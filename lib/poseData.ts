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
// A lunge's REAR foot stands on its toes: a world foot angle past straight
// down, so the toe is the lowest point and the ankle rides above it.
const REAR_FOOT = 200;
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

// A figure hanging from a bar: the shoulder fixed under the bar (the old
// hanging raise's spine top), the pelvis walked down the trunk from it, the
// arms plumb and a hand outside the shoulders, the feet relaxed off the shin.
const HANG_SHOULDER: Point = { x: 0.4914, y: 0.3153 };
function hangingFigure(torso: number, thigh: number, shin: number): Figure {
  const rad = (torso * Math.PI) / 180;
  const pelvis = { x: HANG_SHOULDER.x - (Math.sin(rad) * P.spine) / ASPECT, y: HANG_SHOULDER.y + Math.cos(rad) * P.spine };
  return {
    pelvis,
    torso,
    neck: 0,
    arms: wide(sideArms(3, 2), 0.06),
    legs: sideLegs(thigh, shin, shin - 60),
  };
}

// The farmer's stride (OPEX "Dumbbell Farmer's Carry", K4R8uc1x_OA), shared
// by every loaded carry: heel strike -> feet passing -> the next heel strike,
// in place; only the arms differ between the carries.
function carryStride(arms: [Limb, Limb]): Figure[] {
  return [
    { pelvis: { x: 0.5, y: 0.535 }, torso: 3, arms, legs: [{ upper: 160, lower: 166, end: 80 }, { upper: 202, lower: 214, end: 140 }] },
    { pelvis: { x: 0.5, y: 0.528 }, torso: 3, arms, legs: [{ upper: 178, lower: 180, end: 90 }, { upper: 184, lower: 192, end: 100 }] },
    { pelvis: { x: 0.5, y: 0.535 }, torso: 3, arms, legs: [{ upper: 202, lower: 214, end: 140 }, { upper: 160, lower: 166, end: 80 }] },
  ];
}

