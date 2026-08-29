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
  | { kind: "slab"; x: number; y: number; width: number; height: number };

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
  | { kind: "slab"; at: string; width: number; height: number; dy?: number };

function frame(figure: Figure, props: PropSpec[] = []): PoseFrame {
  const { segments, joints } = build(figure);
  const drawn: PoseProp[] = [];
  for (const spec of props) {
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
      { hip: HIP_STAND, torso: 4, arms: [{ upper: 176, lower: 180 }], legs: [{ upper: 179, lower: 179 }], feet: 82 },
      [{ kind: "bar", at: "grip", length: 0.3 }],
    ),
    finish: frame(
      { hip: { x: 0.52, y: 0.6 }, torso: 72, head: 58, arms: [{ upper: 176, lower: 180 }], legs: [{ upper: 170, lower: 174 }], feet: 82 },
      [{ kind: "bar", at: "grip", length: 0.3 }],
    ),
  },

  bench: {
    start: frame(
      {
        hip: { x: 0.46, y: 0.62 },
        torso: 92,
        head: 92,
        arms: [{ upper: 8, lower: 2 }],
        legs: [{ upper: 156, lower: 186 }],
        feet: 92,
      },
      [
        { kind: "slab", at: "hip", width: 0.34, height: 0.035, dy: 0.028 },
        { kind: "bar", at: "grip", length: 0.3 },
      ],
    ),
    finish: frame(
      {
        hip: { x: 0.46, y: 0.62 },
        torso: 92,
        head: 92,
        arms: [{ upper: 62, lower: -18 }],
        legs: [{ upper: 156, lower: 186 }],
        feet: 92,
      },
      [
        { kind: "slab", at: "hip", width: 0.34, height: 0.035, dy: 0.028 },
        { kind: "bar", at: "grip", length: 0.3 },
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
      { hip: { x: 0.52, y: 0.6 }, torso: 68, head: 54, arms: [{ upper: 176, lower: 180 }], legs: [{ upper: 171, lower: 175 }], feet: 82 },
      [{ kind: "bar", at: "grip", length: 0.3 }],
    ),
    finish: frame(
      { hip: { x: 0.52, y: 0.6 }, torso: 68, head: 54, arms: [{ upper: 208, lower: 128 }], legs: [{ upper: 171, lower: 175 }], feet: 82 },
      [{ kind: "bar", at: "grip", length: 0.3 }],
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
      { hip: { x: 0.5, y: 0.62 }, torso: 76, head: 62, arms: [{ upper: 172, lower: 178 }], legs: [{ upper: 108, lower: 96 }], feet: 40 },
      [],
    ),
    finish: frame(
      { hip: { x: 0.5, y: 0.68 }, torso: 76, head: 62, arms: [{ upper: 214, lower: 132 }], legs: [{ upper: 106, lower: 94 }], feet: 40 },
      [],
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
      { hip: { x: 0.5, y: 0.6 }, torso: 0, arms: [{ upper: 176, lower: 179 }], legs: [{ upper: 179, lower: 180 }], feet: 88 },
      [],
    ),
    finish: frame(
      { hip: { x: 0.5, y: 0.54 }, torso: 0, arms: [{ upper: 176, lower: 179 }], legs: [{ upper: 179, lower: 180 }], feet: 128 },
      [],
    ),
  },

  plank: {
    start: frame(
      { hip: { x: 0.5, y: 0.62 }, torso: 74, head: 62, arms: [{ upper: 186, lower: 128 }], legs: [{ upper: 106, lower: 96 }], feet: 40 },
      [],
    ),
    finish: frame(
      { hip: { x: 0.5, y: 0.635 }, torso: 76, head: 63, arms: [{ upper: 186, lower: 128 }], legs: [{ upper: 106, lower: 96 }], feet: 40 },
      [],
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
} satisfies Record<string, ExercisePose>;

export type PoseName = keyof typeof exercisePoses;
