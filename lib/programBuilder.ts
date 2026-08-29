import type { ExerciseTag, MovementPattern } from "./exerciseCatalog";

// Mirrors the exact values stored by the onboarding questions in App.tsx
// (ids "equipment", "experience", "limitations", "sex") -- not a separate vocabulary.
export type ProgramBuilderProfile = {
  equipment: "gym" | "home-gym" | "minimal" | "bodyweight" | "bars";
  experience: "beginner" | "novice" | "intermediate" | "advanced";
  // "other" carries a free-text note instead of a flag. The catalog only
  // models knee/shoulder/back safety, so there is nothing here for free text
  // to filter on -- it is handled after the program is built, by a pass that
  // may only remove exercises.
  // Every limitation the user reported, not just the first. "other" carries a
  // free-text note instead of a flag: the catalog only models knee/shoulder/
  // back safety, so there is nothing here for free text to filter on -- it is
  // handled after the program is built, by a pass that may only remove
  // exercises.
  limitations: ("knee" | "shoulder" | "back" | "none" | "other")[];
  // What the user reported they can already do. Prescribing a pull-up to
  // someone who cannot do one is a wall, not a hard session.
  bodyweightStrength?: "both" | "pushups" | "neither";
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
// The movement patterns a given split day asks for, in order. Exposed so the
// local library can fill the same slot shape the catalog builder does, rather
// than inventing a second idea of what a session looks like.
export function splitDayPatterns(day: SplitDay): MovementPattern[] {
  return splitTemplates[day].map((slot) => slot.pattern);
}

export function splitDaySlotCount(day: SplitDay): number {
  return splitTemplates[day].length;
}

// Decides which split day applies "today", based on how many days a week the
// user trains (from onboarding) and which split types they've actually done
// most recently -- picks whichever muscle group has gone the longest without
// work, instead of a fixed weekday/count rotation. A plain modulo cycle looks
// balanced on paper but isn't: e.g. 5 days/week on a 3-way push/pull/legs
// cycle lands on push and pull twice but legs only once, every single week.
// Tracking real history self-corrects that regardless of skipped days,
// inconsistent schedules, or which day count they're on.
export function determineSplitDay(
  reminderDays: string[],
  recentSplitDays: SplitDay[],
): { day: SplitDay; label: string } {
  const dayCount = reminderDays.length;
  if (dayCount <= 3) return { day: "full-body", label: splitDayLabels["full-body"] };

  const pool: SplitDay[] = dayCount === 4 ? ["upper", "lower"] : ["push", "pull", "legs"];

  // Only look at a recent window (twice the pool size) so an old habit doesn't
  // keep influencing today's pick forever once behavior changes.
  const window = recentSplitDays.slice(0, pool.length * 2);
  const counts = new Map<SplitDay, number>(pool.map((day) => [day, 0]));
  for (const day of window) {
    if (counts.has(day)) counts.set(day, (counts.get(day) ?? 0) + 1);
  }

  let leastTrainedDay = pool[0]!;
  let lowestCount = Infinity;
  for (const day of pool) {
    const count = counts.get(day) ?? 0;
    if (count < lowestCount) {
      lowestCount = count;
      leastTrainedDay = day;
    }
  }
  return { day: leastTrainedDay, label: splitDayLabels[leastTrainedDay] };
}

const equipmentCategory: Record<ProgramBuilderProfile["equipment"], string | undefined> = {
  minimal: "Dumbbells",
  bodyweight: "Bodyweight",
  // Best-effort guess, unlike the categories above -- not yet confirmed against a live
  // MuscleWiki response (the catalog endpoint has been returning errors). If/when it's
  // healthy again, verify this is the actual category string for pull-up/dip-bar
  // exercises and correct it if not; until then this tier leans on the local fallback
  // roster in App.tsx's createWorkout(), which does not depend on this value.
  bars: "Bar",
  "home-gym": undefined,
  gym: undefined,
};

// The hardest exercise tier a given training background should be handed.
// Ranked, so "intermediate" accepts everything up to and including
// intermediate. A beginner has no business being handed a barbell snatch on
// day one just because it matched the movement pattern.
const difficultyRank: Record<ExerciseTag["difficulty"], number> = {
  novice: 0,
  beginner: 1,
  intermediate: 2,
  advanced: 3,
};

const maxDifficultyRank: Record<ProgramBuilderProfile["experience"], number> = {
  beginner: 1,
  novice: 1,
  intermediate: 2,
  advanced: 3,
};

function isDifficultyAppropriate(
  exercise: ExerciseTag,
  experience: ProgramBuilderProfile["experience"],
): boolean {
  return difficultyRank[exercise.difficulty] <= maxDifficultyRank[experience];
}

// Assisted and negative variants are scaffolding towards a movement, not
// lesser versions of it, so which way to filter them depends entirely on
// whether the user can already do the thing.
//
// This replaces a rule that got it wrong in both directions. It dropped every
// pull-up-family name for anyone who could not do one -- deleting the assisted
// and negative variants too, which are the exact progressions that build a
// first pull-up, so those users were given no pull work at all. And it
// exempted anyone who could, so they were offered band-assisted work they had
// no use for.
//
// The old rule also carried two literal backspace bytes where a word boundary
// was meant, from a shell mangling \b on the way in. That made its "dip"
// alternative match only names containing control characters -- which is to
// say, nothing. Dips were never filtered at all.
//
// Exported and shared with the local-library picker in App.tsx: this rule
// existed in both files, and two copies of a rule are two rules waiting to
// disagree.
// Separator and plural both float in catalog names in a way they never do in
// the local library, where the names are ours: "Chin Up", "Chin-Up", "Chinup"
// and "Tricep Dips" all have to land. The library says "Bar Dip" and means it.
const REGRESSION_NAME = /assisted|negative|(?:knee|incline|wall|box) push[- ]?up/i;
const PUSH_UP_FAMILY = /push[- ]?up/i;
const PULL_UP_FAMILY = /pull[- ]?up|chin[- ]?up|muscle[- ]?up|\bdips?\b/i;

export function suitsBodyweightCapability(
  name: string,
  bodyweightStrength: ProgramBuilderProfile["bodyweightStrength"],
): boolean {
  if (!bodyweightStrength) return true;
  const isRegression = REGRESSION_NAME.test(name);
  // Push-ups are tested first so a name matching both families always resolves
  // the same way rather than by which regex happens to be tried first.
  if (PUSH_UP_FAMILY.test(name)) {
    return bodyweightStrength === "neither" ? isRegression : !isRegression;
  }
  if (PULL_UP_FAMILY.test(name)) {
    return bodyweightStrength === "both" ? !isRegression : isRegression;
  }
  return true;
}

// Stays a soft preference here, unlike the hard filter the local library
// applies: a catalog slot is filled from whatever a single keyword search
// returned, so an unsuitable exercise still beats an empty slot.
function isWithinBodyweightStrength(
  exercise: ExerciseTag,
  bodyweightStrength: ProgramBuilderProfile["bodyweightStrength"],
): boolean {
  return suitsBodyweightCapability(exercise.name, bodyweightStrength);
}

// Every reported limitation has to clear, not just one. Someone with a bad
// knee AND a bad shoulder needs an exercise that is safe for both.
function isInjurySafeForProfile(
  exercise: ExerciseTag,
  limitations: ProgramBuilderProfile["limitations"],
): boolean {
  if (limitations.includes("knee") && !exercise.injurySafe.kneeSafe) return false;
  if (limitations.includes("shoulder") && !exercise.injurySafe.shoulderSafe) return false;
  if (limitations.includes("back") && !exercise.injurySafe.backSafe) return false;
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

// A full-body day has eight slots, and firing all eight at once is exactly the
// burst that gets an API to rate-limit you -- which is what took the catalog
// down. Small batches with a breath between them still finish in well under a
// second, and behave like a client the upstream is happy to serve.
//
// Batches run in parallel internally, so a single slow slot delays its own
// batch rather than everything behind it.
const CATALOG_BATCH_SIZE = 3;
const CATALOG_BATCH_PAUSE_MS = 150;

async function fetchInBatches<Item, Result>(
  items: Item[],
  fetchOne: (item: Item) => Promise<Result>,
): Promise<Result[]> {
  const results: Result[] = [];
  for (let index = 0; index < items.length; index += CATALOG_BATCH_SIZE) {
    if (index > 0) await new Promise((resolve) => setTimeout(resolve, CATALOG_BATCH_PAUSE_MS));
    results.push(...(await Promise.all(items.slice(index, index + CATALOG_BATCH_SIZE).map(fetchOne))));
  }
  return results;
}

export async function buildProgram(
  profile: ProgramBuilderProfile,
  splitDay: SplitDay = "full-body",
  usedIds: Set<string> = new Set(),
): Promise<ExerciseTag[]> {
  const slots = splitTemplates[splitDay];
  const candidatesBySlot = await fetchInBatches(slots, (slot) => fetchSlotCandidates(slot, profile));

  const program: ExerciseTag[] = [];
  for (const candidates of candidatesBySlot) {
    const eligible = candidates.filter(
      (candidate) =>
        !usedIds.has(candidate.id) &&
        candidate.media[profile.sex] !== null &&
        isInjurySafeForProfile(candidate, profile.limitations),
    );
    // Difficulty is a strong preference, not a hard filter: if this keyword
    // only returned exercises above the user's level, a too-hard exercise
    // still beats an empty slot, since enough empty slots sink the whole
    // program back to the built-in fallback roster. Injury-safety and media
    // availability stay hard requirements -- those aren't negotiable.
    const pick =
      eligible.find(
        (candidate) =>
          isDifficultyAppropriate(candidate, profile.experience) &&
          isWithinBodyweightStrength(candidate, profile.bodyweightStrength),
      ) ??
      eligible.find((candidate) => isWithinBodyweightStrength(candidate, profile.bodyweightStrength)) ??
      eligible[0];
    if (pick) {
      program.push(pick);
      usedIds.add(pick.id);
    }
  }

  return program;
}
