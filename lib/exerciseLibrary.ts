import type { MovementPattern, PrimaryMuscle } from "./exerciseCatalog";

// A local exercise library, written rather than fetched.
//
// The MuscleWiki catalog is the richer source when it is reachable, but it has
// been rate-limiting us, and when it fails every user drops to a handful of
// hardcoded movements. This is the floor underneath that: enough exercises,
// with enough metadata, that a sensible programme can be built with no network
// at all.
//
// Every field here exists because some existing filter reads it. Nothing is
// decorative: `pattern` fills split-template slots, `tiers` answers the
// equipment question, `injurySafe` feeds the limitation filters, `difficulty`
// feeds experience matching, `implement` decides which weights are loadable,
// and the bodyweight fields feed the volume maths.
//
// No media yet, by design. `cue` carries the movement in words until demo
// footage exists for these.

export type EquipmentTier = "gym" | "home-gym" | "minimal" | "bodyweight" | "bars";

export type LibraryImplement =
  | "barbell"
  | "dumbbell"
  | "kettlebell"
  | "machine"
  | "cable"
  | "band"
  | "bodyweight"
  | "other";

// Which goals a movement genuinely serves. Left undefined when it suits any of
// them -- most compound lifts do, and pretending otherwise would narrow the
// pool for no reason.
export type TrainingGoal = "strength" | "athletic" | "muscle" | "fat-loss" | "fitness";

export type LibraryExercise = {
  name: string;
  pattern: MovementPattern;
  primaryMuscle: PrimaryMuscle;
  tiers: EquipmentTier[];
  implement: LibraryImplement;
  difficulty: "novice" | "beginner" | "intermediate" | "advanced";
  // Worked one side at a time, so a prescribed rep count is per side.
  unilateral?: boolean;
  // Prescribed in seconds rather than repetitions.
  isHold?: boolean;
  // Held in each hand, so a prescribed weight is per hand.
  perHand?: boolean;
  goals?: TrainingGoal[];
  injurySafe: { kneeSafe: boolean; shoulderSafe: boolean; backSafe: boolean };
  // Starting load for a 70kg reference trainee, before experience, age,
  // recency and bodyweight scaling. Omitted for unloaded movements.
  startingKg?: number;
  // Share of bodyweight moved, for unloaded movements. See
  // BODYWEIGHT_LOAD_FRACTION in App.tsx for the reasoning behind these.
  bodyweightFraction?: number;
  cue: string;
};

const ALL_TIERS: EquipmentTier[] = ["gym", "home-gym", "minimal", "bodyweight", "bars"];
const FREE_WEIGHT: EquipmentTier[] = ["gym", "home-gym"];
const DUMBBELL_TIERS: EquipmentTier[] = ["gym", "home-gym", "minimal"];
const UNLOADED: EquipmentTier[] = ["gym", "home-gym", "minimal", "bodyweight", "bars"];
const BAR_TIERS: EquipmentTier[] = ["gym", "home-gym", "bars"];
const GYM_ONLY: EquipmentTier[] = ["gym"];

const SAFE_ALL = { kneeSafe: true, shoulderSafe: true, backSafe: true };
const KNEE_HEAVY = { kneeSafe: false, shoulderSafe: true, backSafe: true };
const BACK_HEAVY = { kneeSafe: true, shoulderSafe: true, backSafe: false };
const SHOULDER_HEAVY = { kneeSafe: true, shoulderSafe: false, backSafe: true };
const KNEE_AND_BACK = { kneeSafe: false, shoulderSafe: true, backSafe: false };

