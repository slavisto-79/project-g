import type { ExerciseTag, MovementPattern } from "./exerciseCatalog";

export type ProgramBuilderProfile = {
  equipment: "dumbbell" | "bodyweight" | "gym" | "band";
  experience: "beginner" | "intermediate" | "advanced";
  limitations: "knee" | "shoulder" | "back" | "none";
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
  dumbbell: "Dumbbells",
  bodyweight: "Bodyweight",
  band: "Band",
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
  const params = new URLSearchParams({ search: slot.searchKeyword, limit: "15" });
  const response = await fetch(`/api/exercise-catalog?${params.toString()}`);
  if (!response.ok) return [];
  const body = (await response.json()) as { exercises?: ExerciseTag[] };
  const exercises = body.exercises ?? [];

  const category = equipmentCategory[profile.equipment];
  if (!category) return exercises;
  return exercises.filter((exercise) => exercise.equipment?.toLowerCase() === category.toLowerCase());
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
