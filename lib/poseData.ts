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
  pose, bothArms, sideArms, sideLegs, plantedLegs, reachingArms, grip, spineTop, hipAt, shoulderAt, along, reach, P, ASPECT,
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

  // Box squat, from a reference clip measured with the pose lab (Active
  // Life "Box Squat Movement Demo", rMEPHwNhQfo, side view, three reps
  // after a 7 s walk-out; MoveNet on 53 frames at 0.4 s): the lifter sits
  // BACK onto a box a shade above knee height -- thigh 72-75 from vertical,
  // shin 29-31 forward, knee 75-80, trunk 32-37 -- pauses on it about half a
  // second, and stands (knee 171-176, trunk 5-8); a 1.5 s descent, a 0.8 s
  // stand and 1.2 s standing. Authored from the joints like the front
  // squat: thigh 3/40/73, shin 3/18/30, trunk 6/22/35, the pelvis walked
  // back from the planted foot; bar on the traps, stance and gaze from
  // squatting(). The box stands behind the heels with its top a seat's
  // depth under the hip joint at the bottom. Box Squat used to share the
  // back squat's pose, which goes 15 degrees deeper and has no box.
  boxSquat: pose(
    "side",
    ([[6, 3, 3], [22, 40, 18], [35, 73, 30]] as const).map(([torso, thigh, shinFwd]) => {
      const leg: Limb = { upper: 180 - thigh, lower: 180 + shinFwd, end: 90 };
      const knee = along({ x: 0.535, y: FLOOR }, leg.lower + 180, P.shin);
      const hip = along(knee, leg.upper + 180, P.thigh);
      const pelvis = { x: hip.x - hipAt({ x: 0, y: 0 }, torso, 0, "side").x, y: hip.y };
      return squatting({ pelvis, torso, arms: napeArms(pelvis, torso, 0.10), legs: [leg, { ...leg }] as [Limb, Limb] });
    }),
    [
      { kind: "floor" },
      { kind: "bar", at: "grip", length: 0.17 },
      { kind: "slab", at: "ankle1", dx: -0.075, dy: -0.167, width: 0.2, height: 0.05 },
    ],
    "overhand",
    1,
    { tempo: { down: 1500, bottom: 500, up: 800, top: 1200 }, camera: SQUAT_CAMERA },
  ),

  // A front squat racks the bar on the front delts with high elbows -- the
  // clean's catch -- and the trunk stays far more upright than a back squat,
  // which is the entire point of the front rack.
  // Front squat, from a reference clip measured with the pose lab ("How To
  // Do A Barbell front squat", Q1Ypb8ZNzI4, side view, the first 8 s -- two
  // reps before the cut to a close-up; MoveNet on 41 frames at 0.2 s): a
  // DEEP squat -- at the bottom the thigh is 84 degrees from vertical (the
  // hip a shade above the knee), the shin 28 forward with the knee well over
  // the toes, the knee 67; the trunk 33-38 from vertical (a keypoint trunk
  // reads a few degrees high, so 32 here); the upper arms 45-55 degrees up
  // from plumb with the elbows high and the forearms folded back to the
  // shoulders; and the tempo a 1.4 s descent, a 0.5-1.0 s pause at the
  // bottom, a 0.9 s stand and 0.8 s standing. Authored from the joints:
  // thigh from vertical 2/46/65/84, shin 2/16/24/28, knee 176/118/91/68
  // (the clip stands with the knees 15 degrees soft; the standing-knee rule
  // in check-poses allows 4),
  // trunk 3/15/26/32, hip height 0.435 -> 0.214 above the ankle in even
  // steps; arms 135/350 (elbow 35 -- the clip's 10-20 is past the range
  // check-poses allows, and the hands still sit on the front delts).
  // Stance and gaze from `squatting()`.
  // The old frames were the back squat's legs under a 2-15 degree trunk
  // with the bar carried 16cm in front of the shoulders.
  frontSquat: pose(
    "side",
    ([[0.523, 0.490, 3, 178, 182], [0.455, 0.567, 15, 134, 196], [0.446, 0.639, 26, 115, 204], [0.441, 0.717, 32, 96, 208]] as const).map(
      ([x, y, torso, upper, lower]) =>
        squatting({
          pelvis: { x, y },
          torso,
          arms: sideArms(135, 350),
          legs: [{ upper, lower, end: 90 }, { upper, lower, end: 90 }] as [Limb, Limb],
        }),
    ),
    [{ kind: "floor" }, { kind: "bar", at: "grip", length: 0.17 }],
    "overhand",
    1,
    { tempo: { down: 1400, bottom: 600, up: 900, top: 800 }, camera: SQUAT_CAMERA },
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

  // Bulgarian split squat, from a reference clip measured with the pose lab
  // ("Bulgarian Split Squat with Dumbbells", Fmjj7wFJWRE, side view, two
  // reps after a 14 s setup; MoveNet on 99 frames at 0.2 s): the trunk
  // leans to 20-23 degrees at the bottom (5-8 standing), the FRONT thigh
  // goes to 70-76 degrees from vertical with the shin 25-27 forward and the
  // knee at 78-84, the front leg is near vertical at the top (knee 168-173),
  // and the tempo is a 1.5 s descent, a touch at the bottom, a 0.8 s stand
  // and a short pause standing. Authored from the front leg's angles (thigh
  // from vertical 8/43/70, shin 2/19/31, knee 170/118/79) with the pelvis
  // walked back from the planted front foot -- solving the front leg to the
  // foot cannot give a knee between 163 and 180 (two-link IK folds the last
  // one percent of reach into seventeen degrees), and the clip stands at
  // 168-173. The rear leg is solved to the box. The box foot sits at 0.42,
  // not 0.372: with the hip over the front foot at the top a rear foot 34cm
  // behind is out of the leg's reach (0.51 against 0.44). The old frames
  // kept the pelvis midway between the feet and the trunk at 6 throughout.
  splitSquat: pose(
    "side",
    ([[6, 8, 2], [14, 43, 19], [22, 70, 31]] as const).map(([torso, thigh, shin]) => {
      const front: Limb = { upper: 180 - thigh, lower: 180 + shin, end: 90 };
      const ankle = { x: 0.60, y: FLOOR };
      const knee = along(ankle, front.lower + 180, P.shin);
      const hip = along(knee, front.upper + 180, P.thigh);
      const pelvis = { x: hip.x - hipAt({ x: 0, y: 0 }, torso, 0, "side").x, y: hip.y };
      return {
        pelvis,
        torso,
        neck: torso > 10 ? torso - 10 : torso,
        arms: HANG,
        // Front foot flat on the floor, rear foot up on a box behind.
        legs: [front, plantedLegs(pelvis, torso, "side", [ankle, { x: 0.42, y: 0.868 }], FORWARD)[1]] as [Limb, Limb],
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
    1,
    { tempo: { down: 1500, bottom: 200, up: 800, top: 300 }, camera: { azimuth: Math.PI / 2 } },
  ),

  // Split squat (both feet on the floor, the rear heel up), from a reference
  // clip measured with the pose lab (OPEX "Split Squat", Py2Qeg-D5T0, side
  // view, three reps in 11 s; MoveNet on 55 frames at 0.25 s): a LONG split
  // -- standing, the front thigh is already 34 degrees from vertical with the
  // shin leaning 18 back (knee 164) and the rear thigh 30 behind the hip
  // (knee 156); at the bottom the front thigh is level (85 from vertical)
  // over a near-vertical shin (knee 85), the rear knee folds to 82 just off
  // the floor, the trunk goes from 10 to 16; hands behind the head; tempo a
  // 1.4 s descent, a 0.25 s touch, a 0.75 s stand and a second standing.
  // Authored from the front leg (explicit: thigh 34/59/85, shin 18 back / 2 /
  // 10 forward), pelvis walked back from the planted front foot; the rear leg
  // is solved to an ankle hung off a FIXED toe on the floor with the heel
  // rising (foot 60/70/80 degrees off the floor) -- the figure's foot is
  // 13cm ankle to toe, so the rear ankle cannot ride as high as the clip's
  // and the rear knee bottoms out nearer 100 than 82. The old pose (shared
  // `lunge`, still used by the lunges) kept the pelvis midway between the
  // feet, both feet flat, the trunk at 4 throughout and the arms hanging.
  splitSquatStatic: pose(
    "side",
    ([[10, 34, -18, 150], [15, 58, 2, 158], [16, 82, 8, 165]] as const).map(([torso, thigh, shinKneeFwd, rearFoot]) => {
      const front: Limb = { upper: 180 - thigh, lower: 180 + shinKneeFwd, end: 90 };
      const ankle = { x: 0.62, y: FLOOR };
      const knee = along(ankle, front.lower + 180, P.shin);
      const hip = along(knee, front.upper + 180, P.thigh);
      const pelvis = { x: hip.x - hipAt({ x: 0, y: 0 }, torso, 0, "side").x, y: hip.y };
      // The rear toe stays put; the ankle hangs off it at the foot's angle.
      const toe = { x: 0.326, y: FLOOR + 0.02 };
      const rearAnkle = along(toe, rearFoot + 180, 0.069);
      const rear: Limb = { ...reach(hipAt(pelvis, torso, 1, "side"), rearAnkle, P.thigh, P.shin, -1), end: rearFoot };
      // Hands behind the head, elbows swung out to the sides (the clip's
      // prisoner position): the nape arms with the fists pulled in to the
      // midline (a negative spread) and the elbow rotated outboard.
      const arms = napeArms(pelvis, torso, -0.055).map((arm) => ({ ...arm, flare: 80 })) as [Limb, Limb];
      return { pelvis, torso, neck: torso - 8, arms, legs: [front, rear] as [Limb, Limb] };
    }),
    [{ kind: "floor" }],
    "neutral",
    1,
    { tempo: { down: 1400, bottom: 250, up: 750, top: 1000 }, camera: { azimuth: Math.PI / 2 } },
  ),

  // Walking lunge, from a reference clip measured with the pose lab (OPEX
  // "Walking Lunge", 6wZoPedlpok, side view, two steps in 6.4 s; MoveNet on
  // 46 frames at 0.2 s): from feet together (knee 165-173, trunk 1-5) a
  // 0.4 s step lands the front foot, a 0.8 s descent puts the front thigh
  // level (84-88 from vertical) with the knee 25-29 past the ankle (knee
  // 62-70), the rear knee just off the floor under the hip with the heel
  // high, trunk 10; a 0.2 s touch, then 0.8 s up and through to feet
  // together for 0.6 s. The figure cannot travel, so the step is drawn in
  // place: feet together -> the front foot lands ahead -> the lunge, and the
  // return retraces it. Front leg explicit (thigh 2/40/78, shin 2 fwd / 14
  // back / 24 fwd), pelvis walked back from the front foot; rear leg solved
  // to an ankle hung off a fixed toe with the heel rising (foot 50/80
  // degrees off the floor); front thigh 78 rather than the clip's 86 so the
  // rear knee's round clears the floor. Hands together at the chest, as the
  // clip. `lunge` (the loaded lunges) is untouched.
  walkingLunge: pose(
    "side",
    ([[2, 2, 2, 0.37, 0], [4, 40, -14, 0.62, 140], [10, 78, 24, 0.62, 170]] as const).map(([torso, thigh, shinKneeFwd, ankleX, rearFoot]) => {
      const front: Limb = { upper: 180 - thigh, lower: 180 + shinKneeFwd, end: 90 };
      const ankle = { x: ankleX, y: FLOOR };
      const knee = along(ankle, front.lower + 180, P.shin);
      const hip = along(knee, front.upper + 180, P.thigh);
      const pelvis = { x: hip.x - hipAt({ x: 0, y: 0 }, torso, 0, "side").x, y: hip.y };
      const rear: Limb = rearFoot
        ? (() => {
            const rearAnkle = along({ x: 0.389, y: FLOOR + 0.02 }, rearFoot + 180, 0.069);
            return { ...reach(hipAt(pelvis, torso, 1, "side"), rearAnkle, P.thigh, P.shin, -1), end: rearFoot };
          })()
        : { upper: 178, lower: 182, end: 90 };
      // Hands clasped in front of the chest: elbows tucked, forearms up and
      // forward, fists pulled to the midline. (Forearms near vertical put the
      // hands at the chin -- a prayer, not a clasp.)
      const arms = sideArms(165, 45).map((arm) => ({ ...arm, spread: -0.06 })) as [Limb, Limb];
      return { pelvis, torso, neck: torso > 6 ? torso - 6 : torso, arms, legs: [front, rear] as [Limb, Limb] };
    }),
    [{ kind: "floor" }],
    "neutral",
    1,
    { tempo: { down: 1200, bottom: 200, up: 800, top: 600 }, camera: { azimuth: Math.PI / 2 } },
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

  // Kettlebell swing, from a reference clip measured with the pose lab
  // ("The Russian Kettlebell Swing", Onnit, side view, 9 swings in 14.3 s;
  // MoveNet on 72 frames at 0.2 s): a 1.6 s cycle with no pause at the
  // bottom -- ~0.6 s down, ~0.6 s up, ~0.4 s floating at the top. Top: the
  // trunk 9-15 degrees BACK of vertical (hips driven through), knee 160-167,
  // arms 70-80 degrees up from plumb with the bell at chest height, elbows
  // soft. Bottom: a hinge with the trunk 76-91 from vertical, thigh 31-37
  // back, knee 128-140 (shins forward), and the arms swung 50-65 degrees
  // BEHIND plumb -- the bell between the legs. Authored from the joints:
  // trunk -8/35/80, thigh back -3/20/33, shin 0/8/15, knee 177/152/132,
  // arms 105-110 (up, elbows 5 degrees soft) / 175 / 235 (behind plumb).
  // Stance a little wider than the shoulders (spread 0.12, 34cm between
  // the ankles) so the bell passes between the thighs: the ball's 5cm
  // radius plus a thigh's 4.1 leaves nothing at a hip-width stance, and
  // at 0.09 it still grazed the thigh by 2mm on the way back. The viewer turns a kettlebell on a bar movement along the arms
  // (userData.swing), so at the top it points forward, not down.
  kettlebellSwing: pose(
    "side",
    ([[0.531, 0.490, -8, 183, 180, 105, 110], [0.492, 0.506, 35, 160, 188, 175, 175], [0.479, 0.534, 80, 147, 195, 235, 235]] as const).map(
      ([x, y, torso, upper, lower, armUpper, armLower]) => ({
        pelvis: { x, y },
        torso,
        neck: torso > 30 ? torso - 20 : torso,
        arms: [{ upper: armUpper, lower: armLower }, { upper: armUpper, lower: armLower }] as [Limb, Limb],
        legs: [{ upper, lower, end: 90, spread: 0.12 }, { upper, lower, end: 90, spread: 0.12 }] as [Limb, Limb],
      }),
    ),
    [{ kind: "floor" }, { kind: "bar", at: "grip", length: 0.17 }],
    "overhand",
    1,
    { tempo: { down: 600, bottom: 0, up: 600, top: 400 }, camera: { azimuth: Math.PI / 2 } },
  ),

  // Sumo deadlift, from a reference clip measured with the pose lab (OPEX
  // "Sumo Deadlift", three-quarter view, 4 reps in 16 s; MoveNet on 80
  // frames at 0.2 s -- the plates hide the knees at the bottom, so the
  // trunk and tempo are the solid numbers): the trunk is 52-62 degrees
  // from vertical at the bottom (a sumo is far more upright than a
  // conventional pull), 0-8 standing, and the tempo is a 0.7 s pull, a
  // 1.2 s stand, a 1.0 s lower and 0.8 s with the bar on the floor.
  // Authored from the joints: trunk 4/32/62, thigh back 2/35/70, shin
  // 0/2/2 (vertical, as a sumo's are), knee 178/143/108 -- the hips drop
  // this far because the mannequin's wide stance does not shorten the legs
  // the way a real sumo stance does (the world build adds the spread
  // outboard without taking it out of the height), and the hands still
  // have to reach a bar whose plates rest on the floor: at the bottom the
  // hand is 0.196 above the floor, the plates 2cm off it. Stance: leg
  // spread 0.16 (42cm out each side), toes turned out 40. Arms as ropes,
  // AHEAD of plumb throughout -- 13 standing (upright trunk, bar in front
  // of a heavy thigh), 14 at the bottom: in the side plane the shins are on
  // the midline and a plumb bar ran 4cm inside one; in the world the shins
  // are 42cm out and the bar passes between them, on the toe line.
  sumoDeadlift: pose(
    "side",
    ([[0.518, 0.490, 4, 178, 180, -13], [0.442, 0.531, 32, 145, 182, -8], [0.387, 0.638, 62, 110, 182, -14]] as const).map(
      ([x, y, torso, upper, lower, armBack]) => ({
        pelvis: { x, y },
        torso,
        neck: torso > 30 ? torso - 20 : torso,
        // Hands INSIDE the knees, as a sumo grip is: spread -0.045 puts the
        // fists 13cm apart; at the default 22cm the forearm ran 1.1cm into
        // the thigh at the bottom, at 16cm it still touched.
        arms: [{ upper: 180 + armBack, lower: 180 + armBack, spread: -0.045 }, { upper: 180 + armBack, lower: 180 + armBack, spread: -0.045 }] as [Limb, Limb],
        legs: [{ upper, lower, end: 90, spread: 0.16, turn: 40 }, { upper, lower, end: 90, spread: 0.16, turn: 40 }] as [Limb, Limb],
      }),
    ),
    [{ kind: "floor" }, { kind: "bar", at: "grip", length: 0.17 }],
    "overhand",
    1,
    // The clip's tempo (the first key position is standing) and its
    // three-quarter camera, which is what shows a sumo stance.
    { tempo: { down: 1000, bottom: 800, up: 700, top: 1200 }, camera: { azimuth: 0.6 } },
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

  // Barbell hip thrust, from a reference clip measured with the pose lab
  // ("Barbell Hip Thrust", TSz4XEoFSFw, shoulders on a bench, 5 reps in
  // 14 s; MoveNet on 71 frames at 0.2 s): at the top the body is a line
  // from the shoulders to the knees -- hip 166-178, the trunk 8 degrees
  // above horizontal, shin vertical, knee ~110; at the bottom the hips
  // drop to 15cm off the floor with the trunk 50 degrees above horizontal
  // and the hip closed to ~110; tempo up ~0.8 s, ~0.6 s squeezed at the
  // top, down ~1.0 s, ~0.4 s at the bottom. The SHOULDER stays put on the
  // bench: each pelvis is solved from a fixed shoulder point (0.30, 0.452)
  // and the trunk angle (320 / 300 / 278 -- 270 is horizontal, head to the
  // left), where before the pelvis was fixed and the shoulder slid 2cm
  // along the pad. Movement 5 of batch 1.
  hipThrust: pose(
    "side",
    ([[0.405, 0.640, 320], [0.4415, 0.5745, 300], [0.462, 0.486, 278]] as const).map(([x, y, torso]) => {
      const pelvis = { x, y };
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
    "overhand",
    1,
    // The first key position is the BOTTOM, so "down" here is the thrust
    // up, "bottom" the squeeze at the top, "up" the lowering.
    { tempo: { down: 800, bottom: 600, up: 1000, top: 400 }, camera: { azimuth: Math.PI / 2 } },
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

  // Skull crusher, from a reference clip measured with the pose lab (OPEX "EZ
  // Bar Skull Crusher", eluOhtYkm-0, side view from the head end, three reps
  // in 9 s; MoveNet on 60 frames at 0.2 s): at the top the upper arms stand
  // 1-5 degrees off vertical with the forearms 16-22 toward the head (elbow
  // 158-167), the bar 4-5 cm past the shoulder line; the lowering tilts the
  // upper arms 32-40 degrees toward the head and folds the elbow to 63-68,
  // the bar finishing LEVEL with the shoulders, 15 cm past them -- behind
  // the head, not above it; a rep is a 1.4 s lowering, a touch, a 1.2 s
  // press and a 0.4 s lockout. Arms explicit (upper, forearm, world angles
  // with the head to the left) 356/340 -> 340/280 -> 325/215 (elbow
  // 164/120/70). The old frames kept the upper arm at 6 off vertical and
  // stopped the forearm level at 108 -- the bar 18 cm above the shoulders,
  // over the forehead.
  skullCrusher: pose(
    "side",
    // The bottom stops at an 80-degree elbow rather than the clip's 65: the
    // bar has to clear the head's envelope, and this figure's head sits
    // closer to its shoulders than the lifter's.
    ([[356, 340], [340, 280], [322, 222]] as const).map(([upper, lower]) => ({
      ...bench(0.397, 0.304),
      arms: [{ upper, lower }, { upper: upper + 5, lower: lower + 5 }] as [Limb, Limb],
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
    "overhand",
    1,
    { tempo: { down: 1400, bottom: 200, up: 1200, top: 400 }, camera: { azimuth: -0.5 } },
  ),

  // Push-up, from a reference clip measured with the pose lab (OPEX "Push
  // Up", Ql8PKKsDE70, side view, three reps in 4.8 s; MoveNet on 51 frames at
  // 0.15 s): at lockout the trunk runs 4-9 degrees above level (the hips a
  // touch higher still, hip angle 162-168), the elbows locked (169-175) with
  // the hands a hand's breadth toward the feet from the shoulders (upper arm
  // 12-14 back of plumb), the knees straight (172-178), the toes on the floor
  // with the ankles 11 cm up; at the bottom the chest is on the floor, the
  // trunk 3-9 degrees head-DOWN, the body a straight line (hip 172-179), the
  // elbows swept back toward the feet; a rep is a 0.6 s descent, a touch, a
  // 0.6 s press and a 0.3 s lockout. Authored from the SHOULDER: each key
  // places it over the fixed hands (28.5 / 18 / 9 cm up; 4 / 8 / 8 cm toward
  // the head -- a rigid body pivoting on its toes carries the shoulders
  // forward as it sinks) and walks the pelvis back down the trunk (276 /
  // 272 / 269); the toes stay put and the ankle hangs off them at 140 / 130 /
  // 120 so the legs solve straight in every key. The old frames locked out
  // 24 degrees above level and stopped 11 above it, and had no tempo.
  pushUp: pose(
    "side",
    ([[0.357, 0.570, 279, 140], [0.331, 0.675, 274, 130], [0.317, 0.765, 269, 120]] as const).map(([sx, sy, torso, end]) => {
      const rad = (torso * Math.PI) / 180;
      const pelvis = { x: sx - (Math.sin(rad) * P.spine) / ASPECT, y: sy + Math.cos(rad) * P.spine };
      const toe = { x: 0.82, y: 0.86 };
      const ankle = along(toe, end + 180, 0.069);
      return supported(pelvis, torso, { x: 0.392, y: 0.855 }, ankle, end);
    }),
    [{ kind: "floor", mat: true }],
    "overhand",
    -1,
    { tempo: { down: 600, bottom: 150, up: 600, top: 300 } },
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

  // Dip, from a reference clip measured with the pose lab (OPEX "Weighted
  // Dip", VNa0hX_y6Fk, three-quarter side view, four reps in 11 s; MoveNet on
  // 69 frames at 0.25 s -- the belt changes nothing about the shape): at
  // lockout the arms are straight (elbow 160-168) and lean 23-29 degrees
  // back from the shoulders to the bars, the trunk 8-13 forward, the legs
  // hanging straight (knee 175-180, thigh 3-6 back); at the bottom the
  // elbows fold to 64-70 and rise above the shoulders, the shoulders drop to
  // a hand above the bars with the trunk 14-17 forward; a rep is a 1.9 s
  // descent, a touch, a 1.0 s press and a 0.5 s lockout. Authored from the
  // SHOULDER over the fixed bars (9 / 7 / 8 cm ahead of the hands and 27 /
  // 18 / 9 cm above them -- this figure's arm is a fifth longer than its
  // trunk, the lifter's is not, so the lockout reach is scaled to keep the
  // elbow at 165), the pelvis walked down the trunk (10 / 13 / 15). The old
  // frames hung the pelvis from 0.526 to 0.685 under an 8-degree trunk with
  // the shins tucked up behind, and had no tempo.
  dip: pose(
    "side",
    ([[10, 0.536, 0.543], [13, 0.537, 0.631], [15, 0.542, 0.719]] as const).map(([torso, x, y]) => {
      const pelvis = { x, y };
      return {
        pelvis,
        torso,
        neck: torso - 4,
        arms: reachingArms(pelvis, torso, "side", [{ x: 0.516, y: 0.572 }, { x: 0.500, y: 0.572 }], BACK),
        legs: sideLegs(184, 190, 150),
      };
    }),
    // A floor under the lowest point of the rep, so the station's uprights
    // reach the ground the feet hang over instead of stopping at the
    // lockout's toes.
    [{ kind: "floor" }, { kind: "bar", at: "grip", length: 0.14, plates: false, rails: true }],
    "neutral",
    1,
    { tempo: { down: 1900, bottom: 300, up: 1000, top: 500 }, camera: { azimuth: 0.9 } },
  ),

  // Dumbbell fly, from a reference clip measured with the pose lab (OPEX
  // "Dumbbell Neutral Grip Fly", AVIBmE5iQrQ, seen from the head end, three
  // reps in 11.5 s; MoveNet on 59 frames at 0.25 s): LYING on a bench, the
  // arms start all but vertical over the chest with the elbows soft (150-165)
  // and swing out in the frontal plane until the upper arms are level and the
  // hands a little above them -- 26 cm out from the shoulder, elbows kept at
  // 150; a rep is a 2.0 s lowering, a 0.4 s stretch, a 0.8 s squeeze together
  // and a 0.7 s hold at the top. Authored on the bench with the arms explicit
  // in the side plane (upper/forearm 355/10 -> 352/5 -> 350/345, elbow soft)
  // and swung out with the new `abduct` (8 / 45 / 78 degrees), which is the
  // motion a side view could not say. The old pose STOOD the figure up face
  // on and swept the arms from level out to the sides up to overhead -- a
  // lateral raise, not a fly. Two exercises share it (Dumbbell Fly, Pec
  // Deck -- the pec deck is seated and still borrows this lying pose).
  fly: pose(
    "side",
    // The elbow's bend lives in the side plane and swings out with the arm,
    // so a soft elbow at the bottom tilts the forearm a little headward --
    // the price of a fly on a side-authored figure.
    ([[355, 10, 8], [352, 335, 45], [350, 325, 78]] as const).map(([upper, lower, abduct]) => ({
      ...bench(0.397, 0.304),
      arms: [{ upper, lower, abduct }, { upper: upper + 5, lower: lower + 5, abduct }] as [Limb, Limb],
    })),
    [
      { kind: "floor" },
      { kind: "slab", at: "pelvis", width: 0.5, height: 0.055, dx: -0.154, dy: 0.085 },
      { kind: "bell", at: "hand0", each: true, size: 0.05 },
    ],
    "neutral",
    1,
    { tempo: { down: 2000, bottom: 400, up: 800, top: 700 }, camera: { azimuth: 0.9 } },
  ),

  // --- Vertical push -------------------------------------------------------

  // Overhead press, from a reference clip measured with the pose lab
  // (TylerPath "How to Overhead Press Correctly", 0YYeELi896g, three-quarter
  // side view, three reps between the cuts; MoveNet on 63 frames at 0.3 s):
  // the bar starts racked on the upper chest with the wrists at shoulder
  // height, the forearms vertical and the elbows 25-35 degrees ahead of the
  // trunk (elbow 27-35); it passes in front of the face and locks out with
  // the arms straight up (upper arm 176-179 from vertical, elbow 160-172)
  // and the bar over the shoulders; the trunk leans back 5-10 degrees at the
  // start and comes upright under the bar; a rep is a ~1.0 s press, a short
  // lockout, a ~1.0 s lowering and a beat racked. Authored SIDE-ON now (the
  // old pose was a front view with the elbows out to the sides and no lean),
  // arms explicit -- 150/5, 95/0, 5/355 -- with the elbows flared 45 degrees
  // outboard, which is where a press carries them, and the grip 6cm outside
  // the shoulders. The head tips back a touch while the bar passes.
  overheadPress: pose(
    "side",
    ([[355, 150, 5, 350], [358, 95, 0, 352], [0, 5, 355, 0]] as const).map(([torso, upper, lower, neck]) => {
      const pelvis = { x: 0.5, y: 0.492 };
      return {
        pelvis,
        torso,
        neck,
        arms: sideArms(upper, lower).map((arm) => ({ ...arm, spread: 0.06, flare: 45 })) as [Limb, Limb],
        legs: plantedLegs(pelvis, torso, "side", FEET, FORWARD),
      };
    }),
    [
      { kind: "floor" },
      { kind: "bar", at: "grip", length: 0.40 },
      // Stood on, one band to each hand, when the press is done on a band.
      { kind: "cable", at: "hand0", anchor: { x: 0.525, y: 0.94 }, band: true },
      { kind: "cable", at: "hand1", anchor: { x: 0.525, y: 0.94 }, band: true },
    ],
    "overhand",
    1,
    { tempo: { down: 1000, bottom: 400, up: 1100, top: 500 }, camera: { azimuth: 0.75 } },
  ),

  // Lateral raise, from a reference clip measured with the pose lab (OPEX
  // "Dumbbell Lateral Raise", 8aUc9snLOxU, face on -- the right view for a
  // lift in the frontal plane -- five reps in 9 s; MoveNet on 61 frames at
  // 0.2 s): at the bottom the arms hang 7-10 degrees out from the sides,
  // straight (elbow 177-180); the raise takes the upper arm to 90-99 from
  // vertical -- level or a shade above -- with the forearm 100-109, so the
  // hands ride a little higher than the elbows (elbow 166-174); a rep is a
  // 0.75 s raise, a touch at the top, a 1.2 s lowering and a beat at the
  // bottom. Frames [upper, forearm] 172/172 -> 135/140 -> 88/100. The old
  // frames stopped 3 degrees under level and had no tempo.
  lateralRaise: pose(
    "front",
    ([[172, 172], [135, 140], [88, 100]] as const).map(([upper, lower]) => standFront(0.497, 0, bothArms(upper, lower))),
    [{ kind: "floor" }, { kind: "bell", at: "hand0", each: true, size: 0.05 }],
    "neutral",
    1,
    { tempo: { down: 750, bottom: 200, up: 1200, top: 300 } },
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

  // Triceps pushdown, from a reference clip measured with the pose lab (OPEX
  // "Rope Cable Tricep Pushdown", y6EdXBdL75A, side view, five reps in
  // 11.6 s; MoveNet on 73 frames at 0.2 s): the trunk leans 4-8 degrees
  // toward the stack, the knees soft; at the top the elbows sit 8-14 degrees
  // ahead of the trunk with the forearms folded to 120-125 from vertical
  // (elbow 68-75), the hands 12 cm ahead of and 10 cm below the shoulders;
  // the push locks the arms out straight down (upper arm 4-7 forward,
  // forearm 12-17, elbow 170-175), the hands 6 cm ahead of the thighs; a rep
  // is a 1.0 s push, a 0.4 s lockout, a 1.0 s release and a beat at the
  // top. Authored SIDE-ON (the old pose was face on, elbows out at 170 with
  // the forearm from 100 to 174), arms explicit 170/60 -> 174/110 -> 175/165
  // (elbow 70/116/170), the hands a rope's width apart, the pulley above and
  // ahead on a long arm so the station's base clears the toes. Two
  // exercises share it (Triceps Pushdown, Overhead Triceps Extension).
  tricepsExtension: pose(
    "side",
    ([[170, 60], [174, 110], [175, 165]] as const).map(([upper, lower]) =>
      stand({ x: 0.5, y: 0.494 }, 6, sideArms(upper, lower).map((arm) => ({ ...arm, spread: -0.01 })) as [Limb, Limb]),
    ),
    [
      { kind: "floor" },
      { kind: "bar", at: "grip", length: 0.16, plates: false },
      // The pulley must stay AHEAD of the hands in every key: the station is
      // built from the first frame's grip-to-anchor direction, and a pulley
      // behind the folded hands would put the column through the figure.
      { kind: "cable", at: "grip", anchor: { x: 0.66, y: 0.02 }, handle: "rope", arm: 0.42 },
    ],
    "neutral",
    1,
    { tempo: { down: 1000, bottom: 400, up: 1000, top: 200 }, camera: { azimuth: 0.9, lying: false } },
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

  // Bent-over row, from a reference clip measured with the pose lab (NASM
  // "How to do a Barbell Bent Over Row Pronated", bm0_q9bR_HA, side view,
  // three reps after a 6 s hinge down; MoveNet on 72 frames at 0.25 s): the
  // trunk holds 53-67 degrees from vertical over soft knees (140-150, the
  // thigh 20-37 back, the shin 4-10 forward); the arms hang plumb (upper arm
  // 11-23 from vertical, elbow 160-172) and the pull takes the elbow to
  // 73-86 from vertical -- past the line of the back -- with the forearm 20
  // from vertical and the elbow at 72-87, the bar to the lower chest; a rep
  // is a 0.7 s pull, a touch at the chest, a 0.8 s lowering and a beat
  // hanging. Authored from the trunk: torso 60, knees from the pelvis
  // (thigh 25 back, shin 8 forward), the hands solved to a point on the
  // trunk's own frame -- `along` the trunk from the shoulder and `out` from
  // its axis toward the belly -- so the bar finishes a chest's depth off
  // the sternum instead of inside it. The old pose folded the trunk to 96
  // (past horizontal) with the head up at 82 and no tempo.
  bentRow: pose(
    "side",
    ([[0.14, 0.253], [0.16, 0.17], [0.18, 0.10]] as const).map(([along, out]) => {
      const torso = 60;
      const pelvis = { x: 0.480, y: 0.513 };
      const rad = (torso * Math.PI) / 180;
      // Trunk axis from the shoulder toward the hip, and the belly-side
      // normal, in screen terms (x right = forward, y down).
      const axis = { x: -Math.sin(rad), y: Math.cos(rad) };
      const belly = { x: Math.cos(rad), y: Math.sin(rad) };
      const targets = [0, 1].map((side) => {
        const s = shoulderAt(pelvis, torso, side as 0 | 1, "side");
        return { x: s.x + (along * axis.x + out * belly.x) / ASPECT, y: s.y + along * axis.y + out * belly.y };
      }) as [Point, Point];
      return {
        pelvis,
        torso,
        neck: 40,
        arms: reachingArms(pelvis, torso, "side", targets, BACK),
        legs: plantedLegs(pelvis, torso, "side", FEET, FORWARD),
      };
    }),
    [{ kind: "floor" }, { kind: "bar", at: "grip", length: 0.17 }],
    "overhand",
    1,
    // Not a lying scene, whatever the two-metre bar does to the fit box: a
    // full orbit from three-quarters, or the plates hide the trunk for half
    // of a side-to-side swing.
    { tempo: { down: 700, bottom: 250, up: 800, top: 300 }, camera: { azimuth: 1.0, lying: false } },
  ),

  // Seated cable row, from a reference clip measured with the pose lab (OPEX
  // "Seated Cable Row", 4ZbqM_gcgAI, side view, three reps in 9.5 s; MoveNet
  // on 52 frames at 0.25 s): the trunk stays within 7 degrees of vertical
  // the whole rep, the knees bent to 69-77 with the feet on a plate ahead
  // and below the seat (the thigh 20 degrees above level, the shin plumb);
  // extended, the upper arm reaches 63-67 forward of vertical with the
  // forearm level (elbow 144-150); pulled, the upper arm is plumb (-4..+2)
  // with the elbow at the ribs and the forearm rising 35 degrees to the
  // handle at the navel (elbow 51-58); a rep is a 1.0 s pull, a 0.5 s hold,
  // a 1.5 s release and a beat extended. Authored from the clip's angles:
  // arms explicit 115/85 -> 150/70 -> 182/55, hands together on the V-handle
  // (spread -0.06), legs explicit 70/178 with the feet on an upright plate,
  // trunk 356. The old pose swung the trunk 6 -> -7 with the hands at chest
  // height and the legs nearly straight, and had no tempo.
  seatedRow: pose(
    "side",
    ([[115, 85], [150, 70], [182, 55]] as const).map(([upper, lower]) => {
      const pelvis = { x: 0.42, y: 0.600 };
      const torso = 356;
      return {
        pelvis,
        torso,
        neck: 0,
        arms: sideArms(upper, lower).map((arm) => ({ ...arm, spread: -0.06 })) as [Limb, Limb],
        legs: [{ upper: 70, lower: 178, end: 20 }, { upper: 70, lower: 178, end: 20 }] as [Limb, Limb],
      };
    }),
    [
      { kind: "floor" },
      { kind: "slab", at: "pelvis", width: 0.16, height: 0.055, dy: 0.075 },
      // The footplate: an upright board just past the toes, on its own plinth.
      { kind: "slab", at: "ankle0", dx: 0.04, dy: 0.03, width: 0.05, height: 0.25 },
      { kind: "bar", at: "grip", length: 0.10, plates: false },
      { kind: "cable", at: "grip", anchor: { x: 0.88, y: 0.72 }, band: true },
    ],
    "neutral",
    1,
    { tempo: { down: 1000, bottom: 500, up: 1500, top: 500 }, camera: { azimuth: 0.9, lying: false } },
  ),

  // Lat pulldown, from a reference clip measured with the pose lab (OPEX
  // "Cable Lat Pulldown Machine", PEv0gTcMY3g, three-quarter side view, four
  // reps in 10.5 s; MoveNet on 56 frames at 0.25 s): SEATED, thighs level
  // (77-83 from vertical) with the shins tucked 23 back under the seat (knee
  // 73-81), the trunk leaning back 8-12; at the top the arms reach up and a
  // little forward to the bar (upper arm 143-158 from vertical, elbow
  // 160-175, the wrist 25 cm above and 8 cm ahead of the shoulder); the pull
  // brings the elbows straight down to the ribs (upper arm 1-13 from
  // vertical, elbow 35-41) and the bar to the upper chest, 4 cm under the
  // shoulder line; a rep is a 1.0 s pull, a touch, a 1.5 s release and a
  // beat at the top. Authored SIDE-ON on a seat under the hips with the
  // feet on the floor, the hands solved to shoulder-relative targets with
  // the elbows breaking back, the grip wide (spread 0.14), the pulley above
  // and just ahead of the hands. The old pose STOOD on the floor, face on,
  // pulling a bar from 0.18 to 0.31 of the frame with no lean and no seat.
  pulldown: pose(
    "side",
    // [hand above the shoulder, hand ahead of it]: the top reach is 98% of
    // the arm, which two-link IK draws at ~160 -- the clip's 160-175.
    ([[0.272, 0.085], [0.10, 0.08], [-0.04, 0.079]] as const).map(([above, ahead]) => {
      const torso = 350;
      const pelvis = { x: 0.50, y: 0.693 };
      const targets = [0, 1].map((side) => {
        const s = shoulderAt(pelvis, torso, side as 0 | 1, "side");
        return { x: s.x + ahead / ASPECT, y: s.y - above };
      }) as [Point, Point];
      return {
        pelvis,
        torso,
        neck: 0,
        arms: reachingArms(pelvis, torso, "side", targets, BACK).map((arm) => ({ ...arm, spread: 0.14 })) as [Limb, Limb],
        legs: [{ upper: 100, lower: 203, end: 90 }, { upper: 100, lower: 203, end: 90 }] as [Limb, Limb],
      };
    }),
    [
      { kind: "floor" },
      { kind: "slab", at: "pelvis", width: 0.16, height: 0.055, dy: 0.075 },
      { kind: "bar", at: "grip", length: 0.44, plates: false },
      // The pulley just ahead of the hands, on a long arm from a column that
      // stands clear of the knees and the machine's own base.
      { kind: "cable", at: "grip", anchor: { x: 0.57, y: 0.02 }, arm: 0.55 },
    ],
    "overhand",
    1,
    { tempo: { down: 1000, bottom: 150, up: 1500, top: 200 }, camera: { azimuth: 0.9 } },
  ),

  // Pull-up, from a reference clip measured with the pose lab (OPEX "Strict
  // Pull Up", jgFel4wZl3I, side view, four reps in 8.6 s; MoveNet on 60
  // frames at 0.2 s): a dead hang (elbow 165-180, trunk 3-5 from vertical,
  // the legs 5-13 degrees behind the hips with the knees soft at 168-174)
  // rising until the chin clears the bar -- the shoulder 5 cm under the bar
  // and a hand's breadth behind it, the trunk arched to 15-18, the legs
  // 10-15 back; a rep is a 1.1 s pull, a beat at the top, a 1.1 s lowering
  // and a beat hanging. Authored SIDE-ON (the old pose was a front view: a
  // straight body rising under the bar with no arch and no hollow), the
  // shoulder placed under and behind the fixed bar each key and the pelvis
  // walked down the trunk from it; the grip a hand outside the shoulders
  // (spread 0.06). The assistance band hangs from the HAND -- the bar is on
  // the midline in a side view, the hand is outboard of the girdle.
  pullUp: pose(
    "side",
    // [trunk lean, shoulder below the bar, shoulder behind the bar, thigh, shin]
    // -- the face passes BEHIND the bar on the way up, so the shoulder sits
    // 10 cm back of it mid-pull and 8 cm at the top, where the chin is over.
    ([[2, 0.290, 0.02, 185, 195], [8, 0.132, 0.10, 188, 198], [15, 0.026, 0.08, 192, 202]] as const).map(([torso, below, behind, upper, lower]) => {
      const bar = { x: 0.512, y: 0.186 };
      const shoulder = { x: bar.x - behind / ASPECT, y: bar.y + below };
      const rad = (torso * Math.PI) / 180;
      const pelvis = { x: shoulder.x - hipAt({ x: 0, y: 0 }, torso, 0, "side").x - (P.spine * Math.sin(rad)) / ASPECT, y: shoulder.y + P.spine * Math.cos(rad) };
      return {
        pelvis,
        torso,
        neck: torso > 10 ? 350 : 0,
        // The bar is fixed; the body climbs to it.
        arms: reachingArms(pelvis, torso, "side", grip(bar, 0, "side"), FORWARD).map((arm) => ({ ...arm, spread: 0.06 })) as [Limb, Limb],
        legs: [{ upper, lower, end: 150 }, { upper, lower, end: 150 }] as [Limb, Limb],
      };
    }),
    [
      { kind: "bar", at: "grip", length: 0.44, plates: false },
      // The assistance band: looped over the bar by the hand, a foot in it.
      { kind: "cable", at: "ankle0", anchorAt: "hand0", band: true },
    ],
    "overhand",
    1,
    { tempo: { down: 1100, bottom: 200, up: 1100, top: 300 }, camera: { azimuth: 0.9 } },
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

  // Biceps curl, from a reference clip measured with the pose lab (OPEX "EZ
  // Bar Curl", -gSM-kqNlUw, side view, three reps in 10 s; MoveNet on 64
  // frames at 0.2 s): at the bottom the arms hang all but straight (upper
  // arm 2-5 forward of plumb, forearm 12-14 forward, elbow 165-171), the bar
  // just ahead of the thighs; the curl carries the elbows 13-19 degrees
  // forward and folds the forearm to 160-171 from vertical (elbow 28-31) --
  // the bar finishes at shoulder height, 6 cm ahead of the shoulder; the
  // trunk stays within 5 degrees of vertical; a rep is a 1.1 s curl, a 0.3 s
  // squeeze, a 1.5 s lowering and a beat at the bottom. Arms explicit
  // 177/167 -> 172/95 -> 164/15 (elbow 170/103/31). The old pose curled the
  // elbows only to 78 with the upper arm pinned at 4 forward, no tempo. Six
  // exercises share it (Barbell, Dumbbell, Hammer, Band, Preacher and
  // Concentration Curl).
  curl: pose(
    "side",
    ([[177, 167], [172, 95], [164, 15]] as const).map(([upper, lower]) => stand({ x: 0.5, y: 0.494 }, 358, wide(sideArms(upper, lower)))),
    [
      { kind: "floor" },
      { kind: "bell", at: "hand0", each: true },
      // Stood on: one band to each hand, off the floor under the feet.
      { kind: "cable", at: "hand0", anchor: { x: 0.571, y: 0.938 }, band: true },
      { kind: "cable", at: "hand1", anchor: { x: 0.571, y: 0.938 }, band: true },
    ],
    "underhand",
    1,
    { tempo: { down: 1100, bottom: 300, up: 1500, top: 400 }, camera: { azimuth: 0.75 } },
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

  // 45-degree leg press, from a reference clip measured with the pose lab
  // (OPEX "Leg Press Machine Press", B8KqmwdomoU, side view, four reps in
  // 12 s; MoveNet on 41 frames at 0.3 s): the lifter lies on a backrest
  // reclined to about 65 degrees, the feet on a platform inclined 45
  // degrees; at lockout the legs point up the track nearly straight (knee
  // 170-178), at the bottom the knees fold to 50-55 with the thighs over
  // the chest; a rep is a 1.1 s press, a 0.4 s lockout, a 1.2 s lowering
  // and a 0.4 s pause folded. The old pose was a SEATED press: backrest at
  // 38, a vertical platform, the feet travelling level.
  // The feet ride a 45-degree line from the hip (0.20 -> 0.31 -> 0.4365 of
  // the frame out, the last within a percent of the leg's length, which
  // draws it locked); the platform is anchored to the ankle and leans with
  // the track. The
  // machine holds the body off the ground, so there is no floor line.
  legPress: pose(
    "side",
    [0.20, 0.31, 0.4365].map((reach) => {
      const pelvis = { x: 0.46, y: 0.640 };
      const torso = 295;
      const hip = hipAt(pelvis, torso, 0, "side");
      const foot = { x: hip.x + (reach * Math.SQRT1_2) / ASPECT, y: hip.y - reach * Math.SQRT1_2 };
      return {
        pelvis,
        torso,
        neck: torso + 20,
        // Hands on the handles beside the seat: the arms lie along the
        // reclined trunk, outside the backrest, the fists at the hips.
        arms: sideArms(112, 118).map((arm) => ({ ...arm, spread: 0.06 })) as [Limb, Limb],
        // Feet flat on the platform: the soles lie along the 45-degree face.
        legs: plantedLegs(pelvis, torso, "side", [foot, { x: foot.x - 0.014, y: foot.y + 0.012 }], FORWARD, [45, 50]),
      };
    }),
    [
      { kind: "slab", at: "pelvis", width: 0.42, height: 0.055, angle: 295 },
      { kind: "slab", at: "ankle0", dx: 0.012, dy: 0.018, width: 0.045, height: 0.34, tilt: 45 },
    ],
    "overhand",
    1,
    { tempo: { down: 1100, bottom: 400, up: 1200, top: 400 }, camera: { azimuth: 1.2 } },
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
