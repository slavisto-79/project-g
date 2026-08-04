import type { ExerciseTag, MovementPattern } from "./exerciseCatalog";

// Mirrors the exact values stored by the onboarding questions in App.tsx
// (ids "equipment", "experience", "limitations", "sex") -- not a separate vocabulary.
export type ProgramBuilderProfile = {
  equipment: "gym" | "home-gym" | "minimal" | "bodyweight";
  experience: "beginner" | "novice" | "intermediate" | "advanced";
  limitations: "knee" | "shoulder" | "back" | "none" | "coach-review";
  sex: "male" | "female";
};

type SlotDefinition = {
  pattern: MovementPattern;
  searchKeyword: string;
};

export type SplitDay = "full-body" | "upper" | "lower" | "push" | "pull" | "legs";

// Every keyword below is one we've confirmed actually returns results against the
// real MuscleWiki search endpoint -- stick to this set rather than guessing new
// ones (e.g. "tricep", "shoulder press" returned nothing when tried live).
// A keyword can appear more than once in a template on purpose: buildProgram
// excludes already-picked ids, so a repeated "squat" slot naturally lands on a
// different squat variant instead of duplicating the first pick.
const splitTemplates: Record<SplitDay, SlotDefinition[]> = {
  "full-body": [
    { pattern: "squat", searchKeyword: "squat" },
    { pattern: "hinge", searchKeyword: "deadlift" },
    { pattern: "push", searchKeyword: "press" },
    { pattern: "pull", searchKeyword: "row" },
    { pattern: "lunge", searchKeyword: "lunge" },
    { pattern: "pull", searchKeyword: "curl" },
    { pattern: "push", searchKeyword: "push up" },
    { pattern: "isometric", searchKeyword: "plank" },
  ],
  upper: [
    { pattern: "push", searchKeyword: "press" },
    { pattern: "pull", searchKeyword: "row" },
    { pattern: "push", searchKeyword: "push up" },
    { pattern: "pull", searchKeyword: "curl" },
    { pattern: "pull", searchKeyword: "row" },
    { pattern: "isometric", searchKeyword: "plank" },
  ],
  lower: [
    { pattern: "squat", searchKeyword: "squat" },
    { pattern: "hinge", searchKeyword: "deadlift" },
    { pattern: "lunge", searchKeyword: "lunge" },
    { pattern: "squat", searchKeyword: "squat" },
    { pattern: "isometric", searchKeyword: "plank" },
  ],
  push: [
    { pattern: "push", searchKeyword: "press" },
    { pattern: "push", searchKeyword: "push up" },
    { pattern: "push", searchKeyword: "press" },
    { pattern: "isometric", searchKeyword: "plank" },
  ],
  pull: [
    { pattern: "pull", searchKeyword: "row" },
    { pattern: "pull", searchKeyword: "curl" },
    { pattern: "hinge", searchKeyword: "deadlift" },
    { pattern: "pull", searchKeyword: "row" },
  ],
  legs: [
    { pattern: "squat", searchKeyword: "squat" },
    { pattern: "hinge", searchKeyword: "deadlift" },
    { pattern: "lunge", searchKeyword: "lunge" },
    { pattern: "squat", searchKeyword: "squat" },
    { pattern: "isometric", searchKeyword: "plank" },
  ],
};

const splitDayLabels: Record<SplitDay, string> = {
  "full-body": "Full Body",
  upper: "Upper Body",
  lower: "Lower Body",
  push: "Push Day",
  pull: "Pull Day",
  legs: "Legs Day",
};

// How many exercises a given split day's template actually has -- for UI copy
// like "6 guided exercises" that needs to match reality before the fetch runs.
export function splitDaySlotCount(day: SplitDay): number {
  return splitTemplates[day].length;
}

const dayIdToWeekday: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

