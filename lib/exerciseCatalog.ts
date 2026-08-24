export type MuscleWikiVideo = {
  url: string;
  angle: "front" | "side";
  gender: "male" | "female";
  og_image: string;
};

export type MuscleWikiExercise = {
  id: number;
  name: string;
  primary_muscles: string[];
  category: string;
  force: "Push" | "Pull" | "Hold";
  grips: string[];
  mechanic: "Compound" | "Isolation";
  difficulty: "Novice" | "Beginner" | "Intermediate" | "Advanced";
  steps: string[];
  videos: MuscleWikiVideo[];
  bodymap_male: string;
  bodymap_female: string;
};

export type MovementPattern =
  | "squat"
  | "hinge"
  | "push"
  | "pull"
  | "lunge"
  | "carry"
  | "rotation"
  | "isometric";

export type PrimaryMuscle =
  | "quads"
  | "hamstrings"
  | "glutes"
  | "chest"
  | "back"
  | "shoulders"
  | "biceps"
  | "triceps"
  | "core"
  | "calves"
  | "full-body";

export type ExerciseTag = {
  id: string;
  name: string;
  movementPattern: MovementPattern;
  primaryMuscle: PrimaryMuscle;
  equipment: string;
  difficulty: "novice" | "beginner" | "intermediate" | "advanced";
  unilateral: boolean;
  injurySafe: {
    kneeSafe: boolean;
    shoulderSafe: boolean;
    backSafe: boolean;
  };
  media: {
    female: { video: string; poster: string } | null;
    male: { video: string; poster: string } | null;
  };
  formGuideSteps: string[];
  source: { provider: "musclewiki"; externalId: number };
};

const muscleRollup: Record<string, PrimaryMuscle> = {
  Quads: "quads",
  Quadriceps: "quads",
  Hamstrings: "hamstrings",
  "Lateral Hamstrings": "hamstrings",
  Glutes: "glutes",
  "Gluteus Maximus": "glutes",
  "Glute Med": "glutes",
  Chest: "chest",
  "Lower Chest": "chest",
  "Upper Chest": "chest",
  Back: "back",
  Lats: "back",
  "Lower back": "back",
  "Traps (mid-back)": "back",
  "Middle Traps": "back",
  "Lower Traps": "back",
  "Erector Spinae": "back",
  Shoulders: "shoulders",
  "Front Deltoids": "shoulders",
  "Lateral Deltoids": "shoulders",
  "Rear Deltoids": "shoulders",
  Biceps: "biceps",
  Brachioradialis: "biceps",
  Triceps: "triceps",
  Core: "core",
  Abs: "core",
  "Rectus Abdominis": "core",
  Obliques: "core",
  "Lower Abs": "core",
  Calves: "calves",
  "Tibialis Anterior": "calves",
  "Full Body": "full-body",
  Forearms: "biceps",
  "Forearm Flexors": "biceps",
  Adductors: "glutes",
  Abductors: "glutes",
  "Hip Flexors": "quads",
};

function toArray(value: unknown): string[] {
  if (Array.isArray(value)) return value as string[];
  if (typeof value === "string" && value.length > 0) return [value];
  return [];
}

export function rollUpPrimaryMuscle(muscles: unknown): PrimaryMuscle {
  for (const muscle of toArray(muscles)) {
    const rolled = muscleRollup[muscle];
    if (rolled) return rolled;
  }
  return "full-body";
}

export function deriveMovementPattern(exercise: MuscleWikiExercise): MovementPattern {
  const name = exercise.name.toLowerCase();
  const muscle = rollUpPrimaryMuscle(exercise.primary_muscles);

  if (exercise.force === "Hold") return "isometric";
  if (/deadlift|\brdl\b|romanian/.test(name)) return "hinge";
  if (/lunge|split|step[- ]?up|staggered/.test(name)) return "lunge";
  if (/\brow\b/.test(name)) return "pull";
  if (/curl/.test(name)) return "pull";
  if (/carry|farmer/.test(name)) return "carry";
  if (/twist|rotation|woodchop/.test(name)) return "rotation";

  if (exercise.force === "Push" && (muscle === "quads" || muscle === "glutes")) return "squat";
  if (exercise.force === "Push") return "push";
  if (exercise.force === "Pull") return "pull";
  return "push";
}

export function isUnilateral(name: string): boolean {
  // Lunges (and their named variants) are the most common unilateral movement
  // there is -- one leg at a time, so a prescribed rep count means per leg.
  // They were missing here originally, which made every lunge read as if the
  // rep target covered both legs together.
  return /split|single|one[- ]?arm|alternating|staggered|step[- ]?up|lunge|pistol|bulgarian|curtsy/i.test(
    name,
  );
}

export function deriveInjurySafe(exercise: MuscleWikiExercise): ExerciseTag["injurySafe"] {
  const muscle = rollUpPrimaryMuscle(exercise.primary_muscles);
  const isCompound = exercise.mechanic === "Compound";
  return {
    kneeSafe: !(isCompound && exercise.force === "Push" && (muscle === "quads" || muscle === "glutes")),
    shoulderSafe: !(isCompound && (muscle === "shoulders" || muscle === "chest")),
    backSafe: !(isCompound && (muscle === "back")),
  };
}

function safeVideos(videos: unknown): MuscleWikiVideo[] {
  return Array.isArray(videos) ? (videos as MuscleWikiVideo[]) : [];
}

// MuscleWiki's stream URLs require an X-API-Key header, which a plain <video>/<img> src can't
// send -- route them through our own proxy (which holds the key server-side) instead.
function proxied(url: string): string {
  return `/api/video-proxy?url=${encodeURIComponent(url)}`;
}

function buildMediaEntry(
  videos: unknown,
  gender: "male" | "female",
): { video: string; poster: string } | null {
  const genderVideos = safeVideos(videos).filter((video) => video.gender === gender);
  // Side angle shows the exercise's range of motion more clearly than straight-on --
  // fall back to front if this exercise/gender only has a front-angle clip.
  const match =
    genderVideos.find((video) => video.angle === "side") ?? genderVideos.find((video) => video.angle === "front");
  if (!match) return null;
  return { video: proxied(match.url), poster: proxied(match.og_image) };
}

export function hasGenderVideo(exercise: MuscleWikiExercise, gender: "male" | "female"): boolean {
  return safeVideos(exercise.videos).some((video) => video.gender === gender);
}

export function mapExercise(exercise: MuscleWikiExercise): ExerciseTag {
  return {
    id: `musclewiki-${exercise.id}`,
    name: exercise.name,
    movementPattern: deriveMovementPattern(exercise),
    primaryMuscle: rollUpPrimaryMuscle(exercise.primary_muscles),
    equipment: exercise.category,
    difficulty: (exercise.difficulty ?? "intermediate").toLowerCase() as ExerciseTag["difficulty"],
    unilateral: isUnilateral(exercise.name),
    injurySafe: deriveInjurySafe(exercise),
    media: {
      female: buildMediaEntry(exercise.videos, "female"),
      male: buildMediaEntry(exercise.videos, "male"),
    },
    formGuideSteps: toArray(exercise.steps),
    source: { provider: "musclewiki", externalId: exercise.id },
  };
}
