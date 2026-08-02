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

const programSlots: SlotDefinition[] = [
  { pattern: "squat", searchKeyword: "squat" },
  { pattern: "hinge", searchKeyword: "deadlift" },
  { pattern: "push", searchKeyword: "press" },
  { pattern: "pull", searchKeyword: "row" },
  { pattern: "lunge", searchKeyword: "lunge" },
  { pattern: "pull", searchKeyword: "curl" },
  { pattern: "push", searchKeyword: "push up" },
  { pattern: "isometric", searchKeyword: "plank" },
];

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
}

export async function buildProgram(profile: ProgramBuilderProfile, usedIds: Set<string> = new Set()): Promise<ExerciseTag[]> {
  const program: ExerciseTag[] = [];

  for (const slot of programSlots) {
    const candidates = await fetchSlotCandidates(slot, profile);
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
