// The movements, as key positions.
//
// Split out of poses.ts so the model and the data are readable apart. Every
// movement is authored as the path of one repetition: the renderer walks the
// key positions in order and comes back, so the eccentric is the concentric in
// reverse and only one direction has to be written.
//
// Almost everything is drawn from the side. A front view cannot foreshorten,
// and in most exercises the limb travels forwards or backwards -- so face on, a
// squatting thigh gets drawn at full length out to the side and the leg becomes
// a diamond. The side is also the angle a coach watches from. Face on is kept
// only for movement that genuinely happens in that plane: raises, flyes, a
// lateral lunge, an overhead press.
//
// Contact points -- a planted foot, a hand on a bar -- are given as positions
// and solved with `reach`, never as angles.

import {
  pose, bothArms, sideArms, sideLegs, plantedLegs, reachingArms, grip,
  type ExercisePose, type Figure, type Limb, type Point,
} from "./poses";

// The ground sits high enough that a standing leg is not at full stretch --
// at full stretch there is no room left for the hips to sit back at all.
const GROUND = 0.938;
const FLOOR = 0.930;
const FEET: [Point, Point] = [{ x: 0.535, y: FLOOR }, { x: 0.515, y: FLOOR }];
const FEET_FRONT: [Point, Point] = [{ x: 0.565, y: FLOOR }, { x: 0.435, y: FLOOR }];

// Knees break forwards in a side view, outwards face on.
const FORWARD: [1 | -1, 1 | -1] = [-1, -1];
const OUT: [1 | -1, 1 | -1] = [-1, 1];
const BACK: [1 | -1, 1 | -1] = [1, 1];
const DOWN: [1 | -1, 1 | -1] = [1, -1];

// Arms are ropes in every pulling movement: they hang from the shoulder
// wherever the trunk happens to be, and the bar follows the hands.
const HANG = sideArms(178, 179);
const HANG_FRONT = bothArms(175, 178);

// Standing on both feet, seen from the side.
function stand(pelvis: Point, torso: number, arms: [Limb, Limb], neck?: number, feet = FEET): Figure {
  return { pelvis, torso, neck, arms, legs: plantedLegs(pelvis, torso, "side", feet, FORWARD) };
}
// The same face on.
function standFront(pelvisY: number, torso: number, arms: [Limb, Limb], feet = FEET_FRONT): Figure {
  const pelvis = { x: 0.5, y: pelvisY };
  return { pelvis, torso, arms, legs: plantedLegs(pelvis, torso, "front", feet, OUT) };
}

// A body held off the ground on its hands and toes -- push-up, plank, and the
// row done underneath a bar. Both ends are contact points, so both are solved.
function supported(pelvis: Point, torso: number, hands: Point, feet: Point, toes = 130): Figure {
  return {
    pelvis,
    torso,
    neck: torso - 12,
    arms: reachingArms(pelvis, torso, "side", [hands, { x: hands.x - 0.016, y: hands.y }], BACK),
    legs: plantedLegs(pelvis, torso, "side", [feet, { x: feet.x - 0.016, y: feet.y }], BACK, [toes, toes + 5]),
  };
}