// Decides which split day applies "today", based on how many days a week the
// user trains (from onboarding) and, when they've told us which specific
// weekdays, which one today actually is. Falls back to simply rotating
// through the split by total workout count when today isn't one of their
// chosen days (or they never picked any) -- so it still varies session to
// session instead of always serving the same day.
export function determineSplitDay(
  reminderDays: string[],
  completedWorkoutCount: number,
): { day: SplitDay; label: string } {
  const dayCount = reminderDays.length;
  if (dayCount <= 3) return { day: "full-body", label: splitDayLabels["full-body"] };

  const sortedDays = [...reminderDays].sort(
    (a, b) => (dayIdToWeekday[a] ?? 0) - (dayIdToWeekday[b] ?? 0),
  );
  const todayWeekday = new Date().getDay();
  const todayId = Object.keys(dayIdToWeekday).find((id) => dayIdToWeekday[id] === todayWeekday);
  const todayPosition = todayId ? sortedDays.indexOf(todayId) : -1;
  const position = todayPosition >= 0 ? todayPosition : completedWorkoutCount;

  if (dayCount === 4) {
    const day: SplitDay = position % 2 === 0 ? "upper" : "lower";
    return { day, label: splitDayLabels[day] };
  }

  const cycle: SplitDay[] = ["push", "pull", "legs"];
  const day = cycle[position % cycle.length]!;
  return { day, label: splitDayLabels[day] };
}

const equipmentCategory: Record<ProgramBuilderProfile["equipment"], string | undefined> = {
  minimal: "Dumbbells",
  bodyweight: "Bodyweight",
  "home-gym": undefined,
  gym: undefined,
};

function isInjurySafeForProfile(exercise: ExerciseTag, limitations: ProgramBuilderProfile["limitations"]): boolean {
  if (limitations === "knee") return exercise.injurySafe.kneeSafe;
  if (limitations === "shoulder") return exercise.injurySafe.shoulderSafe;
  if (limitations === "back") return exercise.injurySafe.backSafe;
  return true;
}

async function fetchSlotCandidates(slot: SlotDefinition, profile: ProgramBuilderProfile): Promise<ExerciseTag[]> {
  try {
    // /search doesn't take an equipment filter, so fetch by keyword and filter client-side --
    // it returns full exercise data (unlike /exercises browse-by-filter, which is id+name only).
    const params = new URLSearchParams({ search: slot.searchKeyword, limit: "25" });
    const response = await fetch(`/api/exercise-catalog?${params.toString()}`);
    if (!response.ok) return [];
    const body = (await response.json()) as { exercises?: ExerciseTag[] };
    // MuscleWiki's "Recovery" category is stretches/mobility drills, not loaded resistance
    // work -- they have no real weight and don't belong in a sets/reps/kg strength slot.
    const resistanceOnly = (body.exercises ?? []).filter(
      (exercise) => exercise.equipment?.toLowerCase() !== "recovery" && !/stretch/i.test(exercise.name),
    );

    const category = equipmentCategory[profile.equipment];
    if (!category) return resistanceOnly;
    // Bodyweight moves (push-ups, planks) are a reasonable fit regardless of what
    // equipment the user has, so always accept those alongside the chosen equipment.
    return resistanceOnly.filter((exercise) => {
      const exerciseCategory = exercise.equipment?.toLowerCase() ?? "";
      return exerciseCategory === category.toLowerCase() || exerciseCategory === "bodyweight";
    });
  } catch (error) {
    // A single slow/failed request shouldn't sink the whole program -- log it and let
    // this slot come back empty; buildProgram tolerates a few empty slots just fine.
    console.error(`Exercise catalog request failed for "${slot.searchKeyword}"`, error);
    return [];
  }
}

export async function buildProgram(
  profile: ProgramBuilderProfile,
  splitDay: SplitDay = "full-body",
  usedIds: Set<string> = new Set(),
): Promise<ExerciseTag[]> {
  const slots = splitTemplates[splitDay];
  // Fetch all slots in parallel rather than one at a time -- faster, and it shrinks the
  // window in which a single slow request can hold up (or, previously, sink) the rest.
  const candidatesBySlot = await Promise.all(slots.map((slot) => fetchSlotCandidates(slot, profile)));

  const program: ExerciseTag[] = [];
  for (const candidates of candidatesBySlot) {
    const pick = candidates.find(
      (candidate) =>
        !usedIds.has(candidate.id) &&
        candidate.media[profile.sex] !== null &&
        isInjurySafeForProfile(candidate, profile.limitations),
    );
    if (pick) {
      program.push(pick);
      usedIds.add(pick.id);
    }
  }

  return program;
}
