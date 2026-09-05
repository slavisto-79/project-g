import type { MovementPattern } from "./exerciseLibrary";

// How a session is shaped: which split day it is, and which movement patterns
// fill its slots. The exercises themselves come from lib/exerciseLibrary.ts;
// the picker that fills these slots from it lives in App.tsx
// (buildProgramFromLibrary).

// Mirrors the exact value stored by the onboarding question "bodyweightStrength":
// what the user reported they can already do. Prescribing a pull-up to someone
// who cannot do one is a wall, not a hard session.
export type BodyweightStrength = "both" | "pushups" | "neither";

export type SplitDay = "full-body" | "upper" | "lower" | "push" | "pull" | "legs";

// Which slots of a day are the compound spine, and which are up for grabs.
//
// Everyone squats, hinges, pushes and pulls -- that part of a session is not a
// matter of goal. What a fat-loss day and a strength day should stop sharing
// is everything after that, and previously they shared all of it: five goals
// produced byte-identical exercise lists, differing only in reps and rest.
//
// `spine` and `tail` are fixed; the slots between them are filled from the
// goal's preference order, narrowed to what makes sense on that day.
type DayShape = {
  spine: MovementPattern[];
  accessoryCount: number;
  accessoryPool: MovementPattern[];
  tail: MovementPattern[];
};

const dayShapes: Record<SplitDay, DayShape> = {
  "full-body": {
    spine: ["squat", "hinge", "push", "pull"],
    accessoryCount: 3,
    accessoryPool: ["push", "pull", "lunge", "carry", "rotation"],
    tail: ["isometric"],
  },
  upper: {
    spine: ["push", "pull"],
    accessoryCount: 3,
    accessoryPool: ["push", "pull", "carry", "rotation"],
    tail: ["isometric"],
  },
  lower: {
    spine: ["squat", "hinge"],
    accessoryCount: 2,
    accessoryPool: ["lunge", "squat", "carry", "rotation"],
    tail: ["isometric"],
  },
  push: {
    spine: ["push"],
    accessoryCount: 2,
    accessoryPool: ["push", "carry", "rotation"],
    tail: ["isometric"],
  },
  pull: {
    spine: ["pull"],
    accessoryCount: 3,
    accessoryPool: ["pull", "hinge", "carry", "rotation"],
    tail: [],
  },
  legs: {
    spine: ["squat", "hinge"],
    accessoryCount: 2,
    accessoryPool: ["lunge", "squat", "carry", "rotation"],
    tail: ["isometric"],
  },
};

// What each goal reaches for once the compound work is done. Ordered: the
// first entries that a given day allows are the ones it gets.
//
// Strength stacks more heavy compound work. Muscle adds volume on the muscle
// being trained. Athletic and fat-loss are where the carries, sled pushes,
// sprints and rotational work finally become reachable -- 14 exercises in the
// library could never be selected before, because no slot ever asked for a
// carry or a rotation.
const GOAL_ACCESSORY_ORDER: Record<string, MovementPattern[]> = {
  strength: ["push", "pull", "squat", "hinge", "carry", "lunge", "rotation"],
  muscle: ["push", "pull", "lunge", "squat", "rotation", "carry", "hinge"],
  athletic: ["rotation", "carry", "lunge", "push", "pull", "hinge", "squat"],
  "fat-loss": ["carry", "rotation", "lunge", "push", "pull", "squat", "hinge"],
  fitness: ["carry", "lunge", "rotation", "push", "pull", "squat", "hinge"],
  // Legacy goal, kept so anyone still on it gets what they always got.
  health: ["push", "pull", "lunge", "squat", "rotation", "carry", "hinge"],
};

const DEFAULT_ACCESSORY_ORDER: MovementPattern[] = ["push", "pull", "lunge", "carry", "rotation"];

// How many of a day's accessory slots go to single-joint work.
//
// Isolation was previously unreachable: it shares the `push` and `pull`
// patterns with the presses and rows, and a triceps pushdown never outranks a
// bench press in a slot that will take either. Giving it its own slots is how
// a session is actually written -- compounds first, isolation last -- rather
// than a scoring workaround.
//
// Hypertrophy gets the most, since that is what isolation is for. Athletic
// training gets none: single-joint work does not transfer to power.
const GOAL_ISOLATION_SLOTS: Record<string, number> = {
  muscle: 2,
  strength: 1,
  fitness: 1,
  "fat-loss": 1,
  athletic: 0,
  health: 1,
};

