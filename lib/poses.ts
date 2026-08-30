// Exercise figures, defined as joint angles rather than raw coordinates.
//
// The five poses this replaces were lists of line endpoints. They worked, but
// nudging a knee meant editing eight numbers and hoping the limb stayed the
// right length, which is why only five were ever authored. Here a pose is the
// angle of each joint and the proportions do the rest, so "squat deeper" is one
// number and a limb cannot accidentally grow.
//
// Angles are degrees, 0 = straight up, positive = clockwise (towards the
// figure's right / +x). Lengths are fractions of the frame height.

export type PoseSegment = [number, number, number, number];

// Equipment drawn alongside the figure. A back squat and a goblet squat are the
// same shape; what is being held is most of what tells them apart.
export type PoseProp =
  | { kind: "bar"; x: number; y: number; angle: number; length: number; plates: boolean }
  | { kind: "bell"; x: number; y: number; size: number }
  | { kind: "slab"; x: number; y: number; width: number; height: number }
  // A ground line. Side views are hard to read without one -- a bent-over
  // figure and a lying one are the same jumble of sticks until you can see
  // which way is down and where the body is relative to the floor.
  | { kind: "floor"; y: number };

export type PoseFrame = { segments: PoseSegment[]; props: PoseProp[] };
export type ExercisePose = { start: PoseFrame; finish: PoseFrame };

// The frame the renderer maps into. Only the ratio matters: horizontal lengths
// are divided by it so a limb is the same length whichever way it points.
const ASPECT = 850 / 567;

// Fractions of frame height. A standing figure comes to about 0.9, which leaves
// room for a bar overhead without the fitting having to shrink everything.
const P = {
  head: 0.115,
  torso: 0.275,
  upperArm: 0.15,
  forearm: 0.145,
  thigh: 0.235,
  shin: 0.225,
  foot: 0.07,
};

type Point = { x: number; y: number };

function step(from: Point, angleDeg: number, length: number): Point {
  const a = (angleDeg * Math.PI) / 180;
  return { x: from.x + (Math.sin(a) * length) / ASPECT, y: from.y - Math.cos(a) * length };
}

function bone(a: Point, b: Point): PoseSegment {
  return [a.x, a.y, b.x, b.y];
}

// One arm or leg, described by the two angles that define it.
type Limb = { upper: number; lower: number };

type Figure = {
  hip: Point;
  torso: number;
  head?: number;
  arms: Limb[];
  legs: Limb[];
  // Drawn from the ankle, so the foot follows the leg.
  feet?: number;
};

function build(figure: Figure): { segments: PoseSegment[]; joints: Record<string, Point> } {
  const segments: PoseSegment[] = [];
  const hip = figure.hip;
  const shoulder = step(hip, figure.torso, P.torso);
  const head = step(shoulder, figure.head ?? figure.torso, P.head);
  segments.push(bone(hip, shoulder), bone(shoulder, head));

  const hands: Point[] = [];
  for (const arm of figure.arms) {
    const elbow = step(shoulder, arm.upper, P.upperArm);
    const wrist = step(elbow, arm.lower, P.forearm);
    segments.push(bone(shoulder, elbow), bone(elbow, wrist));
    hands.push(wrist);
  }

  const ankles: Point[] = [];
  for (const leg of figure.legs) {
    const knee = step(hip, leg.upper, P.thigh);
    const ankle = step(knee, leg.lower, P.shin);
    segments.push(bone(hip, knee), bone(knee, ankle));
    if (figure.feet !== undefined) segments.push(bone(ankle, step(ankle, figure.feet, P.foot)));
    ankles.push(ankle);
  }

  const joints: Record<string, Point> = { hip, shoulder, head };
  hands.forEach((h, i) => { joints[`hand${i}`] = h; });
  ankles.forEach((a, i) => { joints[`ankle${i}`] = a; });
  // Midpoint of the hands, which is where a bar or a bell is held.
  if (hands.length) {
    joints.grip = {
      x: hands.reduce((sum, h) => sum + h.x, 0) / hands.length,
      y: hands.reduce((sum, h) => sum + h.y, 0) / hands.length,
    };
  }
  return { segments, joints };
}

type PropSpec =
  | { kind: "bar"; at: string; angle?: number; length?: number; plates?: boolean; dy?: number }
  | { kind: "bell"; at: string; size?: number; each?: boolean }
  | { kind: "slab"; at: string; width: number; height: number; dy?: number }
  // Placed under the lowest point of the figure, so it sits where the ground
  // is. Pin it with `y` when the body leaves the ground: otherwise the floor
  // rises with the jump, which reads as the world moving, not the athlete.
  | { kind: "floor"; y?: number };

function frame(figure: Figure, props: PropSpec[] = []): PoseFrame {
  const { segments, joints } = build(figure);
  const drawn: PoseProp[] = [];
  // Where the figure meets the ground in this frame.
  const lowest = segments.reduce((low, [, y1, , y2]) => Math.max(low, y1, y2), 0);
  for (const spec of props) {
    if (spec.kind === "floor") {
      drawn.push({ kind: "floor", y: spec.y ?? lowest + 0.004 });
      continue;
    }
    if (spec.kind === "bell" && spec.each) {
      for (const key of Object.keys(joints)) {
        if (key.startsWith("hand")) drawn.push({ kind: "bell", x: joints[key]!.x, y: joints[key]!.y, size: spec.size ?? 0.055 });
      }
      continue;
    }
    const anchor = joints[spec.at];
    if (!anchor) continue;
    if (spec.kind === "bar") {
      drawn.push({
        kind: "bar",
        x: anchor.x,
        y: anchor.y + (spec.dy ?? 0),
        angle: spec.angle ?? 90,
        length: spec.length ?? 0.34,
        plates: spec.plates ?? true,
      });
    } else if (spec.kind === "bell") {
      drawn.push({ kind: "bell", x: anchor.x, y: anchor.y, size: spec.size ?? 0.055 });
    } else {
      drawn.push({ kind: "slab", x: anchor.x, y: anchor.y + (spec.dy ?? 0), width: spec.width, height: spec.height });
    }
  }
  return { segments, props: drawn };
}