export const exerciseLibrary: LibraryExercise[] = [
  // --- SQUAT ---------------------------------------------------------------
  { name: "Barbell Back Squat", pattern: "squat", primaryMuscle: "quads", tiers: FREE_WEIGHT, implement: "barbell", difficulty: "intermediate", injurySafe: KNEE_AND_BACK, startingKg: 40, cue: "Bar on the upper back, sit between the hips, drive through the whole foot." },
  { name: "Barbell Front Squat", pattern: "squat", primaryMuscle: "quads", tiers: FREE_WEIGHT, implement: "barbell", difficulty: "advanced", injurySafe: KNEE_AND_BACK, startingKg: 30, cue: "Bar racked on the front delts, elbows high, torso vertical throughout." },
  { name: "Goblet Squat", pattern: "squat", primaryMuscle: "quads", tiers: DUMBBELL_TIERS, implement: "dumbbell", difficulty: "novice", injurySafe: KNEE_HEAVY, startingKg: 14, cue: "One bell held at the chest, elbows inside the knees at the bottom." },
  { name: "Heels-Elevated Goblet Squat", pattern: "squat", primaryMuscle: "quads", tiers: DUMBBELL_TIERS, implement: "dumbbell", difficulty: "novice", injurySafe: KNEE_HEAVY, startingKg: 12, cue: "Heels on a small plate, which lets the knees travel and the torso stay tall." },
  { name: "Dumbbell Front Squat", pattern: "squat", primaryMuscle: "quads", tiers: DUMBBELL_TIERS, implement: "dumbbell", difficulty: "beginner", perHand: true, injurySafe: KNEE_HEAVY, startingKg: 12, cue: "A dumbbell resting on each shoulder, elbows forward." },
  { name: "Box Squat", pattern: "squat", primaryMuscle: "quads", tiers: FREE_WEIGHT, implement: "barbell", difficulty: "beginner", injurySafe: BACK_HEAVY, startingKg: 35, cue: "Sit back to a box, pause, then stand without rocking forward." },
  { name: "Bodyweight Squat", pattern: "squat", primaryMuscle: "quads", tiers: ALL_TIERS, implement: "bodyweight", difficulty: "novice", injurySafe: KNEE_HEAVY, bodyweightFraction: 0.8, cue: "Feet just outside hip width, sit down between the hips, chest tall." },
  { name: "Bulgarian Split Squat", pattern: "squat", primaryMuscle: "quads", tiers: ALL_TIERS, implement: "bodyweight", difficulty: "intermediate", unilateral: true, injurySafe: KNEE_HEAVY, bodyweightFraction: 0.85, cue: "Rear foot raised behind you, drop straight down over the front leg." },
  { name: "Dumbbell Bulgarian Split Squat", pattern: "squat", primaryMuscle: "quads", tiers: DUMBBELL_TIERS, implement: "dumbbell", difficulty: "advanced", unilateral: true, perHand: true, injurySafe: KNEE_HEAVY, startingKg: 8, cue: "Same as bodyweight, holding a dumbbell in each hand." },
  { name: "Split Squat", pattern: "squat", primaryMuscle: "quads", tiers: ALL_TIERS, implement: "bodyweight", difficulty: "beginner", unilateral: true, injurySafe: KNEE_HEAVY, bodyweightFraction: 0.85, cue: "Feet split front and back, both on the floor, drop the back knee." },
  { name: "Cossack Squat", pattern: "squat", primaryMuscle: "quads", tiers: ALL_TIERS, implement: "bodyweight", difficulty: "intermediate", unilateral: true, injurySafe: KNEE_HEAVY, bodyweightFraction: 0.8, cue: "Wide stance, sit into one hip while the other leg straightens." },
  { name: "Pistol Squat", pattern: "squat", primaryMuscle: "quads", tiers: ["bodyweight", "bars", "gym", "home-gym"], implement: "bodyweight", difficulty: "advanced", unilateral: true, injurySafe: KNEE_HEAVY, bodyweightFraction: 0.9, cue: "One leg out in front, squat all the way down on the other." },
  { name: "Leg Press", pattern: "squat", primaryMuscle: "quads", tiers: GYM_ONLY, implement: "machine", difficulty: "novice", injurySafe: KNEE_HEAVY, startingKg: 60, cue: "Push the platform away without letting the lower back round off the pad." },
  { name: "Hack Squat", pattern: "squat", primaryMuscle: "quads", tiers: GYM_ONLY, implement: "machine", difficulty: "beginner", injurySafe: KNEE_HEAVY, startingKg: 40, cue: "Back flat on the pad, drive through the whole foot." },
  { name: "Smith Machine Squat", pattern: "squat", primaryMuscle: "quads", tiers: GYM_ONLY, implement: "machine", difficulty: "novice", injurySafe: KNEE_HEAVY, startingKg: 30, cue: "Fixed bar path, so you can focus on depth rather than balance." },
  { name: "Leg Extension", pattern: "squat", primaryMuscle: "quads", tiers: GYM_ONLY, implement: "machine", difficulty: "novice", injurySafe: KNEE_HEAVY, startingKg: 20, cue: "Straighten the knees against the pad, squeeze at the top." },
  { name: "Wall Sit", pattern: "isometric", primaryMuscle: "quads", tiers: ALL_TIERS, implement: "bodyweight", difficulty: "novice", isHold: true, injurySafe: KNEE_HEAVY, bodyweightFraction: 0.75, cue: "Back flat on a wall, thighs parallel, hold." },

  // --- HINGE ---------------------------------------------------------------
  { name: "Conventional Deadlift", pattern: "hinge", primaryMuscle: "hamstrings", tiers: FREE_WEIGHT, implement: "barbell", difficulty: "advanced", injurySafe: BACK_HEAVY, startingKg: 50, cue: "Bar over mid-foot, push the floor away, keep the bar against the legs." },
  { name: "Sumo Deadlift", pattern: "hinge", primaryMuscle: "glutes", tiers: FREE_WEIGHT, implement: "barbell", difficulty: "advanced", injurySafe: BACK_HEAVY, startingKg: 50, cue: "Wide stance, hands inside the knees, more leg drive and less hinge." },
  { name: "Trap Bar Deadlift", pattern: "hinge", primaryMuscle: "hamstrings", tiers: GYM_ONLY, implement: "barbell", difficulty: "intermediate", injurySafe: BACK_HEAVY, startingKg: 50, cue: "Standing inside the bar, which keeps the load closer to your centre." },
  { name: "Romanian Deadlift", pattern: "hinge", primaryMuscle: "hamstrings", tiers: FREE_WEIGHT, implement: "barbell", difficulty: "intermediate", injurySafe: BACK_HEAVY, startingKg: 35, cue: "Soft knees, push the hips back, feel the hamstrings before you stop." },
  { name: "Dumbbell Romanian Deadlift", pattern: "hinge", primaryMuscle: "hamstrings", tiers: DUMBBELL_TIERS, implement: "dumbbell", difficulty: "beginner", perHand: true, injurySafe: BACK_HEAVY, startingKg: 10, cue: "Dumbbells close to the thighs the whole way down." },
  { name: "Single-Leg Romanian Deadlift", pattern: "hinge", primaryMuscle: "hamstrings", tiers: DUMBBELL_TIERS, implement: "dumbbell", difficulty: "advanced", unilateral: true, perHand: true, injurySafe: BACK_HEAVY, startingKg: 6, cue: "Hinge over one leg, the other extending behind as a counterweight." },
  { name: "Stiff-Leg Deadlift", pattern: "hinge", primaryMuscle: "hamstrings", tiers: FREE_WEIGHT, implement: "barbell", difficulty: "advanced", injurySafe: BACK_HEAVY, startingKg: 30, cue: "Knees nearly locked, a longer hamstring stretch than an RDL." },
  { name: "Rack Pull", pattern: "hinge", primaryMuscle: "back", tiers: FREE_WEIGHT, implement: "barbell", difficulty: "intermediate", injurySafe: BACK_HEAVY, startingKg: 60, cue: "Deadlift from knee height, shortening the range and loading the top." },
  { name: "Good Morning", pattern: "hinge", primaryMuscle: "hamstrings", tiers: FREE_WEIGHT, implement: "barbell", difficulty: "advanced", injurySafe: BACK_HEAVY, startingKg: 20, cue: "Bar on the back, hinge forward with a flat spine, stand tall again." },
  { name: "Barbell Hip Thrust", pattern: "hinge", primaryMuscle: "glutes", tiers: FREE_WEIGHT, implement: "barbell", difficulty: "beginner", injurySafe: SAFE_ALL, startingKg: 30, cue: "Shoulders on a bench, drive the hips up, ribs down at the top." },
  { name: "Glute Bridge", pattern: "hinge", primaryMuscle: "glutes", tiers: ALL_TIERS, implement: "bodyweight", difficulty: "novice", injurySafe: SAFE_ALL, bodyweightFraction: 0.4, cue: "Shoulders and feet on the floor, lift the hips, squeeze at the top." },
  { name: "Single-Leg Glute Bridge", pattern: "hinge", primaryMuscle: "glutes", tiers: ALL_TIERS, implement: "bodyweight", difficulty: "beginner", unilateral: true, injurySafe: SAFE_ALL, bodyweightFraction: 0.45, cue: "One foot down, the other knee pulled in, lift with the working glute." },
  { name: "Kettlebell Swing", pattern: "hinge", primaryMuscle: "glutes", tiers: ["gym", "home-gym", "minimal"], implement: "kettlebell", difficulty: "intermediate", goals: ["athletic", "fat-loss", "fitness"], injurySafe: BACK_HEAVY, startingKg: 16, cue: "A hinge, not a squat. The arms are rope; the hips throw the bell." },
  { name: "Cable Pull-Through", pattern: "hinge", primaryMuscle: "glutes", tiers: GYM_ONLY, implement: "cable", difficulty: "novice", injurySafe: SAFE_ALL, startingKg: 20, cue: "Face away from the stack, hinge back, stand and squeeze the glutes." },
  { name: "Back Extension", pattern: "hinge", primaryMuscle: "hamstrings", tiers: GYM_ONLY, implement: "machine", difficulty: "novice", injurySafe: BACK_HEAVY, bodyweightFraction: 0.45, cue: "Hinge over the pad and return to a straight line, no further." },
  { name: "Nordic Hamstring Curl", pattern: "hinge", primaryMuscle: "hamstrings", tiers: ALL_TIERS, implement: "bodyweight", difficulty: "advanced", goals: ["athletic", "strength"], injurySafe: SAFE_ALL, bodyweightFraction: 0.6, cue: "Ankles anchored, lower your torso forward as slowly as you can." },
  { name: "Lying Leg Curl", pattern: "hinge", primaryMuscle: "hamstrings", tiers: GYM_ONLY, implement: "machine", difficulty: "novice", injurySafe: SAFE_ALL, startingKg: 20, cue: "Curl the heels toward the glutes without the hips lifting." },
  // Unloaded hinging, so the bodyweight and bar tiers can train the pattern
  // rather than skipping it for want of a barbell.
  { name: "Bodyweight Good Morning", pattern: "hinge", primaryMuscle: "hamstrings", tiers: ALL_TIERS, implement: "bodyweight", difficulty: "novice", injurySafe: SAFE_ALL, bodyweightFraction: 0.45, cue: "Hands behind the head, hinge forward with a flat back, stand tall." },
  { name: "Single-Leg Deadlift", pattern: "hinge", primaryMuscle: "hamstrings", tiers: ALL_TIERS, implement: "bodyweight", difficulty: "beginner", unilateral: true, injurySafe: SAFE_ALL, bodyweightFraction: 0.6, cue: "Hinge over one leg with the other extending behind, hips square." },
  { name: "Hip Hinge Wall Touch", pattern: "hinge", primaryMuscle: "glutes", tiers: ALL_TIERS, implement: "bodyweight", difficulty: "novice", injurySafe: SAFE_ALL, bodyweightFraction: 0.4, cue: "Stand a foot from a wall, push the hips back to touch it. Teaches the hinge." },
  { name: "Frog Pump", pattern: "hinge", primaryMuscle: "glutes", tiers: ALL_TIERS, implement: "bodyweight", difficulty: "novice", injurySafe: SAFE_ALL, bodyweightFraction: 0.4, cue: "Soles of the feet together, knees wide, pulse the hips up." },
  { name: "Seated Leg Curl", pattern: "hinge", primaryMuscle: "hamstrings", tiers: GYM_ONLY, implement: "machine", difficulty: "novice", injurySafe: SAFE_ALL, startingKg: 25, cue: "Same curl, seated, which biases the lower hamstring." },

  // --- HORIZONTAL PUSH -----------------------------------------------------
  { name: "Barbell Bench Press", pattern: "push", primaryMuscle: "chest", tiers: FREE_WEIGHT, implement: "barbell", difficulty: "intermediate", injurySafe: SHOULDER_HEAVY, startingKg: 40, cue: "Shoulder blades pinned, bar to the lower chest, drive it back over the eyes." },
  { name: "Incline Barbell Bench Press", pattern: "push", primaryMuscle: "chest", tiers: FREE_WEIGHT, implement: "barbell", difficulty: "intermediate", injurySafe: SHOULDER_HEAVY, startingKg: 30, cue: "Bench at about 30 degrees, bar to the upper chest." },
  { name: "Dumbbell Bench Press", pattern: "push", primaryMuscle: "chest", tiers: DUMBBELL_TIERS, implement: "dumbbell", difficulty: "beginner", perHand: true, injurySafe: SHOULDER_HEAVY, startingKg: 14, cue: "Lower until the elbows are level with the torso, press without clashing." },
  { name: "Incline Dumbbell Press", pattern: "push", primaryMuscle: "chest", tiers: DUMBBELL_TIERS, implement: "dumbbell", difficulty: "beginner", perHand: true, injurySafe: SHOULDER_HEAVY, startingKg: 10, cue: "Incline bench, same press, more upper chest." },
  { name: "Neutral-Grip Dumbbell Press", pattern: "push", primaryMuscle: "chest", tiers: DUMBBELL_TIERS, implement: "dumbbell", difficulty: "novice", perHand: true, injurySafe: SAFE_ALL, startingKg: 12, cue: "Palms facing each other, which is kinder to an unhappy shoulder." },
  { name: "Dumbbell Floor Press", pattern: "push", primaryMuscle: "chest", tiers: DUMBBELL_TIERS, implement: "dumbbell", difficulty: "novice", perHand: true, injurySafe: SAFE_ALL, startingKg: 12, cue: "Lying on the floor, so the elbows cannot travel past the torso." },
  { name: "Push-Up", pattern: "push", primaryMuscle: "chest", tiers: ALL_TIERS, implement: "bodyweight", difficulty: "novice", injurySafe: SAFE_ALL, bodyweightFraction: 0.64, cue: "One straight line from head to heels, chest to the floor." },
  { name: "Knee Push-Up", pattern: "push", primaryMuscle: "chest", tiers: ALL_TIERS, implement: "bodyweight", difficulty: "novice", injurySafe: SAFE_ALL, bodyweightFraction: 0.49, cue: "Same shape from the knees, building toward the full version." },
  { name: "Incline Push-Up", pattern: "push", primaryMuscle: "chest", tiers: ALL_TIERS, implement: "bodyweight", difficulty: "novice", injurySafe: SAFE_ALL, bodyweightFraction: 0.45, cue: "Hands raised on a bench or step, easier the higher you go." },
  { name: "Decline Push-Up", pattern: "push", primaryMuscle: "chest", tiers: ALL_TIERS, implement: "bodyweight", difficulty: "intermediate", injurySafe: SHOULDER_HEAVY, bodyweightFraction: 0.75, cue: "Feet raised, which shifts load onto the upper chest and shoulders." },
  { name: "Diamond Push-Up", pattern: "push", primaryMuscle: "triceps", tiers: ALL_TIERS, implement: "bodyweight", difficulty: "intermediate", injurySafe: SAFE_ALL, bodyweightFraction: 0.64, cue: "Hands together under the chest, elbows tight to the ribs." },
  { name: "Archer Push-Up", pattern: "push", primaryMuscle: "chest", tiers: ALL_TIERS, implement: "bodyweight", difficulty: "advanced", unilateral: true, injurySafe: SHOULDER_HEAVY, bodyweightFraction: 0.8, cue: "Wide hands, lower toward one hand while the other arm straightens." },
  { name: "Machine Chest Press", pattern: "push", primaryMuscle: "chest", tiers: GYM_ONLY, implement: "machine", difficulty: "novice", injurySafe: SAFE_ALL, startingKg: 25, cue: "Fixed path, so you can push hard without managing balance." },
  { name: "Cable Chest Fly", pattern: "push", primaryMuscle: "chest", tiers: GYM_ONLY, implement: "cable", difficulty: "beginner", perHand: true, injurySafe: SHOULDER_HEAVY, startingKg: 10, cue: "Soft elbows held fixed, bring the hands together in front of the chest." },
  { name: "Dumbbell Fly", pattern: "push", primaryMuscle: "chest", tiers: DUMBBELL_TIERS, implement: "dumbbell", difficulty: "intermediate", perHand: true, injurySafe: SHOULDER_HEAVY, startingKg: 8, cue: "Wide arc with fixed elbows, stopping level with the torso." },
  { name: "Pec Deck", pattern: "push", primaryMuscle: "chest", tiers: GYM_ONLY, implement: "machine", difficulty: "novice", injurySafe: SHOULDER_HEAVY, startingKg: 20, cue: "Forearms on the pads, squeeze them together." },
  { name: "Band Chest Press", pattern: "push", primaryMuscle: "chest", tiers: ["minimal"], implement: "band", difficulty: "novice", injurySafe: SAFE_ALL, cue: "Band anchored behind you, press forward and control the return." },
  { name: "Plyo Push-Up", pattern: "push", primaryMuscle: "chest", tiers: ALL_TIERS, implement: "bodyweight", difficulty: "advanced", goals: ["athletic"], injurySafe: SHOULDER_HEAVY, bodyweightFraction: 0.7, cue: "Push hard enough that the hands leave the floor, land soft." },

  // --- VERTICAL PUSH -------------------------------------------------------
  { name: "Barbell Overhead Press", pattern: "push", primaryMuscle: "shoulders", tiers: FREE_WEIGHT, implement: "barbell", difficulty: "intermediate", injurySafe: SHOULDER_HEAVY, startingKg: 25, cue: "Bar from the front rack to overhead, ribs down, head through at the top." },
  { name: "Push Press", pattern: "push", primaryMuscle: "shoulders", tiers: FREE_WEIGHT, implement: "barbell", difficulty: "advanced", goals: ["athletic", "strength"], injurySafe: SHOULDER_HEAVY, startingKg: 30, cue: "A short dip and leg drive to start the bar, then press it home." },
  { name: "Dumbbell Shoulder Press", pattern: "push", primaryMuscle: "shoulders", tiers: DUMBBELL_TIERS, implement: "dumbbell", difficulty: "beginner", perHand: true, injurySafe: SHOULDER_HEAVY, startingKg: 10, cue: "Press from shoulder height to overhead without arching the lower back." },
  { name: "Seated Dumbbell Press", pattern: "push", primaryMuscle: "shoulders", tiers: DUMBBELL_TIERS, implement: "dumbbell", difficulty: "novice", perHand: true, injurySafe: SHOULDER_HEAVY, startingKg: 10, cue: "Back supported, which takes the lower back out of it." },
  { name: "Arnold Press", pattern: "push", primaryMuscle: "shoulders", tiers: DUMBBELL_TIERS, implement: "dumbbell", difficulty: "intermediate", perHand: true, injurySafe: SHOULDER_HEAVY, startingKg: 8, cue: "Start palms-in, rotate out as you press." },
  { name: "Landmine Press", pattern: "push", primaryMuscle: "shoulders", tiers: ["gym", "home-gym"], implement: "barbell", difficulty: "beginner", unilateral: true, injurySafe: SAFE_ALL, startingKg: 15, cue: "Press one end of the bar at an angle, which spares an unhappy shoulder." },
  { name: "Machine Shoulder Press", pattern: "push", primaryMuscle: "shoulders", tiers: GYM_ONLY, implement: "machine", difficulty: "novice", injurySafe: SHOULDER_HEAVY, startingKg: 20, cue: "Fixed path overhead press." },
  { name: "Pike Push-Up", pattern: "push", primaryMuscle: "shoulders", tiers: ALL_TIERS, implement: "bodyweight", difficulty: "intermediate", injurySafe: SHOULDER_HEAVY, bodyweightFraction: 0.7, cue: "Hips high, head travelling to the floor between the hands." },
  { name: "Handstand Push-Up", pattern: "push", primaryMuscle: "shoulders", tiers: ["bodyweight", "bars", "gym"], implement: "bodyweight", difficulty: "advanced", injurySafe: SHOULDER_HEAVY, bodyweightFraction: 0.95, cue: "Inverted against a wall, lower the head to the floor and press up." },
  { name: "Dumbbell Lateral Raise", pattern: "push", primaryMuscle: "shoulders", tiers: DUMBBELL_TIERS, implement: "dumbbell", difficulty: "novice", perHand: true, injurySafe: SHOULDER_HEAVY, startingKg: 5, cue: "Lead with the elbows out to the side, stop at shoulder height." },
  { name: "Cable Lateral Raise", pattern: "push", primaryMuscle: "shoulders", tiers: GYM_ONLY, implement: "cable", difficulty: "beginner", unilateral: true, injurySafe: SHOULDER_HEAVY, startingKg: 5, cue: "One arm at a time, constant tension through the whole range." },
  { name: "Dumbbell Front Raise", pattern: "push", primaryMuscle: "shoulders", tiers: DUMBBELL_TIERS, implement: "dumbbell", difficulty: "novice", perHand: true, injurySafe: SHOULDER_HEAVY, startingKg: 5, cue: "Raise to shoulder height in front, no swing." },
  { name: "Band Overhead Press", pattern: "push", primaryMuscle: "shoulders", tiers: ["minimal"], implement: "band", difficulty: "novice", injurySafe: SHOULDER_HEAVY, cue: "Stand on the band, press overhead against increasing tension." },

  // --- VERTICAL PULL -------------------------------------------------------
  { name: "Pull-Up", pattern: "pull", primaryMuscle: "back", tiers: BAR_TIERS, implement: "bodyweight", difficulty: "advanced", injurySafe: SHOULDER_HEAVY, bodyweightFraction: 1, cue: "Overhand grip, pull the chest toward the bar, lower under control." },
  { name: "Chin-Up", pattern: "pull", primaryMuscle: "back", tiers: BAR_TIERS, implement: "bodyweight", difficulty: "intermediate", injurySafe: SAFE_ALL, bodyweightFraction: 1, cue: "Underhand grip, which brings the biceps in and is usually easier." },
  { name: "Band-Assisted Pull-Up", pattern: "pull", primaryMuscle: "back", tiers: BAR_TIERS, implement: "band", difficulty: "beginner", injurySafe: SAFE_ALL, bodyweightFraction: 0.6, cue: "A band under the foot carries part of you, so the pattern can be trained." },
  { name: "Negative Pull-Up", pattern: "pull", primaryMuscle: "back", tiers: BAR_TIERS, implement: "bodyweight", difficulty: "beginner", injurySafe: SAFE_ALL, bodyweightFraction: 0.8, cue: "Jump to the top and lower as slowly as you can. The way in to a first pull-up." },
  { name: "Lat Pulldown", pattern: "pull", primaryMuscle: "back", tiers: GYM_ONLY, implement: "machine", difficulty: "novice", injurySafe: SAFE_ALL, startingKg: 30, cue: "Pull the bar to the collarbone, elbows down rather than back." },
  { name: "Neutral-Grip Pulldown", pattern: "pull", primaryMuscle: "back", tiers: GYM_ONLY, implement: "machine", difficulty: "novice", injurySafe: SAFE_ALL, startingKg: 30, cue: "Palms facing each other, kinder on the shoulder than a wide grip." },
  { name: "Straight-Arm Pulldown", pattern: "pull", primaryMuscle: "back", tiers: GYM_ONLY, implement: "cable", difficulty: "beginner", injurySafe: SAFE_ALL, startingKg: 15, cue: "Arms locked straight, sweep the bar down to the thighs." },

  // --- HORIZONTAL PULL -----------------------------------------------------
  { name: "Barbell Row", pattern: "pull", primaryMuscle: "back", tiers: FREE_WEIGHT, implement: "barbell", difficulty: "intermediate", injurySafe: BACK_HEAVY, startingKg: 30, cue: "Hinged over, bar to the navel, no jerking with the lower back." },
  { name: "Pendlay Row", pattern: "pull", primaryMuscle: "back", tiers: FREE_WEIGHT, implement: "barbell", difficulty: "advanced", goals: ["strength", "athletic"], injurySafe: BACK_HEAVY, startingKg: 30, cue: "Each rep starts from the floor, torso parallel throughout." },
  { name: "One-Arm Dumbbell Row", pattern: "pull", primaryMuscle: "back", tiers: DUMBBELL_TIERS, implement: "dumbbell", difficulty: "novice", unilateral: true, perHand: true, injurySafe: SAFE_ALL, startingKg: 12, cue: "One hand on a bench, row the dumbbell to the hip." },
  { name: "Chest-Supported Row", pattern: "pull", primaryMuscle: "back", tiers: ["gym", "home-gym"], implement: "dumbbell", difficulty: "novice", perHand: true, injurySafe: SAFE_ALL, startingKg: 10, cue: "Face down on an incline bench, which takes the lower back out entirely." },
  { name: "Seated Cable Row", pattern: "pull", primaryMuscle: "back", tiers: GYM_ONLY, implement: "cable", difficulty: "novice", injurySafe: SAFE_ALL, startingKg: 30, cue: "Sit tall, pull to the stomach, let the shoulder blades travel." },
  { name: "T-Bar Row", pattern: "pull", primaryMuscle: "back", tiers: GYM_ONLY, implement: "machine", difficulty: "beginner", injurySafe: BACK_HEAVY, startingKg: 25, cue: "Chest on the pad where available, row to the ribs." },
  { name: "Inverted Row", pattern: "pull", primaryMuscle: "back", tiers: ["gym", "home-gym", "bars"], implement: "bodyweight", difficulty: "beginner", injurySafe: SAFE_ALL, bodyweightFraction: 0.6, cue: "Under a fixed bar, body straight, pull the chest to the bar." },
  { name: "Band Row", pattern: "pull", primaryMuscle: "back", tiers: ["minimal"], implement: "band", difficulty: "novice", injurySafe: SAFE_ALL, cue: "Band anchored in front, row the handles to the ribs." },
  { name: "Face Pull", pattern: "pull", primaryMuscle: "shoulders", tiers: ["gym", "minimal"], implement: "cable", difficulty: "novice", injurySafe: SAFE_ALL, startingKg: 15, cue: "Pull to the face with high elbows. The one everybody skips and shouldn't." },
  // Equipment-free pulling. Without these a bodyweight-only trainee gets no
  // back work whatsoever, which is a hole in the programme rather than a
  // limitation of the tier -- every one of these needs a floor or a door.
  { name: "Towel Row", pattern: "pull", primaryMuscle: "back", tiers: ["bodyweight", "minimal", "bars"], implement: "bodyweight", difficulty: "novice", injurySafe: SAFE_ALL, bodyweightFraction: 0.5, cue: "Towel round a door handle, lean back on straight arms and row yourself up." },
  { name: "Doorway Row", pattern: "pull", primaryMuscle: "back", tiers: ["bodyweight", "bars"], implement: "bodyweight", difficulty: "novice", unilateral: true, injurySafe: SAFE_ALL, bodyweightFraction: 0.45, cue: "Grip a door frame, lean back with the feet close in, pull yourself upright." },
  { name: "Prone Y-T-W Raise", pattern: "pull", primaryMuscle: "shoulders", tiers: ALL_TIERS, implement: "bodyweight", difficulty: "novice", injurySafe: SAFE_ALL, bodyweightFraction: 0.15, cue: "Face down, lift the arms in a Y, then a T, then a W. Small range, real work." },
  { name: "Superman", pattern: "pull", primaryMuscle: "back", tiers: ALL_TIERS, implement: "bodyweight", difficulty: "novice", injurySafe: SAFE_ALL, bodyweightFraction: 0.25, cue: "Face down, lift the chest and thighs off the floor together." },
  { name: "Reverse Snow Angel", pattern: "pull", primaryMuscle: "shoulders", tiers: ALL_TIERS, implement: "bodyweight", difficulty: "novice", injurySafe: SAFE_ALL, bodyweightFraction: 0.15, cue: "Face down, arms sweeping from the hips to overhead without touching down." },
  { name: "Dumbbell Reverse Fly", pattern: "pull", primaryMuscle: "shoulders", tiers: DUMBBELL_TIERS, implement: "dumbbell", difficulty: "novice", perHand: true, injurySafe: SAFE_ALL, startingKg: 5, cue: "Hinged over, sweep the arms out and back with soft elbows." },

  // --- ARMS ----------------------------------------------------------------
  { name: "Barbell Curl", pattern: "pull", primaryMuscle: "biceps", tiers: FREE_WEIGHT, implement: "barbell", difficulty: "novice", injurySafe: SAFE_ALL, startingKg: 15, cue: "Elbows pinned to the ribs, no swinging from the hips." },
  { name: "Dumbbell Biceps Curl", pattern: "pull", primaryMuscle: "biceps", tiers: DUMBBELL_TIERS, implement: "dumbbell", difficulty: "novice", perHand: true, injurySafe: SAFE_ALL, startingKg: 8, cue: "Curl and lower slowly; the lowering is where most of the work is." },
  { name: "Hammer Curl", pattern: "pull", primaryMuscle: "biceps", tiers: DUMBBELL_TIERS, implement: "dumbbell", difficulty: "novice", perHand: true, injurySafe: SAFE_ALL, startingKg: 8, cue: "Palms facing each other throughout, which brings in the forearm." },
  { name: "Incline Dumbbell Curl", pattern: "pull", primaryMuscle: "biceps", tiers: DUMBBELL_TIERS, implement: "dumbbell", difficulty: "beginner", perHand: true, injurySafe: SAFE_ALL, startingKg: 6, cue: "Lying back on an incline, arms hanging behind the torso." },
  { name: "Preacher Curl", pattern: "pull", primaryMuscle: "biceps", tiers: ["gym", "home-gym"], implement: "barbell", difficulty: "beginner", injurySafe: SAFE_ALL, startingKg: 12, cue: "Upper arms on the pad, no cheating from the shoulder." },
  { name: "Cable Curl", pattern: "pull", primaryMuscle: "biceps", tiers: GYM_ONLY, implement: "cable", difficulty: "novice", injurySafe: SAFE_ALL, startingKg: 15, cue: "Constant tension top to bottom." },
  { name: "Concentration Curl", pattern: "pull", primaryMuscle: "biceps", tiers: DUMBBELL_TIERS, implement: "dumbbell", difficulty: "novice", unilateral: true, perHand: true, injurySafe: SAFE_ALL, startingKg: 6, cue: "Seated, elbow braced on the inner thigh." },
  { name: "Band Curl", pattern: "pull", primaryMuscle: "biceps", tiers: ["minimal"], implement: "band", difficulty: "novice", injurySafe: SAFE_ALL, cue: "Stand on the band, curl against tension that grows near the top." },
  { name: "Triceps Pushdown", pattern: "push", primaryMuscle: "triceps", tiers: GYM_ONLY, implement: "cable", difficulty: "novice", injurySafe: SAFE_ALL, startingKg: 20, cue: "Elbows fixed at the ribs, straighten the arms fully." },
  { name: "Overhead Triceps Extension", pattern: "push", primaryMuscle: "triceps", tiers: DUMBBELL_TIERS, implement: "dumbbell", difficulty: "beginner", injurySafe: SHOULDER_HEAVY, startingKg: 10, cue: "One bell behind the head, elbows pointing forward." },
  { name: "Skull Crusher", pattern: "push", primaryMuscle: "triceps", tiers: FREE_WEIGHT, implement: "barbell", difficulty: "intermediate", injurySafe: SAFE_ALL, startingKg: 15, cue: "Lying down, lower to the forehead, straighten without moving the elbows." },
  { name: "Close-Grip Bench Press", pattern: "push", primaryMuscle: "triceps", tiers: FREE_WEIGHT, implement: "barbell", difficulty: "intermediate", injurySafe: SAFE_ALL, startingKg: 30, cue: "Hands shoulder width, elbows tucked, chest to lockout." },
  { name: "Bench Dip", pattern: "push", primaryMuscle: "triceps", tiers: ALL_TIERS, implement: "bodyweight", difficulty: "novice", injurySafe: SHOULDER_HEAVY, bodyweightFraction: 0.5, cue: "Hands on a bench behind you, feet out, lower and press up." },
  { name: "Bar Dip", pattern: "push", primaryMuscle: "triceps", tiers: BAR_TIERS, implement: "bodyweight", difficulty: "advanced", injurySafe: SHOULDER_HEAVY, bodyweightFraction: 1, cue: "On parallel bars, lower until the elbows are square, press back up." },
  { name: "Triceps Kickback", pattern: "push", primaryMuscle: "triceps", tiers: DUMBBELL_TIERS, implement: "dumbbell", difficulty: "novice", unilateral: true, perHand: true, injurySafe: SAFE_ALL, startingKg: 5, cue: "Hinged over, upper arm still, straighten the elbow behind you." },

  // --- LUNGE ---------------------------------------------------------------
  { name: "Bodyweight Reverse Lunge", pattern: "lunge", primaryMuscle: "quads", tiers: ALL_TIERS, implement: "bodyweight", difficulty: "novice", unilateral: true, injurySafe: KNEE_HEAVY, bodyweightFraction: 0.85, cue: "Step back, drop the back knee, drive off the front heel." },
  { name: "Walking Lunge", pattern: "lunge", primaryMuscle: "quads", tiers: ALL_TIERS, implement: "bodyweight", difficulty: "beginner", unilateral: true, injurySafe: KNEE_HEAVY, bodyweightFraction: 0.85, cue: "Travel forward, each step a full lunge." },
  { name: "Dumbbell Lunge", pattern: "lunge", primaryMuscle: "quads", tiers: DUMBBELL_TIERS, implement: "dumbbell", difficulty: "beginner", unilateral: true, perHand: true, injurySafe: KNEE_HEAVY, startingKg: 10, cue: "A dumbbell in each hand, otherwise the same lunge." },
  { name: "Barbell Walking Lunge", pattern: "lunge", primaryMuscle: "quads", tiers: FREE_WEIGHT, implement: "barbell", difficulty: "advanced", unilateral: true, injurySafe: KNEE_AND_BACK, startingKg: 20, cue: "Bar on the back, which demands a lot more balance." },
  { name: "Lateral Lunge", pattern: "lunge", primaryMuscle: "glutes", tiers: ALL_TIERS, implement: "bodyweight", difficulty: "beginner", unilateral: true, goals: ["athletic", "fitness"], injurySafe: KNEE_HEAVY, bodyweightFraction: 0.8, cue: "Step wide to the side, sit into that hip, push back to the middle." },
  { name: "Curtsy Lunge", pattern: "lunge", primaryMuscle: "glutes", tiers: ALL_TIERS, implement: "bodyweight", difficulty: "beginner", unilateral: true, injurySafe: KNEE_HEAVY, bodyweightFraction: 0.85, cue: "Step behind and across, which loads the outer hip." },
  { name: "Step-Up", pattern: "lunge", primaryMuscle: "quads", tiers: ALL_TIERS, implement: "bodyweight", difficulty: "novice", unilateral: true, injurySafe: KNEE_HEAVY, bodyweightFraction: 0.85, cue: "Drive through the top foot without pushing off the trailing one." },
  { name: "Dumbbell Step-Up", pattern: "lunge", primaryMuscle: "quads", tiers: DUMBBELL_TIERS, implement: "dumbbell", difficulty: "beginner", unilateral: true, perHand: true, injurySafe: KNEE_HEAVY, startingKg: 8, cue: "Loaded step-up onto a box at about knee height." },

  // --- CALVES --------------------------------------------------------------
  { name: "Bodyweight Calf Raise", pattern: "push", primaryMuscle: "calves", tiers: ALL_TIERS, implement: "bodyweight", difficulty: "novice", injurySafe: SAFE_ALL, bodyweightFraction: 0.9, cue: "Rise onto the toes, pause at the top, lower slowly." },
  { name: "Single-Leg Calf Raise", pattern: "push", primaryMuscle: "calves", tiers: ALL_TIERS, implement: "bodyweight", difficulty: "beginner", unilateral: true, injurySafe: SAFE_ALL, bodyweightFraction: 0.9, cue: "One leg at a time, which roughly doubles the load." },
  { name: "Dumbbell Calf Raise", pattern: "push", primaryMuscle: "calves", tiers: DUMBBELL_TIERS, implement: "dumbbell", difficulty: "novice", perHand: true, injurySafe: SAFE_ALL, startingKg: 12, cue: "Holding dumbbells at the sides, rise onto the toes." },
  { name: "Seated Calf Raise", pattern: "push", primaryMuscle: "calves", tiers: GYM_ONLY, implement: "machine", difficulty: "novice", injurySafe: SAFE_ALL, startingKg: 20, cue: "Knees bent, which shifts the work to the deeper calf muscle." },

  // --- CORE ----------------------------------------------------------------
  { name: "Plank", pattern: "isometric", primaryMuscle: "core", tiers: ALL_TIERS, implement: "bodyweight", difficulty: "novice", isHold: true, injurySafe: SAFE_ALL, cue: "Forearms down, ribs pulled toward the hips, hold a straight line." },
  { name: "Side Plank", pattern: "isometric", primaryMuscle: "core", tiers: ALL_TIERS, implement: "bodyweight", difficulty: "beginner", isHold: true, unilateral: true, injurySafe: SAFE_ALL, cue: "On one forearm, hips stacked and lifted." },
  { name: "Hollow Hold", pattern: "isometric", primaryMuscle: "core", tiers: ALL_TIERS, implement: "bodyweight", difficulty: "intermediate", isHold: true, goals: ["athletic"], injurySafe: SAFE_ALL, cue: "Lower back pressed flat, shoulders and heels just off the floor." },
  { name: "Dead Bug", pattern: "isometric", primaryMuscle: "core", tiers: ALL_TIERS, implement: "bodyweight", difficulty: "novice", injurySafe: SAFE_ALL, cue: "On your back, extend opposite arm and leg without the back arching." },
  { name: "Bird Dog", pattern: "isometric", primaryMuscle: "core", tiers: ALL_TIERS, implement: "bodyweight", difficulty: "novice", unilateral: true, injurySafe: SAFE_ALL, cue: "On all fours, reach opposite arm and leg out, keep the hips level." },
  { name: "Copenhagen Plank", pattern: "isometric", primaryMuscle: "core", tiers: ALL_TIERS, implement: "bodyweight", difficulty: "advanced", isHold: true, unilateral: true, goals: ["athletic"], injurySafe: SAFE_ALL, cue: "Side plank with the top leg on a bench. Brutal on the adductors." },
  { name: "Hanging Leg Raise", pattern: "pull", primaryMuscle: "core", tiers: BAR_TIERS, implement: "bodyweight", difficulty: "advanced", injurySafe: SAFE_ALL, bodyweightFraction: 0.2, cue: "Hanging, raise straight legs to hip height without swinging." },
  { name: "Hanging Knee Raise", pattern: "pull", primaryMuscle: "core", tiers: BAR_TIERS, implement: "bodyweight", difficulty: "beginner", injurySafe: SAFE_ALL, bodyweightFraction: 0.2, cue: "Same hang, knees tucked to the chest." },
  { name: "Ab Wheel Rollout", pattern: "isometric", primaryMuscle: "core", tiers: ["gym", "home-gym", "minimal"], implement: "other", difficulty: "advanced", injurySafe: BACK_HEAVY, bodyweightFraction: 0.5, cue: "Roll out only as far as you can keep the lower back flat." },
  { name: "Cable Crunch", pattern: "isometric", primaryMuscle: "core", tiers: GYM_ONLY, implement: "cable", difficulty: "beginner", injurySafe: BACK_HEAVY, startingKg: 20, cue: "Kneeling at the stack, curl the ribs toward the hips." },
  { name: "Russian Twist", pattern: "rotation", primaryMuscle: "core", tiers: ALL_TIERS, implement: "bodyweight", difficulty: "beginner", injurySafe: BACK_HEAVY, cue: "Seated and leaning back, rotate the ribcage side to side." },
  { name: "Pallof Press", pattern: "rotation", primaryMuscle: "core", tiers: ["gym", "minimal"], implement: "cable", difficulty: "novice", unilateral: true, injurySafe: SAFE_ALL, startingKg: 10, cue: "Press straight out while the cable tries to twist you. Resist it." },
  { name: "Cable Woodchopper", pattern: "rotation", primaryMuscle: "core", tiers: ["gym", "minimal"], implement: "cable", difficulty: "beginner", unilateral: true, goals: ["athletic", "fitness"], injurySafe: BACK_HEAVY, startingKg: 12, cue: "Chop diagonally across the body, turning through the hips." },
  { name: "Mountain Climbers", pattern: "isometric", primaryMuscle: "core", tiers: ALL_TIERS, implement: "bodyweight", difficulty: "novice", goals: ["fat-loss", "fitness", "athletic"], injurySafe: SAFE_ALL, bodyweightFraction: 0.64, cue: "Plank position, drive the knees in one at a time, hips low." },
  { name: "V-Up", pattern: "isometric", primaryMuscle: "core", tiers: ALL_TIERS, implement: "bodyweight", difficulty: "intermediate", injurySafe: BACK_HEAVY, bodyweightFraction: 0.4, cue: "Lift the arms and legs to meet over the hips." },
  { name: "Bicycle Crunch", pattern: "rotation", primaryMuscle: "core", tiers: ALL_TIERS, implement: "bodyweight", difficulty: "novice", injurySafe: BACK_HEAVY, bodyweightFraction: 0.35, cue: "Opposite elbow toward opposite knee, slowly." },

  // --- CARRY ---------------------------------------------------------------
  { name: "Farmer's Carry", pattern: "carry", primaryMuscle: "full-body", tiers: DUMBBELL_TIERS, implement: "dumbbell", difficulty: "novice", perHand: true, isHold: true, goals: ["strength", "athletic", "fitness"], injurySafe: SAFE_ALL, startingKg: 16, cue: "Heavy in both hands, walk tall without leaning." },
  { name: "Suitcase Carry", pattern: "carry", primaryMuscle: "core", tiers: DUMBBELL_TIERS, implement: "dumbbell", difficulty: "beginner", unilateral: true, perHand: true, isHold: true, goals: ["strength", "athletic"], injurySafe: SAFE_ALL, startingKg: 16, cue: "Weight in one hand only. The work is refusing to tip toward it." },
  { name: "Front Rack Carry", pattern: "carry", primaryMuscle: "core", tiers: ["gym", "home-gym", "minimal"], implement: "kettlebell", difficulty: "intermediate", perHand: true, isHold: true, goals: ["strength", "athletic"], injurySafe: SAFE_ALL, startingKg: 12, cue: "Bells at the shoulders, ribs down, walk." },
  { name: "Overhead Carry", pattern: "carry", primaryMuscle: "shoulders", tiers: DUMBBELL_TIERS, implement: "dumbbell", difficulty: "advanced", isHold: true, goals: ["athletic"], injurySafe: SHOULDER_HEAVY, startingKg: 8, cue: "Locked out overhead, walk without the ribs flaring." },

  // --- POWER AND CONDITIONING ----------------------------------------------
  { name: "Box Jump", pattern: "squat", primaryMuscle: "quads", tiers: ["gym", "home-gym", "bodyweight"], implement: "bodyweight", difficulty: "intermediate", goals: ["athletic", "fitness"], injurySafe: KNEE_HEAVY, bodyweightFraction: 0.85, cue: "Jump up, land softly in a quarter squat, step back down." },
  { name: "Broad Jump", pattern: "squat", primaryMuscle: "quads", tiers: ["gym", "bodyweight"], implement: "bodyweight", difficulty: "intermediate", goals: ["athletic"], injurySafe: KNEE_HEAVY, bodyweightFraction: 0.85, cue: "Jump forward for distance, land balanced and stick it." },
  { name: "Jump Squat", pattern: "squat", primaryMuscle: "quads", tiers: ALL_TIERS, implement: "bodyweight", difficulty: "intermediate", goals: ["athletic", "fat-loss", "fitness"], injurySafe: KNEE_HEAVY, bodyweightFraction: 0.85, cue: "Squat then jump, absorbing the landing before the next rep." },
  { name: "Jumping Lunge", pattern: "lunge", primaryMuscle: "quads", tiers: ALL_TIERS, implement: "bodyweight", difficulty: "advanced", unilateral: true, goals: ["athletic", "fat-loss"], injurySafe: KNEE_HEAVY, bodyweightFraction: 0.85, cue: "Switch legs in the air, land soft and controlled." },
  { name: "Skater Bound", pattern: "lunge", primaryMuscle: "glutes", tiers: ALL_TIERS, implement: "bodyweight", difficulty: "intermediate", unilateral: true, goals: ["athletic"], injurySafe: KNEE_HEAVY, bodyweightFraction: 0.8, cue: "Bound sideways from one leg to the other, sticking each landing." },
  { name: "Tuck Jump", pattern: "squat", primaryMuscle: "quads", tiers: ALL_TIERS, implement: "bodyweight", difficulty: "advanced", goals: ["athletic"], injurySafe: KNEE_HEAVY, bodyweightFraction: 0.85, cue: "Jump and pull the knees to the chest, land quietly." },
  { name: "Depth Jump", pattern: "squat", primaryMuscle: "quads", tiers: ["gym", "home-gym"], implement: "bodyweight", difficulty: "advanced", goals: ["athletic"], injurySafe: KNEE_HEAVY, bodyweightFraction: 0.9, cue: "Step off a low box and rebound immediately. Advanced, and low volume." },
  { name: "Burpee", pattern: "squat", primaryMuscle: "full-body", tiers: ALL_TIERS, implement: "bodyweight", difficulty: "beginner", goals: ["fat-loss", "fitness", "athletic"], injurySafe: KNEE_HEAVY, bodyweightFraction: 0.7, cue: "Down to a push-up, back to the feet, jump. Pace it." },
  { name: "High Knees", pattern: "lunge", primaryMuscle: "quads", tiers: ALL_TIERS, implement: "bodyweight", difficulty: "novice", goals: ["fat-loss", "fitness", "athletic"], injurySafe: KNEE_HEAVY, bodyweightFraction: 0.3, cue: "Run on the spot, knees to hip height, fast feet." },
  { name: "Bear Crawl", pattern: "carry", primaryMuscle: "full-body", tiers: ALL_TIERS, implement: "bodyweight", difficulty: "beginner", goals: ["athletic", "fitness"], injurySafe: SAFE_ALL, bodyweightFraction: 0.6, cue: "Knees just off the floor, opposite hand and foot, hips level." },
  { name: "Power Clean", pattern: "hinge", primaryMuscle: "full-body", tiers: FREE_WEIGHT, implement: "barbell", difficulty: "advanced", goals: ["athletic", "strength"], injurySafe: KNEE_AND_BACK, startingKg: 30, cue: "Pull from the floor and catch in a front rack. Technical -- coach it." },
  { name: "Hang Clean", pattern: "hinge", primaryMuscle: "full-body", tiers: FREE_WEIGHT, implement: "barbell", difficulty: "advanced", goals: ["athletic"], injurySafe: BACK_HEAVY, startingKg: 25, cue: "From the thigh rather than the floor, which shortens the pull." },
  { name: "Push Jerk", pattern: "push", primaryMuscle: "shoulders", tiers: FREE_WEIGHT, implement: "barbell", difficulty: "advanced", goals: ["athletic", "strength"], injurySafe: SHOULDER_HEAVY, startingKg: 30, cue: "Dip, drive, and drop under the bar to catch it locked out." },
  { name: "Kettlebell Clean", pattern: "hinge", primaryMuscle: "full-body", tiers: ["gym", "home-gym", "minimal"], implement: "kettlebell", difficulty: "advanced", unilateral: true, perHand: true, goals: ["athletic", "fitness"], injurySafe: BACK_HEAVY, startingKg: 12, cue: "Swing the bell up to the rack position without banging the wrist." },
  { name: "Kettlebell Snatch", pattern: "hinge", primaryMuscle: "full-body", tiers: ["gym", "home-gym", "minimal"], implement: "kettlebell", difficulty: "advanced", unilateral: true, perHand: true, goals: ["athletic"], injurySafe: BACK_HEAVY, startingKg: 12, cue: "One movement from between the legs to locked out overhead." },
  { name: "Medicine Ball Slam", pattern: "rotation", primaryMuscle: "full-body", tiers: ["gym", "home-gym"], implement: "other", difficulty: "beginner", goals: ["athletic", "fat-loss"], injurySafe: BACK_HEAVY, startingKg: 8, cue: "Overhead then down hard, following through with the whole body." },
  { name: "Rotational Med Ball Throw", pattern: "rotation", primaryMuscle: "core", tiers: ["gym"], implement: "other", difficulty: "intermediate", unilateral: true, goals: ["athletic"], injurySafe: SAFE_ALL, startingKg: 6, cue: "Turn through the hips and throw the ball into a wall." },
  { name: "Battle Ropes", pattern: "carry", primaryMuscle: "full-body", tiers: GYM_ONLY, implement: "other", difficulty: "beginner", isHold: true, goals: ["fat-loss", "fitness", "athletic"], injurySafe: SAFE_ALL, cue: "Alternating waves from a quarter-squat, breathing steadily." },
  { name: "Sled Push", pattern: "carry", primaryMuscle: "full-body", tiers: GYM_ONLY, implement: "other", difficulty: "beginner", isHold: true, goals: ["athletic", "fat-loss", "strength"], injurySafe: SAFE_ALL, startingKg: 40, cue: "Low body angle, short steps, keep it moving." },
  { name: "Sprint Intervals", pattern: "carry", primaryMuscle: "full-body", tiers: ALL_TIERS, implement: "bodyweight", difficulty: "intermediate", isHold: true, goals: ["athletic", "fat-loss", "fitness"], injurySafe: KNEE_HEAVY, cue: "Hard efforts with full recovery between. Quality over quantity." },
];

// --- Queries ---------------------------------------------------------------

export function exercisesForTier(tier: EquipmentTier): LibraryExercise[] {
  return exerciseLibrary.filter((exercise) => exercise.tiers.includes(tier));
}

// Goal-tagged exercises are the ones that only make sense for those goals;
// untagged movements suit any of them and are always eligible.
export function suitsGoal(exercise: LibraryExercise, goal: string | undefined): boolean {
  if (!exercise.goals || exercise.goals.length === 0) return true;
  return exercise.goals.includes(goal as TrainingGoal);
}

export function exerciseByName(name: string): LibraryExercise | undefined {
  return exerciseLibrary.find((exercise) => exercise.name === name);
}