export type SlotShape = { pattern: MovementPattern; isolation: boolean };

function accessorySlots(shape: DayShape, goal: string | undefined): SlotShape[] {
  const order = GOAL_ACCESSORY_ORDER[goal ?? ""] ?? DEFAULT_ACCESSORY_ORDER;
  const allowed = order.filter((pattern) => shape.accessoryPool.includes(pattern));
  const pool = allowed.length ? allowed : shape.accessoryPool;
  // Cycle rather than come up short: a repeated pattern lands on a different
  // exercise, since the picker excludes what it has already chosen.
  const patterns: MovementPattern[] = [];
  for (let i = 0; i < shape.accessoryCount; i++) patterns.push(pool[i % pool.length]!);

  // Always leave at least one compound accessory -- a day whose every
  // accessory is single-joint is not a session, it is a finisher.
  const isolationCount = Math.min(
    GOAL_ISOLATION_SLOTS[goal ?? ""] ?? 1,
    Math.max(0, shape.accessoryCount - 1),
  );
  // Isolation goes last, where it belongs in the running order.
  //
  // Any pattern with single-joint work in it can host an isolation slot --
  // including squat and hinge, without which a leg day had nowhere to put a
  // leg extension or a hamstring curl and they were unreachable. Carries and
  // rotations are whole-body conditioning with no isolation to offer, so they
  // keep their compound slots.
  const isolationHosts: MovementPattern[] = ["push", "pull", "squat", "hinge", "lunge"];
  const hostIndexes = patterns
    .map((pattern, index) => ({ pattern, index }))
    .filter(({ pattern }) => isolationHosts.includes(pattern))
    .map(({ index }) => index);
  const isIsolation = new Set(isolationCount > 0 ? hostIndexes.slice(-isolationCount) : []);

  const compound = patterns.filter((_, index) => !isIsolation.has(index));
  const isolation = patterns.filter((_, index) => isIsolation.has(index));
  return [
    ...compound.map((pattern) => ({ pattern, isolation: false })),
    ...isolation.map((pattern) => ({ pattern, isolation: true })),
  ];
}

const splitDayLabels: Record<SplitDay, string> = {
  "full-body": "Full Body",
  upper: "Upper Body",
  lower: "Lower Body",
  push: "Push Day",
  pull: "Pull Day",
  legs: "Legs Day",
};

// The slots a given split day asks for, in order: the compound spine, the
// goal's accessories, then the tail.
export function splitDaySlots(day: SplitDay, goal?: string): SlotShape[] {
  const shape = dayShapes[day];
  return [
    ...shape.spine.map((pattern) => ({ pattern, isolation: false })),
    ...accessorySlots(shape, goal),
    ...shape.tail.map((pattern) => ({ pattern, isolation: false })),
  ];
}

export function splitDayPatterns(day: SplitDay, goal?: string): MovementPattern[] {
  return splitDaySlots(day, goal).map((slot) => slot.pattern);
}

// How many of a day's leading slots are the compound spine. Exposed so the
// picker can rotate accessory slots harder than the main lifts: a bench press
// that only comes round every third session progresses at a third of the rate.
export function splitDaySpineLength(day: SplitDay): number {
  return dayShapes[day].spine.length;
}

// How many exercises a given split day has -- for UI copy like "6 guided
// exercises" that needs to match reality before the session is built. The
// same for every goal: goals change which patterns fill the slots, not how
// many there are.
export function splitDaySlotCount(day: SplitDay): number {
  const shape = dayShapes[day];
  return shape.spine.length + shape.accessoryCount + shape.tail.length;
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
// Exported and used by the library picker in App.tsx (and once shared with
// the catalog path): one rule, in one place.
// The name patterns tolerate separator and plural variants ("Chin Up",
// "Chin-Up", "Chinup", "Tricep Dips") so a renamed library entry still lands.
const REGRESSION_NAME = /assisted|negative|(?:knee|incline|wall|box) push[- ]?up/i;
const PUSH_UP_FAMILY = /push[- ]?up/i;
const PULL_UP_FAMILY = /pull[- ]?up|chin[- ]?up|muscle[- ]?up|\bdips?\b/i;

export function suitsBodyweightCapability(
  name: string,
  bodyweightStrength: BodyweightStrength | undefined,
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
