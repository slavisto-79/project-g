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
// Arms carried a little wider than plumb. A dumbbell hanging at the side has
// its inner head between the wrist and the thigh; with the wrist 0.4cm off
// the thigh's skin (the authored hang) the head sat 2cm inside it on the
// skinned body. Four centimetres of spread clears it on every build.
function wide(arms: [Limb, Limb], spread = 0.04): [Limb, Limb] {
  return arms.map((arm) => ({ ...arm, spread: (arm.spread ?? 0) + spread })) as [Limb, Limb];
}
// Lying down, both legs are level with the floor: sideLegs' five-degree
// depth offset on the far leg dropped its toes 4cm through the floor a body
// was pinned to, and every lying floor was then pinned to THAT, leaving the
// trunk hanging in the air. The world build separates the legs by the hip
// width, so they never merge there.
function lyingLegs(upper: number, lower: number, end?: number): [Limb, Limb] {
  return [{ upper, lower, end }, { upper, lower, end }];
}

// One squat descent, shared by every carry variant of it.
// Authored from a reference clip of the lift (three reps, camera three-
// quarters on): the hips sit back and down to PARALLEL -- the thigh level,
// not below it -- with the shins 30 degrees forward so the knees stand over
// the toes, the trunk 36 degrees forward at the bottom, and the hip height
// dropping in even steps between the key positions (0.438 -> 0.361 -> 0.274
// -> 0.182 above the ankle). Each frame's pelvis is solved from its shin and
// thigh angles (shin 6/20/28/32, thigh 86/45/22/0 below level), and the
// TRUNK angle from the bar: on the traps it sits 0.297·sin(torso) −
// 0.03·cos(torso) − 0.018 ahead of the pelvis in the world, and a squat
// keeps it over the mid-foot (z 0.056; the standing frame carries it 3.6cm
// behind that, over the rear of the mid-foot, so the straight legs do not
// lean). The old frames took the bar 11.5cm FORWARD over the rep -- from
// 9cm behind the mid-foot to 2cm ahead -- because the hips sat back only
// 6cm; they now sit back 11.8cm and the bar path is vertical from the
// second frame down.
const SQUAT_FRAMES = [
  [0.528, 0.492, 5], [0.466, 0.569, 27], [0.452, 0.656, 35], [0.449, 0.748, 36],
] as const;
// The same clip's timing: a second down, a beat at the bottom, a second up,
// and a longer beat standing before the next rep.
const SQUAT_TEMPO = { down: 1000, bottom: 400, up: 1000, top: 700 };
// And its camera: three-quarters on, the lifter's front turned 43 degrees
// from the viewer (the bar's plates project to 0.73 of their spacing).
const SQUAT_CAMERA = { azimuth: 0.75 };
// A squat stands shoulder-width -- 40cm between the ankles -- with the toes
// turned out 15 degrees, and the gaze stays forward: the neck opens as the
// trunk leans so the head does not follow it down to the floor. Opened to
// 0.4 of the lean, the back of the head met the bar on the traps at the
// bottom (5mm into its envelope); 0.6 keeps the eyes up and the bar clear.
function squatting(figure: Figure): Figure {
  return {
    ...figure,
    neck: Math.round(figure.torso * 0.6),
    legs: figure.legs.map((leg) => ({ ...leg, spread: 0.15, turn: 15 })) as [Limb, Limb],
  };
}

// Hands gripping a bar that lies ACROSS THE TRAPS: the target sits on the
// upper back -- a whisker above the top of the spine and behind it, in the
// trunk's own frame, so it rides the back as the torso tilts. In the side
// plane that puts the hand so close to the shoulder that the elbow would
// fold past its range; the way out is the way a lifter actually does it: a
// WIDE grip. `spread` carries the wrists 14cm outboard in the world build,
// which opens the elbow to ~130 degrees while the bar stays on the back.
// `spread` is the grip's width beyond the girdle: 0.14 is the wide grip;
// the back squat's reference clip holds it just outside the shoulders (0.10).
function napeArms(pelvis: Point, torso: number, spread = 0.14): [Limb, Limb] {
  const top = spineTop(pelvis, torso);
  const rad = (torso * Math.PI) / 180;
  // Trunk axis and its forward perpendicular, in screen terms.
  // 0.045 up and 0.05 back puts the bar's surface exactly on the trunk's
  // upper-rear slope (the top of the spine is a 0.058 x 0.052 dome in the
  // world build, the bar is 0.012 thick) -- touching, not hovering behind it
  // -- while still clearing the neck and the back of the head.
  // The 2D shoulders sit a depth-offset ahead of the 3D girdle, so the world
  // grip lands ~1.8cm further back than this target: 0.02 back here is
  // ~0.038 in the world -- the bar's surface a millimetre INTO the trunk's
  // upper-rear slope at the top of the rep, deeper at the bottom, touching
  // the base of the neck, clear of the head. Measured, not guessed.
  // 0.03 back (was 0.02): the male build's delts grew with the V-taper, and
  // at the bottom of the squat the bar cut 7mm into them. Further back on
  // the traps clears the delts (a sphere is narrower behind its centre)
  // while the bar still touches the trunk's upper-rear slope; higher would
  // have put it into the head envelope instead.
  const nape = {
    x: top.x - (0.03 * Math.cos(rad)) / (850 / 567) + (0.052 * Math.sin(rad)) / (850 / 567),
    y: top.y - 0.03 * Math.sin(rad) - 0.052 * Math.cos(rad),
  };
  // Both arms solved to the same point (equalizedPair makes the far one
  // match): an echoed far arm drifted the grip midpoint 1.6cm back and
  // deeper as the arms folded, so the bar slid on the back through the rep.
  const [near, far] = reachingArms(pelvis, torso, "side", [nape, nape], FORWARD);
  return [{ ...near, spread }, { ...far, spread }];
}