// --- The movements -------------------------------------------------------
//
// Front view where the shape is symmetric and depth is not the point (squat,
// press, raise); side view where the hinge or the path is the whole story
// (deadlift, bench, row, push-up).

const HIP_STAND: Point = { x: 0.5, y: 0.58 };

export const exercisePoses = {
  squat: {
    start: frame(
      {
        hip: HIP_STAND,
        torso: 0,
        arms: [{ upper: 118, lower: 30 }, { upper: -118, lower: -30 }],
        // Thigh and shin lean the same way, or the leg bows into a diamond
        // instead of standing straight in a slightly wide stance.
        legs: [{ upper: 173, lower: 176 }, { upper: -173, lower: -176 }],
        feet: 100,
      },
      [{ kind: "bar", at: "shoulder", dy: 0.012, length: 0.42 }],
    ),
    finish: frame(
      {
        hip: { x: 0.5, y: 0.7 },
        torso: 8,
        arms: [{ upper: 118, lower: 30 }, { upper: -118, lower: -30 }],
        legs: [{ upper: 148, lower: 205 }, { upper: -148, lower: -205 }],
        feet: 100,
      },
      [{ kind: "bar", at: "shoulder", dy: 0.012, length: 0.42 }],
    ),
  },

  hinge: {
    start: frame(
      {
        hip: HIP_STAND,
        torso: 4,
        // Two arms and two legs a few degrees apart. A side view of a single
        // stick is ambiguous; the offset pair reads as a body with depth.
        arms: [{ upper: 176, lower: 179 }, { upper: 183, lower: 186 }],
        legs: [{ upper: 178, lower: 179 }, { upper: 184, lower: 185 }],
        feet: 82,
      },
      [{ kind: "floor", y: 1.05 }, { kind: "bar", at: "grip", length: 0.3 }],
    ),
    finish: frame(
      {
        hip: { x: 0.56, y: 0.55 },
        torso: 108,
        head: 96,
        arms: [{ upper: 176, lower: 179 }, { upper: 183, lower: 186 }],
        legs: [{ upper: 168, lower: 188 }, { upper: 174, lower: 194 }],
        feet: 82,
      },
      [{ kind: "floor", y: 1.05 }, { kind: "bar", at: "grip", length: 0.3 }],
    ),
  },

  bench: {
    start: frame(
      {
        hip: { x: 0.58, y: 0.56 },
        torso: 272,
        head: 272,
        arms: [{ upper: 356, lower: 358 }, { upper: 4, lower: 2 }],
        legs: [{ upper: 128, lower: 188 }, { upper: 134, lower: 194 }],
        feet: 92,
      },
      [
        { kind: "floor" },
        { kind: "slab", at: "hip", width: 0.4, height: 0.03, dy: 0.03 },
        { kind: "bar", at: "grip", length: 0.28 },
      ],
    ),
    finish: frame(
      {
        hip: { x: 0.58, y: 0.56 },
        torso: 272,
        head: 272,
        arms: [{ upper: 212, lower: 12 }, { upper: 220, lower: 16 }],
        legs: [{ upper: 128, lower: 188 }, { upper: 134, lower: 194 }],
        feet: 92,
      },
      [
        { kind: "floor" },
        { kind: "slab", at: "hip", width: 0.4, height: 0.03, dy: 0.03 },
        { kind: "bar", at: "grip", length: 0.28 },
      ],
    ),
  },

  overheadPress: {
    start: frame(
      {
        hip: HIP_STAND,
        torso: 0,
        arms: [{ upper: 152, lower: 22 }, { upper: -152, lower: -22 }],
        legs: [{ upper: 176, lower: 177 }, { upper: -176, lower: -177 }],
        feet: 100,
      },
      [{ kind: "bar", at: "grip", length: 0.4 }],
    ),
    finish: frame(
      {
        hip: HIP_STAND,
        torso: 0,
        arms: [{ upper: 8, lower: 4 }, { upper: -8, lower: -4 }],
        legs: [{ upper: 176, lower: 177 }, { upper: -176, lower: -177 }],
        feet: 100,
      },
      [{ kind: "bar", at: "grip", length: 0.4 }],
    ),
  },

  bentRow: {
    start: frame(
      {
        hip: { x: 0.56, y: 0.56 },
        torso: 104,
        head: 92,
        arms: [{ upper: 176, lower: 179 }, { upper: 183, lower: 186 }],
        legs: [{ upper: 168, lower: 186 }, { upper: 174, lower: 192 }],
        feet: 82,
      },
      [{ kind: "floor" }, { kind: "bar", at: "grip", length: 0.3 }],
    ),
    finish: frame(
      {
        hip: { x: 0.56, y: 0.56 },
        torso: 104,
        head: 92,
        // Elbow drives back and up, hand ends under the ribs.
        arms: [{ upper: 214, lower: 132 }, { upper: 221, lower: 139 }],
        legs: [{ upper: 168, lower: 186 }, { upper: 174, lower: 192 }],
        feet: 82,
      },
      [{ kind: "floor" }, { kind: "bar", at: "grip", length: 0.3 }],
    ),
  },

  lunge: {
    start: frame(
      { hip: HIP_STAND, torso: 2, arms: [{ upper: 174, lower: 179 }], legs: [{ upper: 176, lower: 177 }, { upper: -176, lower: -177 }], feet: 92 },
      [{ kind: "bell", at: "hand0", each: true }],
    ),
    finish: frame(
      { hip: { x: 0.5, y: 0.69 }, torso: 4, arms: [{ upper: 174, lower: 179 }], legs: [{ upper: 148, lower: 196 }, { upper: -152, lower: -128 }], feet: 92 },
      [{ kind: "bell", at: "hand0", each: true }],
    ),
  },

  pushUp: {
    start: frame(
      {
        hip: { x: 0.52, y: 0.6 },
        torso: 254,
        head: 244,
        arms: [{ upper: 178, lower: 179 }, { upper: 184, lower: 185 }],
        legs: [{ upper: 86, lower: 88 }, { upper: 92, lower: 94 }],
        feet: 130,
      },
      [{ kind: "floor", y: 0.981 }],
    ),
    finish: frame(
      {
        hip: { x: 0.52, y: 0.655 },
        torso: 256,
        head: 246,
        arms: [{ upper: 214, lower: 128 }, { upper: 220, lower: 134 }],
        legs: [{ upper: 88, lower: 90 }, { upper: 94, lower: 96 }],
        feet: 130,
      },
      [{ kind: "floor", y: 0.981 }],
    ),
  },

  pullUp: {
    start: frame(
      { hip: { x: 0.5, y: 0.66 }, torso: 2, arms: [{ upper: 4, lower: 2 }, { upper: -4, lower: -2 }], legs: [{ upper: 175, lower: 176 }, { upper: -175, lower: -176 }], feet: 96 },
      [{ kind: "bar", at: "grip", length: 0.46, plates: false, dy: -0.005 }],
    ),
    finish: frame(
      { hip: { x: 0.5, y: 0.55 }, torso: 2, arms: [{ upper: 36, lower: -46 }, { upper: -36, lower: 46 }], legs: [{ upper: 175, lower: 176 }, { upper: -175, lower: -176 }], feet: 96 },
      [{ kind: "bar", at: "grip", length: 0.46, plates: false, dy: -0.11 }],
    ),
  },

  curl: {
    start: frame(
      { hip: HIP_STAND, torso: 0, arms: [{ upper: 176, lower: 178 }, { upper: -176, lower: -178 }], legs: [{ upper: 176, lower: 177 }, { upper: -176, lower: -177 }], feet: 100 },
      [{ kind: "bell", at: "hand0", each: true }],
    ),
    finish: frame(
      { hip: HIP_STAND, torso: 0, arms: [{ upper: 172, lower: 44 }, { upper: -172, lower: -44 }], legs: [{ upper: 176, lower: 177 }, { upper: -176, lower: -177 }], feet: 100 },
      [{ kind: "bell", at: "hand0", each: true }],
    ),
  },

  tricepsExtension: {
    start: frame(
      { hip: HIP_STAND, torso: 0, arms: [{ upper: 168, lower: 96 }, { upper: -168, lower: -96 }], legs: [{ upper: 176, lower: 177 }, { upper: -176, lower: -177 }], feet: 100 },
      [{ kind: "bar", at: "grip", length: 0.2, plates: false }],
    ),
    finish: frame(
      { hip: HIP_STAND, torso: 0, arms: [{ upper: 172, lower: 176 }, { upper: -172, lower: -176 }], legs: [{ upper: 176, lower: 177 }, { upper: -176, lower: -177 }], feet: 100 },
      [{ kind: "bar", at: "grip", length: 0.2, plates: false }],
    ),
  },

  lateralRaise: {
    start: frame(
      { hip: HIP_STAND, torso: 0, arms: [{ upper: 172, lower: 176 }, { upper: -172, lower: -176 }], legs: [{ upper: 176, lower: 177 }, { upper: -176, lower: -177 }], feet: 100 },
      [{ kind: "bell", at: "hand0", each: true, size: 0.05 }],
    ),
    finish: frame(
      { hip: HIP_STAND, torso: 0, arms: [{ upper: 92, lower: 94 }, { upper: -92, lower: -94 }], legs: [{ upper: 176, lower: 177 }, { upper: -176, lower: -177 }], feet: 100 },
      [{ kind: "bell", at: "hand0", each: true, size: 0.05 }],
    ),
  },

  calfRaise: {
    start: frame(
      {
        hip: { x: 0.5, y: 0.6 },
        torso: 0,
        arms: [{ upper: 176, lower: 179 }, { upper: 183, lower: 186 }],
        legs: [{ upper: 178, lower: 179 }, { upper: 184, lower: 185 }],
        feet: 96,
      },
      [{ kind: "floor" }],
    ),
    finish: frame(
      {
        hip: { x: 0.5, y: 0.545 },
        torso: 0,
        arms: [{ upper: 176, lower: 179 }, { upper: 183, lower: 186 }],
        legs: [{ upper: 178, lower: 179 }, { upper: 184, lower: 185 }],
        feet: 140,
      },
      [{ kind: "floor" }],
    ),
  },

  plank: {
    start: frame(
      {
        hip: { x: 0.52, y: 0.6 },
        torso: 254,
        head: 244,
        // Forearms down: a plank is held on the elbows, not the hands.
        arms: [{ upper: 190, lower: 268 }, { upper: 196, lower: 274 }],
        legs: [{ upper: 86, lower: 88 }, { upper: 92, lower: 94 }],
        feet: 130,
      },
      [{ kind: "floor" }],
    ),
    finish: frame(
      {
        hip: { x: 0.52, y: 0.612 },
        torso: 255,
        head: 245,
        arms: [{ upper: 190, lower: 268 }, { upper: 196, lower: 274 }],
        legs: [{ upper: 86, lower: 88 }, { upper: 92, lower: 94 }],
        feet: 130,
      },
      [{ kind: "floor" }],
    ),
  },

  carry: {
    start: frame(
      { hip: HIP_STAND, torso: 0, arms: [{ upper: 176, lower: 179 }, { upper: -176, lower: -179 }], legs: [{ upper: 178, lower: 178 }, { upper: -172, lower: -174 }], feet: 100 },
      [{ kind: "bell", at: "hand0", each: true }],
    ),
    finish: frame(
      { hip: HIP_STAND, torso: 0, arms: [{ upper: 176, lower: 179 }, { upper: -176, lower: -179 }], legs: [{ upper: 170, lower: 172 }, { upper: -178, lower: -178 }], feet: 100 },
      [{ kind: "bell", at: "hand0", each: true }],
    ),
  },

  // --- pressing variants ---------------------------------------------------

  inclinePress: {
    start: frame(
      {
        hip: { x: 0.56, y: 0.64 },
        // 235 points down-left, which reclines the figure head-DOWN: a decline,
        // not an incline. Up-and-left is 305.
        torso: 305,
        head: 305,
        arms: [{ upper: 10, lower: 6 }, { upper: 16, lower: 12 }],
        legs: [{ upper: 145, lower: 178 }, { upper: 151, lower: 184 }],
        feet: 95,
      },
      [
        { kind: "floor" },
        { kind: "slab", at: "hip", width: 0.22, height: 0.03, dy: 0.03 },
        { kind: "bar", at: "grip", length: 0.28 },
      ],
    ),
    finish: frame(
      {
        hip: { x: 0.56, y: 0.64 },
        torso: 305,
        head: 305,
        // Elbow drops back and down, hand comes to the upper chest.
        arms: [{ upper: 250, lower: 35 }, { upper: 256, lower: 41 }],
        legs: [{ upper: 145, lower: 178 }, { upper: 151, lower: 184 }],
        feet: 95,
      },
      [
        { kind: "floor" },
        { kind: "slab", at: "hip", width: 0.22, height: 0.03, dy: 0.03 },
        { kind: "bar", at: "grip", length: 0.28 },
      ],
    ),
  },

  // A fly and a lateral raise are close cousins in a stick figure. What tells
  // them apart is the start: a fly *begins* wide and closes, a raise begins
  // down and opens.
  fly: {
    start: frame(
      { hip: HIP_STAND, torso: 0, arms: [{ upper: 96, lower: 97 }, { upper: -96, lower: -97 }], legs: [{ upper: 176, lower: 177 }, { upper: -176, lower: -177 }], feet: 100 },
      [{ kind: "bell", at: "hand0", each: true, size: 0.05 }],
    ),
    finish: frame(
      { hip: HIP_STAND, torso: 0, arms: [{ upper: 22, lower: 17 }, { upper: -22, lower: -17 }], legs: [{ upper: 176, lower: 177 }, { upper: -176, lower: -177 }], feet: 100 },
      [{ kind: "bell", at: "hand0", each: true, size: 0.05 }],
    ),
  },

  skullCrusher: {
    start: frame(
      {
        hip: { x: 0.58, y: 0.56 },
        torso: 272,
        head: 272,
        arms: [{ upper: 356, lower: 358 }, { upper: 4, lower: 2 }],
        legs: [{ upper: 128, lower: 188 }, { upper: 134, lower: 194 }],
        feet: 92,
      },
      [
        { kind: "floor" },
        { kind: "slab", at: "hip", width: 0.4, height: 0.03, dy: 0.03 },
        { kind: "bar", at: "grip", length: 0.2, plates: false },
      ],
    ),
    finish: frame(
      {
        hip: { x: 0.58, y: 0.56 },
        torso: 272,
        head: 272,
        // The elbow stays where it is: only the forearm folds back past the head.
        arms: [{ upper: 352, lower: 265 }, { upper: 358, lower: 271 }],
        legs: [{ upper: 128, lower: 188 }, { upper: 134, lower: 194 }],
        feet: 92,
      },
      [
        { kind: "floor" },
        { kind: "slab", at: "hip", width: 0.4, height: 0.03, dy: 0.03 },
        { kind: "bar", at: "grip", length: 0.2, plates: false },
      ],
    ),
  },

  kneePushUp: {
    start: frame(
      {
        hip: { x: 0.592, y: 0.764 },
        // Shoulder sits one arm-length above the floor and the knee is on it,
        // so the body is a single inclined line: torso and thigh must agree.
        torso: 305,
        head: 305,
        arms: [{ upper: 178, lower: 179 }, { upper: 184, lower: 185 }],
        // Shins lie along the floor behind the knees, which is what separates
        // this from a plank without doubling a line back over the thigh.
        legs: [{ upper: 125, lower: 90 }, { upper: 131, lower: 96 }],
        feet: 130,
      },
      [{ kind: "floor", y: 1.023 }],
    ),
    finish: frame(
      {
        hip: { x: 0.592, y: 0.822 },
        torso: 305,
        head: 305,
        arms: [{ upper: 214, lower: 128 }, { upper: 220, lower: 134 }],
        // Thigh opens to keep the knee on the same spot as the chest drops.
        legs: [{ upper: 110, lower: 95 }, { upper: 116, lower: 101 }],
        feet: 130,
      },
      [{ kind: "floor", y: 1.023 }],
    ),
  },

  dip: {
    start: frame(
      {
        hip: { x: 0.5, y: 0.6 },
        torso: 6,
        head: 6,
        arms: [{ upper: 186, lower: 188 }, { upper: 192, lower: 194 }],
        // Knees carried forward: a side view needs the legs clear of the arms.
        legs: [{ upper: 140, lower: 100 }, { upper: 146, lower: 106 }],
        feet: 40,
      },
      [{ kind: "bar", at: "grip", length: 0.22, plates: false }],
    ),
    finish: frame(
      {
        hip: { x: 0.5, y: 0.68 },
        torso: 8,
        head: 8,
        // Elbows track back, body sinks between the hands.
        arms: [{ upper: 215, lower: 150 }, { upper: 221, lower: 156 }],
        legs: [{ upper: 140, lower: 100 }, { upper: 146, lower: 106 }],
        feet: 40,
      },
      [{ kind: "bar", at: "grip", length: 0.22, plates: false }],
    ),
  },

  // --- pulling variants ----------------------------------------------------

  // The mirror of a pull-up: here the bar travels and the body stays put.
  pulldown: {
    start: frame(
      { hip: { x: 0.5, y: 0.62 }, torso: 4, arms: [{ upper: 14, lower: 8 }, { upper: -14, lower: -8 }], legs: [{ upper: 176, lower: 177 }, { upper: -176, lower: -177 }], feet: 100 },
      [{ kind: "bar", at: "grip", length: 0.44, plates: false }],
    ),
    finish: frame(
      { hip: { x: 0.5, y: 0.62 }, torso: 6, arms: [{ upper: 175, lower: 45 }, { upper: -175, lower: -45 }], legs: [{ upper: 176, lower: 177 }, { upper: -176, lower: -177 }], feet: 100 },
      [{ kind: "bar", at: "grip", length: 0.44, plates: false }],
    ),
  },

  seatedRow: {
    start: frame(
      {
        hip: { x: 0.5, y: 0.62 },
        torso: 2,
        head: 2,
        arms: [{ upper: 96, lower: 94 }, { upper: 102, lower: 100 }],
        legs: [{ upper: 100, lower: 170 }, { upper: 106, lower: 176 }],
        feet: 88,
      },
      [
        { kind: "floor" },
        { kind: "slab", at: "hip", width: 0.16, height: 0.03, dy: 0.03 },
        { kind: "bar", at: "grip", length: 0.14, plates: false },
      ],
    ),
    finish: frame(
      {
        hip: { x: 0.5, y: 0.62 },
        torso: 356,
        head: 356,
        // Elbow behind the ribs, hand drawn in to the trunk.
        arms: [{ upper: 200, lower: 60 }, { upper: 206, lower: 66 }],
        legs: [{ upper: 100, lower: 170 }, { upper: 106, lower: 176 }],
        feet: 88,
      },
      [
        { kind: "floor" },
        { kind: "slab", at: "hip", width: 0.16, height: 0.03, dy: 0.03 },
        { kind: "bar", at: "grip", length: 0.14, plates: false },
      ],
    ),
  },

  invertedRow: {
    start: frame(
      {
        hip: { x: 0.5, y: 0.62 },
        torso: 285,
        head: 285,
        arms: [{ upper: 356, lower: 358 }, { upper: 2, lower: 4 }],
        legs: [{ upper: 100, lower: 96 }, { upper: 106, lower: 102 }],
        feet: 40,
      },
      [{ kind: "floor", y: 0.742 }, { kind: "bar", at: "grip", length: 0.3, plates: false }],
    ),
    finish: frame(
      {
        hip: { x: 0.5, y: 0.585 },
        torso: 285,
        head: 285,
        // The bar is fixed, so the elbows fold and the whole body rises to it.
        arms: [{ upper: 330, lower: 20 }, { upper: 336, lower: 26 }],
        legs: [{ upper: 100, lower: 96 }, { upper: 106, lower: 102 }],
        feet: 40,
      },
      [{ kind: "floor", y: 0.742 }, { kind: "bar", at: "grip", length: 0.3, plates: false }],
    ),
  },

  hangingRaise: {
    start: frame(
      {
        hip: { x: 0.5, y: 0.62 },
        torso: 356,
        head: 356,
        arms: [{ upper: 2, lower: 1 }, { upper: 8, lower: 7 }],
        legs: [{ upper: 176, lower: 177 }, { upper: 182, lower: 183 }],
        feet: 130,
      },
      [{ kind: "bar", at: "grip", length: 0.4, plates: false }],
    ),
    finish: frame(
      {
        hip: { x: 0.5, y: 0.62 },
        torso: 356,
        head: 356,
        arms: [{ upper: 2, lower: 1 }, { upper: 8, lower: 7 }],
        legs: [{ upper: 80, lower: 150 }, { upper: 86, lower: 156 }],
        feet: 130,
      },
      [{ kind: "bar", at: "grip", length: 0.4, plates: false }],
    ),
  },

  proneRaise: {
    start: frame(
      {
        hip: { x: 0.5, y: 0.66 },
        torso: 268,
        head: 262,
        arms: [{ upper: 268, lower: 272 }, { upper: 274, lower: 278 }],
        legs: [{ upper: 92, lower: 92 }, { upper: 98, lower: 98 }],
        feet: 120,
      },
      [{ kind: "floor", y: 0.765 }],
    ),
    finish: frame(
      {
        hip: { x: 0.5, y: 0.66 },
        // Chest arches up as well: without it the two frames are a straight
        // line and a slightly less straight line.
        torso: 290,
        head: 280,
        // Arms and legs both come off the ground, which is the whole exercise.
        arms: [{ upper: 300, lower: 305 }, { upper: 306, lower: 311 }],
        legs: [{ upper: 70, lower: 62 }, { upper: 76, lower: 68 }],
        feet: 110,
      },
      [{ kind: "floor", y: 0.765 }],
    ),
  },

  // --- hip and leg ---------------------------------------------------------

  hipThrust: {
    start: frame(
      {
        hip: { x: 0.44, y: 0.52 },
        torso: 285,
        head: 285,
        arms: [{ upper: 120, lower: 130 }, { upper: 126, lower: 136 }],
        legs: [{ upper: 80, lower: 172 }, { upper: 86, lower: 178 }],
        feet: 95,
      },
      [
        { kind: "floor", y: 0.741 },
        { kind: "slab", at: "shoulder", width: 0.18, height: 0.03, dy: 0.03 },
        { kind: "bar", at: "hip", length: 0.3 },
      ],
    ),
    finish: frame(
      {
        hip: { x: 0.44, y: 0.44 },
        // Shoulders stay on the bench and the feet stay planted; only the hip
        // travels, which is what makes this a thrust and not a bridge-shaped squat.
        torso: 268,
        head: 268,
        arms: [{ upper: 120, lower: 130 }, { upper: 126, lower: 136 }],
        legs: [{ upper: 100, lower: 169 }, { upper: 106, lower: 175 }],
        feet: 95,
      },
      [
        { kind: "floor", y: 0.741 },
        { kind: "slab", at: "shoulder", width: 0.18, height: 0.03, dy: 0.03 },
        { kind: "bar", at: "hip", length: 0.3 },
      ],
    ),
  },

  legCurl: {
    start: frame(
      {
        hip: { x: 0.5, y: 0.62 },
        torso: 265,
        head: 260,
        arms: [{ upper: 265, lower: 265 }, { upper: 271, lower: 271 }],
        legs: [{ upper: 92, lower: 90 }, { upper: 98, lower: 96 }],
        feet: 130,
      },
      [{ kind: "floor", y: 0.727 }, { kind: "slab", at: "hip", width: 0.4, height: 0.03, dy: 0.03 }],
    ),
    finish: frame(
      {
        hip: { x: 0.5, y: 0.62 },
        torso: 265,
        head: 260,
        arms: [{ upper: 265, lower: 265 }, { upper: 271, lower: 271 }],
        // The knee does not move; the heel swings up towards it.
        legs: [{ upper: 92, lower: 10 }, { upper: 98, lower: 16 }],
        feet: 130,
      },
      [{ kind: "floor", y: 0.727 }, { kind: "slab", at: "hip", width: 0.4, height: 0.03, dy: 0.03 }],
    ),
  },

  splitSquat: {
    start: frame(
      {
        hip: { x: 0.5, y: 0.58 },
        torso: 3,
        arms: [{ upper: 176, lower: 179 }, { upper: 183, lower: 186 }],
        legs: [{ upper: 168, lower: 178 }, { upper: 205, lower: 225 }],
        feet: 92,
      },
      [
        { kind: "floor", y: 1.067 },
        { kind: "slab", at: "ankle1", width: 0.2, height: 0.045, dy: 0.03 },
        { kind: "bell", at: "hand0", each: true },
      ],
    ),
    finish: frame(
      {
        hip: { x: 0.5, y: 0.68 },
        torso: 8,
        arms: [{ upper: 176, lower: 179 }, { upper: 183, lower: 186 }],
        // Front shin stays over the foot; the rear knee is what drops.
        legs: [{ upper: 140, lower: 210 }, { upper: 195, lower: 250 }],
        feet: 92,
      },
      [
        { kind: "floor", y: 1.067 },
        { kind: "slab", at: "ankle1", width: 0.2, height: 0.045, dy: 0.03 },
        { kind: "bell", at: "hand0", each: true },
      ],
    ),
  },

  lateralLunge: {
    start: frame(
      { hip: HIP_STAND, torso: 0, arms: [{ upper: 172, lower: 176 }, { upper: -172, lower: -176 }], legs: [{ upper: 176, lower: 177 }, { upper: -176, lower: -177 }], feet: 100 },
      [],
    ),
    finish: frame(
      {
        hip: { x: 0.44, y: 0.68 },
        torso: 8,
        arms: [{ upper: 172, lower: 176 }, { upper: -172, lower: -176 }],
        // One knee bends deeply out to the side while the other leg stays long.
        legs: [{ upper: 140, lower: 190 }, { upper: -160, lower: -172 }],
        feet: 100,
      },
      [],
    ),
  },

  singleLegHinge: {
    start: frame(
      {
        hip: HIP_STAND,
        torso: 4,
        arms: [{ upper: 176, lower: 179 }, { upper: 183, lower: 186 }],
        legs: [{ upper: 178, lower: 179 }, { upper: 200, lower: 220 }],
        feet: 82,
      },
      [{ kind: "floor", y: 1.045 }, { kind: "bell", at: "hand0" }],
    ),
    finish: frame(
      {
        hip: { x: 0.56, y: 0.55 },
        torso: 100,
        head: 90,
        arms: [{ upper: 178, lower: 179 }, { upper: 185, lower: 186 }],
        // Free leg swings back to counterbalance the torso: the two lines
        // should read as one long lever through the hip.
        legs: [{ upper: 172, lower: 186 }, { upper: 280, lower: 276 }],
        feet: 82,
      },
      [{ kind: "floor", y: 1.045 }, { kind: "bell", at: "hand0" }],
    ),
  },

  wallSit: {
    start: frame(
      {
        hip: { x: 0.5, y: 0.6 },
        torso: 356,
        head: 356,
        arms: [{ upper: 176, lower: 178 }, { upper: 182, lower: 184 }],
        legs: [{ upper: 90, lower: 178 }, { upper: 96, lower: 184 }],
        feet: 92,
      },
      [{ kind: "floor" }],
    ),
    finish: frame(
      {
        hip: { x: 0.5, y: 0.605 },
        torso: 356,
        head: 356,
        arms: [{ upper: 176, lower: 178 }, { upper: 182, lower: 184 }],
        legs: [{ upper: 91, lower: 179 }, { upper: 97, lower: 185 }],
        feet: 92,
      },
      [{ kind: "floor" }],
    ),
  },

  jump: {
    start: frame(
      {
        hip: { x: 0.5, y: 0.7 },
        torso: 12,
        arms: [{ upper: 200, lower: 212 }, { upper: -200, lower: -212 }],
        legs: [{ upper: 145, lower: 208 }, { upper: -145, lower: -208 }],
        feet: 100,
      },
      [{ kind: "floor", y: 1.107 }],
    ),
    finish: frame(
      {
        hip: { x: 0.5, y: 0.46 },
        torso: 0,
        arms: [{ upper: 28, lower: 22 }, { upper: -28, lower: -22 }],
        legs: [{ upper: 172, lower: 174 }, { upper: -172, lower: -174 }],
        feet: 150,
      },
      // Pinned, not measured: the ground must not travel with the athlete.
      [{ kind: "floor", y: 1.107 }],
    ),
  },

  run: {
    start: frame(
      {
        hip: { x: 0.5, y: 0.56 },
        torso: 8,
        head: 8,
        arms: [{ upper: 140, lower: 50 }, { upper: 215, lower: 290 }],
        legs: [{ upper: 60, lower: 130 }, { upper: 200, lower: 160 }],
        feet: 110,
      },
      [{ kind: "floor", y: 1.03 }],
    ),
    finish: frame(
      {
        hip: { x: 0.5, y: 0.575 },
        torso: 8,
        head: 8,
        // Arms and legs trade places, which is the stride.
        arms: [{ upper: 215, lower: 290 }, { upper: 140, lower: 50 }],
        legs: [{ upper: 200, lower: 160 }, { upper: 60, lower: 130 }],
        feet: 110,
      },
      [{ kind: "floor", y: 1.03 }],
    ),
  },

  // --- trunk ---------------------------------------------------------------

  hollowHold: {
    start: frame(
      {
        hip: { x: 0.5, y: 0.68 },
        torso: 275,
        head: 268,
        arms: [{ upper: 275, lower: 278 }, { upper: 281, lower: 284 }],
        legs: [{ upper: 95, lower: 92 }, { upper: 101, lower: 98 }],
        feet: 100,
      },
      [{ kind: "floor", y: 0.774 }],
    ),
    finish: frame(
      {
        hip: { x: 0.5, y: 0.665 },
        torso: 280,
        head: 273,
        // Both ends come up and the hips stay down: the hollow shape.
        arms: [{ upper: 310, lower: 316 }, { upper: 316, lower: 322 }],
        legs: [{ upper: 62, lower: 56 }, { upper: 68, lower: 62 }],
        feet: 100,
      },
      [{ kind: "floor", y: 0.774 }],
    ),
  },

  sidePlank: {
    start: frame(
      {
        hip: { x: 0.5, y: 0.66 },
        torso: 285,
        head: 285,
        // One forearm on the ground, the other arm reaching straight up.
        arms: [{ upper: 180, lower: 265 }, { upper: 10, lower: 6 }],
        legs: [{ upper: 100, lower: 96 }, { upper: 106, lower: 102 }],
        feet: 100,
      },
      [{ kind: "floor", y: 0.806 }],
    ),
    finish: frame(
      {
        // A side plank that sags this far is a different exercise, so the
        // breathing motion is deliberately small.
        hip: { x: 0.5, y: 0.669 },
        torso: 287,
        head: 287,
        arms: [{ upper: 180, lower: 265 }, { upper: 10, lower: 6 }],
        legs: [{ upper: 101, lower: 97 }, { upper: 107, lower: 103 }],
        feet: 100,
      },
      [{ kind: "floor", y: 0.806 }],
    ),
  },

  woodchop: {
    start: frame(
      {
        hip: { x: 0.5, y: 0.6 },
        torso: -12,
        arms: [{ upper: 40, lower: 36 }, { upper: 46, lower: 42 }],
        legs: [{ upper: 166, lower: 169 }, { upper: -166, lower: -169 }],
        feet: 100,
      },
      [{ kind: "bell", at: "grip", size: 0.09 }],
    ),
    finish: frame(
      {
        hip: { x: 0.5, y: 0.64 },
        torso: 14,
        // Both hands travel together on a diagonal: that diagonal is the movement.
        arms: [{ upper: 214, lower: 210 }, { upper: 220, lower: 216 }],
        legs: [{ upper: 158, lower: 176 }, { upper: -158, lower: -176 }],
        feet: 100,
      },
      [{ kind: "bell", at: "grip", size: 0.09 }],
    ),
  },

  // A clean is a hinge that ends in a front rack. Showing only the pull would
  // make it a deadlift; the racked finish is what names it.
  clean: {
    start: frame(
      {
        hip: { x: 0.56, y: 0.55 },
        torso: 108,
        head: 96,
        arms: [{ upper: 176, lower: 179 }, { upper: 183, lower: 186 }],
        legs: [{ upper: 168, lower: 188 }, { upper: 174, lower: 194 }],
        feet: 82,
      },
      [{ kind: "floor", y: 1.045 }, { kind: "bar", at: "grip", length: 0.3 }],
    ),
    finish: frame(
      {
        hip: HIP_STAND,
        torso: 356,
        head: 356,
        // Elbows high, hands at the collarbone: the rack position.
        arms: [{ upper: 150, lower: 40 }, { upper: 156, lower: 46 }],
        legs: [{ upper: 178, lower: 179 }, { upper: 184, lower: 185 }],
        feet: 82,
      },
      [{ kind: "floor", y: 1.045 }, { kind: "bar", at: "shoulder", length: 0.3 }],
    ),
  },

  quadruped: {
    start: frame(
      {
        hip: { x: 0.52, y: 0.63 },
        torso: 285,
        head: 278,
        arms: [{ upper: 178, lower: 179 }, { upper: 184, lower: 185 }],
        // Thigh straight down to the knee, shin back along the ground.
        legs: [{ upper: 178, lower: 92 }, { upper: 184, lower: 98 }],
        feet: 60,
      },
      [{ kind: "floor", y: 0.902 }],
    ),
    finish: frame(
      {
        hip: { x: 0.52, y: 0.63 },
        torso: 285,
        head: 278,
        // Opposite arm and leg reach out; the other two stay planted.
        arms: [{ upper: 290, lower: 292 }, { upper: 184, lower: 185 }],
        legs: [{ upper: 178, lower: 92 }, { upper: 95, lower: 90 }],
        feet: 60,
      },
      [{ kind: "floor", y: 0.902 }],
    ),
  },

  // Side view, because a front raise seen from the front is a dot.
  frontRaise: {
    start: frame(
      {
        hip: HIP_STAND,
        torso: 356,
        head: 356,
        arms: [{ upper: 170, lower: 174 }, { upper: 176, lower: 180 }],
        legs: [{ upper: 178, lower: 179 }, { upper: 184, lower: 185 }],
        feet: 82,
      },
      [{ kind: "floor" }, { kind: "bell", at: "hand0", each: true, size: 0.05 }],
    ),
    finish: frame(
      {
        hip: HIP_STAND,
        torso: 356,
        head: 356,
        arms: [{ upper: 92, lower: 91 }, { upper: 98, lower: 97 }],
        legs: [{ upper: 178, lower: 179 }, { upper: 184, lower: 185 }],
        feet: 82,
      },
      [{ kind: "floor" }, { kind: "bell", at: "hand0", each: true, size: 0.05 }],
    ),
  },

  kickback: {
    start: frame(
      {
        hip: { x: 0.56, y: 0.56 },
        torso: 104,
        head: 92,
        // Upper arm pinned level and back; only the forearm moves.
        arms: [{ upper: 270, lower: 180 }, { upper: 276, lower: 186 }],
        legs: [{ upper: 168, lower: 186 }, { upper: 174, lower: 192 }],
        feet: 82,
      },
      [{ kind: "floor" }, { kind: "bell", at: "hand0", each: true, size: 0.05 }],
    ),
    finish: frame(
      {
        hip: { x: 0.56, y: 0.56 },
        torso: 104,
        head: 92,
        arms: [{ upper: 270, lower: 265 }, { upper: 276, lower: 271 }],
        legs: [{ upper: 168, lower: 186 }, { upper: 174, lower: 192 }],
        feet: 82,
      },
      [{ kind: "floor" }, { kind: "bell", at: "hand0", each: true, size: 0.05 }],
    ),
  },

  legExtension: {
    start: frame(
      {
        hip: { x: 0.42, y: 0.6 },
        torso: 356,
        head: 356,
        arms: [{ upper: 150, lower: 170 }, { upper: 156, lower: 176 }],
        legs: [{ upper: 92, lower: 175 }, { upper: 98, lower: 181 }],
        feet: 92,
      },
      [{ kind: "slab", at: "hip", width: 0.2, height: 0.03, dy: 0.03 }],
    ),
    finish: frame(
      {
        hip: { x: 0.42, y: 0.6 },
        torso: 356,
        head: 356,
        arms: [{ upper: 150, lower: 170 }, { upper: 156, lower: 176 }],
        legs: [{ upper: 92, lower: 88 }, { upper: 98, lower: 94 }],
        feet: 92,
      },
      [{ kind: "slab", at: "hip", width: 0.2, height: 0.03, dy: 0.03 }],
    ),
  },
} satisfies Record<string, ExercisePose>;

export type PoseName = keyof typeof exercisePoses;
