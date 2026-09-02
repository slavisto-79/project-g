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
  pose, bothArms, sideArms, sideLegs, plantedLegs, reachingArms, grip, spineTop,
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
const DOWN_SIDE: [1 | -1, 1 | -1] = [1, 1];

// Arms are ropes in every pulling movement: they hang from the shoulder
// wherever the trunk happens to be, and the bar follows the hands.
const HANG = sideArms(178, 179);
// Hinged movements hang the hands a few degrees forward of plumb: the bar
// travels in FRONT of the shins, and the knees never cross its line.
const HANG_AHEAD = sideArms(168, 171);
const HANG_FRONT = bothArms(175, 178);

// One squat descent, shared by every carry variant of it.
const SQUAT_FRAMES = [
  [0.500, 0.494, 2], [0.478, 0.578, 16], [0.454, 0.636, 30], [0.434, 0.690, 42],
] as const;

// Hands gripping a bar that lies ACROSS THE TRAPS: the target is the nape --
// just behind and below the top of the spine, in the trunk's own frame, so it
// rides the back as the torso tilts.
function napeArms(pelvis: Point, torso: number): [Limb, Limb] {
  const top = spineTop(pelvis, torso);
  const rad = (torso * Math.PI) / 180;
  // Trunk axis and its forward perpendicular, in screen terms.
  const nape = {
    x: top.x - (0.02 * Math.cos(rad)) / (850 / 567) + (0.008 * Math.sin(rad)) / (850 / 567),
    y: top.y - 0.02 * Math.sin(rad) - 0.008 * Math.cos(rad),
  };
  const near = reachingArms(pelvis, torso, "side", [nape, nape], FORWARD)[0]!;
  return [near, echo(near)];
}

// Hands hugging a bell against the chest, elbows tucked down.
function chestArms(pelvis: Point, torso: number): [Limb, Limb] {
  const top = spineTop(pelvis, torso);
  const rad = (torso * Math.PI) / 180;
  const chest = {
    x: top.x + (0.055 * Math.cos(rad)) / (850 / 567) + (0.05 * Math.sin(rad)) / (850 / 567),
    y: top.y + 0.055 * Math.sin(rad) + 0.05 * Math.cos(rad),
  };
  return reachingArms(pelvis, torso, "side", [chest, { x: chest.x - 0.012, y: chest.y + 0.01 }], DOWN_SIDE);
}

// Standing on both feet, seen from the side.
function stand(pelvis: Point, torso: number, arms: [Limb, Limb], neck?: number, feet = FEET): Figure {
  return { pelvis, torso, neck, arms, legs: plantedLegs(pelvis, torso, "side", feet, FORWARD) };
}
// The same face on.
function standFront(pelvisY: number, torso: number, arms: [Limb, Limb], feet = FEET_FRONT): Figure {
  const pelvis = { x: 0.5, y: pelvisY };
  return { pelvis, torso, arms, legs: plantedLegs(pelvis, torso, "front", feet, OUT) };
}

// The far limb repeats the near solve a few degrees into the page. Solving
// it against a screen-shifted target instead folded it against a joint that
// sits a girdle-depth away -- push-up far legs bent 40 degrees BACKWARD.
function echo(limb: Limb, end?: number): Limb {
  return { upper: limb.upper + 4, lower: limb.lower + 4, ...(end !== undefined ? { end } : {}) };
}

// A body held off the ground on its hands and toes -- push-up, plank, and the
// row done underneath a bar. Both ends are contact points; the NEAR side is
// solved and the far side echoes it.
function supported(pelvis: Point, torso: number, hands: Point, feet: Point, toes = 130): Figure {
  // Palms flat on the ground: the hand angle is a world constant, so the
  // wrist visibly articulates as the arm changes angle above it.
  const arm = reachingArms(pelvis, torso, "side", [hands, hands], BACK, [264, 264])[0]!;
  return {
    pelvis,
    torso,
    neck: torso - 4,
    arms: [arm, echo(arm, 259)],
    // Both feet are ON the floor, so both are solved -- with the knee told to
    // sag toward the ground, which is the way a knee in a plank can fold.
    legs: plantedLegs(pelvis, torso, "side", [feet, { x: feet.x - 0.016, y: feet.y }], BACK, [toes, toes + 5]),
  };
}