// Hands hugging a bell against the chest, elbows tucked down.
// Hands holding a weight against the chest (the goblet hold). 14cm in front
// of the spine line: the trunk's front is 5cm out, the bust a further 2,
// and a kettlebell's ball hangs 6cm back from the grip -- at the old 7.5cm
// the bell sat inside the chest on both figures.
function chestArms(pelvis: Point, torso: number): [Limb, Limb] {
  const top = spineTop(pelvis, torso);
  const rad = (torso * Math.PI) / 180;
  const chest = {
    x: top.x + (0.14 * Math.cos(rad)) / (850 / 567) + (0.062 * Math.sin(rad)) / (850 / 567),
    y: top.y + 0.14 * Math.sin(rad) + 0.062 * Math.cos(rad),
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
  return {
    pelvis,
    torso,
    neck: torso - 4,
    // FORWARD, not BACK: a bending push-up elbow travels toward the FEET,
    // the upper arm sweeping back along the ribs -- folded the other way the
    // elbow jutted forward under the face.
    arms: reachingArms(pelvis, torso, "side", [hands, { x: hands.x - 0.016, y: hands.y }], FORWARD, [264, 259]),
    // Both feet are ON the floor, so both are solved -- with the knee told to
    // sag toward the ground, which is the way a knee in a plank can fold.
    legs: plantedLegs(pelvis, torso, "side", [feet, { x: feet.x - 0.016, y: feet.y }], BACK, [toes, toes + 5]),
  };
}

export const exercisePoses = {
  // --- Squat pattern -------------------------------------------------------

  squat: pose(
    "side",
    SQUAT_FRAMES.map(([x, y, torso]) => squatting(stand({ x, y }, torso, napeArms({ x, y }, torso, 0.10)))),
    // The bar is drawn at the grip, and the grip is ON the traps -- so the bar
    // visibly rides the upper back, where a back squat actually carries it.
    [{ kind: "floor" }, { kind: "bar", at: "grip", length: 0.17 }],
    "overhand",
    1,
    { tempo: SQUAT_TEMPO, camera: SQUAT_CAMERA },
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
    SQUAT_FRAMES.map(([x, y, torso]) => squatting(stand({ x, y }, torso, chestArms({ x, y }, torso)))),
    [{ kind: "floor" }, { kind: "bell", at: "grip", size: 0.06 }],
    "neutral",
    1,
    { tempo: SQUAT_TEMPO, camera: SQUAT_CAMERA },
  ),

  // Not an exercise: the figure at rest, for the profile screen where the
  // person looks at the build the app has made of them. Standing easy, arms
  // hanging, with a breath's worth of sway so it reads as alive rather than
  // frozen -- a hold, not a movement, as far as the range check is concerned.
  // Chest up (the trunk a degree off vertical, the head level) and the arms
  // hanging a little away from the body, the way a broad back carries them.
  idle: pose(
    "side",
    [
      stand({ x: 0.500, y: 0.494 }, 1, wide(sideArms(176, 178), 0.03), 0),
      stand({ x: 0.502, y: 0.497 }, 3, wide(sideArms(181, 183), 0.03), 1),
    ],
    [{ kind: "floor" }],
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
      // The box top sits a sole and an ankle below the ankle joint; any
      // higher and the shin's round sinks into it.
      { kind: "slab", at: "ankle1", width: 0.17, height: 0.042, dy: 0.058 },
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
        arms: wide(HANG),
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
      // Feet flat (explicit ends) in the stepped frames: left to the shins,
      // the wide foot's toes tipped 4cm up and the long leg's 3cm down.
      { ...standFront(0.560, 5, bothArms(150, 25), [{ x: 0.645, y: FLOOR }, { x: 0.400, y: FLOOR }]), pelvis: { x: 0.482, y: 0.560 }, legs: plantedLegs({ x: 0.482, y: 0.560 }, 5, "front", [{ x: 0.645, y: FLOOR }, { x: 0.400, y: FLOOR }], OUT, [90, 270]) },
      (() => {
        const pelvis = { x: 0.455, y: 0.605 };
        return {
          pelvis,
          torso: 10,
          arms: bothArms(150, 25),
          // One knee bends deeply over a wide foot; the other leg stays long.
          legs: plantedLegs(pelvis, 10, "front", [{ x: 0.676, y: FLOOR }, { x: 0.372, y: FLOOR }], OUT, [90, 270]),
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
    [
      { kind: "floor", y: 0.9 },
      { kind: "slab", at: "pelvis", width: 0.22, height: 0.055, dy: 0.075 },
      // The machine's shin pad: a padded roller riding the ankle, which is
      // what the movement is actually pushing. Anchored to the joint, so it
      // travels with the shin through the whole extension. The offset is
      // straight UP rather than along the shin, and that is right at both
      // ends of the range: with the shin hanging, up the shin IS up; with it
      // extended, above the ankle is above the shin, where the pad presses.
      { kind: "slab", at: "ankle0", width: 0.16, height: 0.05, dy: -0.045, lever: true },
    ],
  ),

  legCurl: pose(
    "side",
    [90, 50, 14].map((shin) => ({
      pelvis: { x: 0.47, y: 0.62 },
      torso: 266,
      neck: 318,
      // Hands on the handles beside the bench, arms outside the pad.
      arms: sideArms(226, 300).map((arm) => ({ ...arm, spread: 0.08 })) as [Limb, Limb],
      legs: sideLegs(92, shin, shin + 85),
    })),
    // The pad sits a centimetre lower than a lying pad's usual body-half:
    // the trunk tilts 4 degrees head-down, which put the chest 2.5cm into
    // the pad (measured on the skinned body).
    [{ kind: "floor", y: 0.79 }, { kind: "slab", at: "pelvis", width: 0.62, height: 0.055, dx: -0.13, dy: 0.095 }],
    "overhand",
    -1,
  ),

  calfRaise: pose(
    "side",
    // A calf raise really does travel less than any other movement here: flat
    // feet up to full plantarflexion. The ball of the foot is the pivot, so
    // the toe tip stays at one height while the ankle rises (pelvis 0.506 ->
    // 0.450 = the toe's 0.056 drop below the ankle at 141 degrees). The old
    // first frame dipped the heels under a step that was never drawn, and the
    // floor, pinned to that heel, left the feet 4.6cm in the air at the top.
    [[0.506, 90], [0.479, 112], [0.450, 141]].map(([y, toe]) => ({
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
      // is pinned where the take-off was. A modest hop with the arms in a V,
      // not overhead -- fully raised arms at the flight apex stretched the
      // camera frame ~30% taller and shrank the figure in the card.
      { pelvis: { x: 0.49, y: 0.500 }, torso: 8, arms: sideArms(72, 52), legs: sideLegs(160, 172, 130) },
      { pelvis: { x: 0.50, y: 0.435 }, torso: 2, arms: sideArms(55, 35), legs: sideLegs(176, 178, 140) },
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

  // A Romanian deadlift stops at mid-shin: the trunk just short of
  // horizontal (81 degrees), the hanging hands 0.14 above the floor -- a
  // plate's radius and some air. The old bottom (98 degrees) hung the hands
  // 6.5cm off the floor, where a barbell's plates went 5cm through it and
  // dumbbells looked planted on the feet.
  hinge: pose(
    "side",
    ([[0.500, 0.494, 4], [0.528, 0.528, 36], [0.552, 0.538, 62], [0.570, 0.550, 81]] as const).map(([x, y, torso]) =>
      stand({ x, y }, torso, wide(HANG_AHEAD), torso > 30 ? torso - 16 : torso),
    ),
    [{ kind: "floor" }, { kind: "bar", at: "grip", length: 0.17 }],
  ),

  // Romanian deadlift, from a reference clip measured with the pose lab
  // (BB RDL side view, 3 reps in 9.8 s; MoveNet on 40 frames): the trunk
  // goes to 83-91 degrees from vertical at the bottom, the thigh 27-40
  // degrees back, the shin stays vertical, the knee 150 (a soft bend that
  // does not change), the bar ends just below the knee, and the tempo is a
  // slow lower (~1.75 s), a touch at the bottom, a faster stand (~1.0 s).
  // Authored from the joints: thigh back 4/12/20/25, shin 4/2/0/0, trunk
  // 4/30/55/75 (the keypoint trunk reads high -- the shoulder point sits on
  // the deltoid), arms as ropes: 10 degrees AHEAD of plumb standing (the bar
  // hangs in front of the thighs, as the hinge's HANG_AHEAD -- plumb, the
  // checker had it 7cm inside a heavy thigh), swinging to 13 degrees BEHIND
  // plumb at the bottom (the lats keep the bar on the legs: plumb, it
  // drifted 2cm past the toes). Hand at the bottom ~0.21 above the floor
  // with the knee at 0.215, on the toe line; hip height 0.439 -> 0.419 (an
  // RDL barely drops).
  romanianDeadlift: pose(
    "side",
    ([[0.523, 0.491, 4, 176, 184, -10], [0.497, 0.495, 30, 168, 182, -4], [0.472, 0.504, 55, 160, 180, 6], [0.460, 0.511, 75, 155, 180, 13]] as const).map(
      ([x, y, torso, upper, lower, armBack]) => ({
        pelvis: { x, y },
        torso,
        neck: torso > 30 ? torso - 20 : torso,
        arms: [{ upper: 180 + armBack, lower: 180 + armBack }, { upper: 180 + armBack, lower: 180 + armBack }] as [Limb, Limb],
        legs: [{ upper, lower, end: 90 }, { upper, lower, end: 90 }] as [Limb, Limb],
      }),
    ),
    [{ kind: "floor" }, { kind: "bar", at: "grip", length: 0.17 }],
    "overhand",
    1,
    { tempo: { down: 1700, bottom: 200, up: 1000, top: 300 }, camera: { azimuth: Math.PI / 2 } },
  ),

  // Stiff-leg deadlift, from a reference clip measured with the pose lab
  // ("BB Stiff Legged Deadlift", side view, 5 reps in 14.5 s; MoveNet on
  // 59 frames): "semi-straight legs" -- the thigh goes 37-42 degrees back
  // with the shin vertical, so the knee reads 134-143 at the bottom and
  // 174-178 standing; the trunk reaches 80-86 from vertical; the bar ends
  // at mid-shin; tempo a slow lower (~1.25 s), a beat at the bottom, a
  // faster stand (~0.85 s) and a longer pause standing (~0.65 s). Authored
  // from the joints: thigh back 3/15/28/40, shin 2/2/0/2, trunk 0/28/58/82,
  // arms as ropes from 14 degrees ahead of plumb standing (the trunk is
  // upright here, not 4 degrees back as the RDL's, so the bar needs more
  // room in front of a heavy thigh) to 9 behind at the bottom (at 15 the
  // bar sat 3cm inside a heavy shin; 9 puts it on the toe line). Hand at
  // the bottom 0.135 above the floor -- mid-shin, 8cm below the knee, the
  // plates 2cm off the ground; hip height 0.440 -> 0.387 -- the hips
  // travel back 13cm, more than the RDL's 6.
  stiffLegDeadlift: pose(
    "side",
    ([[0.520, 0.490, 0, 177, 182, -14], [0.490, 0.498, 28, 165, 182, -5], [0.453, 0.516, 58, 152, 180, 4], [0.432, 0.543, 82, 140, 182, 9]] as const).map(
      ([x, y, torso, upper, lower, armBack]) => ({
        pelvis: { x, y },
        torso,
        neck: torso > 30 ? torso - 20 : torso,
        arms: [{ upper: 180 + armBack, lower: 180 + armBack }, { upper: 180 + armBack, lower: 180 + armBack }] as [Limb, Limb],
        legs: [{ upper, lower, end: 90 }, { upper, lower, end: 90 }] as [Limb, Limb],
      }),
    ),
    [{ kind: "floor" }, { kind: "bar", at: "grip", length: 0.17 }],
    "overhand",
    1,
    { tempo: { down: 1250, bottom: 250, up: 850, top: 650 }, camera: { azimuth: Math.PI / 2 } },
  ),

  // Standing inside a hex bar with the hands at the sides: the hips sit lower
  // and the torso stays more upright than a straight-bar hinge, and the
  // handles travel straight up the mid-foot. The bottom hand height is the
  // bar's own -- plate radius plus the raised handles above the floor -- so
  // the plates rest on the ground at the start of the pull.
  // Authored from a reference clip (two reps, camera square on the lifter's
  // right side): the arms hang STRAIGHT AND VERTICAL the whole rep -- they
  // are ropes from the shoulders, so the hands are not solved to a point,
  // they hang 180/180 and the trunk angle is what puts them over the
  // mid-foot (z 0.076, where the hex handles are). At the bottom the hips
  // sit well above the knees: shin 12 forward, thigh 24 below level, knee
  // 102 -- and the trunk 50, which is then also what brings the hand down
  // to the handle (shoulder 0.529 - arm 0.290 = 0.239 above the floor:
  // plate radius plus the raised handle, plates ON the ground). Hip height
  // 0.437 -> 0.375 -> 0.302 above the ankle. The standing frame carries the
  // pelvis 4cm forward so the bar hangs a centimetre behind the mid-foot,
  // against the thighs, instead of 5cm behind it. The old bottom solved the
  // hands to a fixed x and let the trunk overtake them: elbows bent to 142
  // and the hands 11 degrees behind the shoulders, at a hip 16 below level.
  trapBarDeadlift: pose(
    "side",
    ([[0.527, 0.494, 6], [0.452, 0.555, 37], [0.429, 0.628, 50]] as const).map(([px, py, torso]) => {
      const pelvis = { x: px, y: py };
      return {
        pelvis,
        torso,
        neck: torso > 30 ? torso - 16 : torso,
        // The hands hang OUTSIDE the legs, on the hex handles: 0.19 out
        // (72cm apart, at the wide end of a real bar's 63-71cm) against
        // knees at 0.083 -- at the default 0.112 the forearms and the
        // handles both ran through the knees of the widened stance, seen
        // face on; at 0.18 the forearm passed the thigh by 5mm.
        arms: [{ upper: 180, lower: 180, spread: 0.078 }, { upper: 180, lower: 180, spread: 0.078 }] as [Limb, Limb],
        // Hip-width inside the hex, feet parallel: 24cm between the ankles.
        legs: plantedLegs(pelvis, torso, "side", [{ x: 0.548, y: FLOOR }, { x: 0.515, y: FLOOR }], FORWARD).map((leg) => ({
          ...leg,
          spread: 0.07,
        })) as [Limb, Limb],
      };
    }),
    [{ kind: "floor" }, { kind: "bar", at: "grip", length: 0.17, hex: true }],
    "neutral",
    1,
    // The clip's timing -- lowered to the floor, a beat on the floor, pulled,
    // a beat standing -- and its camera, square on the right side.
    { tempo: { down: 700, bottom: 650, up: 550, top: 500 }, camera: { azimuth: Math.PI / 2 } },
  ),

  // Good morning, from a reference clip measured with the pose lab ("High
  // Bar Good Morning", side view, 3 reps in 17.3 s; MoveNet on 70 frames):
  // the trunk reaches 71-78 degrees from vertical, the hips go BACK (thigh
  // 28-37 degrees back) with the shin a few degrees forward and the knee
  // soft at 150-158, and the tempo is a very slow lower (~4.5 s), a beat at
  // the bottom, a fast stand (~1.0 s) and a pause standing (~0.5 s). The
  // old frames took the pelvis 8cm FORWARD and bent the knees under it as
  // the trunk leaned -- a squat-hinge hybrid. Authored from the joints:
  // thigh back -4/12/24/33, shin -4/-3/-4/-7 (the knees stay BEHIND the
  // ankles: the clip's knee of 150-158 with the thigh 33 back only closes
  // if the shin leans back, and that is what a good morning looks like --
  // legs nearly straight, hips pushed away), trunk 5/30/55/75, knee
  // 180/171/160/154; the bar stays on the traps (the wide napeArms grip)
  // and over the mid-foot at the bottom; hip height 0.439 -> 0.402.
  goodMorning: pose(
    "side",
    ([[0.523, 0.490, 5, 180, 180], [0.485, 0.495, 30, 168, 177], [0.452, 0.510, 55, 156, 176], [0.424, 0.528, 75, 147, 173]] as const).map(
      ([x, y, torso, upper, lower]) => ({
        pelvis: { x, y },
        torso,
        neck: torso > 30 ? torso - 16 : torso,
        arms: napeArms({ x, y }, torso),
        legs: [{ upper, lower, end: 90 }, { upper, lower, end: 90 }] as [Limb, Limb],
      }),
    ),
    [{ kind: "floor" }, { kind: "bar", at: "grip", length: 0.17 }],
    "overhand",
    1,
    // The clip's tempo; its camera was a shade off the side, and so is
    // this one -- square on, the near plate hides the head and the trunk.
    { tempo: { down: 4500, bottom: 250, up: 1000, top: 500 }, camera: { azimuth: 1.2 } },
  ),

  singleLegHinge: pose(
    "side",
    ([[0.500, 0.494, 4, 196, 214], [0.532, 0.530, 50, 248, 254], [0.560, 0.542, 94, 284, 278]] as const).map(([x, y, torso, up, low]) => {
      const pelvis = { x, y };
      return {
        pelvis,
        torso,
        neck: torso > 30 ? torso - 14 : torso,
        // Hanging dumbbells clear the hips (wider on the female build) only
        // if the arms hang a little outboard.
        arms: HANG_AHEAD.map((arm) => ({ ...arm, spread: 0.05 })) as [Limb, Limb],
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
      // The bench ends just past the shoulders: the trunk angles down from
      // there and ran through a pad that reached further.
      { kind: "slab", at: "shoulder", width: 0.20, height: 0.055, dx: -0.06, dy: 0.085 },
      { kind: "bar", at: "pelvis", dy: -0.048, length: 0.17 },
    ],
  ),

  clean: pose(
    "side",
    // Floor, past the knee, the extension, the catch, and standing. Showing
    // only the first and last is what made the old version a deadlift.
    ([[0.570, 96], [0.548, 60], [0.516, 16], [0.500, 4], [0.500, 356]] as const).map(([x, torso], i) => {
      // The start is a lift FROM THE FLOOR: the load has to rest on it, not
      // cut into it. Measured at the old height, the hands sat 7.7cm above the
      // floor -- a plated bar there buries 4.3cm of plate in the podium and a
      // kettlebell 6cm of bell. The hips start higher, which is a clean's
      // start anyway: hips above the knees, shoulders over the bar.
      const pelvis = { x, y: [0.497, 0.538, 0.518, 0.556, 0.494][i]! };
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
      const planted = plantedLegs(pelvis, torso, "side", [{ x: 0.767, y: 0.855 }, { x: 0.751, y: 0.855 }], BACK, [130, 135]);
      // Knee driven UNDER the chest, shin hanging straight down -- and folding
      // the same anatomical way as the planted leg, so the swap between the
      // two never carries a joint through hyperextension.
      const tucked: Limb = { upper: 330, lower: 185, end: 115 };
      return {
        pelvis,
        torso,
        neck: torso - 4,
        arms: reachingArms(pelvis, torso, "side", [{ x: 0.392, y: 0.855 }, { x: 0.376, y: 0.855 }], FORWARD, [264, 259]),
        legs: (phase === 0 ? [planted[0]!, tucked] : [tucked, planted[1]!]) as [Limb, Limb],
      };
    }),
    [{ kind: "floor", mat: true }],
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
    [{ kind: "floor", mat: true }],
    "overhand",
    -1,
  ),

  // --- Horizontal push -----------------------------------------------------

  // The bench ends at the hip joint: the thighs angle down to the floor from
  // there, and a pad running on past the hips is what they used to sink into.
  // Authored from a reference clip (three reps, camera at the foot end, a
  // little to the lifter's left): the bar locks out over the shoulder and
  // comes down to the LOWER chest, 10cm toward the feet, to touch it -- the
  // bottom bar height is the skinned chest surface under it (0.465 male,
  // 0.461 female at that z) plus the bar's radius and a few millimetres. The
  // old bottom stopped 4cm above the chest, 14cm toward the feet. Elbows
  // flare to 45 degrees at the chest (the elbow turns about the shoulder-
  // wrist line, see Limb.flare), grip 0.19 out (76cm apart, about 1.5
  // shoulder widths), and the feet stand wide on the floor either side of
  // the bench, pulled in under the knees for a 100-degree bend -- a right
  // angle is out of reach with the hip 33cm above the floor and the foot on
  // it.
  bench: pose(
    "side",
    ([[0.397, 0.304, 20], [0.436, 0.410, 35], [0.475, 0.513, 45]] as const).map(([barX, barY, flare]) =>
      bench(barX, barY, { flare, spread: 0.078, legSpread: 0.12, feetX: 0.640 }),
    ),
    [
      { kind: "floor" },
      // From the hip joint (the thighs hang off the foot end, feet on the
      // floor) to 4cm past the crown: the head lies at the END of the bench.
      // At 0.58 the pad ran 16cm on past the head. The drawn pad is 4cm
      // shorter than `width` (its ends are rounded off), and the rack is
      // only built for a width of 0.5 or more -- 0.456 lost it.
      { kind: "slab", at: "pelvis", width: 0.5, height: 0.055, dx: -0.154, dy: 0.085 },
      { kind: "bar", at: "grip", length: 0.17 },
      // Round the back and under the bench, when the press is done on a band.
      { kind: "cable", at: "hand0", anchor: { x: 0.387, y: 0.78 }, band: true },
      { kind: "cable", at: "hand1", anchor: { x: 0.387, y: 0.78 }, band: true },
    ],
    "overhand",
    1,
    // The clip's timing: down, a touch on the chest, up, a beat locked out --
    // and its camera, the foot end, 30 degrees round to the lifter's left.
    { tempo: { down: 900, bottom: 150, up: 600, top: 350 }, camera: { azimuth: -0.5 } },
  ),

  inclinePress: pose(
    "side",
    ([[0.460, 0.212], [0.495, 0.262], [0.525, 0.305]] as const).map(([barX, barY]) => incline(barX, barY)),
    [
      { kind: "floor" },
      { kind: "slab", at: "pelvis", width: 0.55, height: 0.055, angle: 306 },
      { kind: "bar", at: "grip", length: 0.17 },
    ],
  ),

  skullCrusher: pose(
    "side",
    [354, 318, 282].map((forearm) => ({
      ...bench(0.397, 0.304),
      arms: [{ upper: 354, lower: forearm }, { upper: 359, lower: forearm + 5 }] as [Limb, Limb],
    })),
    [
      { kind: "floor" },
      // From the hip joint (the thighs hang off the foot end, feet on the
      // floor) to 4cm past the crown: the head lies at the END of the bench.
      // At 0.58 the pad ran 16cm on past the head. The drawn pad is 4cm
      // shorter than `width` (its ends are rounded off), and the rack is
      // only built for a width of 0.5 or more -- 0.456 lost it.
      { kind: "slab", at: "pelvis", width: 0.5, height: 0.055, dx: -0.154, dy: 0.085 },
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
      supported({ x, y }, torso, { x: 0.392, y: 0.855 }, { x: 0.767, y: 0.855 }),
    ),
    [{ kind: "floor", mat: true }],
    "overhand",
    -1,
  ),

  // The same plank with the feet up on a bench. Derived from the flat frames:
  // hands where they were, ankles raised 0.26 (a 49cm bench), the pelvis at
  // the same 0.65 of the way along the ankle-to-shoulder line, the torso
  // re-aimed along it. Level at lockout, 12 degrees head-down at the bottom
  // -- which is what a decline push-up on a bench actually looks like; a
  // steeper slope needs a box taller than a bench.
  declinePushUp: pose(
    "side",
    ([[0.497, 0.596, 269.9, 0.800], [0.481, 0.635, 264.9, 0.784], [0.466, 0.688, 258.2, 0.764]] as const).map(([x, y, torso, ax]) =>
      supported({ x, y }, torso, { x: 0.392, y: 0.855 }, { x: ax, y: 0.595 }),
    ),
    [
      // Pinned where the flat push-up's unpinned floor lands, so the hands
      // meet the ground exactly as they do there.
      { kind: "floor", y: 0.907 },
      // Bench top a sole's thickness under the toe tips: the toe bone ends
      // 0.046 below the ankle, the sneaker sole 0.012 under that. Crosswise,
      // its near edge just behind the ankles, the whole foot on the pad.
      { kind: "slab", at: "ankle0", width: 0.5, height: 0.055, dx: 0.033, dy: 0.086, across: true },
    ],
    "overhand",
    -1,
  ),

  // The mirror image: hands up on the same bench, feet on the floor. Same
  // derivation -- the hands rise 0.26 and the shoulders with them (the arm
  // vector unchanged), the ankles stay put, the pelvis keeps its place on the
  // ankle-to-shoulder line. 48 degrees up at lockout, 32 at the bottom.
  inclinePushUp: pose(
    "side",
    ([[0.564, 0.518, 317.9, 0.513], [0.537, 0.557, 310.8, 0.487], [0.511, 0.610, 302.5, 0.459]] as const).map(([x, y, torso, hx]) =>
      supported({ x, y }, torso, { x: hx, y: 0.595 }, { x: 0.767, y: 0.855 }),
    ),
    [
      { kind: "floor", y: 0.907 },
      // Bench top the same 0.052 under the wrists that the floor is under
      // them in the flat push-up, so the palms meet it the same way. The
      // bench stands crosswise with the wrists at its edge: run along the
      // body it reached under the hips, and the thighs sank 2cm into it at
      // the bottom of the rep.
      { kind: "slab", at: "hand0", width: 0.5, height: 0.055, dx: -0.052, dy: 0.0795, across: true },
    ],
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
        arms: reachingArms(pelvis, torso, "side", [{ x: 0.410, y: 0.885 }, { x: 0.394, y: 0.885 }], FORWARD, [264, 259]),
        // The plank hinges at the planted knee: thigh on the body line, shin
        // lying flat on the floor behind it.
        legs: [{ upper: thigh, lower: 92, end: 100 }, { upper: thigh + 5, lower: 97, end: 105 }],
      };
    }),
    [{ kind: "floor", mat: true }],
    "overhand",
    -1,
  ),

  plank: pose(
    "side",
    [
      // Held on the forearms: the forearm lies ON the floor, the upper arm
      // stands on the elbow, and the neck lifts the gaze forward.
      { ...supported({ x: 0.565, y: 0.745 }, 272, { x: 0.392, y: 0.855 }, { x: 0.86, y: 0.87 }), neck: 300, arms: [{ upper: 185, lower: 272, end: 272 }, { upper: 190, lower: 277, end: 277 }] },
      { ...supported({ x: 0.565, y: 0.748 }, 271, { x: 0.392, y: 0.855 }, { x: 0.86, y: 0.87 }), neck: 300, arms: [{ upper: 186, lower: 272, end: 272 }, { upper: 191, lower: 277, end: 277 }] },
    ],
    [{ kind: "floor", mat: true }],
    "overhand",
    -1,
  ),

  // A forearm plank rocking forward and back over the planted elbows -- the
  // "saw". The forearms stay put (lower arm flat on the floor throughout);
  // the shoulders travel past them and back, and the ankles hinge over the
  // pinned toes. Only the upper-arm angle changes, so the elbow contact
  // never slides.
  plankSaw: pose(
    "side",
    [
      { ...supported({ x: 0.607, y: 0.752 }, 272, { x: 0.392, y: 0.855 }, { x: 0.9, y: 0.872 }, 118), neck: 300, arms: [{ upper: 163, lower: 272, end: 272 }, { upper: 168, lower: 277, end: 277 }] },
      { ...supported({ x: 0.565, y: 0.745 }, 272, { x: 0.392, y: 0.855 }, { x: 0.86, y: 0.87 }), neck: 300, arms: [{ upper: 185, lower: 272, end: 272 }, { upper: 190, lower: 277, end: 277 }] },
      { ...supported({ x: 0.523, y: 0.752 }, 272, { x: 0.392, y: 0.855 }, { x: 0.82, y: 0.868 }, 150), neck: 300, arms: [{ upper: 207, lower: 272, end: 272 }, { upper: 212, lower: 277, end: 277 }] },
    ],
    [{ kind: "floor", mat: true }],
    "overhand",
    -1,
  ),

  // A forearm plank with the near arm cycling through the W-Y-I raises (the
  // reverse sweep plays on the way back). The T points out of the sagittal
  // plane, so the demo shows the three shapes that read from the side. The
  // whole figure sits further right than the plain plank so the fully
  // extended arm stays on the canvas.
  plankIYTW: pose(
    "side",
    [
      { ...supported({ x: 0.64, y: 0.745 }, 272, { x: 0.467, y: 0.855 }, { x: 0.935, y: 0.87 }), neck: 300, arms: [{ upper: 185, lower: 272, end: 272 }, { upper: 190, lower: 277, end: 277 }] },
      // W: elbow drawn back toward the ribs, forearm hovering ahead.
      { ...supported({ x: 0.64, y: 0.745 }, 272, { x: 0.467, y: 0.855 }, { x: 0.935, y: 0.87 }), neck: 300, arms: [{ upper: 120, lower: 250, end: 250 }, { upper: 190, lower: 277, end: 277 }] },
      // Y: raised past the ear.
      { ...supported({ x: 0.64, y: 0.747 }, 272, { x: 0.467, y: 0.855 }, { x: 0.935, y: 0.87 }), neck: 300, arms: [{ upper: 288, lower: 288, end: 288 }, { upper: 190, lower: 277, end: 277 }] },
      // I: the arm reaches forward in line with the body.
      { ...supported({ x: 0.64, y: 0.745 }, 272, { x: 0.467, y: 0.855 }, { x: 0.935, y: 0.87 }), neck: 300, arms: [{ upper: 272, lower: 272, end: 272 }, { upper: 190, lower: 277, end: 277 }] },
    ],
    [{ kind: "floor", mat: true }],
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
    [0.30, 0.115, -0.030].map((barY) => {
      const pelvis = { x: 0.5, y: 0.497 };
      return {
        pelvis,
        torso: 0,
        arms: reachingArms(pelvis, 0, "front", grip({ x: 0.5, y: barY }, 0.12, "front"), DOWN),
        legs: plantedLegs(pelvis, 0, "front", FEET_FRONT, OUT),
      };
    }),
    [
      { kind: "floor" },
      { kind: "bar", at: "grip", length: 0.40 },
      // Stood on, one band to each hand, when the press is done on a band.
      { kind: "cable", at: "hand0", anchor: { x: 0.5, y: 0.94 }, band: true },
      { kind: "cable", at: "hand1", anchor: { x: 0.5, y: 0.94 }, band: true },
    ],
  ),

  lateralRaise: pose(
    "front",
    [170, 131, 93].map((arm) => standFront(0.497, 0, bothArms(arm, arm + 14))),
    [{ kind: "floor" }, { kind: "bell", at: "hand0", each: true, size: 0.05 }],
    "neutral",
  ),

  frontRaise: pose(
    "side",
    [174, 133, 92].map((arm) => stand({ x: 0.5, y: 0.494 }, 356, wide(sideArms(arm, arm + 2)))),
    [{ kind: "floor" }, { kind: "bell", at: "hand0", each: true, size: 0.05 }],
    "neutral",
  ),

  // --- Cable variants ------------------------------------------------------
  // The same shapes as their free-weight cousins, but the load comes from a
  // station: a low pulley in front for the curl, a high pulley either side
  // for the crossover fly, low pulleys either side for the lateral raise,
  // and a low pulley BEHIND the lifter for the pull-through.

  cableCurl: pose(
    "side",
    // Upper arms a shade forward of the curl's: the cable comes up from a low
    // pulley ahead and grazed the thighs with the hands hanging plumb.
    [172, 130, 74].map((forearm) => stand({ x: 0.5, y: 0.494 }, 356, sideArms(152, forearm))),
    [
      { kind: "floor" },
      // A short straight handle (a bell draws as one on a machine); a full
      // bar would run through the thighs in the side view.
      { kind: "bell", at: "grip", size: 0.06 },
      { kind: "cable", at: "grip", anchor: { x: 0.92, y: 0.9 } },
    ],
    "underhand",
  ),

  cableFly: pose(
    "front",
    [96, 60, 24].map((arm) => standFront(0.497, 0, bothArms(arm, arm - 25))),
    [
      { kind: "floor" },
      { kind: "cable", at: "hand0", anchor: { x: 0.95, y: 0.05 }, handle: "d" },
      { kind: "cable", at: "hand1", anchor: { x: 0.05, y: 0.05 }, handle: "d" },
    ],
    "neutral",
  ),

  cableLateralRaise: pose(
    "front",
    [170, 131, 93].map((arm) => standFront(0.497, 0, bothArms(arm, arm + 14))),
    [
      { kind: "floor" },
      { kind: "cable", at: "hand0", anchor: { x: 0.95, y: 0.92 }, handle: "d" },
      { kind: "cable", at: "hand1", anchor: { x: 0.05, y: 0.92 }, handle: "d" },
    ],
    "neutral",
  ),

  // A hinge with the rope held between the legs, the cable running back to a
  // low pulley behind: the hands hang toward the pulley, not toward the floor.
  cablePullThrough: pose(
    "side",
    ([[0.500, 0.494, 4, 0.46, 0.52], [0.528, 0.528, 40, 0.56, 0.59], [0.552, 0.538, 72, 0.62, 0.70], [0.570, 0.550, 98, 0.65, 0.82]] as const).map(
      ([x, y, torso, hx, hy]) => {
        const pelvis = { x, y };
        return {
          pelvis,
          torso,
          neck: torso > 30 ? torso - 16 : torso,
          arms: reachingArms(pelvis, torso, "side", [{ x: hx, y: hy }, { x: hx - 0.016, y: hy }], BACK),
          legs: plantedLegs(pelvis, torso, "side", FEET, FORWARD),
        };
      },
    ),
    [
      { kind: "floor" },
      // The rope handle sits BETWEEN the thighs; a bar prop would trip the
      // bar-through-leg rule that cannot see the gap between the legs.
      { kind: "bell", at: "grip", size: 0.06 },
      { kind: "cable", at: "grip", anchor: { x: 0.06, y: 0.93 }, handle: "rope" },
    ],
    "neutral",
  ),

  tricepsExtension: pose(
    "front",
    [100, 138, 174].map((forearm) => standFront(0.497, 0, bothArms(170, forearm))),
    [{ kind: "floor" }, { kind: "bar", at: "grip", length: 0.16, plates: false }, { kind: "cable", at: "grip", anchor: { x: 0.5, y: 0.02 }, handle: "rope" }],
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
      { kind: "slab", at: "pelvis", width: 0.16, height: 0.055, dy: 0.075 },
      { kind: "bar", at: "grip", length: 0.10, plates: false },
      { kind: "cable", at: "grip", anchor: { x: 0.88, y: 0.50 }, band: true },
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
    [{ kind: "floor" }, { kind: "bar", at: "grip", length: 0.44, plates: false }, { kind: "cable", at: "grip", anchor: { x: 0.5, y: -0.06 } }],
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
    [
      { kind: "bar", at: "grip", length: 0.44, plates: false },
      // The assistance band: looped over the bar, a foot standing in it.
      // Off the midline: a band looped over the bar hangs down the side of
      // the body with a foot in it, not through the head.
      { kind: "cable", at: "ankle0", anchor: { x: 0.633, y: 0.186 }, band: true },
    ],
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
        arms: reachingArms(pelvis, torso, "side", [{ x: 0.335, y: 0.341 }, { x: 0.319, y: 0.341 }], BACK),
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
    [178, 130, 74].map((forearm) => stand({ x: 0.5, y: 0.494 }, 356, wide(sideArms(176, forearm)))),
    [
      { kind: "floor" },
      { kind: "bell", at: "hand0", each: true },
      // Stood on: one band to each hand, off the floor under the feet.
      { kind: "cable", at: "hand0", anchor: { x: 0.571, y: 0.938 }, band: true },
      { kind: "cable", at: "hand1", anchor: { x: 0.571, y: 0.938 }, band: true },
    ],
    "underhand",
  ),

  // A bodyweight curl on suspension rings: the body hangs straight as a
  // plank, heels planted, hands fixed on the rings -- and the ONLY hinge is
  // the elbow, which is what pulls the whole body from the lean-back up to
  // vertical. The lean angle drives the pelvis (heel + a straight leg), the
  // torso continues the same line, and the rings never move.
  ringCurl: pose(
    "side",
    // The third number is the heel-to-pelvis distance that makes the LEG
    // solve straight: legs reach from the hip, which sits a depth-offset
    // toward the feet, so the raw 0.44 leg length left the knees 25 bent.
    ([[38, 322, 0.4486], [26, 334, 0.4454], [16, 344, 0.4424]] as const).map(([lean, torso, dist]) => {
      const rad = (lean * Math.PI) / 180;
      const pelvis = { x: 0.6 - (dist * Math.sin(rad)) / (850 / 567), y: 0.93 - dist * Math.cos(rad) };
      return {
        pelvis,
        torso,
        neck: torso + 8,
        arms: reachingArms(pelvis, torso, "side", [{ x: 0.518, y: 0.335 }, { x: 0.502, y: 0.335 }], DOWN_SIDE),
        legs: plantedLegs(pelvis, torso, "side", [{ x: 0.6, y: FLOOR }, { x: 0.584, y: FLOOR }], FORWARD),
      };
    }),
    // Just the handle: a strap slab reads as a fat post from the front-on
    // orbit angles, and the fixed floating handle already says "suspension".
    [{ kind: "floor" }, { kind: "bar", at: "grip", length: 0.1, plates: false }],
    "underhand",
  ),

  proneRaise: pose(
    "side",
    [
      // Face down: the feet are pointed (toes down, on the floor), not toes
      // up as in the supine holds this was first copied from.
      // The head is held a little up off the floor (neck 12 degrees above the
      // trunk line), looking ahead: level with the trunk, the face went 3cm
      // through the floor.
      // Trunk 2 degrees up from the hips: the chest is thicker than the
      // thighs the floor is pinned under, and level it went 2cm through.
      { pelvis: { x: 0.5, y: 0.680 }, torso: 272, neck: 284, arms: sideArms(272, 276), legs: lyingLegs(92, 92, 104) },
      { pelvis: { x: 0.5, y: 0.678 }, torso: 280, neck: 292, arms: sideArms(292, 296), legs: lyingLegs(80, 76, 112) },
      // Chest and legs both come off the ground, which is the whole exercise.
      { pelvis: { x: 0.5, y: 0.676 }, torso: 292, neck: 304, arms: sideArms(312, 318), legs: lyingLegs(68, 60, 96) },
    ],
    // Pinned a thigh's radius under the leg line, where the belly and the
    // thighs actually rest: at 0.786 the trunk hung 5cm over the floor.
    [{ kind: "floor", mat: true, y: 0.733 }],
    "overhand",
    -1,
  ),

  // --- Trunk ---------------------------------------------------------------

  hollowHold: pose(
    "side",
    [
      // The lower back stays on the floor throughout: the pelvis sits a hip's
      // radius above it (at 0.700 over a 0.792 floor it hung 5cm in the air).
      { pelvis: { x: 0.5, y: 0.735 }, torso: 274, neck: 268, arms: sideArms(276, 279), legs: lyingLegs(91, 89, 40) },
      { pelvis: { x: 0.5, y: 0.733 }, torso: 278, neck: 271, arms: sideArms(294, 298), legs: lyingLegs(78, 74, 24) },
      { pelvis: { x: 0.5, y: 0.731 }, torso: 282, neck: 274, arms: sideArms(312, 317), legs: lyingLegs(62, 56, 8) },
    ],
    [{ kind: "floor", mat: true, y: 0.792 }],
  ),

  sidePlank: pose(
    "side",
    [
      // One forearm on the ground and the other arm reaching straight up: the
      // asymmetry is what says "side" rather than "front".
      // The hips lift by hinging over the planted feet: the legs steepen as
      // the pelvis rises, so the feet stay on the floor (lifted with the
      // legs at the same angle, the whole figure rose 6cm off it).
      { pelvis: { x: 0.5, y: 0.665 }, torso: 286, neck: 286, arms: [{ upper: 180, lower: 266, end: 266 }, { upper: 10, lower: 6 }], legs: lyingLegs(107, 103, 17) },
      { pelvis: { x: 0.5, y: 0.688 }, torso: 289, neck: 289, arms: [{ upper: 180, lower: 266, end: 266 }, { upper: 10, lower: 6 }], legs: lyingLegs(104, 100, 14) },
    ],
    [{ kind: "floor", mat: true }],
  ),

  // Both hands travel together on a diagonal; that diagonal is the exercise.
  // They are authored as ONE pair of hands either side of what is held, not
  // as two arms swinging on the same angles: parallel arms from shoulders
  // 22cm apart leave the hands 39-51cm apart, and everything this movement
  // holds -- a rope handle, a medicine ball -- is narrower than that. The
  // ball floated between two hands that never touched it.
  woodchop: pose(
    "front",
    // The elbows stay pointed the same way through the whole sweep. Past
    // the midline the hands are on the far side of the shoulders, so the
    // bend that kept them out on the way down folds them the other way --
    // the pose checker calls that the joint hinging backwards mid-rep.
    ([
      [{ x: 0.560, y: 0.115 }, 348, 0.520, OUT],
      [{ x: 0.610, y: 0.470 }, 0, 0.555, OUT],
      [{ x: 0.435, y: 0.560 }, 12, 0.585, DOWN],
    ] as const).map(([hands, torso, py, elbows]) => {
      const pelvis = { x: 0.5, y: py };
      return {
        pelvis,
        torso,
        arms: reachingArms(pelvis, torso, "front", grip(hands, 0.056, "front"), elbows),
        legs: plantedLegs(pelvis, torso, "front", [{ x: 0.612, y: FLOOR }, { x: 0.388, y: FLOOR }], OUT),
      };
    }),
    [{ kind: "floor" }, { kind: "bell", at: "grip", size: 0.085 }, { kind: "cable", at: "grip", anchor: { x: 0.95, y: 0.08 }, handle: "rope" }],
  ),

  // A slam is not a chop. It goes straight up -- ball overhead, body fully
  // extended -- and straight down, hips and knees folding together, to the
  // ball on the floor between the feet. It was drawn on the woodchopper,
  // which is a diagonal across the body with the hands 40cm apart. Side
  // view, so the fold shows; the hands are pulled in with a negative spread,
  // because the world build spreads a side view's hands to the shoulder
  // girdle and a 23cm ball needs them 16cm apart, not 22.
  medBallSlam: pose(
    "side",
    // Mid-rep the ball is out in front at chest height, arms still long: a
    // target closer to the shoulder folded the elbows to 163 degrees.
    ([[0.500, 0.494, 356, 0.58, 0.000], [0.520, 0.550, 40, 0.74, 0.54], [0.550, 0.620, 80, 0.72, 0.86]] as const).map(
      ([x, y, torso, hx, hy]) => {
        const pelvis = { x, y };
        return {
          pelvis,
          torso,
          neck: torso > 30 ? torso - 20 : torso,
          arms: wide(reachingArms(pelvis, torso, "side", [{ x: hx, y: hy }, { x: hx - 0.012, y: hy }], FORWARD), -0.03),
          legs: plantedLegs(pelvis, torso, "side", FEET, FORWARD),
        };
      },
    ),
    [{ kind: "floor" }, { kind: "bell", at: "grip", size: 0.085 }],
    "neutral",
  ),

  // A rotational throw is horizontal: the ball loaded at one hip, driven
  // across the body and released at chest height toward the other side.
  // Face on, so the rotation reads, and one pair of hands either side of the
  // ball as on the chopper.
  medBallThrow: pose(
    "front",
    // The load sits at the hip with the elbows bent, not at arm's length below
    // the shoulder: a hand 33cm under the shoulder cannot be reached by a
    // 29cm arm, and the far hand has to cross the body to get there.
    // The elbow's fold side is a world sign, and each arm's target crosses
    // its own shoulder at a different frame -- the near arm at the middle,
    // the far arm at the end -- so the bend is set per arm per frame, or the
    // checker finds a joint hinging backwards mid-rep.
    ([[{ x: 0.57, y: 0.50 }, 6, OUT], [{ x: 0.50, y: 0.48 }, 0, BACK], [{ x: 0.40, y: 0.48 }, 352, DOWN]] as const).map(
      ([hands, torso, elbows]) => {
        const pelvis = { x: 0.5, y: 0.500 };
        return {
          pelvis,
          torso,
          arms: reachingArms(pelvis, torso, "front", grip(hands, 0.056, "front"), elbows),
          // A wide throwing stance, but not wider than the legs: at 0.60/0.40
          // the far foot sat 7mm past a straight leg.
          legs: plantedLegs(pelvis, torso, "front", [{ x: 0.585, y: FLOOR }, { x: 0.415, y: FLOOR }], OUT),
        };
      },
    ),
    [{ kind: "floor" }, { kind: "bell", at: "grip", size: 0.085 }],
    "neutral",
  ),

  carry: pose(
    "side",
    [
      { pelvis: { x: 0.5, y: 0.520 }, torso: 0, arms: wide(HANG), legs: [{ upper: 172, lower: 176, end: 86 }, { upper: 186, lower: 182, end: 92 }] },
      { pelvis: { x: 0.5, y: 0.516 }, torso: 1, arms: wide(HANG), legs: [{ upper: 182, lower: 179, end: 89 }, { upper: 176, lower: 179, end: 89 }] },
      { pelvis: { x: 0.5, y: 0.520 }, torso: 0, arms: wide(HANG), legs: [{ upper: 190, lower: 184, end: 94 }, { upper: 168, lower: 174, end: 84 }] },
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
        // Hands on the handles beside the seat: the arms hang outside the
        // backrest, not through its edge.
        arms: sideArms(196, 206).map((arm) => ({ ...arm, spread: 0.06 })) as [Limb, Limb],
        legs: plantedLegs(pelvis, torso, "side", [{ x: fx, y: fy }, { x: fx - 0.014, y: fy + 0.012 }], FORWARD, [352, 357]),
      };
    }),
    [
      { kind: "slab", at: "pelvis", width: 0.42, height: 0.055, angle: 322 },
      { kind: "slab", at: "ankle0", dx: 0.055, width: 0.045, height: 0.34 },
    ],
  ),

  // One end of a full-length bar sits in a pivot on the floor ahead; the hands
  // cup the other end at the chest and press it up AND forward, so they
  // travel an arc about that pivot -- a 2.2m bar leaning 33 degrees at the
  // start and 50 at lockout. The world build finds the pivot from the arc;
  // the 2D angle is the bar's lean at the start.
  landminePress: pose(
    "side",
    ([[0.593, 0.355, 10], [0.643, 0.247, 11], [0.707, 0.145, 13]] as const).map(([hx, hy, torso]) => {
      const pelvis = { x: 0.5, y: 0.494 };
      // Both hands cup the ONE bar end at the midline, so the elbows tuck in
      // and the fists sit side by side instead of a shoulder-width apart.
      const [near, far] = reachingArms(pelvis, torso, "side", [{ x: hx, y: hy }, { x: hx - 0.012, y: hy + 0.01 }], BACK);
      return {
        pelvis,
        torso,
        arms: [{ ...near, spread: -0.065 }, { ...far, spread: -0.065 }] as [typeof near, typeof far],
        legs: plantedLegs(pelvis, torso, "side", [{ x: 0.548, y: FLOOR }, { x: 0.515, y: FLOOR }], FORWARD),
      };
    }),
    [{ kind: "floor" }, { kind: "bar", at: "grip", angle: 303, length: 0.30, plates: false }],
    "neutral",
  ),

  // A push-up folded into a pike: hips stay the apex, the head travels to the
  // floor between the hands. Pelvis positions solved so the legs stay long.
  pikePushUp: pose(
    "side",
    ([[0.578, 0.501, 246], [0.564, 0.515, 234], [0.544, 0.538, 222]] as const).map(([x, y, torso]) =>
      supported({ x, y }, torso, { x: 0.425, y: 0.872 }, { x: 0.745, y: 0.872 }, 118),
    ),
    [{ kind: "floor", mat: true }],
    "overhand",
    -1,
  ),

  // Inverted, legs split fore-aft for balance (and to fit the frame); the head
  // grazes the floor at the bottom, which is full depth.
  handstandPushUp: pose(
    "side",
    [0.351, 0.4115, 0.472].map((py) => {
      const pelvis = { x: 0.516, y: py };
      const torso = 184;
      return {
        pelvis,
        torso,
        arms: reachingArms(pelvis, torso, "side", [{ x: 0.50, y: 0.885 }, { x: 0.484, y: 0.885 }], BACK, [92, 97]),
        legs: [{ upper: 310, lower: 305, end: 308 }, { upper: 46, lower: 50, end: 48 }] as [Limb, Limb],
      };
    }),
    [{ kind: "floor", mat: true }],
    "overhand",
    -1,
  ),

  // Arms locked straight, sweeping the bar from overhead down to the thighs.
  straightArmPulldown: pose(
    "side",
    [40, 98, 166].map((arm) => stand({ x: 0.5, y: 0.494 }, 18, sideArms(arm, arm + 2), 14, [{ x: 0.557, y: FLOOR }, { x: 0.515, y: FLOOR }])),
    [{ kind: "floor" }, { kind: "bar", at: "grip", length: 0.16, plates: false }, { kind: "cable", at: "grip", anchor: { x: 0.9, y: 0.02 } }],
  ),

  // Pulled to the face with the elbows staying high.
  facePull: pose(
    "side",
    ([[82, 84], [96, 50], [108, 4]] as const).map(([up, low]) => stand({ x: 0.5, y: 0.494 }, 6, sideArms(up, low), undefined, [{ x: 0.538, y: FLOOR }, { x: 0.515, y: FLOOR }])),
    [{ kind: "floor" }, { kind: "bar", at: "grip", length: 0.10, plates: false }, { kind: "cable", at: "grip", anchor: { x: 0.92, y: 0.3 }, handle: "rope" }],
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
      // Both feet flat (explicit ends): left to the shin, the crossed leg's
      // foot tilted with it and its toes went 6cm through the floor, which
      // then sat 6cm under the standing frame.
      (() => {
        const pelvis = { x: 0.512, y: 0.565 };
        return { pelvis, torso: 6, arms: bothArms(150, 25), legs: plantedLegs(pelvis, 6, "front", [{ x: 0.565, y: FLOOR }, { x: 0.628, y: FLOOR }], OUT, [90, 270]) };
      })(),
      (() => {
        const pelvis = { x: 0.52, y: 0.632 };
        return { pelvis, torso: 8, arms: bothArms(150, 25), legs: plantedLegs(pelvis, 8, "front", [{ x: 0.565, y: FLOOR }, { x: 0.652, y: FLOOR }], OUT, [90, 270]) };
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
        // Hands a little higher, so the thigh pad they rest on clears the
        // thighs it presses on instead of cutting into them.
        arms: sideArms(118, 120),
        legs: plantedLegs(pelvis, 354, "side", [{ x: ax, y: ay }, { x: ax - 0.012, y: ay + 0.008 }], FORWARD, [end, end + 4]),
      };
    }),
    [
      { kind: "floor" },
      { kind: "slab", at: "pelvis", width: 0.15, height: 0.055, dy: 0.08 },
      // The machine pad the hands rest on, riding over the knees -- pressing
      // on the thighs, not cutting into them.
      { kind: "slab", at: "hand0", width: 0.12, height: 0.028, dy: 0.012 },
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
    [{ kind: "floor", mat: true }, { kind: "bell", at: "grip", size: 0.045, wheel: true }],
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
        // The rope is held at the forehead, 14cm IN FRONT of the face and
        // riding with the trunk as it curls -- with the hands on the skull
        // the cable had to pass through the head to reach them, and at 10cm
        // the deepest curl pressed the rope into the beard.
        arms: (() => {
          const top = spineTop(pelvis, torso);
          const rad = (torso * Math.PI) / 180;
          const rope = {
            x: top.x - (0.14 * Math.cos(rad)) / (850 / 567) + (0.13 * Math.sin(rad)) / (850 / 567),
            y: top.y - 0.14 * Math.sin(rad) - 0.13 * Math.cos(rad),
          };
          return reachingArms(pelvis, torso, "side", [rope, rope], FORWARD);
        })(),
        legs: [{ upper: thigh, lower: 90, end: 98 }, { upper: thigh + 4, lower: 94, end: 102 }] as [Limb, Limb],
      };
    }),
    // The rope handle at the head, and the cable up to a high pulley in front.
    // The pulley stands well forward (x 0.04): any closer and the cable's run
    // down to the rope passes through the face at the bottom of the crunch.
    // It sits a quarter-frame ABOVE the authored frame (a 2.3m tower): at the
    // frame's top edge the cable reached a kneeling lifter's hands at barely
    // 30 degrees, and read as coming from ahead rather than from above.
    [{ kind: "floor", mat: true }, { kind: "bar", at: "grip", length: 0.08, plates: false }, { kind: "cable", at: "grip", anchor: { x: 0.04, y: -0.25 }, handle: "rope" }],
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
    [{ kind: "floor", mat: true, y: 0.745 }],
    "overhand",
    -1,
  ),

  // Lying crunch with the legs trading places -- one knee to the chest, the
  // other held long off the floor. The swap IS the pedal.
  bicycleCrunch: pose(
    "side",
    [0, 1].map((phase) => {
      const tucked: Limb = { upper: 335, lower: 120, end: 80 };
      const long: Limb = { upper: 63, lower: 61, end: 22 };
      return {
        // Lower back on the floor: a hip's radius above it, as in the hollow
        // hold (at 0.70 it hung 3.5cm in the air).
        pelvis: { x: 0.5, y: 0.733 },
        torso: 282,
        neck: 304,
        arms: sideArms(330, 185),
        legs: (phase === 0 ? [tucked, long] : [{ ...long, upper: 68, lower: 66 }, { ...tucked, upper: 340 }]) as [Limb, Limb],
      };
    }),
    [{ kind: "floor", mat: true, y: 0.792 }],
  ),

  // Jump, stand, crouch with the hands planted, plank -- played out and back,
  // which is the full burpee cycle.
  burpee: pose(
    "side",
    [
      // Same low-hop rule as `jump`: arms in a V, not overhead, so the flight
      // apex doesn't stretch the camera frame and shrink the figure.
      { pelvis: { x: 0.50, y: 0.445 }, torso: 358, arms: sideArms(305, 325), legs: sideLegs(186, 182, 216) },
      { pelvis: { x: 0.500, y: 0.494 }, torso: 358, arms: HANG, legs: plantedLegs({ x: 0.500, y: 0.494 }, 358, "side", FEET, FORWARD, [272, 268]) },
      (() => {
        const pelvis = { x: 0.545, y: 0.70 };
        const torso = 285;
        return {
          pelvis,
          torso,
          neck: torso - 4,
          arms: reachingArms(pelvis, torso, "side", [{ x: 0.392, y: 0.855 }, { x: 0.376, y: 0.855 }], FORWARD, [264, 259]),
          legs: plantedLegs(pelvis, torso, "side", [{ x: 0.62, y: FLOOR }, { x: 0.604, y: FLOOR }], BACK, [272, 268]),
        };
      })(),
      supported({ x: 0.485, y: 0.689 }, 292.3, { x: 0.392, y: 0.855 }, { x: 0.767, y: 0.855 }),
    ],
    [{ kind: "floor", mat: true, y: 0.936 }],
    "overhand",
    -1,
  ),

  // Hip extension against a low pulley, standing on one leg with the hands on
  // the machine for balance. The cuff is on the ankle, so the cable ends at
  // the ankle rather than at a hand.
  cableKickback: pose(
    "side",
    // The start has the heel already off the floor with the knee folded --
    // at a true standing start the checker reads two planted feet and calls
    // the free leg a stance knee out of sync with the other.
    ([[172, 214], [198, 210], [226, 229]] as const).map(([up, low]) => {
      const pelvis = { x: 0.5, y: 0.494 };
      const torso = 12;
      return {
        pelvis,
        torso,
        neck: torso - 6,
        // Both hands on the upright in front: this is a balance movement and
        // the hands are what makes that read.
        arms: reachingArms(pelvis, torso, "side", [{ x: 0.63, y: 0.50 }, { x: 0.616, y: 0.508 }], FORWARD),
        // The working leg is the NEAR one so nothing hides it; the far leg is
        // solved to the floor and holds the whole body up.
        legs: [{ upper: up, lower: low, end: low - 92 }, plantedLegs(pelvis, torso, "side", FEET, FORWARD)[1]!],
      };
    }),
    [
      { kind: "floor" },
      { kind: "cable", at: "ankle0", anchor: { x: 0.867, y: 0.928 } },
    ],
    "neutral",
  ),

  // Standing hip abduction on a loop band: the band goes under the standing
  // foot and round the working ankle, so it is anchored on the other ankle and
  // stretches as the leg travels.
  hipAbduction: pose(
    "front",
    ([180, 163, 146] as const).map((up) => {
      const pelvis = { x: 0.5, y: 0.494 };
      return {
        pelvis,
        torso: 0,
        arms: bothArms(168, 170),
        legs: [{ upper: up, lower: up - 1 }, plantedLegs(pelvis, 0, "front", FEET_FRONT, OUT)[1]!],
      };
    }),
    [
      { kind: "floor" },
      { kind: "cable", at: "ankle0", anchorAt: "ankle1", band: true },
    ],
    "neutral",
  ),

  // Stepping sideways in a half squat with a loop band round both ankles: the
  // band runs ankle to ankle and both ends move, which is the whole exercise.
  bandedLateralWalk: pose(
    "front",
    ([0.535, 0.600, 0.665] as const).map((outerFoot) => {
      const pelvis = { x: 0.5, y: 0.530 };
      return {
        pelvis,
        torso: 6,
        arms: bothArms(158, 128),
        legs: plantedLegs(pelvis, 6, "front", [{ x: outerFoot, y: FLOOR }, { x: 0.435, y: FLOOR }], OUT),
      };
    }),
    [
      { kind: "floor" },
      { kind: "cable", at: "ankle0", anchorAt: "ankle1", band: true },
    ],
    "neutral",
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
    // One rope per hand, and BOTH to the same anchor: battle ropes are one
    // rope looped round a post, whose two ends the athlete holds. Without
    // them the movement was a man shaking his fists at the floor.
    [
      { kind: "floor" },
      { kind: "cable", at: "hand0", anchor: { x: 1.00, y: 0.905 }, rope: true },
      { kind: "cable", at: "hand1", anchor: { x: 1.00, y: 0.905 }, rope: true },
    ],
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
      // The sled, built round the handles the hands are on: a post and a
      // floating slab of bench upholstery was standing in for it.
      { kind: "slab", at: "hand0", width: 0.44, height: 0.055, sled: true },
    ],
  ),

  // One hand braced on a bench, the other rowing a single dumbbell from a
  // dead hang to the lower ribs -- the brace is what makes it one-arm.
  oneArmRow: pose(
    "side",
    ([[0.735, 0.855], [0.720, 0.780], [0.700, 0.700]] as const).map(([hx, hy]) => {
      const pelvis = { x: 0.55, y: 0.548 };
      const torso = 96;
      return {
        pelvis,
        torso,
        neck: 80,
        // Near arm rows; far arm braces on the bench, nearly straight. The
        // rowing arm hangs outboard so the dumbbell passes beside the shin,
        // not through it.
        arms: (() => {
          const [near, far] = reachingArms(pelvis, torso, "side", [{ x: hx, y: hy }, { x: 0.75, y: 0.855 }], BACK);
          return [{ ...near, spread: 0.05 }, far] as [Limb, Limb];
        })(),
        legs: plantedLegs(pelvis, torso, "side", [{ x: 0.46, y: FLOOR }, { x: 0.66, y: FLOOR }], FORWARD),
      };
    }),
    [
      { kind: "floor" },
      { kind: "slab", at: "hand1", width: 0.16, height: 0.035, dy: 0.03 },
      { kind: "bell", at: "hand0", size: 0.055 },
    ],
    "neutral",
  ),

  // Lying back on an incline: the upper arms hang plumb BEHIND the torso and
  // stay there -- only the forearms curl, which is the whole point. The arms
  // hang OUTSIDE the backrest (spread), the way they must on a real bench:
  // the dumbbells used to swing through the pad.
  inclineCurl: pose(
    "side",
    [179, 130, 78].map((forearm) => {
      const pelvis = { x: 0.585, y: 0.64 };
      const torso = 306;
      return {
        pelvis,
        torso,
        neck: 316,
        arms: sideArms(178, forearm).map((arm) => ({ ...arm, spread: 0.07 })) as [Limb, Limb],
        legs: plantedLegs(pelvis, torso, "side", [{ x: 0.712, y: FLOOR }, { x: 0.696, y: FLOOR }], FORWARD),
      };
    }),
    [
      { kind: "floor" },
      { kind: "slab", at: "pelvis", width: 0.55, height: 0.055, angle: 306 },
      { kind: "bell", at: "hand0", each: true },
    ],
    "underhand",
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
// `press` is the barbell bench's own shape, from its reference clip: elbows
// flared out of the side plane, a wide grip, and the feet planted wide on
// the floor either side of the bench with the knees near a right angle.
function bench(barX: number, barY: number, press?: { flare: number; spread: number; legSpread: number; feetX: number }): Figure {
  const pelvis = { x: 0.560, y: 0.600 };
  const torso = 272;
  const feetX = press?.feetX ?? 0.688;
  // The far shoulder sits a shade lower in a side view, so the far hand
  // gets its own target or the lockout frame is out of its reach.
  const arms = reachingArms(pelvis, torso, "side", [{ x: barX, y: barY }, { x: barX - 0.016, y: barY }], BACK);
  const legs = plantedLegs(pelvis, torso, "side", [{ x: feetX, y: FLOOR }, { x: feetX - 0.016, y: FLOOR }], FORWARD);
  return {
    pelvis,
    torso,
    neck: torso,
    arms: press ? (arms.map((arm) => ({ ...arm, spread: press.spread, flare: press.flare })) as [Limb, Limb]) : arms,
    legs: press ? (legs.map((leg) => ({ ...leg, spread: press.legSpread })) as [Limb, Limb]) : legs,
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
    arms: reachingArms(pelvis, torso, "side", [{ x: barX, y: barY }, { x: barX - 0.016, y: barY }], BACK),
    legs: plantedLegs(pelvis, torso, "side", [{ x: 0.712, y: FLOOR }, { x: 0.696, y: FLOOR }], FORWARD),
  };
}

export type PoseName = keyof typeof exercisePoses;