export const exercisePoses = {
  // --- Squat pattern -------------------------------------------------------

  squat: pose(
    "side",
    // Hips travel back and down together; the trunk closes as they do.
    ([[0.500, 0.494, 2], [0.478, 0.578, 16], [0.454, 0.636, 30], [0.434, 0.690, 42]] as const).map(([x, y, torso]) =>
      stand({ x, y }, torso, sideArms(230, 60)),
    ),
    [{ kind: "floor" }, { kind: "bar", at: "grip", length: 0.17 }],
  ),

  splitSquat: pose(
    "side",
    [0.520, 0.588, 0.658].map((y) => {
      const pelvis = { x: 0.49, y };
      return {
        pelvis,
        torso: 6,
        arms: HANG,
        // Front foot flat, rear foot up on a box behind. Different heights, so
        // the two legs are solved separately.
        legs: plantedLegs(pelvis, 6, "side", [{ x: 0.60, y: FLOOR }, { x: 0.372, y: 0.868 }], FORWARD),
      };
    }),
    [
      { kind: "floor" },
      { kind: "slab", at: "ankle1", width: 0.17, height: 0.042, dy: 0.038 },
      { kind: "bell", at: "hand0", each: true },
    ],
    "neutral",
  ),

  lunge: pose(
    "side",
    [0.545, 0.612, 0.680].map((y) => {
      const pelvis = { x: 0.49, y };
      return {
        pelvis,
        torso: 4,
        arms: HANG,
        legs: plantedLegs(pelvis, 4, "side", [{ x: 0.605, y: FLOOR }, { x: 0.372, y: FLOOR }], FORWARD),
      };
    }),
    [{ kind: "floor" }, { kind: "bell", at: "hand0", each: true }],
    "neutral",
  ),

  lateralLunge: pose(
    "front",
    [
      standFront(0.497, 0, bothArms(150, 25)),
      { ...standFront(0.560, 5, bothArms(150, 25), [{ x: 0.645, y: FLOOR }, { x: 0.400, y: FLOOR }]), pelvis: { x: 0.482, y: 0.560 } },
      (() => {
        const pelvis = { x: 0.455, y: 0.605 };
        return {
          pelvis,
          torso: 10,
          arms: bothArms(150, 25),
          // One knee bends deeply over a wide foot; the other leg stays long.
          legs: plantedLegs(pelvis, 10, "front", [{ x: 0.676, y: FLOOR }, { x: 0.372, y: FLOOR }], OUT),
        };
      })(),
    ],
    [{ kind: "floor" }],
  ),

  wallSit: pose(
    "side",
    [
      { pelvis: { x: 0.44, y: 0.60 }, torso: 356, arms: sideArms(176, 178), legs: sideLegs(90, 178, 88) },
      { pelvis: { x: 0.44, y: 0.606 }, torso: 356, arms: sideArms(176, 178), legs: sideLegs(91, 179, 89) },
    ],
    // The wall is the exercise: without it the figure sat in mid-air.
    [{ kind: "floor" }, { kind: "slab", at: "shoulder", dx: -0.075, dy: 0.1, width: 0.045, height: 0.62 }],
  ),

  legExtension: pose(
    "side",
    [175, 132, 90].map((shin) => ({
      pelvis: { x: 0.40, y: 0.58 },
      torso: 356,
      arms: sideArms(150, 172),
      legs: sideLegs(92, shin, shin - 90),
    })),
    [{ kind: "floor", y: 0.9 }, { kind: "slab", at: "pelvis", width: 0.22, height: 0.035, dy: 0.042 }],
  ),

  legCurl: pose(
    "side",
    [90, 50, 14].map((shin) => ({
      pelvis: { x: 0.47, y: 0.62 },
      torso: 266,
      neck: 318,
      arms: sideArms(226, 300),
      legs: sideLegs(92, shin, shin + 40),
    })),
    [{ kind: "floor", y: 0.79 }, { kind: "slab", at: "pelvis", width: 0.40, height: 0.035, dy: 0.045 }],
  ),

  calfRaise: pose(
    "side",
    // A calf raise really does travel less than any other movement here; this
    // is the full range from a stretch under the step to full plantarflexion.
    [[0.545, 62], [0.498, 112], [0.450, 156]].map(([y, toe]) => ({
      pelvis: { x: 0.5, y: y! },
      torso: 0,
      arms: HANG,
      legs: sideLegs(178, 179, toe),
    })),
    [{ kind: "floor" }],
  ),

  jump: pose(
    "side",
    [
      stand({ x: 0.500, y: 0.494 }, 2, sideArms(178, 179)),
      stand({ x: 0.452, y: 0.630 }, 30, sideArms(212, 200)),
      // Airborne: nothing is planted, so the angles are direct and the ground
      // is pinned where the take-off was.
      { pelvis: { x: 0.49, y: 0.470 }, torso: 8, arms: sideArms(60, 40), legs: sideLegs(160, 172, 130) },
      { pelvis: { x: 0.50, y: 0.370 }, torso: 2, arms: sideArms(22, 14), legs: sideLegs(176, 178, 150) },
    ],
    [{ kind: "floor" }],
  ),

  run: pose(
    "side",
    [
      { pelvis: { x: 0.5, y: 0.520 }, torso: 8, arms: [{ upper: 142, lower: 52 }, { upper: 214, lower: 292 }], legs: [{ upper: 62, lower: 132, end: 40 }, { upper: 202, lower: 162, end: 88 }] },
      { pelvis: { x: 0.5, y: 0.535 }, torso: 8, arms: [{ upper: 178, lower: 172 }, { upper: 182, lower: 188 }], legs: [{ upper: 132, lower: 148, end: 60 }, { upper: 232, lower: 196, end: 110 }] },
      // Arms and legs trade sides, which is the stride.
      { pelvis: { x: 0.5, y: 0.520 }, torso: 8, arms: [{ upper: 214, lower: 292 }, { upper: 142, lower: 52 }], legs: [{ upper: 202, lower: 162, end: 88 }, { upper: 62, lower: 132, end: 40 }] },
    ],
    [{ kind: "floor", y: 0.978 }],
  ),

  // --- Hinge pattern -------------------------------------------------------

  hinge: pose(
    "side",
    ([[0.500, 0.494, 4], [0.528, 0.528, 40], [0.552, 0.538, 72], [0.570, 0.550, 98]] as const).map(([x, y, torso]) =>
      stand({ x, y }, torso, HANG, torso > 30 ? torso - 16 : torso),
    ),
    [{ kind: "floor" }, { kind: "bar", at: "grip", length: 0.17 }],
  ),

  singleLegHinge: pose(
    "side",
    ([[0.500, 0.494, 4, 196, 214], [0.532, 0.530, 50, 248, 254], [0.560, 0.542, 94, 284, 278]] as const).map(([x, y, torso, up, low]) => {
      const pelvis = { x, y };
      return {
        pelvis,
        torso,
        neck: torso > 30 ? torso - 14 : torso,
        arms: HANG,
        // Standing leg solved to the floor; the free leg swings back as the
        // counterweight, which is the balance the movement is built on.
        legs: [plantedLegs(pelvis, torso, "side", FEET, FORWARD)[0], { upper: up, lower: low, end: low - 90 }],
      };
    }),
    [{ kind: "floor" }, { kind: "bell", at: "hand0" }],
    "neutral",
  ),

  hipThrust: pose(
    "side",
    ([[0.575, 300], [0.505, 284], [0.435, 266]] as const).map(([y, torso]) => {
      const pelvis = { x: 0.45, y };
      return {
        pelvis,
        torso,
        // Chin tucked, face forward -- not trailing off the bench.
        neck: torso + 54,
        arms: sideArms(122, 132),
        // Shoulders stay on the bench and the feet stay planted; only the hip
        // travels, which is what makes it a thrust and not a squat lying down.
        legs: plantedLegs(pelvis, torso, "side", [{ x: 0.645, y: 0.735 }, { x: 0.629, y: 0.735 }], FORWARD, [88, 93]),
      };
    }),
    [
      { kind: "floor", y: 0.742 },
      { kind: "slab", at: "shoulder", width: 0.20, height: 0.035, dy: 0.038 },
      { kind: "bar", at: "pelvis", length: 0.17 },
    ],
  ),

  clean: pose(
    "side",
    // Floor, past the knee, the extension, the catch, and standing. Showing
    // only the first and last is what made the old version a deadlift.
    ([[0.570, 96], [0.548, 60], [0.516, 16], [0.500, 4], [0.500, 356]] as const).map(([x, torso], i) => {
      const pelvis = { x, y: [0.552, 0.538, 0.518, 0.556, 0.494][i]! };
      return {
        pelvis,
        torso,
        neck: torso > 30 ? torso - 16 : torso,
        arms: i >= 3 ? sideArms(150, 42) : HANG,
        legs: plantedLegs(pelvis, torso, "side", FEET, FORWARD),
      };
    }),
    [{ kind: "floor" }, { kind: "bar", at: "grip", length: 0.17 }],
  ),

  quadruped: pose(
    "side",
    [
      quadrupedFrame(),
      {
        ...quadrupedFrame(),
        // Opposite arm and leg reach out; the other two stay planted.
        arms: [{ upper: 292, lower: 296 }, quadrupedFrame().arms[1]!],
        legs: [quadrupedFrame().legs[0]!, { upper: 96, lower: 92, end: 60 }],
      },
    ],
    [{ kind: "floor" }],
  ),

  // --- Horizontal push -----------------------------------------------------

  bench: pose(
    "side",
    [0.352, 0.422, 0.492].map((barY) => bench(barY)),
    [
      { kind: "floor" },
      { kind: "slab", at: "pelvis", width: 0.40, height: 0.035, dy: 0.045 },
      { kind: "bar", at: "grip", length: 0.17 },
    ],
  ),

  inclinePress: pose(
    "side",
    [0.300, 0.372, 0.444].map((barY) => incline(barY)),
    [
      { kind: "floor" },
      { kind: "slab", at: "pelvis", width: 0.22, height: 0.035, dy: 0.045 },
      { kind: "bar", at: "grip", length: 0.17 },
    ],
  ),

  skullCrusher: pose(
    "side",
    [354, 318, 282].map((forearm) => ({
      ...bench(0.352),
      arms: [{ upper: 354, lower: forearm }, { upper: 359, lower: forearm + 5 }] as [Limb, Limb],
    })),
    [
      { kind: "floor" },
      { kind: "slab", at: "pelvis", width: 0.40, height: 0.035, dy: 0.045 },
      { kind: "bar", at: "grip", length: 0.14, plates: false },
    ],
  ),

  pushUp: pose(
    "side",
    // The hips barely move: it is the trunk that rotates about the toes, and
    // the shoulder that travels. Dropping the pelvis instead makes a sag.
    ([273, 262, 248] as const).map((torso) =>
      supported({ x: 0.545, y: 0.600 }, torso, { x: 0.392, y: 0.855 }, { x: 0.755, y: 0.855 }),
    ),
    [{ kind: "floor" }],
  ),

  kneePushUp: pose(
    "side",
    ([288, 274, 256] as const).map((torso) => {
      const pelvis = { x: 0.585, y: 0.700 };
      return {
        pelvis,
        torso,
        neck: torso,
        arms: reachingArms(pelvis, torso, "side", [{ x: 0.410, y: 0.885 }, { x: 0.394, y: 0.885 }], BACK),
        // Knee on the floor with the shin lying along it behind: that is the
        // whole difference from a full push-up and it has to be visible.
        legs: sideLegs(155, 88, 30),
      };
    }),
    [{ kind: "floor" }],
  ),

  plank: pose(
    "side",
    [
      // Held on the forearms, so the elbow is the contact and the hand is flat
      // in front of it.
      { ...supported({ x: 0.545, y: 0.600 }, 268, { x: 0.392, y: 0.855 }, { x: 0.755, y: 0.855 }), arms: [{ upper: 192, lower: 272, end: 272 }, { upper: 197, lower: 277, end: 277 }] },
      { ...supported({ x: 0.545, y: 0.603 }, 267, { x: 0.392, y: 0.855 }, { x: 0.755, y: 0.855 }), arms: [{ upper: 193, lower: 272, end: 272 }, { upper: 198, lower: 277, end: 277 }] },
    ],
    [{ kind: "floor" }],
  ),

  dip: pose(
    "side",
    [0.530, 0.605, 0.685].map((y) => {
      const pelvis = { x: 0.5, y };
      return {
        pelvis,
        torso: 8,
        neck: 6,
        arms: reachingArms(pelvis, 8, "side", [{ x: 0.516, y: 0.572 }, { x: 0.500, y: 0.572 }], BACK),
        legs: sideLegs(142, 100, 40),
      };
    }),
    [{ kind: "bar", at: "grip", length: 0.14, plates: false }],
  ),

  fly: pose(
    "front",
    [96, 60, 24].map((arm) => standFront(0.497, 0, bothArms(arm, arm - 4))),
    [{ kind: "floor" }, { kind: "bell", at: "hand0", each: true, size: 0.05 }],
    "neutral",
  ),

  // --- Vertical push -------------------------------------------------------

  overheadPress: pose(
    "front",
    [0.300, 0.222, 0.146].map((barY) => {
      const pelvis = { x: 0.5, y: 0.497 };
      return {
        pelvis,
        torso: 0,
        arms: reachingArms(pelvis, 0, "front", grip({ x: 0.5, y: barY }, 0.118, "front"), DOWN),
        legs: plantedLegs(pelvis, 0, "front", FEET_FRONT, OUT),
      };
    }),
    [{ kind: "floor" }, { kind: "bar", at: "grip", length: 0.40 }],
  ),

  lateralRaise: pose(
    "front",
    [170, 131, 93].map((arm) => standFront(0.497, 0, bothArms(arm, arm + 3))),
    [{ kind: "floor" }, { kind: "bell", at: "hand0", each: true, size: 0.05 }],
    "neutral",
  ),

  frontRaise: pose(
    "side",
    [174, 133, 92].map((arm) => stand({ x: 0.5, y: 0.494 }, 356, sideArms(arm, arm + 2))),
    [{ kind: "floor" }, { kind: "bell", at: "hand0", each: true, size: 0.05 }],
    "neutral",
  ),

  tricepsExtension: pose(
    "front",
    [100, 138, 174].map((forearm) => standFront(0.497, 0, bothArms(170, forearm))),
    [{ kind: "floor" }, { kind: "bar", at: "grip", length: 0.16, plates: false }],
  ),

  kickback: pose(
    "side",
    [180, 222, 264].map((forearm) => {
      const pelvis = { x: 0.545, y: 0.552 };
      return {
        pelvis,
        torso: 98,
        neck: 84,
        arms: sideArms(270, forearm),
        legs: plantedLegs(pelvis, 98, "side", FEET, FORWARD),
      };
    }),
    [{ kind: "floor" }, { kind: "bell", at: "hand0", each: true, size: 0.05 }],
    "neutral",
  ),

  // --- Pulling -------------------------------------------------------------

  bentRow: pose(
    "side",
    [0.838, 0.780, 0.722].map((barY) => {
      const pelvis = { x: 0.558, y: 0.548 };
      return {
        pelvis,
        torso: 96,
        neck: 82,
        // The hands hang under the shoulders, and the shoulders are to the
        // RIGHT of the hips once the trunk is folded over that way.
        arms: reachingArms(pelvis, 96, "side", [{ x: 0.712, y: barY }, { x: 0.696, y: barY }], BACK),
        legs: plantedLegs(pelvis, 96, "side", FEET, FORWARD),
      };
    }),
    [{ kind: "floor" }, { kind: "bar", at: "grip", length: 0.17 }],
  ),

  seatedRow: pose(
    "side",
    [0.600, 0.540, 0.480].map((handX) => {
      const pelvis = { x: 0.42, y: 0.600 };
      const torso = handX > 0.58 ? 6 : handX > 0.52 ? 0 : 353;
      return {
        pelvis,
        torso,
        neck: torso,
        arms: reachingArms(pelvis, torso, "side", [{ x: handX, y: 0.485 }, { x: handX - 0.016, y: 0.485 }], BACK),
        legs: sideLegs(96, 168, 82),
      };
    }),
    [
      { kind: "floor" },
      { kind: "slab", at: "pelvis", width: 0.16, height: 0.035, dy: 0.042 },
      { kind: "bar", at: "grip", length: 0.10, plates: false },
    ],
  ),

  pulldown: pose(
    "front",
    [0.180, 0.244, 0.310].map((barY) => {
      const pelvis = { x: 0.5, y: 0.492 };
      return {
        pelvis,
        torso: 4,
        arms: reachingArms(pelvis, 4, "front", grip({ x: 0.5, y: barY }, 0.145, "front"), DOWN),
        legs: plantedLegs(pelvis, 4, "front", FEET_FRONT, OUT),
      };
    }),
    [{ kind: "bar", at: "grip", length: 0.44, plates: false }],
  ),

  pullUp: pose(
    "front",
    [0.586, 0.510, 0.428].map((pelvisY) => {
      const pelvis = { x: 0.5, y: pelvisY };
      return {
        pelvis,
        torso: 2,
        // The bar is fixed; the body climbs to it.
        arms: reachingArms(pelvis, 2, "front", grip({ x: 0.5, y: 0.186 }, 0.145, "front"), DOWN),
        legs: bothArms(174, 176),
      };
    }),
    [{ kind: "bar", at: "grip", length: 0.44, plates: false }],
  ),

  invertedRow: pose(
    "side",
    [0.668, 0.612, 0.556].map((pelvisY) => {
      const pelvis = { x: 0.52, y: pelvisY };
      const torso = 284;
      return {
        pelvis,
        torso,
        neck: torso,
        arms: reachingArms(pelvis, torso, "side", [{ x: 0.335, y: 0.350 }, { x: 0.319, y: 0.350 }], BACK),
        legs: plantedLegs(pelvis, torso, "side", [{ x: 0.745, y: 0.815 }, { x: 0.729, y: 0.815 }], BACK, [40, 45]),
      };
    }),
    [{ kind: "floor" }, { kind: "bar", at: "grip", length: 0.17, plates: false }],
  ),

  hangingRaise: pose(
    "side",
    [[178, 179], [122, 152], [78, 148]].map(([thigh, shin]) => ({
      pelvis: { x: 0.5, y: 0.560 },
      torso: 357,
      arms: sideArms(3, 2),
      legs: sideLegs(thigh!, shin!, shin! - 60),
    })),
    [{ kind: "bar", at: "grip", length: 0.30, plates: false }],
  ),

  curl: pose(
    "side",
    [178, 130, 74].map((forearm) => stand({ x: 0.5, y: 0.494 }, 356, sideArms(176, forearm))),
    [{ kind: "floor" }, { kind: "bell", at: "hand0", each: true }],
    "underhand",
  ),

  proneRaise: pose(
    "side",
    [
      { pelvis: { x: 0.5, y: 0.680 }, torso: 268, neck: 262, arms: sideArms(268, 272), legs: sideLegs(92, 92, 40) },
      { pelvis: { x: 0.5, y: 0.678 }, torso: 280, neck: 272, arms: sideArms(292, 296), legs: sideLegs(80, 76, 26) },
      // Chest and legs both come off the ground, which is the whole exercise.
      { pelvis: { x: 0.5, y: 0.676 }, torso: 292, neck: 282, arms: sideArms(312, 318), legs: sideLegs(68, 60, 12) },
    ],
    [{ kind: "floor", y: 0.786 }],
  ),

  // --- Trunk ---------------------------------------------------------------

  hollowHold: pose(
    "side",
    [
      { pelvis: { x: 0.5, y: 0.700 }, torso: 274, neck: 268, arms: sideArms(276, 279), legs: sideLegs(95, 92, 40) },
      { pelvis: { x: 0.5, y: 0.696 }, torso: 278, neck: 271, arms: sideArms(294, 298), legs: sideLegs(78, 74, 24) },
      { pelvis: { x: 0.5, y: 0.692 }, torso: 282, neck: 274, arms: sideArms(312, 317), legs: sideLegs(62, 56, 8) },
    ],
    [{ kind: "floor", y: 0.792 }],
  ),

  sidePlank: pose(
    "side",
    [
      // One forearm on the ground and the other arm reaching straight up: the
      // asymmetry is what says "side" rather than "front".
      { pelvis: { x: 0.5, y: 0.665 }, torso: 286, neck: 286, arms: [{ upper: 180, lower: 266, end: 266 }, { upper: 10, lower: 6 }], legs: sideLegs(100, 96, 10) },
      { pelvis: { x: 0.5, y: 0.688 }, torso: 289, neck: 289, arms: [{ upper: 180, lower: 266, end: 266 }, { upper: 10, lower: 6 }], legs: sideLegs(104, 100, 14) },
    ],
    [{ kind: "floor" }],
  ),

  woodchop: pose(
    "front",
    [
      { pelvis: { x: 0.5, y: 0.520 }, torso: 348, arms: [{ upper: 38, lower: 34 }, { upper: 44, lower: 40 }], legs: plantedLegs({ x: 0.5, y: 0.520 }, 348, "front", [{ x: 0.612, y: FLOOR }, { x: 0.388, y: FLOOR }], OUT) },
      { pelvis: { x: 0.5, y: 0.555 }, torso: 0, arms: [{ upper: 126, lower: 122 }, { upper: 132, lower: 128 }], legs: plantedLegs({ x: 0.5, y: 0.555 }, 0, "front", [{ x: 0.612, y: FLOOR }, { x: 0.388, y: FLOOR }], OUT) },
      // Both hands travel together on a diagonal; that diagonal is the exercise.
      { pelvis: { x: 0.5, y: 0.585 }, torso: 12, arms: [{ upper: 214, lower: 210 }, { upper: 220, lower: 216 }], legs: plantedLegs({ x: 0.5, y: 0.585 }, 12, "front", [{ x: 0.612, y: FLOOR }, { x: 0.388, y: FLOOR }], OUT) },
    ],
    [{ kind: "floor" }, { kind: "bell", at: "grip", size: 0.085 }],
  ),

  carry: pose(
    "side",
    [
      { pelvis: { x: 0.5, y: 0.520 }, torso: 0, arms: HANG, legs: [{ upper: 172, lower: 176, end: 86 }, { upper: 186, lower: 182, end: 92 }] },
      { pelvis: { x: 0.5, y: 0.516 }, torso: 1, arms: HANG, legs: [{ upper: 182, lower: 179, end: 89 }, { upper: 176, lower: 179, end: 89 }] },
      { pelvis: { x: 0.5, y: 0.520 }, torso: 0, arms: HANG, legs: [{ upper: 190, lower: 184, end: 94 }, { upper: 168, lower: 174, end: 84 }] },
    ],
    [{ kind: "floor", y: 0.972 }, { kind: "bell", at: "hand0", each: true }],
    "neutral",
  ),
} satisfies Record<string, ExercisePose>;