export const exercisePoses = {
  // --- Squat pattern -------------------------------------------------------

  squat: pose(
    "side",
    SQUAT_FRAMES.map(([x, y, torso]) => stand({ x, y }, torso, napeArms({ x, y }, torso))),
    // The bar is drawn at the grip, and the grip is ON the traps -- so the bar
    // visibly rides the upper back, where a back squat actually carries it.
    [{ kind: "floor" }, { kind: "bar", at: "grip", length: 0.17 }],
  ),

  // A front squat racks the bar on the front delts with high elbows -- the
  // clean's catch -- and the trunk stays far more upright than a back squat,
  // which is the entire point of the front rack.
  frontSquat: pose(
    "side",
    ([[0.500, 0.494, 2], [0.484, 0.578, 7], [0.466, 0.636, 12], [0.450, 0.690, 15]] as const).map(([x, y, torso]) =>
      stand({ x, y }, torso, sideArms(150, 40)),
    ),
    [{ kind: "floor" }, { kind: "bar", at: "grip", length: 0.17 }],
  ),

  // A goblet squat hugs the bell against the chest with both hands.
  gobletSquat: pose(
    "side",
    SQUAT_FRAMES.map(([x, y, torso]) => stand({ x, y }, torso, chestArms({ x, y }, torso))),
    [{ kind: "floor" }, { kind: "bell", at: "grip", size: 0.06 }],
    "neutral",
  ),

  // Bodyweight: arms reach forward as the counterbalance.
  bodyweightSquat: pose(
    "side",
    SQUAT_FRAMES.map(([x, y, torso]) => stand({ x, y }, torso, sideArms(96, 92))),
    [{ kind: "floor" }],
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
      legs: sideLegs(92, shin, shin + 85),
    })),
    [{ kind: "floor", y: 0.79 }, { kind: "slab", at: "pelvis", width: 0.40, height: 0.035, dy: 0.045 }],
    "overhand",
    -1,
  ),

  calfRaise: pose(
    "side",
    // A calf raise really does travel less than any other movement here; this
    // is the full range from a stretch under the step to full plantarflexion.
    [[0.545, 62], [0.498, 112], [0.450, 141]].map(([y, toe]) => ({
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
      { pelvis: { x: 0.50, y: 0.370 }, torso: 2, arms: sideArms(22, 14), legs: sideLegs(176, 178, 140) },
    ],
    [{ kind: "floor" }],
  ),

  run: pose(
    "side",
    [
      { pelvis: { x: 0.5, y: 0.520 }, torso: 8, arms: [{ upper: 142, lower: 52 }, { upper: 214, lower: 140 }], legs: [{ upper: 62, lower: 132, end: 40 }, { upper: 202, lower: 230, end: 150 }] },
      { pelvis: { x: 0.5, y: 0.535 }, torso: 8, arms: [{ upper: 178, lower: 172 }, { upper: 182, lower: 188 }], legs: [{ upper: 132, lower: 148, end: 60 }, { upper: 232, lower: 285, end: 205 }] },
      // Arms and legs trade sides, which is the stride -- but every knee and
      // elbow keeps folding the same anatomical way through the swap.
      { pelvis: { x: 0.5, y: 0.520 }, torso: 8, arms: [{ upper: 214, lower: 140 }, { upper: 142, lower: 52 }], legs: [{ upper: 202, lower: 230, end: 150 }, { upper: 62, lower: 132, end: 40 }] },
    ],
    [{ kind: "floor", y: 0.978 }],
  ),

  // --- Hinge pattern -------------------------------------------------------

  hinge: pose(
    "side",
    ([[0.500, 0.494, 4], [0.528, 0.528, 40], [0.552, 0.538, 72], [0.570, 0.550, 98]] as const).map(([x, y, torso]) =>
      stand({ x, y }, torso, HANG_AHEAD, torso > 30 ? torso - 16 : torso),
    ),
    [{ kind: "floor" }, { kind: "bar", at: "grip", length: 0.17 }],
  ),

  goodMorning: pose(
    "side",
    ([[0.500, 0.494, 4], [0.528, 0.528, 40], [0.552, 0.538, 72]] as const).map(([x, y, torso]) =>
      stand({ x, y }, torso, napeArms({ x, y }, torso), torso > 30 ? torso - 16 : torso),
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
        arms: HANG_AHEAD,
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
      { kind: "bar", at: "pelvis", dy: -0.048, length: 0.17 },
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
        arms: i >= 3 ? sideArms(150, 42) : HANG_AHEAD,
        legs: plantedLegs(pelvis, torso, "side", FEET, FORWARD),
      };
    }),
    [{ kind: "floor" }, { kind: "bar", at: "grip", length: 0.17 }],
  ),

  // A plank on locked arms with the knees driving alternately to the chest.
  // Two key positions with the legs swapped; the ping-pong playback IS the
  // alternation.
  mountainClimber: pose(
    "side",
    [0, 1].map((phase) => {
      const pelvis = { x: 0.485, y: 0.689 };
      const torso = 292.3;
      const planted = plantedLegs(pelvis, torso, "side", [{ x: 0.755, y: 0.855 }, { x: 0.739, y: 0.855 }], BACK, [130, 135]);
      // Knee driven UNDER the chest, shin hanging straight down -- and folding
      // the same anatomical way as the planted leg, so the swap between the
      // two never carries a joint through hyperextension.
      const tucked: Limb = { upper: 330, lower: 185, end: 115 };
      return {
        pelvis,
        torso,
        neck: torso - 4,
        arms: reachingArms(pelvis, torso, "side", [{ x: 0.392, y: 0.855 }, { x: 0.376, y: 0.855 }], BACK, [264, 259]),
        legs: (phase === 0 ? [planted[0]!, tucked] : [tucked, planted[1]!]) as [Limb, Limb],
      };
    }),
    [{ kind: "floor" }],
    "overhand",
    -1,
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
    "overhand",
    -1,
  ),

  // --- Horizontal push -----------------------------------------------------

  bench: pose(
    "side",
    ([[0.397, 0.285], [0.450, 0.375], [0.505, 0.465]] as const).map(([barX, barY]) => bench(barX, barY)),
    [
      { kind: "floor" },
      { kind: "slab", at: "pelvis", width: 0.40, height: 0.035, dy: 0.045 },
      { kind: "bar", at: "grip", length: 0.17 },
    ],
  ),

  inclinePress: pose(
    "side",
    ([[0.460, 0.192], [0.495, 0.250], [0.525, 0.300]] as const).map(([barX, barY]) => incline(barX, barY)),
    [
      { kind: "floor" },
      { kind: "slab", at: "pelvis", width: 0.22, height: 0.035, dy: 0.045 },
      { kind: "bar", at: "grip", length: 0.17 },
    ],
  ),

  skullCrusher: pose(
    "side",
    [354, 318, 282].map((forearm) => ({
      ...bench(0.397, 0.285),
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
    // A rigid plank pivoting on the toes: the pelvis sits ON the ankle-to-
    // shoulder line and travels down with the body -- fixing it in place
    // piked the hips the whole way through. Solved: lockout 24 degrees above
    // the floor, chest grazing it at 11.
    ([[0.485, 0.689, 292.3], [0.475, 0.728, 286.8], [0.467, 0.78, 279.8]] as const).map(([x, y, torso]) =>
      supported({ x, y }, torso, { x: 0.392, y: 0.855 }, { x: 0.755, y: 0.855 }),
    ),
    [{ kind: "floor" }],
    "overhand",
    -1,
  ),

  kneePushUp: pose(
    "side",
    ([[0.536, 0.756, 307.5, 127.5], [0.524, 0.784, 299.1, 119.1], [0.515, 0.816, 290.2, 110.2]] as const).map(([x, y, torso, thigh]) => {
      const pelvis = { x, y };
      return {
        pelvis,
        torso,
        neck: torso - 4,
        arms: reachingArms(pelvis, torso, "side", [{ x: 0.410, y: 0.885 }, { x: 0.394, y: 0.885 }], BACK, [264, 259]),
        // The plank hinges at the planted knee: thigh on the body line, shin
        // lying flat on the floor behind it.
        legs: [{ upper: thigh, lower: 92, end: 100 }, { upper: thigh + 5, lower: 97, end: 105 }],
      };
    }),
    [{ kind: "floor" }],
    "overhand",
    -1,
  ),

  plank: pose(
    "side",
    [
      // Held on the forearms, so the elbow is the contact and the hand is flat
      // in front of it.
      { ...supported({ x: 0.545, y: 0.600 }, 268, { x: 0.392, y: 0.855 }, { x: 0.775, y: 0.855 }), arms: [{ upper: 192, lower: 272, end: 272 }, { upper: 197, lower: 277, end: 277 }] },
      { ...supported({ x: 0.545, y: 0.603 }, 267, { x: 0.392, y: 0.855 }, { x: 0.775, y: 0.855 }), arms: [{ upper: 193, lower: 272, end: 272 }, { upper: 198, lower: 277, end: 277 }] },
    ],
    [{ kind: "floor" }],
    "overhand",
    -1,
  ),

  dip: pose(
    "side",
    [0.526, 0.605, 0.685].map((y) => {
      const pelvis = { x: 0.5, y };
      return {
        pelvis,
        torso: 8,
        neck: 6,
        arms: reachingArms(pelvis, 8, "side", [{ x: 0.516, y: 0.572 }, { x: 0.500, y: 0.572 }], BACK),
        legs: sideLegs(166, 252, 200),
      };
    }),
    [{ kind: "bar", at: "grip", length: 0.14, plates: false, rails: true }],
    "neutral",
  ),

  fly: pose(
    "front",
    [96, 60, 24].map((arm) => standFront(0.497, 0, bothArms(arm, arm - 25))),
    [{ kind: "floor" }, { kind: "bell", at: "hand0", each: true, size: 0.05 }],
    "neutral",
  ),

  // --- Vertical push -------------------------------------------------------

  overheadPress: pose(
    "front",
    [0.262, 0.115, -0.036].map((barY) => {
      const pelvis = { x: 0.5, y: 0.497 };
      return {
        pelvis,
        torso: 0,
        arms: reachingArms(pelvis, 0, "front", grip({ x: 0.5, y: barY }, 0.105, "front"), DOWN),
        legs: plantedLegs(pelvis, 0, "front", FEET_FRONT, OUT),
      };
    }),
    [{ kind: "floor" }, { kind: "bar", at: "grip", length: 0.40 }],
  ),

  lateralRaise: pose(
    "front",
    [170, 131, 93].map((arm) => standFront(0.497, 0, bothArms(arm, arm + 14))),
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
    [0.710, 0.560, 0.428].map((pelvisY) => {
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
    [0.684, 0.618, 0.556].map((pelvisY) => {
      const pelvis = { x: 0.52, y: pelvisY };
      const torso = 284;
      return {
        pelvis,
        torso,
        neck: torso,
        arms: reachingArms(pelvis, torso, "side", [{ x: 0.335, y: 0.322 }, { x: 0.319, y: 0.360 }], BACK),
        legs: plantedLegs(pelvis, torso, "side", [{ x: 0.745, y: 0.815 }, { x: 0.729, y: 0.815 }], FORWARD, [40, 45]),
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
    "overhand",
    -1,
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

  // --- The last seventeen: exercises that only had a written cue -----------

  // One leg does the whole squat while the other holds straight out in front
  // -- the held-out leg IS the pistol.
  pistolSquat: pose(
    "side",
    ([[0.500, 0.494, 4, 150, 164, 60], [0.472, 0.590, 22, 112, 128, 30], [0.450, 0.700, 34, 90, 102, 8], [0.438, 0.775, 40, 86, 94, 2]] as const).map(([x, y, torso, up, low, end]) => {
      const pelvis = { x, y };
      return {
        pelvis,
        torso,
        neck: torso > 20 ? torso - 12 : torso,
        arms: sideArms(96, 92),
        legs: [plantedLegs(pelvis, torso, "side", FEET, FORWARD)[0]!, { upper: up, lower: low, end }] as [Limb, Limb],
      };
    }),
    [{ kind: "floor" }],
  ),

  // Reclined on the seat, pressing the platform away. The machine holds the
  // body off the ground, so there is no floor line.
  legPress: pose(
    "side",
    ([[0.648, 0.564], [0.700, 0.548], [0.746, 0.536]] as const).map(([fx, fy]) => {
      const pelvis = { x: 0.46, y: 0.640 };
      const torso = 322;
      return {
        pelvis,
        torso,
        neck: torso + 20,
        arms: sideArms(196, 206),
        legs: plantedLegs(pelvis, torso, "side", [{ x: fx, y: fy }, { x: fx - 0.014, y: fy + 0.012 }], FORWARD, [352, 357]),
      };
    }),
    [
      { kind: "slab", at: "pelvis", width: 0.20, height: 0.035, dy: 0.052 },
      { kind: "slab", at: "ankle0", dx: 0.055, width: 0.045, height: 0.34 },
    ],
  ),

  // One end of the bar is pinned to the floor ahead; the hands arc around it,
  // so the drawn bar leans at the arc's mean angle and runs down to the pivot.
  landminePress: pose(
    "side",
    ([[0.530, 0.350, 12], [0.616, 0.303, 8], [0.705, 0.284, 6]] as const).map(([hx, hy, torso]) => {
      const pelvis = { x: 0.5, y: 0.494 };
      return {
        pelvis,
        torso,
        arms: reachingArms(pelvis, torso, "side", [{ x: hx, y: hy }, { x: hx - 0.012, y: hy + 0.01 }], BACK),
        legs: plantedLegs(pelvis, torso, "side", [{ x: 0.548, y: FLOOR }, { x: 0.515, y: FLOOR }], FORWARD),
      };
    }),
    [{ kind: "floor" }, { kind: "bar", at: "grip", angle: 347, length: 0.30, plates: false }],
    "neutral",
  ),

  // A push-up folded into a pike: hips stay the apex, the head travels to the
  // floor between the hands. Pelvis positions solved so the legs stay long.
  pikePushUp: pose(
    "side",
    ([[0.583, 0.501, 246], [0.564, 0.515, 234], [0.539, 0.538, 222]] as const).map(([x, y, torso]) =>
      supported({ x, y }, torso, { x: 0.425, y: 0.872 }, { x: 0.715, y: 0.872 }, 118),
    ),
    [{ kind: "floor" }],
    "overhand",
    -1,
  ),

  // Inverted, legs split fore-aft for balance (and to fit the frame); the head
  // grazes the floor at the bottom, which is full depth.
  handstandPushUp: pose(
    "side",
    [0.3526, 0.429, 0.506].map((py) => {
      const pelvis = { x: 0.516, y: py };
      const torso = 184;
      return {
        pelvis,
        torso,
        arms: reachingArms(pelvis, torso, "side", [{ x: 0.50, y: 0.885 }, { x: 0.484, y: 0.885 }], BACK, [92, 97]),
        legs: [{ upper: 310, lower: 305, end: 308 }, { upper: 46, lower: 50, end: 48 }] as [Limb, Limb],
      };
    }),
    [{ kind: "floor" }],
    "overhand",
    -1,
  ),

  // Arms locked straight, sweeping the bar from overhead down to the thighs.
  straightArmPulldown: pose(
    "side",
    [40, 98, 166].map((arm) => stand({ x: 0.5, y: 0.494 }, 18, sideArms(arm, arm + 2), 14, [{ x: 0.557, y: FLOOR }, { x: 0.515, y: FLOOR }])),
    [{ kind: "floor" }, { kind: "bar", at: "grip", length: 0.16, plates: false }],
  ),

  // Pulled to the face with the elbows staying high.
  facePull: pose(
    "side",
    ([[82, 84], [96, 50], [108, 4]] as const).map(([up, low]) => stand({ x: 0.5, y: 0.494 }, 6, sideArms(up, low), undefined, [{ x: 0.538, y: FLOOR }, { x: 0.515, y: FLOOR }])),
    [{ kind: "floor" }, { kind: "bar", at: "grip", length: 0.10, plates: false }],
  ),

  // Hinged over, arms sweeping from a hang up and back with soft elbows.
  reverseFly: pose(
    "side",
    ([[168, 170], [214, 208], [256, 246]] as const).map(([up, low]) => {
      const pelvis = { x: 0.552, y: 0.548 };
      return {
        pelvis,
        torso: 92,
        neck: 78,
        arms: [{ upper: up, lower: low }, { upper: up + 5, lower: low + 5 }] as [Limb, Limb],
        legs: plantedLegs(pelvis, 92, "side", FEET, FORWARD),
      };
    }),
    [{ kind: "floor" }, { kind: "bell", at: "hand0", each: true, size: 0.05 }],
    "neutral",
  ),

  // Face on: the working leg steps behind and across the midline, which is
  // what loads the outer hip.
  curtsyLunge: pose(
    "front",
    [
      standFront(0.497, 0, bothArms(150, 25)),
      (() => {
        const pelvis = { x: 0.512, y: 0.565 };
        return { pelvis, torso: 6, arms: bothArms(150, 25), legs: plantedLegs(pelvis, 6, "front", [{ x: 0.565, y: FLOOR }, { x: 0.628, y: FLOOR }], OUT) };
      })(),
      (() => {
        const pelvis = { x: 0.52, y: 0.632 };
        return { pelvis, torso: 8, arms: bothArms(150, 25), legs: plantedLegs(pelvis, 8, "front", [{ x: 0.565, y: FLOOR }, { x: 0.652, y: FLOOR }], OUT) };
      })(),
    ],
    [{ kind: "floor" }],
  ),

  // Knees stay bent at ninety, which is the whole point: only the ankle moves,
  // and the ball of the foot stays put while the heel rises. The tiny travel
  // is the honest range of the movement.
  seatedCalfRaise: pose(
    "side",
    ([[0.567, 0.919, 95], [0.5715, 0.8946, 115], [0.581, 0.874, 135]] as const).map(([ax, ay, end]) => {
      const pelvis = { x: 0.42, y: 0.70 };
      return {
        pelvis,
        torso: 354,
        arms: sideArms(128, 130),
        legs: plantedLegs(pelvis, 354, "side", [{ x: ax, y: ay }, { x: ax - 0.012, y: ay + 0.008 }], FORWARD, [end, end + 4]),
      };
    }),
    [
      { kind: "floor" },
      { kind: "slab", at: "pelvis", width: 0.15, height: 0.035, dy: 0.05 },
      // The machine pad the hands rest on, riding over the knees.
      { kind: "slab", at: "hand0", width: 0.12, height: 0.028, dy: 0.02 },
    ],
  ),

  // Kneeling, the wheel rolls out ahead; the pelvis is derived from the fixed
  // knee so the shins never leave the ground.
  abWheelRollout: pose(
    "side",
    ([[150, 297, 0.287], [130, 288, 0.20], [118, 283, 0.145]] as const).map(([thigh, torso, wx]) => {
      const knee = { x: 0.545, y: 0.905 };
      const pelvis = { x: knee.x - (0.225 * Math.sin((thigh * Math.PI) / 180)) / (850 / 567), y: knee.y + 0.225 * Math.cos((thigh * Math.PI) / 180) };
      return {
        pelvis,
        torso,
        neck: torso - 6,
        arms: reachingArms(pelvis, torso, "side", [{ x: wx, y: 0.868 }, { x: wx - 0.014, y: 0.868 }], FORWARD),
        legs: [{ upper: thigh, lower: 90, end: 98 }, { upper: thigh + 4, lower: 94, end: 102 }] as [Limb, Limb],
      };
    }),
    [{ kind: "floor" }, { kind: "bell", at: "grip", size: 0.045 }],
    "overhand",
    -1,
  ),

  // Kneeling at the stack, ribs curling toward the hips; the hands ride at the
  // temples the whole way down.
  cableCrunch: pose(
    "side",
    ([[168, 335], [162, 300], [154, 272]] as const).map(([thigh, torso]) => {
      const knee = { x: 0.50, y: 0.905 };
      const pelvis = { x: knee.x - (0.225 * Math.sin((thigh * Math.PI) / 180)) / (850 / 567), y: knee.y + 0.225 * Math.cos((thigh * Math.PI) / 180) };
      return {
        pelvis,
        torso,
        neck: torso - 25,
        arms: sideArms(torso - 110, torso + 15),
        legs: [{ upper: thigh, lower: 90, end: 98 }, { upper: thigh + 4, lower: 94, end: 102 }] as [Limb, Limb],
      };
    }),
    [{ kind: "floor" }],
  ),

  // Seated and leaned back, feet light: the hands sweep between chest height
  // and the hip, which is the twist's rhythm seen side-on.
  russianTwist: pose(
    "side",
    ([[275, 277], [225, 227]] as const).map(([up, low]) => ({
      pelvis: { x: 0.5, y: 0.72 },
      torso: 25,
      neck: 15,
      arms: sideArms(up, low),
      legs: [{ upper: 305, lower: 235, end: 325 }, { upper: 310, lower: 240, end: 330 }] as [Limb, Limb],
    })),
    [{ kind: "floor", y: 0.745 }],
    "overhand",
    -1,
  ),

  // Lying crunch with the legs trading places -- one knee to the chest, the
  // other held long off the floor. The swap IS the pedal.
  bicycleCrunch: pose(
    "side",
    [0, 1].map((phase) => {
      const tucked: Limb = { upper: 335, lower: 120, end: 80 };
      const long: Limb = { upper: 72, lower: 70, end: 30 };
      return {
        pelvis: { x: 0.5, y: 0.70 },
        torso: 282,
        neck: 304,
        arms: sideArms(322, 160),
        legs: (phase === 0 ? [tucked, long] : [{ ...long, upper: 77, lower: 75 }, { ...tucked, upper: 340 }]) as [Limb, Limb],
      };
    }),
    [{ kind: "floor", y: 0.792 }],
  ),

  // Jump, stand, crouch with the hands planted, plank -- played out and back,
  // which is the full burpee cycle.
  burpee: pose(
    "side",
    [
      { pelvis: { x: 0.50, y: 0.38 }, torso: 358, arms: sideArms(340, 348), legs: sideLegs(186, 182, 216) },
      { pelvis: { x: 0.500, y: 0.494 }, torso: 358, arms: HANG, legs: plantedLegs({ x: 0.500, y: 0.494 }, 358, "side", FEET, FORWARD, [272, 268]) },
      (() => {
        const pelvis = { x: 0.545, y: 0.70 };
        const torso = 285;
        return {
          pelvis,
          torso,
          neck: torso - 4,
          arms: reachingArms(pelvis, torso, "side", [{ x: 0.392, y: 0.855 }, { x: 0.376, y: 0.855 }], BACK, [264, 259]),
          legs: plantedLegs(pelvis, torso, "side", [{ x: 0.62, y: FLOOR }, { x: 0.604, y: FLOOR }], BACK, [272, 268]),
        };
      })(),
      supported({ x: 0.485, y: 0.689 }, 292.3, { x: 0.392, y: 0.855 }, { x: 0.755, y: 0.855 }),
    ],
    [{ kind: "floor", y: 0.936 }],
    "overhand",
    -1,
  ),

  // Quarter-squat stance, arms pumping alternately -- the ropes themselves
  // cannot be drawn, but the wave rhythm can.
  battleRopes: pose(
    "side",
    ([[112, 32, 152, 96], [152, 96, 116, 36]] as const).map(([nu, nl, fu, fl]) => {
      const pelvis = { x: 0.49, y: 0.56 };
      return {
        pelvis,
        torso: 18,
        arms: [{ upper: nu, lower: nl }, { upper: fu, lower: fl }] as [Limb, Limb],
        legs: plantedLegs(pelvis, 18, "side", [{ x: 0.56, y: FLOOR }, { x: 0.53, y: FLOOR }], FORWARD),
      };
    }),
    [{ kind: "floor" }],
  ),

  // Low lean into the sled's posts, legs driving alternately -- one flat and
  // planted, one trailing on the toes.
  sledPush: pose(
    "side",
    [0, 1].map((phase) => {
      const pelvis = { x: 0.46, y: phase ? 0.605 : 0.60 };
      const torso = 55;
      const feet: [Point, Point] = phase === 0
        ? [{ x: 0.52, y: FLOOR }, { x: 0.398, y: 0.902 }]
        : [{ x: 0.402, y: 0.902 }, { x: 0.516, y: FLOOR }];
      const ends: [number, number] = phase === 0 ? [88, 132] : [132, 92];
      return {
        pelvis,
        torso,
        neck: 40,
        arms: reachingArms(pelvis, torso, "side", [{ x: 0.68, y: 0.66 }, { x: 0.666, y: 0.672 }], BACK),
        legs: plantedLegs(pelvis, torso, "side", feet, FORWARD, ends),
      };
    }),
    [
      { kind: "floor" },
      { kind: "slab", at: "hand0", dx: 0.032, dy: 0.02, width: 0.035, height: 0.26 },
      { kind: "slab", at: "hand0", dx: 0.075, dy: 0.245, width: 0.16, height: 0.05 },
    ],
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
function bench(barX: number, barY: number): Figure {
  const pelvis = { x: 0.560, y: 0.600 };
  const torso = 272;
  return {
    pelvis,
    torso,
    neck: torso,
    // The far shoulder sits a shade lower in a side view, so the far hand
    // gets its own target or the lockout frame is out of its reach.
    arms: reachingArms(pelvis, torso, "side", [{ x: barX, y: barY }, { x: barX - 0.016, y: barY + 0.034 }], BACK),
    legs: plantedLegs(pelvis, torso, "side", [{ x: 0.688, y: FLOOR }, { x: 0.672, y: FLOOR }], FORWARD),
  };
}

// The same on a bench set at an incline, so the trunk climbs to the left.
function incline(barX: number, barY: number): Figure {
  const pelvis = { x: 0.585, y: 0.640 };
  const torso = 306;
  return {
    pelvis,
    torso,
    neck: torso,
    // Same far-shoulder allowance as the flat bench.
    arms: reachingArms(pelvis, torso, "side", [{ x: barX, y: barY }, { x: barX - 0.016, y: barY + 0.03 }], BACK),
    legs: plantedLegs(pelvis, torso, "side", [{ x: 0.712, y: FLOOR }, { x: 0.696, y: FLOOR }], FORWARD),
  };
}

export type PoseName = keyof typeof exercisePoses;