// A push-up variant as its own movement rather than the flat one shifted
// about: the hands stay put (a bench does not slide under them), the body
// stays one straight line from the shoulder through the hip to the pivot --
// the ankle, or the knee for the kneeling version -- and the ELBOW drives
// the rep. For each elbow angle the shoulder has to sit a known distance
// from the hand (the cosine rule on the upper arm and forearm), and there is
// exactly one body angle that puts it there; it is found by bisection, so
// the lockout really locks out instead of stopping at 135 degrees.
// A push-up variant as its own movement rather than the flat one shifted
// about: the hands stay put (a bench does not slide out from under them), the
// body is one straight line from the shoulder through the hip to the PIVOT --
// the ankle, or the knee for the kneeling version -- and the ELBOW drives the
// rep. For each elbow angle the shoulder has to sit a known distance from the
// hand (the cosine rule on the upper arm and forearm), and the body angle
// that puts it there is solved rather than guessed.
//
// Two offsets make this worth solving instead of eyeballing three sets of
// angles, and both are the fake depth the side view carries. The LEG solves
// from the hip, which sits a girdle half-depth off the pelvis -- horizontal,
// so harmless under a standing figure but running ALONG the body of a lying
// one: placing the pelvis `thigh+shin` from the ankle left the hip short of
// it and folded the knees to 151. So the HIP is placed, and the pelvis falls
// out of it. The ARM solves from the same offset on the shoulder, which is
// 1.8 cm of its 29 and the difference between a lockout that locks and one
// that stops at 135.
function pressUpFrames(
  hand: Point,
  pivot: Point,
  legSpan: number,
  elbows: number[],
  legs: (pelvis: Point, torso: number) => [Limb, Limb],
  // An inverted row is this same solve pulled instead of pressed: the arms
  // reach UP to a fixed bar and the elbow breaks the other way, so the one
  // thing it needs to override is how the arms are built.
  arms?: (pelvis: Point, torso: number, hand: Point) => [Limb, Limb],
  // Which root to take: see the scan below. A press rises toward its hands
  // from under them and wants the STEEPER body; a row hangs under a bar in
  // front and wants the shallower one.
  branch: "steeper" | "shallower" = "steeper",
): Figure[] {
  // The side view's fake depth, read off hipAt rather than restated here, so
  // it cannot drift from the one the build actually uses.
  const depth = hipAt({ x: 0, y: 0 }, 0, 0, "side").x * ASPECT;
  const dist = (a: Point, b: Point) => Math.hypot((a.x - b.x) * ASPECT, a.y - b.y);
  // The body `deg` above horizontal, head end away from the pivot.
  const bodyAt = (deg: number) => {
    const a = (deg * Math.PI) / 180;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    // Pelvis distance that lands the HIP exactly `legSpan` from the pivot,
    // hip offset and all -- the positive root of |pelvis - offset| = legSpan.
    const d = cos * depth + Math.sqrt(Math.max(legSpan * legSpan - depth * depth * (1 - cos * cos), 0));
    const pelvis = { x: pivot.x - (cos * d) / ASPECT, y: pivot.y - sin * d };
    // The trunk runs along the same line. x is in frame units: a real angle
    // needs it scaled by ASPECT, as step() does.
    const torso = (Math.atan2(-cos, sin) * 180) / Math.PI;
    return { pelvis, torso };
  };
  return elbows.map((elbow) => {
    const rad = (elbow * Math.PI) / 180;
    // Shoulder-to-wrist across a bent elbow.
    const reachLen = Math.sqrt(P.upperArm * P.upperArm + P.forearm * P.forearm - 2 * P.upperArm * P.forearm * Math.cos(rad));
    const err = (deg: number) => {
      const { pelvis, torso } = bodyAt(deg);
      return dist(shoulderAt(pelvis, torso, 0, "side"), hand) - reachLen;
    };
    // Shoulder-to-hand is not monotonic in the body angle: it falls to a
    // minimum and rises again, so two angles put the shoulder a given
    // distance from the hand. The press-up is the steeper one -- the body
    // rises from the pivot toward hands below it -- so it takes the LAST
    // crossing. A row hangs from a bar ahead and above, where the shallower
    // root is the one that lifts the chest to it, and takes the first.
    let deg = 0;
    let found = false;
    let prev = err(-70);
    for (let t = -69.95; t <= 80; t += 0.05) {
      const e = err(t);
      if ((prev <= 0 && e >= 0) || (prev >= 0 && e <= 0)) {
        if (branch === "steeper" || !found) deg = t;
        found = true;
      }
      prev = e;
    }
    const { pelvis, torso } = bodyAt(deg);
    return {
      pelvis,
      torso,
      neck: torso - 4,
      // Both hands on the same point: the flat push-up staggers the far one
      // 0.016 toward the head, which at a locked-out elbow is further than
      // the far arm can reach.
      arms: arms ? arms(pelvis, torso, hand) : reachingArms(pelvis, torso, "side", [hand, hand], FORWARD, [264, 259]),
      legs: legs(pelvis, torso),
    };
  });
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

  // Step-up, from a reference clip measured with the pose lab (OPEX "Step
  // Up", RRuWVDefORg, three-quarter view, four step-ups in 19 s; MoveNet on
  // 71 frames at 0.25 s). The clip: a knee-high box IN FRONT of the lifter
  // (the hip rises 0.5 m onto it); the lead foot goes up on the box with
  // the knee at 73-80 and the trunk leaning 24-27 forward; the drive
  // brings the hip up and over the foot (trunk 25 -> 10 -> 0) until she
  // stands tall on the box with the trailing foot brought up beside the
  // lead (knees 157-175); then down the same way; a rep is a 1.0 s drive,
  // 0.5 s standing on the box, a 1.0 s step down and 0.5 s on the floor.
  // Step-Up and Dumbbell Step-Up borrowed the Bulgarian split squat --
  // whose box is BEHIND the lifter, under the rear foot.
  // Box 0.25 (0.5 m) tall, its top 3 cm under the lead ankle; the lead leg
  // is solved to that ankle, the trailing leg to the floor, then explicit
  // (hanging) in the drive and solved to the box top standing.
  stepUp: pose(
    "side",
    ([
      // Hip heights are set by the straight leg under them: 0.436 (99% of
      // the leg, where the solver locks the knee) above the trailing ankle
      // on the floor at the start, above the lead ankle on the box at the
      // top -- a hair less and the solver folds the knee 36 degrees.
      [{ x: 0.44, y: 0.50 }, 25, "floor"],
      [{ x: 0.57, y: 0.33 }, 12, "hanging"],
      [{ x: 0.62, y: 0.221 }, 2, "box"],
    ] as const).map(([pelvis, torso, trail]) => {
      const lead = { x: 0.62, y: 0.658 };
      const hips = [0, 1].map((side) => hipAt(pelvis, torso, side as 0 | 1, "side"));
      // Knees fold FORWARD (bend -1, as FORWARD): +1 put the lead knee
      // below and behind the hip, a leg sitting on air.
      const leadLeg: Limb = { ...reach(hips[0]!, lead, P.thigh, P.shin, -1), end: 90 };
      const trailLeg: Limb =
        trail === "floor"
          ? { ...reach(hips[1]!, { x: 0.455, y: 0.93 }, P.thigh, P.shin, -1), end: 90 }
          : trail === "hanging"
            ? { upper: 200, lower: 205, end: 160 }
            : { ...reach(hips[1]!, { x: 0.60, y: 0.658 }, P.thigh, P.shin, -1), end: 90 };
      return { pelvis, torso, neck: torso > 10 ? torso - 15 : 0, arms: wide(HANG), legs: [leadLeg, trailLeg] as [Limb, Limb] };
    }),
    [
      { kind: "floor" },
      { kind: "bell", at: "hand0", each: true },
      // The box: its top 3 cm under the lead ankle, centred a little ahead
      // of it, 0.25 deep, on posts to the floor.
      { kind: "slab", at: "ankle0", dx: 0.02, dy: 0.055, width: 0.25, height: 0.05 },
    ],
    "neutral",
    1,
    { tempo: { down: 1000, bottom: 500, up: 1000, top: 500 }, camera: { azimuth: 0.9 } },
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

  // A goblet squat hugs the bell against the chest with both hands -- and
  // `hug` is what makes it do that: the bell leans with the chest instead of
  // hanging plumb from the grip.
  //
  // From a reference clip measured with the pose lab (OPEX "Goblet Squat",
  // pEGfGwp6IEA, three-quarter view, three reps in 11.2 s; MoveNet on 33
  // frames at 0.25 s). The clip CONFIRMS the shared squat frames rather than
  // correcting them: it bottoms with the hip crease level with the knee
  // (measured +0.024, -0.011, +0.010, -0.024 of frame height across the
  // three reps -- parallel, not below it) and the hip at 0.40 of its
  // standing height above the ankle, against the shared frames' 0.42. The
  // trunk reads 32 degrees at the bottom against the frames' 37, but this
  // camera is three-quarters on, so a sagittal angle is a projection and 5
  // degrees is inside its error -- not a reason to move a frame that was
  // solved from the back squat's bar constraint.
  //
  // What the clip does settle is the TIMING, which was the back squat's:
  // 1.25 s down, a quarter-second at the bottom, 1.0 s up and 0.55 s tall.
  gobletSquat: pose(
    "side",
    SQUAT_FRAMES.map(([x, y, torso]) => squatting(stand({ x, y }, torso, chestArms({ x, y }, torso)))),
    [{ kind: "floor" }, { kind: "bell", at: "grip", size: 0.06, hug: true }],
    "neutral",
    1,
    { tempo: { down: 1250, bottom: 250, up: 1000, top: 550 }, camera: SQUAT_CAMERA },
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

  // Reverse lunge, from a reference clip measured with the pose lab (OPEX
  // "Dumbbell Reverse Lunge", Q2k3kYbtOcI, square side view, three reps in
  // 11.7 s; MoveNet on 45 frames at 0.25 s, both legs read separately --
  // table() picks one side per frame and a lunge's two legs do different
  // things).
  //
  // The thing the old frames had wrong: the REAR FOOT. Both feet were
  // planted flat on the floor, so the rear leg stayed long and held its
  // knee 4 cm up in the air at the bottom. In the clip the rear heel is up
  // and the foot stands on its toes -- the rear ankle sits 5.2 cm ABOVE the
  // front one and the rear knee comes down level with the floor (measured
  // 1.7 cm below the front ankle JOINT, which is itself a centimetre up
  // from the sole). So the rear toe is the contact point here, the way a
  // push-up's is, and the ankle hangs off it.
  //
  // The rest of the clip: the front foot never moves (ankle x 0.276-0.282
  // across all three reps), the front thigh comes to level at the bottom
  // (knee 0.016 below the hip) with the knee at 69-77 and the shin 21-27
  // degrees forward, the rear knee at 81-88, and the trunk stays within 10
  // degrees of upright. A rep is a 1.0 s descent, a beat at the bottom, a
  // 1.0 s stand and 0.75 s tall -- the pose had no tempo at all.
  lunge: pose(
    "side",
    [0.520, 0.630, 0.700].map((y) => {
      const pelvis = { x: 0.49, y };
      // The rear foot stands on its toes: the toe is planted and the ankle
      // hangs off it, up and a little forward.
      const rearToe = { x: 0.293, y: FLOOR };
      const rearAnkle = along(rearToe, REAR_FOOT - 180, 0.069);
      return {
        pelvis,
        torso: 4,
        arms: wide(HANG),
        legs: plantedLegs(pelvis, 4, "side", [{ x: 0.605, y: FLOOR }, rearAnkle], FORWARD, [90, REAR_FOOT]),
      };
    }),
    [{ kind: "floor" }, { kind: "bell", at: "hand0", each: true }],
    "neutral",
    1,
    { tempo: { down: 1000, bottom: 250, up: 1000, top: 750 } },
  ),

  lateralLunge: pose(
    "front",
    [
      standFront(0.497, 0, bothArms(158, -48)),
      // Feet flat (explicit ends) in the stepped frames: left to the shins,
      // the wide foot's toes tipped 4cm up and the long leg's 3cm down.
      // The pelvis is SOLVED, not placed: it sits where the trailing leg is
      // at full stretch and the squatting knee is at the clip's angle.
      { ...standFront(0.570, 4, bothArms(158, -48), [{ x: 0.645, y: FLOOR }, { x: 0.400, y: FLOOR }]), pelvis: { x: 0.443, y: 0.570 }, legs: plantedLegs({ x: 0.443, y: 0.570 }, 4, "front", [{ x: 0.645, y: FLOOR }, { x: 0.400, y: FLOOR }], OUT, [90, 270]) },
      (() => {
        const pelvis = { x: 0.401, y: 0.678 };
        return {
          pelvis,
          torso: 6,
          arms: bothArms(158, -48),
          // One knee bends deeply over a wide foot; the other leg stays long.
          legs: plantedLegs(pelvis, 6, "front", [{ x: 0.676, y: FLOOR }, { x: 0.372, y: FLOOR }], OUT, [90, 270]),
        };
      })(),
    ],
    [{ kind: "floor" }],
    "neutral",
    1,
    // The clip: about 2.2 s down, a beat at the bottom, 1.5 s up and 1.2 s
    // standing between reps.
    { tempo: { down: 2200, bottom: 300, up: 1500, top: 1200 } },
  ),

  // Skater bound, from a reference clip measured with the pose lab ("Skater
  // Jumps", Xqzq9w42-z4, square FRONT view, nine bounds in 12 s; MoveNet on
  // 61 frames at 0.2 s, read as frontal keypoints). The clip: a bound
  // sideways from one leg to the other, the hip travelling 155 px (about
  // 1.4 m) each way and rising only 3-4 cm; landing on one leg with the
  // stance knee soft (165-170), the trunk leaning 7-13 over the stance
  // foot, the free leg folded (knee 80-115) and crossed BEHIND the stance
  // leg with its foot 13-15 cm up; mid-bound the legs straddle wide, low
  // to the floor; the hands come together in front of the chest on each
  // landing and swing out between. A bound every 1.3 s. Skater Bound
  // borrowed `jump` (a two-footed hop, side view) before.
  // Face on, since the whole movement is lateral. The free leg's shin is
  // pitched behind the body with `forward` (now on legs too): in the frontal
  // plane alone it drew through the stance leg. The bound covers 0.20
  // (0.6 m) each way.
  skaterBound: pose(
    "front",
    (() => {
      const landed = (stance: 0 | 1): Figure => {
        const dir = stance === 0 ? 1 : -1; // side 0 stands on the figure's right (+x)
        // Pelvis height sets the stance knee: 0.487 puts the foot at 98.8% of
        // the leg (knee 162, the clip's soft 165-170); 0.50 folded it to 147.
        const pelvis = { x: 0.5 + dir * 0.10, y: 0.487 };
        const torso = dir * 10; // leaning over the stance foot
        const hipS = hipAt(pelvis, torso, stance, "front");
        const foot = { x: hipS.x + dir * 0.008, y: FLOOR };
        const stanceLeg: Limb = { ...reach(hipS, foot, P.thigh, P.shin, OUT[stance]), end: stance === 0 ? 90 : 270 };
        // The free leg angled 20 toward the stance side, its shin swung 70
        // behind: the foot ends up behind the stance ankle, 15 cm up.
        const freeLeg: Limb = { upper: 180 - dir * 20, lower: 180, forward: -70, end: 180 };
        const legs = (stance === 0 ? [stanceLeg, freeLeg] : [freeLeg, stanceLeg]) as [Limb, Limb];
        // Hands together in front of the chest, the forearms crossing.
        const arms: [Limb, Limb] = [{ upper: 200, lower: 290 }, { upper: 160, lower: 70 }];
        return { pelvis, torso, arms, legs };
      };
      // Mid-bound: low and wide, the legs straddled, the arms swung out.
      const flight: Figure = {
        pelvis: { x: 0.5, y: 0.47 },
        torso: 0,
        arms: [{ upper: 150, lower: 130 }, { upper: 210, lower: 230 }],
        // Toes down and out (135 / 225): pointing straight down they went 5 mm
        // into the floor.
        legs: [{ upper: 155, lower: 175, forward: -20, end: 135 }, { upper: 205, lower: 185, forward: -20, end: 225 }],
      };
      return [landed(0), flight, landed(1)];
    })(),
    [{ kind: "floor", y: GROUND }],
    "neutral",
    1,
    { tempo: { down: 650, bottom: 0, up: 650, top: 0 }, camera: { azimuth: 0.35 } },
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

  // Lying leg curl, from a reference clip measured with the pose lab (OPEX
  // "Prone Hamstring Curl Machine", xKOyGU0AfOE, side view, four reps in
  // 12.4 s). The lifter is small in frame on a gym machine and MoveNet
  // scores only 0.26-0.71 here, mixing the two legs on the curled frames,
  // so the per-frame angles are NOT quoted -- what survives is the two
  // clusters the whole clip agrees on, and they are what this pose needed:
  // extended, the shin is HORIZONTAL and the knee 142-174; curled, the shin
  // is vertical or a touch past it and the knee is 48-60. Ours stopped at
  // 102 -- a shin straight up, which is half a curl. A rep is about 1.0 s
  // to curl and 1.25 s to lower, with a beat at each end.
  //
  // And the thing the clip has that the pose did not: the machine's ROLLER
  // at the ankles, which is what the legs are actually pushing. Without it
  // the figure read as someone lying on a bench kicking their heels up.
  legCurl: pose(
    "side",
    [90, 45, -30].map((shin) => ({
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
    [
      { kind: "floor", y: 0.79 },
      // Long enough to carry the thigh to the knee, which is where a curl
      // machine's pad stops so the joint is free to bend at its edge: at
      // 0.62 the pad ended 11 cm short and the thighs hung in the air.
      { kind: "slab", at: "pelvis", width: 0.70, height: 0.055, dx: -0.089, dy: 0.095 },
      // The roller on the back of the ankles, as the leg extension has one
      // on the front of its shins: anchored to the joint so it travels
      // through the whole curl.
      { kind: "slab", at: "ankle0", width: 0.16, height: 0.05, dy: -0.045, lever: true },
    ],
    "overhand",
    -1,
    { tempo: { down: 1250, bottom: 300, up: 1000, top: 300 } },
  ),

  calfRaise: pose(
    "side",
    // Reference: OPEX "Standing Calf Raise" (LnWEIjIls-M), four reps in 11.6
    // s, measured with the pose lab. Two things about this clip limit what
    // it can settle, and both are said here rather than hidden: it is filmed
    // from BEHIND, so there is no sagittal ankle angle in it at all; and it
    // is done on a LEDGE with the heels dropping below the step, which is
    // not the exercise this pose draws (the library cue is "rise onto the
    // toes" from the floor, and a previous pass deliberately removed a heel
    // dip under a step that was never drawn). So the RANGE below is left
    // exactly as it was. What the clip does give is the tempo -- 2.0 s a
    // rep, measured top to top across four of them.
    //
    // A calf raise really does travel less than any other movement here: flat
    // feet up to full plantarflexion. The ball of the foot is the pivot, so
    // the toe tip stays at one height while the ankle rises (pelvis 0.506 ->
    // 0.450 = the toe's 0.056 drop below the ankle at 141 degrees). The old
    // first frame dipped the heels under a step that was never drawn, and the
    // floor, pinned to that heel, left the feet 4.6cm in the air at the top.
    [[0.506, 90], [0.479, 112], [0.450, 141]].map(([y, toe]) => ({
      pelvis: { x: 0.5, y: y! },
      torso: 0,
      // Wide enough for the dumbbell head to clear the thigh, as everywhere
      // else a weight hangs at the side.
      arms: wide(HANG),
      legs: sideLegs(178, 179, toe),
    })),
    // Dumbbell Calf Raise shares this pose and had NOTHING in its hands:
    // with only a floor authored the viewer has no prop to hang, so the
    // loaded version drew the bodyweight one.
    [{ kind: "floor" }, { kind: "bell", at: "hand0", each: true }],
    "neutral",
    1,
    // From the clip: about two seconds a rep, and the lowering is the half
    // the coaching cue asks you to slow down.
    { tempo: { down: 900, bottom: 200, up: 700, top: 300 } },
  ),

  // Box jump, from a reference clip measured with the pose lab (OPEX "Box
  // Jump Step Down", W5QzqIbEWvk, square side view, three jumps in 10 s;
  // MoveNet on 47 frames at 0.25 s). The clip: standing a stride from a
  // knee-high box; a 0.5 s dip -- trunk 31-37 forward, knee to 110, shin 34
  // forward, the arms swung back -- then flight with the knees tucked
  // (~110) and the arms swung forward; a landing on the box in a deep
  // absorb (knee 116, trunk 31, the arms out in front, the hip still near
  // its apex); a stand tall on the box; and a STEP down -- one foot
  // reaching for the floor while the other leg bends on the box -- back to
  // the start. A rep is 3.25 s. Box Jump borrowed `jump` (a hop on the
  // spot) before.
  // The first looping movement: it does not come back the way it went, so
  // the key positions play in order (`loop`, one duration per leg, the last
  // leg home) and the box is a slab fixed in the world, 0.25 (0.5 m) tall
  // as the step-up's, its top 3 cm under a foot standing on it.
  boxJump: pose(
    "side",
    (() => {
      const boxTop = 0.658; // an ankle standing on the box
      const floorFeet: [Point, Point] = [{ x: 0.435, y: FLOOR }, { x: 0.415, y: FLOOR }];
      // The pelvis that puts the near leg, at these angles, on this ankle.
      const overAnkle = (ankle: Point, thigh: number, shin: number, torso: number): Point => {
        const knee = along(ankle, shin + 180, P.shin);
        const hip = along(knee, thigh + 180, P.thigh);
        return { x: hip.x - hipAt({ x: 0, y: 0 }, torso, 0, "side").x, y: hip.y };
      };
      const arms = sideArms(180, 136); // hanging, the forearms 44 forward: hands in front
      const stepDownStart = (() => {
        // The far leg bends on the box (knee 100) while the near foot reaches
        // down in front of it; the pelvis is solved from the box leg.
        const torso = 20;
        const boxAnkle = { x: 0.545, y: boxTop }; // heel a centimetre inside the box's front edge
        const knee = along(boxAnkle, 205 + 180, P.shin);
        const hip1 = along(knee, 125 + 180, P.thigh);
        const pelvis = { x: hip1.x - hipAt({ x: 0, y: 0 }, torso, 1, "side").x, y: hip1.y };
        const hip0 = hipAt(pelvis, torso, 0, "side");
        return {
          pelvis, torso, neck: 12, arms,
          legs: [{ ...reach(hip0, { x: 0.46, y: 0.76 }, P.thigh, P.shin, -1), end: 110 }, { upper: 125, lower: 205, end: 90 }] as [Limb, Limb],
        };
      })();
      const landedInFront = (() => {
        // The near foot on the floor a stride ahead of the box, the far foot
        // lifting off the box's front edge on its way down.
        // The hip stays high (the near knee soft, 140) so the far knee, with
        // its foot 27 cm up, folds to 60 rather than 40.
        const pelvis = { x: 0.45, y: 0.50 }, torso = 20;
        const hip0 = hipAt(pelvis, torso, 0, "side"), hip1 = hipAt(pelvis, torso, 1, "side");
        return {
          pelvis, torso, neck: 12, arms,
          legs: [{ ...reach(hip0, floorFeet[0], P.thigh, P.shin, -1), end: 90 }, { ...reach(hip1, { x: 0.505, y: 0.69 }, P.thigh, P.shin, -1), end: 130 }] as [Limb, Limb],
        };
      })();
      return [
        // Standing a stride from the box.
        stand({ x: 0.40, y: 0.494 }, 2, arms, undefined, floorFeet),
        // The dip: knees to 110, shins 34 forward, trunk 37, the arms swung back
        // nearly straight (elbow 165).
        { pelvis: overAnkle(floorFeet[0], 144, 214, 37), torso: 37, neck: 22, arms: sideArms(220, 205), legs: sideLegs(144, 214, 90) },
        // Flight, at the apex: knees tucked, arms swung forward, the hip 24 cm
        // above standing and the feet just over the box top.
        { pelvis: { x: 0.52, y: 0.255 }, torso: 20, neck: 12, arms: sideArms(135, 50), legs: sideLegs(130, 205, 120) },
        // Landing on the box, the deep absorb: knee 115, trunk 31, arms in front.
        // Both legs at the same angles on the box (lyingLegs, not sideLegs):
        // the five-degree depth offset put the far heel over the box's edge.
        { pelvis: overAnkle({ x: 0.58, y: boxTop }, 132, 197, 31), torso: 31, neck: 19, arms: sideArms(138, 53), legs: lyingLegs(132, 197, 90) },
        // Standing tall on the box.
        { pelvis: overAnkle({ x: 0.58, y: boxTop }, 180, 180, 2), torso: 2, arms, legs: lyingLegs(180, 180, 90) },
        stepDownStart,
        landedInFront,
      ];
    })(),
    [
      { kind: "floor" },
      { kind: "slab", x: 0.625, y: 0.713, width: 0.25, height: 0.05 },
    ],
    "neutral",
    1,
    // dip, flight, landing, stand, step down, foot to the floor, settle home.
    { loop: [500, 350, 300, 450, 400, 350, 750], camera: { azimuth: 0.9 } },
  ),

  // Broad jump, from a reference clip measured with the pose lab (Flow High
  // Performance "Broad Jump", YjFr2OEivz0, square side view, one jump in
  // 6 s; MoveNet on 40 frames at 0.15 s). The clip: standing with the arms
  // reached overhead; a 0.7 s dip that is nearly a hinge -- trunk 77-84
  // forward, thigh 54 forward, shin 40-52 forward, knee 74-84, the arms
  // swung back and up behind -- then take-off with the body extended along
  // 40-45 forward and the arms thrown forward-up; flight with the knees
  // coming forward; a landing about 0.8 body heights ahead in a DEEP absorb
  // (thigh past level, knee 49-65, trunk 28-31, arms in front); and a rise
  // to standing. Broad Jump borrowed `jump` (a hop on the spot) before.
  // Ours lands a little shallower (knee 85) so the hip travels forward
  // through every leg of the jump; see the landing key.
  // A loop: the standing finish glides back to the start (0.9 s) while the
  // arms rise to the overhead reach that opens the next jump -- the one
  // motion here that no jumper makes, kept because the alternative was a
  // rep played backwards, a jump BACKWARDS. The jump covers 0.42 (0.9 m).
  broadJump: pose(
    "side",
    (() => {
      const overAnkle = (ankle: Point, thigh: number, shin: number, torso: number): Point => {
        const knee = along(ankle, shin + 180, P.shin);
        const hip = along(knee, thigh + 180, P.thigh);
        return { x: hip.x - hipAt({ x: 0, y: 0 }, torso, 0, "side").x, y: hip.y };
      };
      const startFeet: [Point, Point] = [{ x: 0.395, y: FLOOR }, { x: 0.375, y: FLOOR }];
      const landFeet: [Point, Point] = [{ x: 0.68, y: FLOOR }, { x: 0.66, y: FLOOR }];
      return [
        // Standing, the arms reached overhead.
        stand({ x: 0.36, y: 0.494 }, 2, sideArms(8, 10), undefined, startFeet),
        // The dip: trunk 65, thigh 54 and shin 42 forward (knee 84), the arms
        // swung back and up.
        { pelvis: overAnkle(startFeet[0], 126, 222, 65), torso: 65, neck: 39, arms: sideArms(250, 240), legs: sideLegs(126, 222, 90) },
        // Take-off: the body one line 35 forward, the toes leaving the floor,
        // the arms thrown forward-up. (At 40 the hip stood so far ahead of
        // the feet that it travelled BACKWARDS into the landing.)
        { pelvis: overAnkle({ x: 0.40, y: 0.90 }, 215, 217, 35), torso: 35, neck: 21, arms: sideArms(60, 55), legs: sideLegs(215, 217, 120) },
        // Flight: the hip 12 cm up, the knees coming forward for the landing.
        { pelvis: { x: 0.58, y: 0.374 }, torso: 25, neck: 15, arms: sideArms(100, 95), legs: sideLegs(130, 175, 120) },
        // The landing absorb: thigh 70 forward, shin 25, knee 85, trunk 30,
        // the arms in front. (The clip goes deeper, thigh past level and knee
        // 65: the hip then sits so far behind the feet that it, too, would
        // travel backwards from the take-off.)
        // (lyingLegs: the five-degree far-leg offset sank the far foot 8 mm.)
        { pelvis: overAnkle(landFeet[0], 110, 205, 30), torso: 30, neck: 18, arms: sideArms(120, 110), legs: lyingLegs(110, 205, 90) },
        // Standing tall where the jump landed.
        stand({ x: 0.645, y: 0.494 }, 2, HANG, undefined, landFeet),
      ];
    })(),
    // Pinned: unpinned, the floor went under the take-off toes, 4 cm below
    // the standing feet.
    [{ kind: "floor", y: GROUND }],
    "neutral",
    1,
    // dip, take-off, flight, landing, rise, and the glide back to the start.
    { loop: [700, 300, 300, 300, 500, 900], camera: { azimuth: 0.9 } },
  ),

  // Depth jump, from a reference clip measured with the pose lab (Catalyst
  // Athletics "Depth Jump", GeN0S3XCZnM, square side view, two reps out of
  // a 1:20 tutorial; MoveNet on 41 frames at 0.2 s over 8 s). The clip:
  // standing on a knee-high box; a STEP off it (not a jump down) with the
  // hip falling 0.16 of the frame; a landing that absorbs to knee 128-133
  // with the trunk 8-11 forward; an immediate rebound that takes the whole
  // body off the floor again (the hip 0.32 of the frame against 0.40 on the
  // box, the arms thrown up); and a second landing, again at knee 127-133.
  // The contact between the two is short -- 0.2-0.4 s, which is the whole
  // point of the drill.
  // Depth Jump borrowed `jump`, a hop on the spot with no box at all.
  // A loop of six key positions, as the box jump's: the way back to the box
  // is a step up, not the drop played backwards.
  depthJump: pose(
    "side",
    (() => {
      const boxTop = 0.658; // an ankle standing on the box
      const floorFeet: [Point, Point] = [{ x: 0.42, y: FLOOR }, { x: 0.40, y: FLOOR }];
      const overAnkle = (ankle: Point, thigh: number, shin: number, torso: number): Point => {
        const knee = along(ankle, shin + 180, P.shin);
        const hip = along(knee, thigh + 180, P.thigh);
        return { x: hip.x - hipAt({ x: 0, y: 0 }, torso, 0, "side").x, y: hip.y };
      };
      const arms = sideArms(180, 150); // hanging, the forearms a little forward
      const onBox = { x: 0.60, y: boxTop };
      return [
        // Standing tall on the box.
        { pelvis: overAnkle(onBox, 180, 180, 2), torso: 2, neck: 0, arms, legs: lyingLegs(180, 180, 90) },
        // Stepping off: the near foot has left the edge and hangs in front,
        // the far foot still on the box, the hip starting to fall.
        { pelvis: { x: 0.54, y: 0.30 }, torso: 8, neck: 5, arms, legs: [{ upper: 160, lower: 175, end: 120 }, { upper: 185, lower: 182, end: 90 }] as [Limb, Limb] },
        // The landing: both feet on the floor in front of the box, knee 130,
        // trunk 20, the arms swung back ready to drive.
        { pelvis: overAnkle(floorFeet[0], 140, 205, 20), torso: 20, neck: 12, arms: sideArms(215, 200), legs: sideLegs(140, 205, 90) },
        // The rebound: off the floor again, the toes pointed, the arms up.
        { pelvis: { x: 0.42, y: 0.345 }, torso: -2, neck: -1, arms: sideArms(60, 45), legs: sideLegs(178, 180, 140) },
        // The second landing, the same absorb.
        { pelvis: overAnkle(floorFeet[0], 140, 205, 20), torso: 20, neck: 12, arms: sideArms(150, 130), legs: sideLegs(140, 205, 90) },
        // Stepping back up: the far foot on the box, the hip rising.
        { pelvis: { x: 0.52, y: 0.33 }, torso: 15, neck: 9, arms, legs: [{ upper: 195, lower: 195, end: 120 }, { ...reach(hipAt({ x: 0.52, y: 0.33 }, 15, 1, "side"), { x: 0.60, y: boxTop }, P.thigh, P.shin, -1), end: 90 }] as [Limb, Limb] },
      ];
    })(),
    [
      { kind: "floor" },
      // Centred under the feet standing on it: at 0.66 the foot sat on the
      // front edge with 16 cm of box behind it.
      { kind: "slab", x: 0.61, y: 0.713, width: 0.25, height: 0.05 },
    ],
    "neutral",
    1,
    // off the box, the landing, the rebound, the landing, the step up, home.
    { loop: [400, 300, 350, 350, 500, 500], camera: { azimuth: 0.9 } },
  ),

  // Jump squat, from a reference clip measured with the pose lab (OPEX
  // Abbotsford "Jump Squats", 3jJt5gCMRNQ, near-side view, ten reps in
  // 13 s; MoveNet on 64 frames at 0.25 s). The clip: a DEEP squat -- the
  // thigh 77-88 forward (below parallel), the shin 22-30 forward, the knee
  // 66-81, the trunk 39-45 forward -- with both arms reaching forward and
  // level as a counterbalance (elbow 155-168, the upper arm 50-88 forward
  // of plumb); then a jump that extends the whole body (knee 175-179, the
  // trunk 3-5 back) with the arms swung back down to the sides; and a
  // landing straight into the next squat. A rep is about 1.25 s.
  // Jump Squat borrowed `jump`, a modest hop that only quarter-squats and
  // keeps its arms in a V.
  jumpSquat: pose(
    "side",
    (() => {
      const overAnkle = (thigh: number, shin: number, torso: number): Point => {
        const knee = along(FEET[0], shin + 180, P.shin);
        const hip = along(knee, thigh + 180, P.thigh);
        return { x: hip.x - hipAt({ x: 0, y: 0 }, torso, 0, "side").x, y: hip.y };
      };
      // Both arms reaching forward and level at the bottom, elbow 165.
      const reachOut = sideArms(95, 110);
      return [
        stand({ x: 0.5, y: 0.494 }, 2, HANG),
        // The bottom: thigh 82 forward and shin 27, so the knee closes to 71
        // and the hip sits below the knee; trunk 42.
        { pelvis: overAnkle(98, 207, 42), torso: 42, neck: 25, arms: reachOut, legs: sideLegs(98, 207, 90) },
        // Airborne: the body one line, the toes pointed, the arms swung back
        // to the sides. The hip is 17 cm above standing and the feet 12 cm
        // off the floor (at 0.414 the extended legs left only 2.9 cm of air).
        { pelvis: { x: 0.5, y: 0.325 }, torso: -3, neck: -2, arms: sideArms(190, 192), legs: sideLegs(178, 180, 140) },
      ];
    })(),
    [{ kind: "floor", y: GROUND }],
    "neutral",
    1,
    { tempo: { down: 600, bottom: 0, up: 500, top: 150 }, camera: { azimuth: 0.9 } },
  ),

  // Tuck jump, from a reference clip measured with the pose lab (OPEX
  // Bristol "Tuck Jump", w0cI_zLXJFo, square side view, three jumps in
  // 8.5 s; MoveNet on 71 frames at 0.12 s, read as raw keypoints for the
  // heights and the knee-under-hip distance). The clip: from
  // standing, a 0.5 s dip -- the hip 8-10 cm down, the shoulders dropping
  // twice as far (the trunk tips forward), the knees bent to about 110 --
  // then a vertical jump with the knees pulled to the chest at the apex
  // (the knee 32 px under the hip against 80 standing: the thigh near
  // level; the shin folded back, knee 50-70; the hip 20-25 cm up), the
  // hands drawn in at the chest; a landing back into the dip and a stand.
  // A jump every 2.0 s: 0.5 s dip, 0.5 s in the air, 1.0 s landing and
  // reset. Tuck Jump borrowed `jump` (a modest hop, arms in a V) before.
  // Three key positions there and back: standing, the dip, the tucked
  // apex -- the way back IS the landing into the dip and the stand.
  tuckJump: pose(
    "side",
    (() => {
      const overAnkle = (ankle: Point, thigh: number, shin: number, torso: number): Point => {
        const knee = along(ankle, shin + 180, P.shin);
        const hip = along(knee, thigh + 180, P.thigh);
        return { x: hip.x - hipAt({ x: 0, y: 0 }, torso, 0, "side").x, y: hip.y };
      };
      return [
        stand({ x: 0.5, y: 0.494 }, 2, sideArms(172, 160)),
        // The dip: knees 110 (thigh 40, shin 30 forward), trunk 25, the arms
        // swung back; the hip 8 cm down.
        { pelvis: overAnkle(FEET[0], 140, 210, 25), torso: 25, neck: 15, arms: sideArms(215, 200), legs: sideLegs(140, 210, 90) },
        // The apex: hip 20 cm up, the thighs pulled to level (85 forward) with
        // the shins folded back under them (knee 55), the toes down; the
        // hands drawn in at the chest.
        { pelvis: { x: 0.5, y: 0.294 }, torso: 15, neck: 9, arms: sideArms(150, 60), legs: sideLegs(95, 220, 240) },
      ];
    })(),
    [{ kind: "floor", y: GROUND }],
    "neutral",
    1,
    { tempo: { down: 900, bottom: 0, up: 900, top: 200 }, camera: { azimuth: 0.9 } },
  ),

  // Jumping lunge, from a reference clip measured with the pose lab (OPEX
  // "Jump Lunge", BR1A8T9SjIU, square side view, eight switches in 9 s;
  // MoveNet on 56 frames at 0.2 s). The clip: a lunge with the front thigh
  // 72-84 forward (near level), the front shin 15-20 forward, front knee
  // 80-92; the rear knee just off the floor, the rear shin sweeping back
  // and up past horizontal (105-115 from vertical), the rear foot on its
  // toes; the trunk 8-22 forward; the hands clasped at the chest (elbow
  // 52-60; the upper-arm reading, 60-77 forward, does not square with hands
  // at the sternum and is not used); a hop switches the legs in the air --
  // the hip 0.66 -> 0.44 of the frame -- and the next lunge lands with the
  // other leg in front. A switch every 1.15 s. Jumping Lunge borrowed
  // `jump` (a two-footed hop) before.
  // Three key positions there and back: lunge, the switch in the air, the
  // mirrored lunge -- the way back IS the next switch.
  jumpingLunge: pose(
    "side",
    (() => {
      const torso = 15, neck = 9;
      // Hands clasped in front of the sternum (elbow 51, as the clip): the
      // upper arm 15 forward with the elbow by the ribs, the forearm up and
      // forward. (Upper arm 65 forward with the forearm folded up put the
      // hands 7 cm ABOVE the shoulders.)
      const arms: [Limb, Limb] = [{ upper: 165, lower: 36, spread: -0.08 }, { upper: 165, lower: 36, spread: -0.08 }];
      const front: Limb = { upper: 102, lower: 197, end: 90 }; // thigh 78 forward, shin 17, knee 85
      const rear: Limb = { upper: 190, lower: 280, end: 165 }; // knee 3 cm off the floor, shin back and up, toes down
      const lunge = (ankle: Point): Point => {
        const knee = along(ankle, front.lower + 180, P.shin);
        const hip = along(knee, front.upper + 180, P.thigh);
        return { x: hip.x - hipAt({ x: 0, y: 0 }, torso, 0, "side").x, y: hip.y };
      };
      const near = { x: 0.60, y: FLOOR }, far = { x: 0.58, y: FLOOR };
      return [
        { pelvis: lunge(near), torso, neck, arms, legs: [front, rear] as [Limb, Limb] },
        // The switch: airborne, both knees soft as the legs pass under the hip.
        { pelvis: { x: 0.50, y: 0.45 }, torso: 12, neck: 7, arms, legs: [{ upper: 175, lower: 205, end: 150 }, { upper: 185, lower: 220, end: 165 }] },
        { pelvis: { ...lunge(far), x: lunge(far).x + (hipAt({ x: 0, y: 0 }, torso, 0, "side").x - hipAt({ x: 0, y: 0 }, torso, 1, "side").x) }, torso, neck, arms, legs: [rear, front] as [Limb, Limb] },
      ];
    })(),
    [{ kind: "floor", y: GROUND }],
    "neutral",
    1,
    { tempo: { down: 575, bottom: 0, up: 575, top: 0 }, camera: { azimuth: 0.9 } },
  ),

  // High knees, from a reference clip measured with the pose lab (CrossFit
  // "High Knees | Movement Demo", cUmfCd-Hznk, a near-side view, nine
  // seconds of running on the spot; MoveNet on 64 frames at 0.15 s; the
  // angles are projections, +-5). The clip: a run on the spot with each
  // knee driven to hip height (thigh 68-89 forward at the peak, the shin
  // hanging vertical under it), the stance leg straight (knee 160-170) on
  // the ball of the foot, the trunk within 10 of upright, the arms pumping
  // with the elbows at 40-65 and the upper arms swinging 20 either side of
  // plumb; the hip is highest at each knee peak. A step every 0.6 s.
  // High Knees borrowed `run` (a running stride) before.
  // Three key positions there and back: one knee up, both feet down with
  // the knees soft, the other knee up -- so the way back is the next step.
  highKnees: pose(
    "side",
    (() => {
      const torso = 5;
      const up: Limb = { upper: 90, lower: 180, end: 200 }; // thigh level, shin plumb, toes down
      const stance: Limb = { upper: 180, lower: 180, end: 120 }; // straight, on the ball of the foot
      const fwdArm: Limb = { upper: 135, lower: 45 }; // elbow 90, the hand at chest height in front
      const backArm: Limb = { upper: 215, lower: 125 }; // elbow 90, the hand by the hip
      // On the ball of the foot the toes touch the floor 3.6 cm below the
      // ankle, so the pelvis rides at 0.454, 4 cm above a flat-footed stand.
      const kneeUp = (side: 0 | 1): Figure => ({
        pelvis: { x: 0.5, y: 0.454 },
        torso,
        neck: 0,
        arms: (side === 0 ? [backArm, fwdArm] : [fwdArm, backArm]) as [Limb, Limb],
        legs: (side === 0 ? [up, stance] : [stance, up]) as [Limb, Limb],
      });
      return [kneeUp(0), stand({ x: 0.5, y: 0.50 }, torso, [{ upper: 180, lower: 90 }, { upper: 180, lower: 90 }], 0), kneeUp(1)];
    })(),
    [{ kind: "floor", y: GROUND }],
    "neutral",
    1,
    { tempo: { down: 600, bottom: 0, up: 600, top: 0 }, camera: { azimuth: 0.9 } },
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

  // The hip hinge, from a reference clip measured with the pose lab (OPEX
  // "Conventional Deadlift", TN3DHmd1Fe8, square side view, three reps in
  // 13.8 s; MoveNet on 51 frames at 0.25 s). What the clip actually does,
  // and what the old frames had backwards: the HIPS TRAVEL BACK while the
  // shoulders travel forward, and the shin stays near vertical. The old
  // frames walked the pelvis 10.5 cm FORWARD over the foot and pitched the
  // shin 40 degrees -- a shallow squat wearing a hinge's trunk angle.
  //
  // The clip's order of events is the other thing worth keeping: the trunk
  // leads and the knee follows. Trunk 7 -> 56 -> 76 -> 82 from vertical
  // while the knee only gives way from 176 to 163 to 151, and then folds to
  // 121 in the last quarter as the hips settle back. Thigh 4/17/25/46
  // degrees BEHIND vertical, shin 0/0/4/13 in front of it, so the bar
  // clears the shins all the way down. A rep is a 1.0 s descent, 0.75 s at
  // the bottom, a 0.6 s stand and 1.2 s tall.
  //
  // Authored from the ANKLE up, not from the pelvis: the foot is planted,
  // so the leg angles are the authored quantity and the pelvis falls out of
  // them. That is what keeps the hip travelling the right way.
  hinge: pose(
    "side",
    ([[4, 0, 4, 12], [17, 0, 57, 10], [25, 4, 76, 6], [46, 13, 80, 2]] as const).map(([thighBack, shinAhead, torso, armAhead]) => {
      const upper = 180 - thighBack;
      const lower = 180 + shinAhead;
      // Up the planted leg: ankle -> knee -> hip, then back off the girdle's
      // half-depth to the pelvis the build hangs the hip on.
      const ankle = { x: 0.535, y: FLOOR };
      const knee = along(ankle, lower + 180, P.shin);
      const hip = along(knee, upper + 180, P.thigh);
      const pelvis = { x: hip.x - (hipAt({ x: 0, y: 0 }, 0, 0, "side").x), y: hip.y };
      return {
        pelvis,
        torso,
        neck: torso > 30 ? torso - 16 : torso,
        // The bar hangs from the shoulder: a few degrees ahead of plumb
        // standing so it clears the thigh, plumb at the bottom where the
        // shoulder is already out over it.
        arms: wide(sideArms(180 - armAhead, 183 - armAhead)),
        legs: [{ upper, lower, end: 90 }, { upper, lower, end: 90 }] as [Limb, Limb],
      };
    }),
    [{ kind: "floor" }, { kind: "bar", at: "grip", length: 0.17 }],
    "overhand",
    1,
    { tempo: { down: 1000, bottom: 750, up: 600, top: 1200 } },
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

  // Kettlebell snatch, from a reference clip measured with the pose lab
  // (OPEX "Kettlebell Snatch", y12D2GApeO0, square side view, four reps in
  // 9 s; MoveNet on 53 frames at 0.2 s). The clip: a one-arm swing that
  // finishes overhead -- at the bottom a hinge with the trunk 61-71
  // forward, the thigh 10-19 forward, the shin 11-15 forward, knee 146-159,
  // the working arm hanging back between the legs (upper arm 38-41 behind
  // plumb, elbow 159-165); the pull brings the trunk up as the bell rides
  // the front of the body with the elbow bent to 122 (upper arm 17
  // forward, forearm near level); the lockout stands tall with the arm
  // straight overhead; the drop swings the bell back down in front. A rep
  // is 2.3 s: 1.0 s from the hinge to the lockout, a beat there, 1.0 s
  // down. Kettlebell Snatch borrowed `clean` (a two-hand barbell clean).
  // The way down is the pull reversed -- the bell falls back down the
  // front of the body into the hinge, close enough to the clip's drop.
  // The bell is a swung `bell` on the working hand: drawn on that hand and
  // along the arm's line, so overhead it stands ABOVE the hand, on the
  // forearm, not hanging under it.
  // Kettlebell clean, from a reference clip measured with the pose lab
  // (Functional Bodybuilding "Single Arm Kettlebell Clean From Floor",
  // JrNe81MYEuI, near-side view, six reps in 9 s; MoveNet on 20 frames at
  // 0.2 s over two of them). The clip: a one-arm swing that finishes at the
  // shoulder -- the hinge has the trunk 45-52 forward, the knee 143-157 and
  // the thigh 17-27 forward with the bell between the legs; the drive
  // stands the lifter up (trunk 2-5, knee 177-179) and the bell comes to
  // the RACK, the elbow folded tight (9-30) against the ribs with the bell
  // resting on the outside of the forearm at the shoulder. A rep is about
  // 1.7 s. Kettlebell Clean borrowed `clean`, a two-hand barbell clean from
  // the floor.
  // Three key positions there and back: the hinge, the swing through, the
  // rack -- the way down IS the bell falling back into the hinge.
  kettlebellClean: pose(
    "side",
    (() => {
      const overFoot = (thigh: number, shin: number, torso: number): Point => {
        const knee = along(FEET[0], shin + 180, P.shin);
        const hip = along(knee, thigh + 180, P.thigh);
        return { x: hip.x - hipAt({ x: 0, y: 0 }, torso, 0, "side").x, y: hip.y };
      };
      // Wider than the snatch's 0.16: on the midline the bell (radius 0.05)
      // sits exactly one bell-plus-thigh from a thigh axis 0.108 out, and
      // grazed it on the way through. 0.20 puts the axis 0.128 out.
      const leg = (thigh: number, shin: number): Limb => ({ upper: thigh, lower: shin, end: 90, spread: 0.20, turn: 20 });
      // The idle arm trails a hand's width wide of the body, as the snatch's.
      const idle: Limb = { upper: 205, lower: 215, spread: 0.06 };
      const hinge = (() => {
        const torso = 55;
        return {
          pelvis: overFoot(168, 190, torso), torso, neck: 38,
          // The working hand on the midline (spread -0.085 cancels the arm's
          // splay), swung back between the legs.
          // (At 230/214 the bell grazed 1 cm into the near thigh on the way
          // down; 234/217 swings it clear behind the legs.)
          arms: [{ upper: 234, lower: 217, spread: -0.085 }, idle] as [Limb, Limb],
          legs: [leg(168, 190), leg(168, 190)] as [Limb, Limb],
        };
      })();
      return [
        hinge,
        // The swing through: half-way up with the arm hanging plumb and the
        // bell at knee height in front of the shins (the snatch needed this
        // key too -- without it the bell cut through the thighs).
        { pelvis: overFoot(173, 187, 35), torso: 35, neck: 24, arms: [{ upper: 183, lower: 183, spread: -0.085 }, { upper: 195, lower: 200, spread: 0.06 }] as [Limb, Limb], legs: [leg(173, 187), leg(173, 187)] as [Limb, Limb] },
        // The rack: tall, the elbow tight to the ribs (170) with the forearm
        // folded up across the chest, the bell standing on the forearm.
        stand({ x: 0.50, y: 0.494 }, 3, [{ upper: 170, lower: 32, spread: -0.085 }, idle]),
      ];
    })(),
    // One bell on the working hand, swung: it points along the arm, so at the
    // rack it stands above the fist instead of hanging under it.
    [{ kind: "floor" }, { kind: "bell", at: "hand0", swing: true }],
    "overhand",
    1,
    { tempo: { down: 850, bottom: 0, up: 850, top: 250 }, camera: { azimuth: 1.2 } },
  ),

  kettlebellSnatch: pose(
    "side",
    (() => {
      // The pelvis that puts the near leg, at these angles, on the near foot.
      const overFoot = (thigh: number, shin: number, torso: number): Point => {
        const knee = along(FEET[0], shin + 180, P.shin);
        const hip = along(knee, thigh + 180, P.thigh);
        return { x: hip.x - hipAt({ x: 0, y: 0 }, torso, 0, "side").x, y: hip.y };
      };
      const stanceLeg = (thigh: number, shin: number): Limb => ({ upper: thigh, lower: shin, end: 90, spread: 0.16, turn: 20 });
      const hinge = (() => {
        const torso = 65;
        // Stance 0.16 out each side with the toes turned 20 (a snatch stands
        // a little wider than a swing) so the bell passes between the knees.
        const leg: Limb = { upper: 165, lower: 192, end: 90, spread: 0.16, turn: 20 }; // thigh 15 forward, shin 12: knee 153
        const knee = along(FEET[0], leg.lower + 180, P.shin);
        const hip = along(knee, leg.upper + 180, P.thigh);
        const pelvis = { x: hip.x - hipAt({ x: 0, y: 0 }, torso, 0, "side").x, y: hip.y };
        return {
          pelvis, torso, neck: 45,
          // The working arm swung back between the legs; the other trails
          // out behind, a hand's width wide of the body.
          // (At 220/205 the bell sat 1.4 cm inside the thigh line; 232/215 swings
          // it clear behind the legs, as the swing's 235.)
          // The working hand on the midline (spread -0.10 cancels the arm's
          // splay): the bell hangs between the knees, not beside a thigh.
          arms: [{ upper: 232, lower: 215, spread: -0.085 }, { upper: 205, lower: 215, spread: 0.06 }] as [Limb, Limb],
          legs: [leg, { ...leg }] as [Limb, Limb],
        };
      })();
      return [
        hinge,
        // The swing through: half-way up (trunk 40, knees 166) with the arm
        // hanging plumb, the bell at knee height just in front of the shins.
        // Without this key the bell cut the corner from behind the knees to
        // the chest THROUGH the thighs.
        { pelvis: overFoot(172, 186, 40), torso: 40, neck: 28, arms: [{ upper: 183, lower: 183, spread: -0.085 }, { upper: 195, lower: 200, spread: 0.06 }] as [Limb, Limb], legs: [stanceLeg(172, 186), stanceLeg(172, 186)] as [Limb, Limb] },
        // The high pull: standing up into it, the bell riding the front of
        // the body with the elbow high (122).
        stand({ x: 0.50, y: 0.494 }, 15, [{ upper: 163, lower: 106, spread: -0.085 }, { upper: 188, lower: 192, spread: 0.06 }], 10),
        // The lockout: tall, the arm straight overhead, 10 forward of plumb.
        stand({ x: 0.50, y: 0.494 }, 2, [{ upper: 10, lower: 5, spread: -0.085 }, { upper: 180, lower: 182, spread: 0.06 }]),
      ];
    })(),
    // One bell on the working hand, swung: drawn ON that hand (outboard of
    // the thigh) and pointing along the arm, so overhead it stands above the
    // hand on the forearm rather than hanging under it.
    [{ kind: "floor" }, { kind: "bell", at: "hand0", swing: true }],
    "overhand",
    1,
    { tempo: { down: 1000, bottom: 200, up: 1000, top: 100 }, camera: { azimuth: 1.2 } },
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

  // Power clean, from a reference clip measured with the pose lab (Fitness
  // Pain Free "Power Clean (side view)", YEXjyc22Jek, square side view, two
  // reps in 14 s; MoveNet on 70 frames at 0.3 s). The clip: a low start
  // with the bar on the floor -- thigh 78-80 forward, trunk 47-55 forward,
  // the arms plumb to the bar, held about three seconds; a pull that stands
  // the lifter up and on the toes (the hip rising 0.63 -> 0.43 of the
  // frame, trunk 4 from vertical); a catch in a quarter squat (knee 98-125,
  // thigh 27-47 forward, shin 28-35 forward, trunk 9-15) with the elbows
  // whipped up and the forearms folded (elbow 21-25) under the bar on the
  // shoulders; standing up with the bar racked (knee 179, elbows still up);
  // then a hinge to lower the bar back to the floor (trunk 25 -> 60 -> 97
  // over 1.2 s, the arms straight). A rep is about 7 s, most of it the
  // start position and the lowering.
  // A loop of six key positions: the way down is a lowering, not the
  // catch played backwards. The bar rests on the floor at the start (hands
  // 0.176 up: the plates 3 mm off the floor). Hang Clean and Kettlebell
  // Clean still borrow `clean`; the hang clean is the next movement.
  powerClean: pose(
    "side",
    (() => {
      const overAnkle = (ankle: Point, thigh: number, shin: number, torso: number): Point => {
        const knee = along(ankle, shin + 180, P.shin);
        const hip = along(knee, thigh + 180, P.thigh);
        return { x: hip.x - hipAt({ x: 0, y: 0 }, torso, 0, "side").x, y: hip.y };
      };
      // The arms are ropes on the pull (as every other lift from the floor):
      // they hang from the shoulders and the bar follows the hands.
      // The rack, as the front squat's: upper arms 45 up from plumb, the
      // forearms folded back so the hands sit at the front delts under the bar.
      const rack = sideArms(135, 350);
      const pull = (thigh: number, shin: number, torso: number) => {
        const pelvis = overAnkle(FEET[0], thigh, shin, torso);
        // 22 ahead of plumb, not the hinge's 12: the bar has to clear a heavy
        // thigh and shin on the way past the knee.
        return { pelvis, torso, neck: Math.round(torso * 0.6), arms: sideArms(158, 161), legs: sideLegs(thigh, shin, 90) };
      };
      return [
        // The start: hips LOW (thigh 80 forward, the shin 20 over the toes),
        // the trunk 50 -- that is what puts the hands on a bar resting on the
        // floor (0.13 up, as the old clean's) with the trunk as upright as
        // the clip has it.
        pull(100, 200, 50),
        // Past the knee: the bar dragged up the thigh, the trunk still over it.
        pull(140, 188, 45),
        // The extension: tall, on the toes, the bar just past the hip with the
        // elbows starting to break (174/138) -- straight arms hung the bar
        // 6.6 cm INSIDE a heavy thigh, and the pull is past the hip by here.
        { pelvis: { x: 0.5, y: 0.454 }, torso: -5, neck: 0, arms: sideArms(174, 138), legs: sideLegs(178, 180, 120) },
        // The catch: a quarter squat, elbows up, the bar on the shoulders.
        { pelvis: overAnkle(FEET[0], 140, 210, 12), torso: 12, neck: 7, arms: rack, legs: sideLegs(140, 210, 90) },
        stand({ x: 0.5, y: 0.494 }, 2, rack),
        // The lowering: a hinge back down, the arms straight again.
        pull(150, 190, 55),
      ];
    })(),
    [{ kind: "floor", y: GROUND }, { kind: "bar", at: "grip" }],
    "overhand",
    1,
    // to the knee, to the extension, the catch, the stand, the lowering, the floor.
    // Camera 1.2, as the good morning's: at 0.9 the near plate covered the
    // head through the whole rack.
    { loop: [600, 250, 300, 700, 800, 600], camera: { azimuth: 1.2 } },
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

  // Bear crawl, from a reference clip measured with the pose lab (OPEX
  // "Crawl", w089AXf1f_g, square side view, ten hand-steps in 9 s; MoveNet
  // on 56 frames at 0.2 s, read as raw keypoints -- the lab's table drops
  // the legs of a crawling figure). The clip: on hands and toes with the
  // trunk level (shoulders and hips at one height, 55 cm up), the arms
  // straight (elbow 170-180) and near plumb (within 15), the knees bent to
  // 65-115 and hovering 10-15 cm off the floor, the heels up; a hand steps
  // 22 cm forward every 0.8 s, lifting 10 cm, with the opposite foot; the
  // hips stay level throughout. Bear Crawl borrowed `quadruped` (the bird
  // dog: kneeling, one arm and the opposite leg reached out) before.
  // A crawl on the spot, as the carries walk on the spot: four key positions
  // on a `loop` -- one diagonal pair planted forward, the other pair lifted
  // mid-step, the first pair planted forward, the second lifted. Facing -x,
  // as the quadruped does.
  bearCrawl: pose(
    "side",
    (() => {
      const pelvis = { x: 0.55, y: 0.646 }; // shoulders and hips 0.284 up: a straight arm to the floor
      const torso = 270; // level, the shoulders ahead (toward -x)
      const shoulders = [0, 1].map((side) => shoulderAt(pelvis, torso, side as 0 | 1, "side"));
      const hips = [0, 1].map((side) => hipAt(pelvis, torso, side as 0 | 1, "side"));
      // A hand on the floor `ahead` (in y units, -x is ahead) of its shoulder.
      const hand = (side: 0 | 1, ahead: number, up = 0): Limb =>
        ({ ...reach(shoulders[side]!, { x: shoulders[side]!.x - ahead / ASPECT, y: FLOOR - up }, P.upperArm, P.forearm, FORWARD[side]), end: 270 });
      // A planted leg: the ankle 4 cm up (toes on the floor, heel raised)
      // `back` behind its hip, the knee solved ahead of the hip and low.
      const planted = (side: 0 | 1, back: number): Limb =>
        ({ ...reach(hips[side]!, { x: hips[side]!.x + back / ASPECT, y: FLOOR - 0.04 }, P.thigh, P.shin, 1), end: 230 });
      // Mid-step: the foot 13 cm up under the hip, the knee tucked ahead.
      const lifted = (side: 0 | 1): Limb =>
        ({ ...reach(hips[side]!, { x: hips[side]!.x + 0.12 / ASPECT, y: FLOOR - 0.13 }, P.thigh, P.shin, 1), end: 230 });
      const neck = 290;
      return [
        { pelvis, torso, neck, arms: [hand(0, 0.05), hand(1, -0.05)], legs: [planted(0, 0.17), planted(1, 0.09)] },
        { pelvis, torso, neck, arms: [hand(0, 0), hand(1, 0.03, 0.05)], legs: [lifted(0), planted(1, 0.13)] },
        { pelvis, torso, neck, arms: [hand(0, -0.05), hand(1, 0.05)], legs: [planted(0, 0.09), planted(1, 0.17)] },
        { pelvis, torso, neck, arms: [hand(0, 0.03, 0.05), hand(1, 0)], legs: [planted(0, 0.13), lifted(1)] },
      ];
    })(),
    // Pinned: unpinned it dropped to the lowest toe and left the hands 6 cm up.
    [{ kind: "floor", y: GROUND, mat: true }],
    "overhand",
    -1,
    { loop: [400, 400, 400, 400], camera: { azimuth: 0.9 } },
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

  // Decline push-up, from a reference clip measured with the pose lab (OPEX
  // "Decline Push Up", cnsPwJ2f2B4, square side view). The hands stay on the
  // floor where the flat push-up puts them and the ankles sit on the bench,
  // 0.26 above them -- a 49 cm bench. That leaves the body all but LEVEL at
  // lockout and about ten degrees head-down at the bottom, which is what a
  // decline push-up on a bench really looks like: the arm is as long as the
  // bench is tall, so the shoulder comes up to meet the raised feet. A
  // steeper slope needs a box, not a bench.
  // It used to be the flat frames re-aimed along a raised ankle line, which
  // locked out at 135 and folded the knees to 147.
  declinePushUp: pose(
    "side",
    pressUpFrames(
      { x: 0.392, y: 0.855 },
      { x: 0.800, y: 0.595 },
      P.thigh + P.shin,
      [172, 110, 60],
      (pelvis, torso) => plantedLegs(pelvis, torso, "side", [{ x: 0.800, y: 0.595 }, { x: 0.784, y: 0.595 }], BACK, [130, 135]),
    ),
    [
      { kind: "floor", mat: true },
      // The bench under the toes.
      { kind: "slab", at: "ankle0", width: 0.45, height: 0.055, dx: 0.06, dy: 0.075, across: true },
    ],
    "overhand",
    -1,
    { tempo: { down: 900, bottom: 200, up: 800, top: 400 } },
  ),

  // Incline push-up, from a reference clip measured with the pose lab (OPEX
  // "Incline Push Up on Bench", E--Ls5QtFqI, square side view, four reps in
  // 12 s; MoveNet on 59 frames at 0.25 s). The clip: the hands FIXED on the
  // bench -- the wrist sits at the same pixel all rep -- the body one
  // straight line (shoulder-hip-knee 154-180) rising about 31 degrees from
  // the toes on the floor to the shoulders, the elbow locking out at 170-180
  // and folding to 55-65 at the bottom; a rep is a 1.5 s descent, a beat, a
  // 1.2 s press and 0.5 s at the top -- the slowest of the three, because the
  // easiest variant is the one people are told to control.
  // It used to be the flat push-up's frames shifted about, which locked out
  // at 135, folded the knees to 151 and left the bench 5 cm under the palms.
  inclinePushUp: pose(
    "side",
    pressUpFrames(
      { x: 0.400, y: 0.720 },
      { x: 0.800, y: 0.855 },
      P.thigh + P.shin,
      [172, 110, 60],
      (pelvis, torso) => plantedLegs(pelvis, torso, "side", [{ x: 0.800, y: 0.855 }, { x: 0.784, y: 0.855 }], BACK, [130, 135]),
    ),
    [
      { kind: "floor", mat: true },
      // The bench: its top flush under the palms, standing crosswise so it
      // does not reach back under the hips.
      { kind: "slab", at: "hand0", width: 0.5, height: 0.055, dx: -0.052, dy: 0.050, across: true },
    ],
    "overhand",
    -1,
    { tempo: { down: 1500, bottom: 250, up: 1200, top: 500 } },
  ),

  // Knee push-up, from a reference clip measured with the pose lab (OPEX
  // "Knee Push Up", 8XQ-okb5NWE, square side view, six reps in 11 s). The
  // clip: the plank hinges at the KNEE, which rests on the mat with the shin
  // lying flat behind it, the body one line from the shoulder through the hip
  // to that knee, and the same lockout and depth as a full push-up. It used
  // to be the flat frames shifted about, locking out at 148 and carrying the
  // knee 14 cm clear of the mat it is supposed to be resting on.
  kneePushUp: pose(
    "side",
    pressUpFrames(
      { x: 0.392, y: 0.855 },
      { x: 0.700, y: 0.855 },
      P.thigh,
      [172, 110, 60],
      (pelvis) => {
        // The thigh runs from the hip down to the planted knee -- measured
        // from the hip the build uses, so it comes out exactly a thigh long
        // and the joint does not silently stretch.
        const knee = { x: 0.700, y: 0.855 };
        const hip = hipAt(pelvis, 0, 0, "side");
        const thigh = (Math.atan2((knee.x - hip.x) * ASPECT, hip.y - knee.y) * 180) / Math.PI;
        // The shin lies flat on the mat behind the knee, toes back. Both legs
        // take the same thigh angle: the far knee then lands a girdle-depth
        // into the page, which is the side view's depth convention, instead
        // of being solved against an offset hip and coming out a different
        // shape.
        return [
          { upper: thigh, lower: 90, end: 88 },
          { upper: thigh, lower: 91, end: 89 },
        ] as [Limb, Limb];
      },
    ),
    [{ kind: "floor", mat: true }],
    "overhand",
    -1,
    { tempo: { down: 900, bottom: 200, up: 800, top: 400 } },
  ),

  // Forearm plank, from a reference clip measured with the pose lab (OPEX
  // "Front Plank to Forearm Plank", rfPf3HCg2Ac, square side view; MoveNet
  // on 25 frames at 0.5 s, the forearm phases at 2.5-3, 6-6.5 and 9.5-10 s).
  // The clip: the forearm flat on the floor, the elbow at 78-80 with the
  // upper arm leaning 6-10 degrees toward the head, the legs 18 degrees off
  // the floor, the trunk 7 degrees DOWN toward the shoulders (hips 3cm above
  // them), the knees 174-178. The same model reads the clip's straight-arm
  // plank as a 24-degree pike, so the hip is authored ten degrees straighter
  // than it measured: legs 14 degrees, hip 169, trunk 3 degrees up.
  // Solved from the floor up: the forearm's radius (0.028) puts the elbow
  // centre there, the upper arm (0.152) stands on it 7 degrees off plumb, so
  // the shoulder is 0.178 up; the toes are tucked with the ankle 0.06 up, and
  // the legs and trunk climb from there to the shoulder.
  plank: pose(
    "side",
    [
      // A hold: the second key is a breath -- the hips sag 2mm, the gaze
      // drops a little, the elbows and toes stay planted.
      // Legs written out (a solved leg folds when its target is within a
      // hair of full span): thigh 104, shin 106 -- the knee 2 degrees soft --
      // and the foot 138 puts the toes on the floor with the ankle 5cm up.
      { pelvis: { x: 0.5, y: 0.7636 }, torso: 273, neck: 295, arms: [{ upper: 173, lower: 270, end: 270 }, { upper: 173, lower: 270, end: 270 }], legs: lyingLegs(104, 106, 138) },
      { pelvis: { x: 0.5, y: 0.7656 }, torso: 273.5, neck: 293, arms: [{ upper: 173, lower: 270, end: 270 }, { upper: 173, lower: 270, end: 270 }], legs: lyingLegs(104, 106, 138) },
    ],
    [{ kind: "floor", mat: true }],
    "overhand",
    -1,
    { tempo: { down: 1600, bottom: 300, up: 1600, top: 300 }, camera: { azimuth: 0.9 } },
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

  // Pec deck, from a reference clip measured with the pose lab (OPEX "Chest
  // Fly Machine", X3Nj2ZPwW04, three-quarter view, three reps in 14 s;
  // MoveNet on 36 frames at 0.4 s). The clip: seated against the pad, the
  // trunk 3-9 back of vertical, the thighs seated with the knees at ~140,
  // the arms level with the shoulders and the elbows soft (145-171) as the
  // handles sweep from out at the sides (upper arm ~57 behind the shoulder
  // line as projected) to met in front of the chest (~60 ahead); a rep is a
  // 0.9 s squeeze, a 0.5 s hold in, a 1.0 s opening and 0.8 s open. It
  // borrowed the lying dumbbell fly before.
  // The sweep is about the vertical axis, which no plane draws: each arm is
  // authored hanging with a soft elbow, swung out level with `abduct -90`
  // (a hanging arm swings outboard on the negative sign) and turned in with
  // `yaw` -- -5 (a little behind the shoulder line) -> 45 -> 85, where the
  // hands meet 8 cm apart in front of the chest.
  pecDeck: pose(
    "side",
    ([-5, 45, 85] as const).map((yaw) => ({
      pelvis: { x: 0.5, y: 0.693 },
      torso: 354,
      neck: 4,
      arms: [{ upper: 180, lower: 150, end: 180, abduct: -90, yaw }, { upper: 180, lower: 150, end: 180, abduct: -90, yaw }] as [Limb, Limb],
      legs: [{ upper: 100, lower: 203, end: 90 }, { upper: 100, lower: 203, end: 90 }] as [Limb, Limb],
    })),
    [
      { kind: "floor" },
      // The seat, as the lat pulldown's. The machine's arms are not drawn.
      { kind: "slab", at: "pelvis", width: 0.16, height: 0.055, dy: 0.075 },
    ],
    "neutral",
    1,
    { tempo: { down: 900, bottom: 500, up: 1000, top: 800 }, camera: { azimuth: 0.6 } },
  ),

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
  // Push jerk, from a reference clip measured with the pose lab (Fitness
  // Pain Free "Push Jerk (Side view)", dboDOX7xY_Q, square side view, three
  // reps in 10 s; MoveNet on 58 frames at 0.3 s). The clip: the bar racked
  // (elbow 27-34, knee 177-179, trunk within 4); a DIP to knee 124-133; a
  // drive to full extension (knee 175, the trunk 12 back); and then the
  // thing that makes it a jerk -- the lifter DROPS UNDER the bar, catching
  // it with the arms already locked overhead (elbow 171-175) and the knees
  // re-bent to 99-110, the trunk 18-20 forward; then stands up under it
  // (knee 154 -> 180) and brings the bar back to the rack. A rep is about
  // 1.8 s: 0.3 s dip, 0.3 s drive, 0.6 s in the catch, 0.6 s standing.
  // Push Jerk borrowed `overheadPress`, a strict press. The push press
  // (the previous movement) drives the bar up with the legs but never
  // drops under it; the second dip is the whole difference.
  pushJerk: pose(
    "side",
    (() => {
      const rack = sideArms(135, 350);
      const locked = sideArms(5, 355).map((arm) => ({ ...arm, spread: 0.06, flare: 45 })) as [Limb, Limb];
      const dip = { x: 0.5, y: 0.554 };
      // The catch: under the bar, the knees folded to 110 and the trunk a
      // little forward -- the pelvis 5.5 cm below standing.
      const under = { x: 0.5, y: 0.549 };
      return [
        stand({ x: 0.5, y: 0.494 }, 3, rack),
        { pelvis: dip, torso: 5, neck: 3, arms: rack, legs: plantedLegs(dip, 5, "side", FEET, FORWARD) },
        // The drive: tall on the toes, the bar still on the shoulders.
        { pelvis: { x: 0.5, y: 0.454 }, torso: -3, neck: -2, arms: rack, legs: sideLegs(178, 180, 120) },
        // The catch: the arms already locked overhead, the knees re-bent.
        { pelvis: under, torso: 12, neck: 7, arms: locked, legs: plantedLegs(under, 12, "side", FEET, FORWARD) },
        stand({ x: 0.5, y: 0.494 }, 0, locked),
      ];
    })(),
    [{ kind: "floor" }, { kind: "bar", at: "grip", length: 0.40 }],
    "overhand",
    1,
    { tempo: { down: 700, bottom: 0, up: 700, top: 700 }, camera: { azimuth: 0.75 } },
  ),

  // Push press, from a reference clip measured with the pose lab (Armory
  // HPFT "Push press (side view)", xcCYH-UcoZ0, square side view, three
  // reps in 11.6 s; MoveNet on 57 frames at 0.2 s). The clip: the bar
  // racked on the front delts with the elbow folded to 28-34 and the trunk
  // within 10 of vertical; a DIP -- the hip drops 0.10 of the frame (about
  // 15 cm) with the trunk staying upright, the bar riding down with the
  // shoulders; then a drive that stands the lifter up and presses the bar
  // to a lockout overhead (elbow 173-179, the arms 170 from plumb, the
  // wrist at 0.19 of the frame against 0.48 racked); a beat overhead, and
  // the bar comes back to the rack. A rep is about 4 s: 1.5 s racked, a
  // 0.4 s dip, a 0.4 s drive, 1.6 s overhead.
  // Push Press and Push Jerk borrowed `overheadPress` -- a strict press,
  // no legs at all. The jerk is the next movement; it drops UNDER the bar,
  // which this one does not.
  pushPress: pose(
    "side",
    (() => {
      // The bar on the front delts, as the front squat's and the clean's
      // catch: upper arms 45 up from plumb, the forearms folded back.
      const rack = sideArms(135, 350);
      // Overhead, as the strict press's top: the arms flared 45 out of the
      // drawing plane so the bar reads as a bar, not a stub.
      const locked = sideArms(5, 355).map((arm) => ({ ...arm, spread: 0.06, flare: 45 })) as [Limb, Limb];
      const dipPelvis = { x: 0.5, y: 0.554 }; // 6 cm down: the clip's 0.10 of the frame
      return [
        stand({ x: 0.5, y: 0.494 }, 3, rack),
        { pelvis: dipPelvis, torso: 5, neck: 3, arms: rack, legs: plantedLegs(dipPelvis, 5, "side", FEET, FORWARD) },
        stand({ x: 0.5, y: 0.494 }, 0, locked),
      ];
    })(),
    [{ kind: "floor" }, { kind: "bar", at: "grip", length: 0.40 }],
    "overhand",
    1,
    // Camera 0.75, the strict press's: at 1.2 the near plate covered the
    // whole figure.
    { tempo: { down: 450, bottom: 0, up: 450, top: 900 }, camera: { azimuth: 0.75 } },
  ),

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
  // Arnold press, from a reference clip measured with the pose lab (OPEX
  // "Standing Arnold Dumbbell Press", hHmFzFaSn7U, square FRONT view -- the
  // right one, since the whole difference from a shoulder press is what the
  // hands do across the body -- four reps in 14 s; MoveNet on 67 frames at
  // 0.25 s, read as frontal keypoints).
  // The clip: at the bottom the elbows are folded to 21-34 with the hands
  // together in FRONT of the chest, a shoulder-width apart (53 px against
  // 55 px between the shoulders) and a shade below shoulder height; the
  // press sweeps them OUT -- widest at the middle, 87 px, 1.6 shoulder
  // widths, with the elbow opening through 100 -- and then up to a lockout
  // (elbow 167-178, the hands back to 56 px apart, 105 px above the
  // shoulders). A rep is about 2.4 s, half of it at the bottom.
  // The forearms also rotate (palms in at the bottom, forward at the top).
  // The mannequin has no forearm twist, so what carries the lift is the
  // hand PATH: in front of the chest, out wide, overhead.
  // Arnold Press borrowed `overheadPress`, a side-view strict press whose
  // hands never leave the plane.
  arnoldPress: pose(
    "front",
    ([
      // Bottom: upper arms hanging 17 out, forearms folded up and INWARD so
      // the hands sit in front of the chest a shoulder-width apart.
      [163, -33],
      // The middle: elbows swung out and opening through 99, the hands 22 cm
      // above the shoulders and only 5 cm outboard of them -- the clip's
      // widest frame, not the arms thrown out to the sides.
      [44, -37],
      // The lockout: all but straight overhead, 5 inward of plumb so the
      // front build's wrist splay does not push the hands wide.
      [-5, -5],
    ] as const).map(([upper, lower]) => standFront(0.497, 0, bothArms(upper, lower))),
    [{ kind: "floor" }, { kind: "bell", at: "hand0", each: true, size: 0.05 }],
    "neutral",
    1,
    { tempo: { down: 900, bottom: 600, up: 900, top: 300 } },
  ),

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

  // Cable curl, from a reference clip measured with the pose lab (OPEX
  // "Cable Curl", h9DPY5pCaGA, side view, four reps in 12.1 s; MoveNet on 39
  // frames at 0.3 s). The clip curls the elbow from 158-163 hanging to
  // 24-31 at the top -- the hand at the shoulder -- with the upper arm
  // staying at the side (4 to 20 degrees off vertical, drifting forward as
  // it finishes) and the trunk within 11 of upright.
  //
  // Ours stopped at 102, which is half a curl, and the first two keys were
  // 160 and 158 -- the opening third of the animation did not move. The
  // barbell curl, measured against its own clip, finishes at 41.
  //
  // A rep is 0.9 s up, a touch at the top, 1.5 s down and a beat hanging.
  cableCurl: pose(
    "side",
    // Elbow interior = 180 - |upper - forearm|: 160 / 100 / 27, against the
    // clip's 160 / 100 / 27. The upper arm hangs 12 degrees forward of
    // plumb, inside the clip's 4-20, because the cable comes up from a low
    // pulley ahead.
    [188, 88, 15].map((forearm) => stand({ x: 0.5, y: 0.494 }, 356, sideArms(168, forearm))),
    [
      { kind: "floor" },
      // A short straight handle (a bell draws as one on a machine); a full
      // bar would run through the thighs in the side view.
      { kind: "bell", at: "grip", size: 0.06 },
      { kind: "cable", at: "grip", anchor: { x: 0.92, y: 0.9 } },
    ],
    "underhand",
    1,
    { tempo: { down: 900, bottom: 300, up: 1500, top: 300 } },
  ),

  // Cable fly, from a reference clip measured with the pose lab (OPEX "Cable
  // Fly", jtkaC-mq1Xk, square FRONT view, four reps in 12.4 s; MoveNet on 40
  // frames at 0.3 s, read as frontal keypoints).
  //
  // The old frames had the movement BACKWARDS. They swept the arms from
  // level (96) UP to overhead (24) while the cables hung from pulleys at the
  // ceiling -- the hands travelled TOWARD the anchors, which is a cable
  // going slack, not a cable being pulled. And the hands finished 34 cm
  // apart on a lift whose cue is "bring the hands together in front of the
  // chest".
  //
  // What the clip does: the hands stay at ONE height -- 0.67 shoulder widths
  // below the shoulders in every frame of every rep -- and travel inward,
  // from 3.2 shoulder widths apart to 0.73, which is together. The pulleys
  // are at CHEST height, not overhead: the cable runs level out to the towers
  // at about 0.43 of the way from the shoulder down to the hip. A rep is 0.9
  // s in, a beat squeezed, 0.9 s out and 1.4 s open.
  //
  // The elbow is NOT read from this clip. A front camera cannot see an arm
  // reaching forward, so its projected 157 -> 80 is a shadow of the real
  // angle; the pec deck, which is this movement seated, has the same note.
  // So the sweep is authored the pec deck's way -- hanging arm, soft elbow,
  // swung out with `abduct` and turned in with `yaw` -- and the HAND PATH
  // is what the clip fixes.
  cableFly: pose(
    // FRONT, not side: the towers are authored by their cable anchors, and a
    // side view reads an anchor x as FORWARD. Authored side-on, the two
    // stacks stood in front of and behind the figure and hid it at every
    // orbit angle.
    "front",
    // The hands are the authored quantity: one HEIGHT, and a lateral travel
    // from wide to together. `abduct`/`yaw` -- the pec deck's trick for the
    // same sweep -- only work out of a SIDE plane, and read as almost no
    // movement at all when the figure is built face on.
    ([0.682, 0.607, 0.541] as const).map((handX) => {
      const pelvis = { x: 0.5, y: 0.497 };
      const hands: [Point, Point] = [{ x: handX, y: 0.365 }, { x: 1 - handX, y: 0.365 }];
      return {
        pelvis,
        torso: 0,
        arms: reachingArms(pelvis, 0, "front", hands, [1, -1]),
        legs: plantedLegs(pelvis, 0, "front", FEET_FRONT, OUT),
      };
    }),
    [
      { kind: "floor" },
      // Chest-height pulleys, level with the hands, not the ceiling ones the
      // old frames pulled upward against.
      { kind: "cable", at: "hand0", anchor: { x: 0.95, y: 0.36 }, handle: "d" },
      { kind: "cable", at: "hand1", anchor: { x: 0.05, y: 0.36 }, handle: "d" },
    ],
    "neutral",
    1,
    { tempo: { down: 900, bottom: 300, up: 900, top: 1400 }, camera: { azimuth: 0.9 } },
  ),

  // Cable lateral raise, from a reference clip measured with the pose lab
  // (OPEX "Cable Lateral Raise", dQPTeeqgJqA, front view, four reps in 12.1
  // s; MoveNet on 39 frames at 0.3 s, scores 0.66-0.91). The clip finishes
  // with the hand ABOVE the shoulder -- 0.08 of the frame, about 6.6 cm on
  // this figure -- and the elbow near straight throughout (164-176). Ours
  // stopped 5 cm BELOW the shoulder, which is a raise that never reaches
  // shoulder height; the dumbbell version had the same fault corrected in
  // its own PR ("the old frames stopped 3 degrees under level"). A rep is
  // about 0.9 s up, a touch, 1.2 s down and a beat at the bottom.
  // The low pulleys were already right: the clip runs its cable to the floor.
  cableLateralRaise: pose(
    "front",
    [170, 128, 74].map((arm) => standFront(0.497, 0, bothArms(arm, arm + 14))),
    [
      { kind: "floor" },
      { kind: "cable", at: "hand0", anchor: { x: 0.95, y: 0.92 }, handle: "d" },
      { kind: "cable", at: "hand1", anchor: { x: 0.05, y: 0.92 }, handle: "d" },
    ],
    "neutral",
    1,
    { tempo: { down: 900, bottom: 300, up: 1200, top: 300 } },
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

  // Overhead triceps extension, from a reference clip measured with the pose
  // lab (OPEX "Single Dumbbell Overhead Tricep Extension", 7h3lG2WnLXg,
  // square side view, three reps in 8 s; MoveNet on 32 frames at 0.25 s).
  // The clip: standing, one dumbbell in both hands overhead, the arms all
  // but straight at the top (elbow 165-178, upper arm 2-20 forward of
  // plumb), the elbows staying up and 20 forward of plumb while the
  // forearms fold BEHIND the head to 67-77 off vertical (elbow 52-57), the
  // trunk within 8 of vertical; a rep is a 1.25 s lowering, a beat behind
  // the head, a 0.75 s press and 0.5 s at the top. It borrowed the cable
  // pushdown before -- a dumbbell pushed DOWN in front of the chest.
  overheadTricepsExtension: pose(
    "side",
    ([[8, 8], [14, 309], [20, 250]] as const).map(([upper, lower]) =>
      stand({ x: 0.5, y: 0.497 }, 2, [{ upper, lower, spread: -0.08 }, { upper, lower, spread: -0.08 }]),
    ),
    // One bell held in both hands: a bell at the grip is drawn once, between
    // them.
    [{ kind: "floor" }, { kind: "bell", at: "grip", size: 0.07 }],
    "neutral",
    1,
    { tempo: { down: 1250, bottom: 250, up: 750, top: 500 }, camera: { azimuth: 0.9 } },
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

  // Inverted row, from a reference clip measured with the pose lab (OPEX
  // "Ring Row", B90sF7dbP04, square side view, four reps in 10.8 s; MoveNet
  // on 41 frames at 0.25 s). The clip is a rigid plank turning about the
  // HEELS: the knee reads 158-179 in every frame of every rep and the
  // shoulder-hip-knee line 156-179, while the body swings from 16 degrees
  // above horizontal hanging to 39 at the top and the elbow runs 157-178
  // down to 33-44 with the chest at the rings.
  //
  // Ours bent the KNEES to 103 at the bottom -- the pelvis was placed by
  // hand and the planted feet were 8 cm nearer than a straight leg reaches,
  // so two-link IK folded them. On a movement whose whole demand is holding
  // a line. And the pull stopped at an elbow of 70, well short of the
  // chest-to-bar the clip finishes on.
  //
  // Solved instead with pressUpFrames, which is the same problem: one rigid
  // body turning about a fixed pivot until the elbow hits a given angle.
  // A push-up presses down from it and a row pulls up to it, so the only
  // thing overridden is the arms.
  invertedRow: pose(
    "side",
    pressUpFrames(
      { x: 0.335, y: 0.341 },
      { x: 0.745, y: 0.815 },
      P.thigh + P.shin,
      // 44 is the shallow end of the clip's 33-44 top band, and the end
      // that keeps the head clear of a fixed bar: at 38 the crown passed
      // through it by 2.5 cm.
      [178, 90, 44],
      (pelvis, torso) => {
        // The heels are the contact: the foot stays as it was, angled up off
        // the floor the way a row's does.
        const flat: [number, number] = [40, 45];
        return plantedLegs(pelvis, torso, "side", [{ x: 0.745, y: 0.815 }, { x: 0.729, y: 0.815 }], FORWARD, flat);
      },
      (pelvis, torso, hand) => reachingArms(pelvis, torso, "side", [hand, { x: hand.x - 0.016, y: hand.y }], BACK),
      "shallower",
    ),
    [{ kind: "floor" }, { kind: "bar", at: "grip", length: 0.17, plates: false }],
    "overhand",
    1,
    // A rep in the clip is about 1.2 s up, a touch at the rings, 1.2 s down
    // and a beat hanging.
    { tempo: { down: 1200, bottom: 300, up: 1200, top: 300 } },
  ),

  // Hanging raises, from a reference clip measured with the pose lab (OPEX
  // San Juan "Hanging Leg Raises", w0IDQ_05X34, three-quarter view, four
  // reps in 12 s; MoveNet on 48 frames at 0.25 s). The clip: a dead hang
  // with the legs plumb (thigh 1-5 off vertical, knee 175-180) and the trunk
  // within 3 degrees of vertical; the knees BEND as the legs come up (knee
  // ~125 with the thigh 60 off plumb, ~80 with the thigh past level) and the
  // thighs finish 150-160 off plumb -- the knees at the chest -- with the
  // trunk leaning back 6-10; a rep is a 1.1 s raise, a beat at the top, a
  // 1.5 s lowering and 0.4 s hanging. The ankles scored under 0.5 through
  // the raise, so the knee angles are read off the overlays, not the table.
  // That is a knee raise, and it is what "Hanging Knee Raise" now shows
  // (hangingKneeRaise, below). "Hanging Leg Raise" -- straight legs to hip
  // height, its own cue -- keeps the clip's hang, trunk and tempo with the
  // knees held at 177 and the thighs stopping level.
  // The shoulder is FIXED under the bar and the pelvis walked down the trunk
  // from it, so the hands (and the bar drawn at them) stay put as the trunk
  // leans back.
  hangingRaise: pose(
    "side",
    ([[357, 178, 179], [354, 135, 138], [350, 92, 95]] as const).map(([torso, thigh, shin]) => hangingFigure(torso, thigh, shin)),
    [{ kind: "bar", at: "grip", length: 0.44, plates: false }],
    "overhand",
    1,
    { tempo: { down: 1100, bottom: 250, up: 1500, top: 400 }, camera: { azimuth: 0.9 } },
  ),

  hangingKneeRaise: pose(
    "side",
    // The shin hangs plumb until the thigh is level, then folds under as the
    // knees come to the chest: knee 177 / 125 / 80 / 85.
    ([[357, 178, 179], [355, 120, 175], [352, 70, 170], [350, 30, 125]] as const).map(([torso, thigh, shin]) => hangingFigure(torso, thigh, shin)),
    [{ kind: "bar", at: "grip", length: 0.44, plates: false }],
    "overhand",
    1,
    { tempo: { down: 1100, bottom: 250, up: 1500, top: 400 }, camera: { azimuth: 0.9 } },
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

  // Superman, from a reference clip measured with the pose lab (OPEX
  // "Superman Hold", W8vlZfmxOpM, side view, a 7 s hold -- a hold gives one
  // position and no tempo, and that is all this one is used for).
  //
  // What it CONFIRMS, measured against the hip, which is the part left on
  // the floor: the clip lifts the shoulder 6.7 cm, the knee 6.7 and the
  // ANKLE 19.3. Ours reads 9.2, 8.4 and 19.2 -- the ankle to a millimetre.
  // The trunk and the legs were already right.
  //
  // What it CORRECTS: the arms. They finished 29.6 cm above the hip, which
  // is 15.6 cm above the figure's own HEAD -- past anything the three
  // exercises on this pose ask for, and nothing like the clip's 5.4 cm. They
  // now finish level with the head (17.6 cm up), which is the Y-T-W raise's
  // and the snow angel's position and much nearer the superman's.
  //
  // The reason they were up there is worth recording: reaching them FORWARD
  // makes the figure longer, and the flat-and-wide check caps a lying pose
  // at 3.4:1. This one now reads 4.4, so it gets its own cap the way the
  // plank family and the hollow hold do -- a superman really is that shape.
  // Rendered at every key on both builds to confirm the card still frames it.
  //
  // Still a compromise: Superman alone would hold the arms at the clip's
  // 5.4 cm, but Prone Y-T-W Raise and Reverse Snow Angel share this pose and
  // both lift them.
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
      { pelvis: { x: 0.5, y: 0.678 }, torso: 280, neck: 292, arms: sideArms(278, 282), legs: lyingLegs(80, 76, 112) },
      // Chest and legs both come off the ground, which is the whole exercise.
      { pelvis: { x: 0.5, y: 0.676 }, torso: 292, neck: 304, arms: sideArms(284, 290), legs: lyingLegs(68, 60, 96) },
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
      // From a reference clip measured with the pose lab (OPEX "Hollow Body
      // Hold", EsnM8eBtazU, square side view, 1.25 s into the hold and 3.5 s
      // holding it; MoveNet on 22 frames at 0.25 s): flat on the back with
      // the arms by the sides, then the shoulders come up 8-10 degrees, the
      // straight legs (knee 172-179) to 25 degrees above the floor and the
      // straight arms overhead to 20-30 degrees above it, by the ears -- and
      // the position is HELD. The old hold lifted the legs to 28-34 and the
      // arms to 42-47 with no tempo.
      { pelvis: { x: 0.5, y: 0.735 }, torso: 274, neck: 268, arms: sideArms(276, 279), legs: lyingLegs(91, 89, 40) },
      { pelvis: { x: 0.5, y: 0.733 }, torso: 277, neck: 271, arms: sideArms(288, 291), legs: lyingLegs(78, 76, 24) },
      { pelvis: { x: 0.5, y: 0.731 }, torso: 280, neck: 276, arms: sideArms(300, 303), legs: lyingLegs(65, 64, 12) },
    ],
    [{ kind: "floor", mat: true, y: 0.792 }],
    "overhand",
    1,
    { tempo: { down: 1250, bottom: 2500, up: 1250, top: 600 }, camera: { azimuth: 0.9 } },
  ),

  // Side plank, from a reference clip measured with the pose lab (OPEX "Side
  // Plank", tbWPBOgju9g, the camera square on the front of the body; MoveNet
  // on 13 frames at 0.5 s). The clip: one straight line from the stacked
  // feet up to the shoulders, 12-19 degrees off the floor (the model reads
  // the top side of the body at 12 and the bottom side at 19 -- the girdle
  // widths seen edge-on), knees 174-178, the top arm straight up (elbow
  // 174-179, 6-10 degrees off plumb), the support elbow under its shoulder
  // with the forearm on the floor pointing at the camera.
  // A FRONT view, lying along x: that is the one plane a side plank lives
  // in -- the girdles stack vertically when the trunk runs along x, which a
  // side view (girdles always across the depth axis) can never draw. The
  // old pose was a side-view figure with its belly up and one arm raised.
  // Solved from the floor up, both ends pinned: the bottom ankle 4cm up
  // (a shoe on its side), the support elbow at the forearm's radius
  // (0.028) with the upper arm plumb below the bottom shoulder -- which
  // fixes the body's angle at 14.8 degrees (legs 104.8, trunk 284.8). The
  // top leg is 2 degrees steeper so its foot lands on the bottom foot
  // (7.5cm up); the support forearm is pitched 90 degrees out of the plane
  // with `forward`.
  // Dead bug, from a reference clip measured with the pose lab (OPEX
  // "Alternating Dead Bug", -VykQ1HD0Vw, square side view, four reaches in
  // 17 s; MoveNet on 43 frames at 0.4 s). The clip: lying supine (trunk
  // 87-93 from vertical) with both hips and knees at a right angle (thigh
  // 165-171 off plumb -- straight up -- knee 74-87) and the arms straight
  // up (elbow 170-179, 20-25 degrees toward the head); one leg reaches out
  // until the thigh is 3-7 degrees above level with the knee at 166-179
  // while the OPPOSITE arm lowers overhead to level, 0.8 s out, 0.8 s held,
  // 0.8 s back, then the other side. Authored as one side (the near leg,
  // the far arm); the renderer's return is the same reach again.
  // The old mapping showed the hollow hold for this.
  deadBug: pose(
    "side",
    ([0, 0.5, 1] as const).map((reach) => {
      const lerp = (a: number, b: number) => a + (b - a) * reach;
      return {
        pelvis: { x: 0.5, y: 0.735 },
        torso: 274,
        neck: 272,
        // Arms: straight up, 20 degrees toward the head; the far arm lowers
        // overhead to 5 degrees above the floor.
        arms: [{ upper: 340, lower: 340 }, { upper: lerp(340, 275), lower: lerp(340, 275) }] as [Limb, Limb],
        // Legs: thigh straight up (5 toward the feet), shin level; the near
        // leg reaches out to 8 degrees above the floor, the knee opening
        // from 90 to 172.
        legs: [{ upper: lerp(5, 82), lower: lerp(95, 90), end: lerp(125, 100) }, { upper: 5, lower: 95, end: 125 }] as [Limb, Limb],
      };
    }),
    [{ kind: "floor", mat: true, y: 0.792 }],
    "overhand",
    1,
    { tempo: { down: 900, bottom: 700, up: 900, top: 600 }, camera: { azimuth: 0.9 } },
  ),

  sidePlank: pose(
    "front",
    [
      // A hold: the second key is a breath -- the hips sag 2mm and the
      // trunk steepens the half-degree that keeps the elbow planted.
      // The top arm is authored 7 degrees toward the head: the world build's
      // splay carries the hand toward the feet (+x here) and the guessed
      // depth a little forward, and plumb-in-the-plane came out 11 degrees
      // off plumb in the world.
      { pelvis: { x: 0.4744, y: 0.7312 }, torso: 284.8, neck: 286, arms: [{ upper: 353, lower: 353 }, { upper: 180, lower: 180, end: 180, forward: 90 }], legs: [{ upper: 106, lower: 109, end: 96 }, { upper: 103.8, lower: 105.8, end: 96 }] },
      { pelvis: { x: 0.4744, y: 0.7332 }, torso: 285.25, neck: 286.5, arms: [{ upper: 353, lower: 353 }, { upper: 180, lower: 180, end: 180, forward: 90 }], legs: [{ upper: 106, lower: 109, end: 96 }, { upper: 103.8, lower: 105.8, end: 96 }] },
    ],
    [{ kind: "floor", mat: true, y: 0.93 }],
    "overhand",
    1,
    // Said outright: the raised arm makes the scene as tall as it is long,
    // and the renderer's own rule would have orbited a lying figure.
    { tempo: { down: 1600, bottom: 300, up: 1600, top: 300 }, camera: { azimuth: 0, lying: true } },
  ),

  // Copenhagen plank, from a reference clip measured with the pose lab (OPEX
  // "Copenhagen Plank", tKb76R21AfM, the camera square on the front of the
  // body, a 7 s hold; MoveNet on 15 frames at 0.5 s). The clip: the side
  // plank's shape on the forearm, but the TOP foot rests on a bench and the
  // hips ride up to it -- the body runs DOWN from the feet to the shoulders
  // (the model reads the top side at 17 below level and the bottom side at 7
  // above it: the girdles seen edge-on), the top leg straight and level
  // with the bench (knee 170-174), the bottom leg hanging under the bench
  // with a soft knee, the top hand on the hip (elbow 134-140).
  // Same plane as the side plank (front view, lying along x), solved with
  // both ends pinned: the support elbow at the forearm's radius (0.028)
  // with the upper arm plumb, the top ankle 4 cm over a bench top 0.40 up;
  // that fixes the body at 12 degrees, descending to the head (legs 78,
  // trunk 258). The bottom leg 100 / 118 hangs clear of the bench's
  // underside. Copenhagen Plank borrowed the floor side plank before.
  copenhagenPlank: pose(
    "front",
    [
      // The top hand rests ON the hip: its forearm is pitched 32 degrees
      // toward the belly (`forward`) so the hand sits 8 cm off the hip line
      // -- the hip's radius plus the hand's -- instead of the guessed front
      // depth, which held it 11 cm out in the air. Both arms carry spread
      // -0.028: the world build's splay is along x, which for a figure
      // lying along x is the BODY axis, and it stretched the top forearm
      // 1.3 cm toward the feet.
      { pelvis: { x: 0.5, y: 0.617 }, torso: 258, neck: 262, arms: [{ upper: 60, lower: 112, forward: 32, spread: -0.028 }, { upper: 180, lower: 180, end: 180, forward: 90, spread: -0.028 }], legs: [{ upper: 78, lower: 80, end: 90 }, { upper: 100, lower: 118, end: 120 }] },
      { pelvis: { x: 0.5, y: 0.620 }, torso: 258.7, neck: 262.7, arms: [{ upper: 60, lower: 112, forward: 32, spread: -0.028 }, { upper: 180, lower: 180, end: 180, forward: 90, spread: -0.028 }], legs: [{ upper: 78, lower: 80, end: 90 }, { upper: 100, lower: 118, end: 120 }] },
    ],
    [
      { kind: "floor", mat: true, y: 0.93 },
      // The bench under the top foot: its top 4 cm under the ankle, its
      // length running along the body (`across`) toward the head.
      // ...and 10 cm behind the body's plane, so the foot rests on its near
      // half and the pad does not stand between the camera and the trunk.
      { kind: "slab", at: "ankle0", width: 0.5, height: 0.055, dx: -0.10, dy: 0.0675, across: true, depth: -0.10 },
    ],
    "overhand",
    1,
    { tempo: { down: 1600, bottom: 300, up: 1600, top: 300 }, camera: { azimuth: 0, lying: true } },
  ),

  // Pallof press, from a reference clip measured with the pose lab (OPEX
  // "Cable Standing Pallof Press", syYBcVbEAFk, three-quarter view, three
  // reps in 10 s; MoveNet on 41 frames at 0.25 s). The clip: standing
  // sideways to a cable at chest height, both hands on the handle at the
  // sternum (elbow 66-80, upper arm 9-16 behind plumb, forearm level), then
  // pressed straight out until the arms are all but locked (elbow 160-166
  // as projected, lockout by the cue), the trunk within 5-13 of vertical
  // and the knees soft (168-175); a rep is a 0.75 s press, a 0.6 s hold
  // out, a 0.9 s return and 1.1 s at the chest. It borrowed the woodchop.
  // A SIDE view: the press is forward, which is the plane, and the cable
  // comes from the figure's side through the prop's `depth` (world x).
  pallofPress: pose(
    "side",
    ([[188, 82], [140, 92], [94, 100]] as const).map(([upper, lower]) =>
      // Pelvis at the curl's standing height (0.497): at STAND's 0.52 the
      // solved knees came out at 138.
      stand({ x: 0.5, y: 0.497 }, 5, [{ upper, lower, spread: -0.08 }, { upper, lower, spread: -0.08 }]),
    ),
    [
      { kind: "floor" },
      // The pulley at chest height, 90 cm out to the figure's right; the
      // station's column stands beyond it.
      { kind: "cable", at: "grip", anchor: { x: 0.5, y: 0.275 }, handle: "d", depth: 0.9 },
    ],
    "neutral",
    1,
    { tempo: { down: 750, bottom: 600, up: 900, top: 1100 }, camera: { azimuth: 0.9 } },
  ),

  // Both hands travel together on a diagonal; that diagonal is the exercise.
  // They are authored as ONE pair of hands either side of what is held, not
  // as two arms swinging on the same angles: parallel arms from shoulders
  // 22cm apart leave the hands 39-51cm apart, and everything this movement
  // holds -- a rope handle, a medicine ball -- is narrower than that. The
  // ball floated between two hands that never touched it.
  // From a reference clip measured with the pose lab (OPEX "High to Low
  // Cable Oblique Rotation", KnbgKcvOG_c, three-quarter view, three reps in
  // 11 s; MoveNet on 46 frames at 0.25 s): the hands start AT the shoulder
  // on the pulley's side with the elbows bent (85-115) -- not overhead --
  // and finish beside the far hip with the arms straight (176-178), the
  // trunk turning and leaning 8-13 degrees toward them and the hips dropping
  // ~7 cm into a quarter squat (knees 145-155); a rep is a 1.0 s chop, a
  // 0.75 s hold low, a 1.5 s return and 0.5 s at the shoulder. The old
  // sweep began with the hands high over the head on straight arms and
  // leaned the trunk AWAY from the hands at both ends.
  // A front view cannot turn the trunk, so the far arm cannot be straight
  // at the far hip: the low hands are set diagonal (the far hand higher) so
  // the near arm locks out and the far one reaches 170.
  woodchop: pose(
    "front",
    // The elbows stay pointed the same way through the whole sweep. Past
    // the midline the hands are on the far side of the shoulders, so the
    // bend that kept them out on the way down folds them the other way --
    // the pose checker calls that the joint hinging backwards mid-rep.
    // [near hand, far hand, trunk lean, pelvis height, elbows]
    ([
      // The stance is wide (feet 0.11 either side), so the knees bend fast
      // as the pelvis drops: 2.7 cm of drop is a quarter squat here.
      [{ x: 0.667, y: 0.150 }, { x: 0.593, y: 0.150 }, 5, 0.518, BACK],
      [{ x: 0.560, y: 0.520 }, { x: 0.486, y: 0.520 }, 0, 0.530, BACK],
      [{ x: 0.500, y: 0.575 }, { x: 0.425, y: 0.600 }, 352, 0.545, DOWN],
    ] as const).map(([near, far, torso, py, elbows]) => {
      const pelvis = { x: 0.5, y: py };
      return {
        pelvis,
        torso,
        arms: reachingArms(pelvis, torso, "front", [near, far], elbows),
        legs: plantedLegs(pelvis, torso, "front", [{ x: 0.612, y: FLOOR }, { x: 0.388, y: FLOOR }], OUT),
      };
    }),
    // The station stands BESIDE the figure (depth 0.05, on the shoulder
    // line), the way the clip's lifter stands sideways to it; the front-view
    // default put it in front, where it hid the figure for a third of the
    // orbit.
    [{ kind: "floor" }, { kind: "bell", at: "grip", size: 0.085 }, { kind: "cable", at: "grip", anchor: { x: 0.95, y: 0.08 }, handle: "rope", depth: 0.05 }],
    "overhand",
    1,
    { tempo: { down: 1000, bottom: 750, up: 1500, top: 500 }, camera: { azimuth: -0.5 } },
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

  // Loaded carry, from a reference clip measured with the pose lab (OPEX
  // "Dumbbell Farmer's Carry", K4R8uc1x_OA, square side view, the lifter in
  // frame for 2.6 s of walking; MoveNet on 14 frames at 0.2 s): the trunk
  // upright (0-8 forward), the arms plumb (upper arm 0-7 off vertical, elbow
  // 166-177), the dumbbells at the sides, and a real stride -- the thighs
  // swing 20 degrees forward and 25 back with the knees at 163-175 -- at a
  // step every 0.5 s. The old walk shuffled the legs 10 degrees either way
  // on the default cycle.
  // Authored in place (the world walks under the figure): the front foot
  // flat on the floor at heel strike, the back foot on its toes; the middle
  // key has both feet under the hips with the far knee soft. The renderer
  // walks the keys and back, so one traversal is one step and the return
  // is the next -- the legs' roles do not swap, which is why the middle key
  // is kept symmetric enough to read either way.
  carry: pose(
    "side",
    carryStride(wide(HANG)),
    [{ kind: "floor", y: 0.972 }, { kind: "bell", at: "hand0", each: true }],
    "neutral",
    1,
    { tempo: { down: 500, bottom: 40, up: 500, top: 40 }, camera: { azimuth: 0.9 } },
  ),

  // The other loaded carries: the farmer's stride with the load moved. Each
  // from its own reference clip, measured with the pose lab -- all three
  // filmed walking TOWARD the camera, which shows the arms and nothing of
  // the stride (that is the farmer's, from its side-view clip).
  // Overhead: OPEX "Dual Kettlebell Overhead Carry" (dwGP7RAYtxY, 12 frames
  // at 0.25 s): both arms locked out overhead (elbow 175-179), 10-20
  // degrees out from plumb in the frontal plane -- a shallow V -- the trunk
  // within 5 of vertical. Authored plumb in the side plane and swung out
  // 15 with `abduct`; the bells at the hands.
  overheadCarry: pose(
    "side",
    carryStride([{ upper: 0, lower: 0, abduct: 15 }, { upper: 0, lower: 0, abduct: 15 }]),
    [{ kind: "floor", y: 0.972 }, { kind: "bell", at: "hand0", each: true }],
    "neutral",
    1,
    { tempo: { down: 500, bottom: 40, up: 500, top: 40 }, camera: { azimuth: 0.9 } },
  ),
  // Front rack: OPEX "Front Rack Kettlebell Carry" (0OzaglIheOc, 15 frames
  // at 0.25 s): the elbows down by the ribs (upper arm within 8 of plumb),
  // the forearms folded up to the shoulders (elbow 25-31, forearm ~30 off
  // vertical), the bells at the collarbones. Upper arm 165 (15 forward of
  // plumb) and forearm 15: the hand lands at shoulder height, 7 cm ahead
  // of the shoulder, elbow 30.
  frontRackCarry: pose(
    "side",
    carryStride([{ upper: 165, lower: 15 }, { upper: 165, lower: 15 }]),
    [{ kind: "floor", y: 0.972 }, { kind: "bell", at: "hand0", each: true }],
    "neutral",
    1,
    { tempo: { down: 500, bottom: 40, up: 500, top: 40 }, camera: { azimuth: 0.9 } },
  ),
  // Suitcase: OPEX "Single Arm Farmers Carry" (28BIZccT5fs, 22 frames at
  // 0.25 s): one bell, the loaded arm straight (elbow 177-180) and held
  // 9-12 degrees out from plumb so the bell clears the thigh, the free arm
  // hanging (elbow 176-179, 5-8 off plumb), the trunk held within 12 of
  // vertical against the pull. The loaded (near) arm is swung out 12 with
  // `abduct` (negative: an arm that hangs swings outboard on the negative
  // sign) -- `spread` would have stretched it 6 mm; the free arm hangs as
  // the farmer's; one bell, on the near hand.
  suitcaseCarry: pose(
    "side",
    carryStride([{ upper: 178, lower: 179, abduct: -12 }, { upper: 178, lower: 179, spread: 0.04 }]),
    [{ kind: "floor", y: 0.972 }, { kind: "bell", at: "hand0" }],
    "neutral",
    1,
    { tempo: { down: 500, bottom: 40, up: 500, top: 40 }, camera: { azimuth: 0.9 } },
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

  // Straight-arm pulldown, from a reference clip measured with the pose lab
  // (OPEX "Standing Cable Straight Arm Pulldown", nAkTIeJ_Aus, side view,
  // three reps in 11.2 s; MoveNet on 40 frames at 0.35 s).
  //
  // The ARC RAN TOO HIGH AT THE TOP. The shoulder-to-wrist line -- the line
  // a locked arm makes, and the one thing this lift is about -- reads 167
  // from vertical at the finish, hands at the thighs, and 64 at the start,
  // in all three reps and within 5 degrees each time. Ours ran 41 to 167:
  // the finish was already right, and the start had the arms almost
  // straight overhead, a third of a right angle past the clip. The middle
  // key, taken at half the hand's vertical travel, is 130 against our 99.
  //
  // The ELBOW is deliberately NOT changed. The clip's own elbow holds 174
  // to 180 from the finish through three quarters of the raise and then
  // folds to about 135 in the last quarter, where the bar arrives at the
  // lifter's forehead -- he stands close to the machine. That is this
  // clip, not this lift, whose whole name is the locked elbow; a figure
  // bending at the top would read as a lat pulldown. So the HAND PATH comes
  // from the clip and the arm stays straight along it.
  //
  // The trunk was overdone as well: 12 degrees from vertical at the finish
  // and 7 at the start, against our flat 18.
  //
  // Tempo, which it did not have: 1.25 s down, 0.35 s at the thighs, 2.25 s
  // back up and no pause at the top -- the hand curve turns there inside a
  // single 0.35 s frame in every rep. Period 3.85 s, the same to within
  // 0.01 s across the three.
  straightArmPulldown: pose(
    "side",
    ([[63, 7], [129, 10], [166, 12]] as const).map(([arm, torso]) =>
      stand({ x: 0.5, y: 0.494 }, torso, sideArms(arm, arm + 2), 14, [{ x: 0.557, y: FLOOR }, { x: 0.515, y: FLOOR }]),
    ),
    [{ kind: "floor" }, { kind: "bar", at: "grip", length: 0.16, plates: false }, { kind: "cable", at: "grip", anchor: { x: 0.9, y: 0.02 } }],
    "overhand",
    1,
    { tempo: { down: 1250, bottom: 350, up: 2250, top: 0 } },
  ),

  // Face pull, from a reference clip measured with the pose lab (OPEX "Cable
  // Rope Face Pull", 5ZC4LagfDQ4, side view, four reps in 11.6 s; MoveNet on
  // 38 frames at 0.3 s).
  //
  // The ELBOW angles in this clip are not usable and are not quoted: both
  // hands finish beside the head and the model tangles the near and far arm
  // there, reading the elbow anywhere from 3 to 28 degrees. What the frames
  // DO show, plainly, is the pulley -- it sits well above the head, and the
  // rope runs down to the face. Ours anchored the cable at shoulder height,
  // so the rope came in level and the movement read as a row to the chin.
  //
  // Pulled to the face with the elbows staying high, which the frames
  // needed fixing too: the elbows DROPPED 4.7 cm below the shoulder as the
  // rope came in, where the clip keeps them at shoulder height and flared. A
  // rep
  // is 0.9 s in, a beat at the face, 1.2 s out and a beat extended.
  facePull: pose(
    "side",
    ([[72, 82], [80, 40], [88, -15]] as const).map(([up, low]) => stand({ x: 0.5, y: 0.494 }, 6, sideArms(up, low), undefined, [{ x: 0.538, y: FLOOR }, { x: 0.515, y: FLOOR }])),
    [{ kind: "floor" }, { kind: "bar", at: "grip", length: 0.10, plates: false }, { kind: "cable", at: "grip", anchor: { x: 0.92, y: 0.10 }, handle: "rope" }],
    "neutral",
    1,
    { tempo: { down: 900, bottom: 300, up: 1200, top: 300 } },
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
  // Russian twist, from a reference clip measured with the pose lab (OPEX
  // "Russian Twist", Hvtxbidjins, square side view, six twists in 9.5 s;
  // MoveNet on 39 frames at 0.25 s): a V-sit with the feet off the floor --
  // the trunk reclined 40-47 degrees, the thighs 34 degrees above level,
  // the shins 30 below it (knee 110-120, hip 70-105), the head up -- and
  // the clasped hands, elbows bent (50-97), sweeping from one hip to the
  // other in ~0.75 s each way. The old sit reclined only 25 degrees and
  // "twisted" by dropping straight arms 50 degrees in the plane.
  // The sweep is the one thing a side view cannot draw, so each arm is
  // swung about the fore-aft axis through its shoulder with `abduct` --
  // signed OPPOSITELY on the two arms, which sends both hands to the same
  // side of the body with every bone at full length (the same sign sends
  // them apart, a fly). The hands are authored below the shoulders (upper
  // arm 230, forearm 260, elbow 150) because the swing is proportional to
  // that drop: hands at shoulder height would not move at all.
  russianTwist: pose(
    "side",
    ([-60, 0, 60] as const).map((swing) => ({
      pelvis: { x: 0.5, y: 0.72 },
      torso: 42,
      neck: 20,
      arms: [{ upper: 230, lower: 260, spread: -0.075, abduct: swing }, { upper: 230, lower: 260, spread: -0.075, abduct: -swing }] as [Limb, Limb],
      legs: [{ upper: 305, lower: 240, end: 330 }, { upper: 305, lower: 240, end: 330 }] as [Limb, Limb],
    })),
    [{ kind: "floor", mat: true, y: 0.745 }],
    "overhand",
    -1,
    { tempo: { down: 750, bottom: 100, up: 750, top: 100 }, camera: { azimuth: 0.9 } },
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