// --- Frame builders --------------------------------------------------------

// Hands and knees. The trunk rides low, because an arm is 0.29 long and it has
// to reach the ground.
function quadrupedFrame(): Figure {
  return supported({ x: 0.560, y: 0.700 }, 288, { x: 0.408, y: 0.893 }, { x: 0.700, y: 0.893 }, 95);
}

// Supine on a flat bench, head to the left, feet planted on the floor. The bar
// height is the only thing that changes through the press.
function bench(barY: number): Figure {
  const pelvis = { x: 0.560, y: 0.600 };
  const torso = 272;
  return {
    pelvis,
    torso,
    neck: torso,
    arms: reachingArms(pelvis, torso, "side", [{ x: 0.396, y: barY }, { x: 0.380, y: barY }], BACK),
    legs: plantedLegs(pelvis, torso, "side", [{ x: 0.688, y: FLOOR }, { x: 0.672, y: FLOOR }], FORWARD),
  };
}

// The same on a bench set at an incline, so the trunk climbs to the left.
function incline(barY: number): Figure {
  const pelvis = { x: 0.585, y: 0.640 };
  const torso = 306;
  return {
    pelvis,
    torso,
    neck: torso,
    arms: reachingArms(pelvis, torso, "side", [{ x: 0.408, y: barY }, { x: 0.392, y: barY }], BACK),
    legs: plantedLegs(pelvis, torso, "side", [{ x: 0.712, y: FLOOR }, { x: 0.696, y: FLOOR }], FORWARD),
  };
}

export type PoseName = keyof typeof exercisePoses;
