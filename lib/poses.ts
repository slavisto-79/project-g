// Exercise figures: an articulated body, drawn through the whole range of a
// repetition.
//
// This replaces a model that could not do either of those things. Every arm
// started at one point and every leg at another, so the figure had no shoulders
// and no hips and could never look like a person however the angles were tuned.
// And a pose was exactly two positions -- so a squat was passable, but a clean
// showed the floor and the rack and skipped the lift between them, which is the
// half that matters and the half that hurts people to get wrong.
//
// So: a shoulder girdle and a pelvis with real width, a head, hands and feet,
// near and far limbs for depth, and as many key positions per movement as the
// movement needs.
//
// Angles are degrees, 0 = straight up, positive = clockwise (towards the
// figure's right / +x). Lengths are fractions of the frame height.

// `weight` decides how a segment is drawn: `core` for the trunk and head,
// `near` for the limbs closest to the viewer, `far` for the ones behind them.
// Without that distinction a side view is a pile of identical sticks.
export type PoseSegment = { x1: number; y1: number; x2: number; y2: number; weight: "core" | "near" | "far" };

// Equipment drawn alongside the figure. A back squat and a goblet squat are the
// same shape; what is being held is most of what tells them apart.
export type PoseProp =
  | { kind: "bar"; x: number; y: number; angle: number; length: number; plates: boolean; rails?: boolean; hex?: boolean }
  // both: held in both hands (authored at the grip), not a per-hand weight.
  | { kind: "bell"; x: number; y: number; size: number; both?: boolean }
  // angle: an inclined bench -- the backrest runs along this authored
  // direction (same convention as a bar's angle) from the anchor, which is
  // then the hip joint rather than the pad's centre.
  | { kind: "slab"; x: number; y: number; width: number; height: number; angle?: number }
  // A cable running from a pulley (the anchor, fixed in the world) to the
  // hands; the world build draws the whole machine around the anchor.
  | { kind: "cable"; x: number; y: number; ax: number; ay: number }
  // A ground line. Side views are hard to read without one -- a bent-over
  // figure and a lying one are the same jumble of sticks until you can see
  // which way is down and where the body is relative to the floor.
  | { kind: "floor"; y: number };

export type PoseFrame = {
  segments: PoseSegment[];
  head: { x: number; y: number; r: number };
  props: PoseProp[];
};

// --- The 3D form of the same data ------------------------------------------
//
// The same key positions, emitted as world coordinates so a 3D renderer can
// show the movement from any angle. X is the figure's right, Y is up, Z is
// forward (the direction a side view faces). Authored angles live in one
// plane per view -- sagittal for "side", frontal for "front" -- and the
// girdle gives the body its real width on the axis the author never drew.

export type Vec3 = [number, number, number];

export type PoseBone3D = {
  part: "spine" | "neck" | "shoulders" | "hips" | "upperArm" | "forearm" | "hand" | "thigh" | "shin" | "foot";
  // 0 is the figure's right, 1 the left; absent for the trunk.
  side?: 0 | 1;
  a: Vec3;
  b: Vec3;
};

export type PoseProp3D =
  // rails: dip bars run fore-aft on BOTH sides of the body; a single
  // crossbar at hip height cannot exist without passing through it.
  // dir: a leaning bar (landmine) -- unit direction in the sagittal plane,
  // pointing from the floor-pinned end up toward the hands.
  // hex: a trap bar -- a hexagonal frame the lifter stands inside, handles at
  // the sides where the hands are; the plates sit outside the frame.
  | { kind: "bar"; center: Vec3; length: number; plates: boolean; rails?: boolean; dir?: Vec3; hex?: boolean }
  | { kind: "bell"; center: Vec3; size: number; both?: boolean }
  // dir: an inclined bench's backrest direction; center is then the hip.
  | { kind: "slab"; center: Vec3; width: number; height: number; dir?: Vec3 }
  // center is the grip (where the cable ends), anchor the pulley.
  | { kind: "cable"; center: Vec3; anchor: Vec3 }
  | { kind: "floor"; y: number };

export type PoseFrame3D = {
  bones: PoseBone3D[];
  head: { c: Vec3; r: number };
  // Wrist positions, so a renderer can wrap a fist around whatever is held.
  hands: [Vec3, Vec3];
  props: PoseProp3D[];
};

// How the hands hold the implement. Drawn as the thumb side of the fist, which
// is what visually separates a curl grip from a row grip.
export type GripStyle = "overhand" | "underhand" | "neutral";

// Key positions in order, from the start of the rep to the end. The renderer
// walks them and comes back, so authoring the down-phase gives the up-phase.
// `facing` says which side of the spine the belly is on (+1 for a standing
// figure that faces +x, -1 for the mirror) -- rotating the spine a quarter
// turn that way gives the ventral direction in ANY posture, which is what
// orients the face and the chest.
export type ExercisePose = { frames: PoseFrame[]; frames3d: PoseFrame3D[]; grip: GripStyle; facing: 1 | -1 };

// The frame the renderer maps into. Only the ratio matters: horizontal lengths
// are divided by it so a limb is the same length whichever way it points.
const ASPECT = 850 / 567;

// Fractions of frame height. Roughly seven-and-a-half heads tall, which is what
// makes a stick figure read as an adult rather than a child or a spider.
const P = {
  headRadius: 0.048,
  neck: 0.038,
  spine: 0.245,
  shoulderHalf: 0.072,
  hipHalf: 0.048,
  upperArm: 0.152,
  forearm: 0.138,
  hand: 0.048,
  thigh: 0.225,
  shin: 0.215,
  foot: 0.072,
};

// How far apart the two sides are drawn. Face on, that is the real width of the
// body. Side on, the far side is a few thousandths behind the near one -- just
// enough to stop the two legs being one line.
const SIDE_DEPTH = 0.018;

type Point = { x: number; y: number };
type View = "front" | "side";

function step(from: Point, angleDeg: number, length: number): Point {
  const a = (angleDeg * Math.PI) / 180;
  return { x: from.x + (Math.sin(a) * length) / ASPECT, y: from.y - Math.cos(a) * length };
}

// One arm or leg: the two angles that define it, plus an optional angle for the
// hand or foot on the end.
// spread: extra lateral reach in the WORLD build only -- the wrist moves this
// far outboard (the elbow half as far). A side view cannot draw a wide grip,
// but a bar carried on the back is held wide, and the width is what keeps
// the elbow open in 3D while the hand sits close to the neck in the plane.
type Limb = { upper: number; lower: number; end?: number; spread?: number };

type Figure = {
  // Centre of the hip line, which is where the whole figure hangs from.
  pelvis: Point;
  // Pelvis to the base of the neck.
  torso: number;
  // Neck to the centre of the head. Defaults to following the torso.
  neck?: number;
  // Index 0 is the near side (the figure's right, positive angles in a front
  // view); index 1 is the far side.
  arms: [Limb, Limb];
  legs: [Limb, Limb];
};

function build(figure: Figure, view: View): { segments: PoseSegment[]; head: { x: number; y: number; r: number }; joints: Record<string, Point> } {
  const segments: PoseSegment[] = [];
  const core = (a: Point, b: Point) => segments.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, weight: "core" as const });
  const limb = (a: Point, b: Point, side: 0 | 1) =>
    segments.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, weight: side === 0 ? ("near" as const) : ("far" as const) });

  const pelvis = figure.pelvis;
  const shoulderMid = step(pelvis, figure.torso, P.spine);
  const neckTop = step(shoulderMid, figure.neck ?? figure.torso, P.neck);
  const headCentre = step(neckTop, figure.neck ?? figure.torso, P.headRadius);

  // Face on, the girdle and pelvis are drawn at their real width and the trunk
  // reads as a torso. Side on, they are edge-on: the two sides sit a hair
  // apart for depth -- HORIZONTALLY, never rotated with the trunk. A rotated
  // offset put the far hip lower whenever the torso leaned, the far leg then
  // solved against a different chord and its knee drifted out of sync with
  // the near one. The depth is visual fakery; gravity is not.
  const shoulder: [Point, Point] =
    view === "front"
      ? [step(shoulderMid, figure.torso + 90, P.shoulderHalf), step(shoulderMid, figure.torso - 90, P.shoulderHalf)]
      : [{ x: shoulderMid.x + SIDE_DEPTH / ASPECT, y: shoulderMid.y }, { x: shoulderMid.x - SIDE_DEPTH / ASPECT, y: shoulderMid.y }];
  const hip: [Point, Point] =
    view === "front"
      ? [step(pelvis, figure.torso + 90, P.hipHalf), step(pelvis, figure.torso - 90, P.hipHalf)]
      : [{ x: pelvis.x + SIDE_DEPTH / ASPECT, y: pelvis.y }, { x: pelvis.x - SIDE_DEPTH / ASPECT, y: pelvis.y }];

  if (view === "front") {
    // Four sides of a trapezoid: shoulders, ribs, hips. This is most of what
    // makes the figure look like a body rather than a cross.
    core(shoulder[0], shoulder[1]);
    core(hip[0], hip[1]);
    core(shoulder[0], hip[0]);
    core(shoulder[1], hip[1]);
  } else {
    core(pelvis, shoulderMid);
  }
  core(shoulderMid, neckTop);

  const wrists: Point[] = [];
  figure.arms.forEach((arm, index) => {
    const side = index as 0 | 1;
    const from = shoulder[side]!;
    const elbow = step(from, arm.upper, P.upperArm);
    const wrist = step(elbow, arm.lower, P.forearm);
    limb(from, elbow, side);
    limb(elbow, wrist, side);
    // The hand carries on from the forearm unless the pose says otherwise --
    // which it does for anything gripping a bar across the line of the arm.
    limb(wrist, step(wrist, arm.end ?? arm.lower, P.hand), side);
    wrists.push(wrist);
  });

  const ankles: Point[] = [];
  figure.legs.forEach((leg, index) => {
    const side = index as 0 | 1;
    const from = hip[side]!;
    const knee = step(from, leg.upper, P.thigh);
    const ankle = step(knee, leg.lower, P.shin);
    limb(from, knee, side);
    limb(knee, ankle, side);
    // Foot forward of the shin by default. Face on, the far foot splays the
    // other way, or both feet point the same direction and the stance reads
    // as a person standing sideways.
    const splay = view === "front" && side === 1 ? 90 : -90;
    const footAngle = leg.end ?? leg.lower + splay;
    // A real foot has a heel: the segment starts behind the ankle.
    limb(step(ankle, footAngle, -0.38 * P.foot), step(ankle, footAngle, P.foot), side);
    ankles.push(ankle);
  });

  const joints: Record<string, Point> = { pelvis, hip: pelvis, shoulder: shoulderMid, head: headCentre, neck: neckTop };
  shoulder.forEach((p, i) => { joints[`shoulder${i}`] = p; });
  hip.forEach((p, i) => { joints[`hip${i}`] = p; });
  wrists.forEach((p, i) => { joints[`hand${i}`] = p; });
  ankles.forEach((p, i) => { joints[`ankle${i}`] = p; });
  // Midpoint of the hands, which is where a bar or a bell is held.
  joints.grip = {
    x: (wrists[0]!.x + wrists[1]!.x) / 2,
    y: (wrists[0]!.y + wrists[1]!.y) / 2,
  };
  return { segments, head: { ...headCentre, r: P.headRadius }, joints };
}

// How far in front of the trunk plane a front-view hand sits, by how close
// to the centreline it is and how high: hands at the chest are a forearm's
// depth out, hands out at the sides barely ahead of the shoulders, and hands
// overhead stack over the shoulders rather than reaching forward.
function frontDepth(xWorld: number, aboveShoulder: number): number {
  const lateral = Math.max(0, Math.min(1, 1 - Math.abs(xWorld) / 0.4));
  const lift = Math.max(0, Math.min(1, aboveShoulder / 0.2));
  return 0.04 + 0.12 * lateral * (1 - 0.7 * lift);
}

// Builds the same figure in world space. The authored angles live in one plane
// -- sagittal for a side view, frontal for a front view -- and the third axis
// comes from the girdle widths, which is exactly the information a flat
// projection had to throw away.
function build3d(figure: Figure, view: View): { bones: PoseBone3D[]; head: { c: Vec3; r: number }; hands: [Vec3, Vec3] } {
  // Authored screen x compressed horizontal lengths by ASPECT so they matched
  // the 2D frame; multiplying by ASPECT restores world proportions. Screen y
  // grows downward; world Y grows up.
  const planar = (p: Point): Vec3 =>
    view === "side" ? [0, 1 - p.y, (p.x - 0.5) * ASPECT] : [(p.x - 0.5) * ASPECT, 1 - p.y, 0];
  // Walking a limb by its authored angle, in the plane that view draws.
  const walk = (from: Vec3, angleDeg: number, length: number): Vec3 => {
    const a = (angleDeg * Math.PI) / 180;
    return view === "side"
      ? [from[0], from[1] + Math.cos(a) * length, from[2] + Math.sin(a) * length]
      : [from[0] + Math.sin(a) * length, from[1] + Math.cos(a) * length, from[2]];
  };
  // The lateral axis: X in a side view. In a front view the girdle already
  // spans X inside the drawing plane, so the offset only breaks z-fighting.
  const lateral = (side: 0 | 1, half: number): Vec3 =>
    view === "side" ? [side === 0 ? half : -half, 0, 0] : [0, 0, side === 0 ? 0.012 : -0.012];
  const add = (p: Vec3, d: Vec3): Vec3 => [p[0] + d[0], p[1] + d[1], p[2] + d[2]];

  const bones: PoseBone3D[] = [];
  const pelvis = planar(figure.pelvis);
  const shoulderMid = walk(pelvis, figure.torso, P.spine);
  const neckTop = walk(shoulderMid, figure.neck ?? figure.torso, P.neck);
  const headCentre = walk(neckTop, figure.neck ?? figure.torso, P.headRadius);

  // In a front view the shoulders and hips are drawn inside the plane exactly
  // as the 2D build places them; in a side view they span the lateral axis.
  const girdle = (centre: Vec3, half: number, side: 0 | 1): Vec3 =>
    view === "side"
      ? add(centre, lateral(side, half))
      : add(walk(centre, figure.torso + (side === 0 ? 90 : -90), half), lateral(side, 0));

  const shoulder: [Vec3, Vec3] = [girdle(shoulderMid, P.shoulderHalf, 0), girdle(shoulderMid, P.shoulderHalf, 1)];
  const hip: [Vec3, Vec3] = [girdle(pelvis, P.hipHalf, 0), girdle(pelvis, P.hipHalf, 1)];

  bones.push({ part: "spine", a: pelvis, b: shoulderMid });
  bones.push({ part: "neck", a: shoulderMid, b: neckTop });
  bones.push({ part: "shoulders", a: shoulder[0], b: shoulder[1] });
  bones.push({ part: "hips", a: hip[0], b: hip[1] });

  const hands: Vec3[] = [];
  figure.arms.forEach((arm, index) => {
    const side = index as 0 | 1;
    // Front-view angles are authored mirrored (side 1 negative); walking them
    // directly reproduces that. Side-view limbs differ only by their offset.
    const elbow = walk(shoulder[side]!, arm.upper, P.upperArm);
    const wrist = walk(elbow, arm.lower, P.forearm);
    // Arms splay a little outward from the shoulder to the hand -- relaxed
    // human arms do, and without it anything hanging from the hands (a
    // dumbbell's inner head, a kettlebell's ball) sat exactly at shoulder
    // width and passed straight through the thighs.
    const out = side === 0 ? 1 : -1;
    const spread = arm.spread ?? 0;
    elbow[0] += out * (0.014 + spread / 2);
    wrist[0] += out * (0.028 + spread);
    // Face on, the authored arms have no depth, so hands that cross in front
    // of the trunk would sit INSIDE it; give them the depth a real arm has
    // there -- well forward at the centreline, a hair forward at the sides.
    if (view === "front") {
      const z = frontDepth(wrist[0], wrist[1] - shoulderMid[1]);
      elbow[2] += z / 2;
      wrist[2] += z;
    }
    // Walked from the already-shifted wrist, so it carries the splay with it.
    const handTip = walk(wrist, arm.end ?? arm.lower, P.hand);
    bones.push({ part: "upperArm", side, a: shoulder[side]!, b: elbow });
    bones.push({ part: "forearm", side, a: elbow, b: wrist });
    bones.push({ part: "hand", side, a: wrist, b: handTip });
    hands.push(wrist);
  });

  figure.legs.forEach((leg, index) => {
    const side = index as 0 | 1;
    const knee = walk(hip[side]!, leg.upper, P.thigh);
    const ankle = walk(knee, leg.lower, P.shin);
    const splay = view === "front" && side === 1 ? 90 : -90;
    const footAngle = leg.end ?? leg.lower + splay;
    bones.push({ part: "thigh", side, a: hip[side]!, b: knee });
    bones.push({ part: "shin", side, a: knee, b: ankle });
    // Heel behind the ankle, toes in front: the foot is its own part.
    bones.push({ part: "foot", side, a: walk(ankle, footAngle, -0.38 * P.foot), b: walk(ankle, footAngle, P.foot) });
  });

  return { bones, head: { c: headCentre, r: P.headRadius }, hands: [hands[0]!, hands[1]!] };
}

// The 2D props are already resolved against the figure; the world form is a
// mechanical conversion of each one, plus the bar getting its real length --
// a side view foreshortens a barbell to a stub, and a 3D one must not.
function propsTo3d(props: PoseProp[], view: View, hands: [Vec3, Vec3]): PoseProp3D[] {
  const point = (x: number, y: number): Vec3 =>
    view === "side" ? [0, 1 - y, (x - 0.5) * ASPECT] : [(x - 0.5) * ASPECT, 1 - y, 0];
  // Face on, anything held rides at the depth of the hand holding it -- the
  // hand itself when the prop sits on one, the hands' mean when it spans both.
  const heldDepth = (x: number, y: number): number => {
    if (view !== "front") return 0;
    const wx = (x - 0.5) * ASPECT;
    const wy = 1 - y;
    const own = hands.find((h) => Math.abs(h[0] - wx) < 0.012 && Math.abs(h[1] - wy) < 0.012);
    return own ? own[2] : (hands[0][2] + hands[1][2]) / 2;
  };
  return props.map((prop) => {
    if (prop.kind === "floor") return { kind: "floor" as const, y: 1 - prop.y };
    if (prop.kind === "bar") {
      const centre = point(prop.x, prop.y);
      // In a front view the bar sits at the hands' depth, and never inside
      // the trunk -- in the body plane it visibly passed through the neck
      // and skull.
      if (view === "front") centre[2] = Math.max(heldDepth(prop.x, prop.y), 0.075);
      return {
        kind: "bar" as const,
        center: centre,
        // A real barbell is longer than the lifter is tall -- 2.2m of bar
        // against 1.75m of person. Drawn shoulder-width it fuses with the
        // body; at this length the plates sit well clear of the silhouette,
        // which is most of what makes it read as a separate object.
        length: prop.plates ? 1.04 : Math.max(view === "front" ? prop.length : 0.34, 0.34),
        plates: prop.plates,
        ...(prop.rails ? { rails: true } : {}),
        ...(prop.hex ? { hex: true } : {}),
        // An authored lean survives into 3D as a direction; the bar is long
        // enough to visibly run down to its floor pivot.
        ...(view === "side" && prop.angle !== 90
          ? { dir: [0, Math.cos((prop.angle * Math.PI) / 180), Math.sin((prop.angle * Math.PI) / 180)] as Vec3, length: 0.70 }
          : {}),
      };
    }
    if (prop.kind === "bell") {
      const centre = point(prop.x, prop.y);
      if (view === "front") centre[2] = heldDepth(prop.x, prop.y);
      return { kind: "bell" as const, center: centre, size: prop.size, ...(prop.both ? { both: true } : {}) };
    }
    if (prop.kind === "cable") {
      // Face on, the machine stands IN FRONT of the figure (the figure faces
      // +Z); the authored anchor only says how high and how far to the side.
      // The cable ends where the hand actually is, depth included.
      const anchor: Vec3 = view === "front" ? [(prop.ax - 0.5) * ASPECT, 1 - prop.ay, 0.45] : point(prop.ax, prop.ay);
      const centre = point(prop.x, prop.y);
      if (view === "front") centre[2] = heldDepth(prop.x, prop.y);
      return { kind: "cable" as const, center: centre, anchor };
    }
    return {
      kind: "slab" as const,
      center: point(prop.x, prop.y),
      width: prop.width,
      height: prop.height,
      ...(view === "side" && prop.angle !== undefined && prop.angle !== 90
        ? { dir: [0, Math.cos((prop.angle * Math.PI) / 180), Math.sin((prop.angle * Math.PI) / 180)] as Vec3 }
        : {}),
    };
  });
}

type PropSpec =
  | { kind: "bar"; at: string; angle?: number; length?: number; plates?: boolean; dy?: number; rails?: boolean; hex?: boolean }
  | { kind: "bell"; at: string; size?: number; each?: boolean }
  | { kind: "slab"; at: string; width: number; height: number; dx?: number; dy?: number; angle?: number }
  // anchor: the pulley, in authored coordinates (a high pulley sits above the
  // frame's top edge, which is fine -- it only has to be off the figure).
  | { kind: "cable"; at: string; anchor: Point }
  // Placed under the lowest point of the figure, so it sits where the ground
  // is. Pin it with `y` when the body leaves the ground: otherwise the floor
  // rises with the jump, which reads as the world moving, not the athlete.
  | { kind: "floor"; y?: number };

function resolveProps(specs: PropSpec[], joints: Record<string, Point>, segments: PoseSegment[]): PoseProp[] {
  const drawn: PoseProp[] = [];
  const lowest = segments.reduce((low, s) => Math.max(low, s.y1, s.y2), 0);
  for (const spec of specs) {
    if (spec.kind === "floor") {
      drawn.push({ kind: "floor", y: spec.y ?? lowest + 0.006 });
      continue;
    }
    if (spec.kind === "cable") {
      const grip = joints[spec.at];
      if (!grip) throw new Error(`pose: cable anchored to unknown joint "${spec.at}"`);
      drawn.push({ kind: "cable", x: grip.x, y: grip.y, ax: spec.anchor.x, ay: spec.anchor.y });
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
        ...(spec.rails ? { rails: true } : {}),
        ...(spec.hex ? { hex: true } : {}),
      });
    } else if (spec.kind === "bell") {
      drawn.push({ kind: "bell", x: anchor.x, y: anchor.y, size: spec.size ?? 0.055, ...(spec.at === "grip" ? { both: true } : {}) });
    } else {
      drawn.push({
        kind: "slab",
        x: anchor.x + (spec.dx ?? 0),
        y: anchor.y + (spec.dy ?? 0),
        width: spec.width,
        height: spec.height,
        ...(spec.angle !== undefined ? { angle: spec.angle } : {}),
      });
    }
  }
  return drawn;
}

// Builds a movement from its key positions. Props are declared once and
// re-anchored in every frame, so equipment cannot drift out of the hands and
// adding a key position does not mean restating the barbell.
function pose(view: View, figures: Figure[], props: PropSpec[] = [], grip: GripStyle = "overhand", facing: 1 | -1 = 1): ExercisePose {
  if (figures.length < 2) throw new Error("a movement needs at least two key positions");
  const built = figures.map((figure) => build(figure, view));
  // An unpinned floor goes under the lowest point the body reaches in ANY key
  // position, not the lowest in each one. Per-frame it slid about as the figure
  // moved, and measuring it from an ankle put it above the toes.
  const lowest = Math.max(...built.flatMap(({ segments }) => segments.flatMap((s) => [s.y1, s.y2]))) + 0.006;
  const grounded = props.map((spec) =>
    spec.kind === "floor" && spec.y === undefined ? { kind: "floor" as const, y: lowest } : spec,
  );
  const frames = built.map(({ segments, head, joints }) => ({
    segments,
    head,
    props: resolveProps(grounded, joints, segments),
  }));
  // The renderer matches segments and props by index across frames, so every
  // frame has to have the same ones in the same order.
  const shape = (f: PoseFrame) => f.segments.length + ":" + f.props.map((p) => p.kind).join(",");
  if (new Set(frames.map(shape)).size !== 1) throw new Error("key positions disagree on how many parts there are");
  // The world form is derived from the same figures and the already-resolved
  // props, so the two renderers can never disagree about the movement.
  const frames3d = figures.map((figure, i) => {
    const world = build3d(figure, view);
    return { ...world, props: propsTo3d(frames[i]!.props, view, world.hands) };
  });
  return { frames, frames3d, grip, facing };
}

// --- Authoring helpers ---------------------------------------------------

// A front view is symmetric far more often than not, and writing each pair out
// twice is how sign errors get in.
function bothArms(upper: number, lower: number, end?: number): [Limb, Limb] {
  return [{ upper, lower, end }, { upper: -upper, lower: -lower, end: end === undefined ? undefined : -end }];
}
function bothLegs(upper: number, lower: number, end?: number): [Limb, Limb] {
  return [{ upper, lower, end }, { upper: -upper, lower: -lower, end: end === undefined ? undefined : -end }];
}
// Side on, the two sides do the same thing a few degrees apart -- enough to
// read as a body with depth rather than a single stick.
function sideArms(upper: number, lower: number, end?: number): [Limb, Limb] {
  return [{ upper, lower, end }, { upper: upper + 5, lower: lower + 5, end: end === undefined ? undefined : end + 5 }];
}
function sideLegs(upper: number, lower: number, end?: number): [Limb, Limb] {
  return [{ upper, lower, end }, { upper: upper + 5, lower: lower + 5, end: end === undefined ? undefined : end + 5 }];
}

// Where a limb hangs from, given the trunk. Authoring needs these because a
// planted foot is planted relative to the world, not to the hip that moves.
function hipAt(pelvis: Point, torso: number, side: 0 | 1, view: View): Point {
  if (view === "front") return step(pelvis, torso + (side === 0 ? 90 : -90), P.hipHalf);
  // Side-view depth is horizontal (see build): both hips at one height, so a
  // stance pair solves both legs to the same angles.
  return { x: pelvis.x + (side === 0 ? 1 : -1) * (SIDE_DEPTH / ASPECT), y: pelvis.y };
}
function shoulderAt(pelvis: Point, torso: number, side: 0 | 1, view: View): Point {
  const mid = step(pelvis, torso, P.spine);
  if (view === "front") return step(mid, torso + (side === 0 ? 90 : -90), P.shoulderHalf);
  return { x: mid.x + (side === 0 ? 1 : -1) * (SIDE_DEPTH / ASPECT), y: mid.y };
}

// Two-link inverse kinematics: the joint angles that put the end of a limb on a
// target. This is the whole reason the rebuild is tractable -- "the foot stays
// here while the hips drop" is one line instead of two angles solved by hand
// per frame, and hand-solving them is where every geometry bug so far came
// from. `bend` picks which way the middle joint breaks: +1 clockwise on screen.
function reach(from: Point, to: Point, upperLen: number, lowerLen: number, bend: 1 | -1): Limb {
  const dx = (to.x - from.x) * ASPECT;
  const dy = to.y - from.y;
  const span = Math.hypot(dx, dy);
  const total = upperLen + lowerLen;
  // Loud, not clamped. A target further away than the limb is long is an
  // authoring mistake, and clamping it silently straightens the limb and
  // leaves whatever was meant to be held floating out of reach -- which is
  // exactly what a barbell did in the first draft of this rebuild.
  if (span > total * 1.01) {
    throw new Error(
      `pose: cannot reach (${to.x.toFixed(3)}, ${to.y.toFixed(3)}) from ` +
        `(${from.x.toFixed(3)}, ${from.y.toFixed(3)}) -- needs ${span.toFixed(3)}, limb is ${total.toFixed(3)}`,
    );
  }
  // A limb within one percent of full stretch draws straight. Two-link IK
  // turns a small shortfall into a large fold -- at 99% reach the solved knee
  // is still bent twelve degrees, and a standing figure looked crouched. A
  // person at that distance locks the joint; so does the figure. The end lands
  // within 0.005 of the target, under every tolerance the checks use.
  if (span >= total * 0.99) {
    const straight = ((Math.atan2(dx, -dy) * 180) / Math.PI);
    return { upper: straight, lower: straight };
  }
  const dist = Math.max(span, 1e-6);
  const deg = (radians: number) => (radians * 180) / Math.PI;
  const straight = deg(Math.atan2(dx, -dy));
  const cosine = (upperLen * upperLen + dist * dist - lowerLen * lowerLen) / (2 * upperLen * dist);
  const upper = straight + bend * deg(Math.acos(Math.max(-1, Math.min(1, cosine))));
  const joint = step(from, upper, upperLen);
  const lower = deg(Math.atan2((to.x - joint.x) * ASPECT, joint.y - to.y));
  return { upper, lower };
}

// Both legs reaching planted feet. The commonest thing a movement needs to say.
// A STANCE PAIR is the same contact point drawn twice, a girdle's depth
// apart. Solving the far side against its own slightly-off joint makes its
// span come out shorter, and two-link IK amplifies the shortfall -- the far
// knee folded rubbery while the near one stayed straight, in every deadlift
// and push-up. When two side-view targets are only the depth convention
// apart, the far one slides along its own height until the spans match, so
// both limbs solve to the same shape and the far foot stays on its floor.
// Genuinely different targets (a lunge's front and back foot) pass through.
function equalizedPair(a0: Point, a1: Point, targets: [Point, Point], view: View): [Point, Point] {
  if (view !== "side") return targets;
  const [t0, t1] = targets;
  if (Math.abs(t0.x - t1.x) > 0.022 || Math.abs(t0.y - t1.y) > 0.015) return targets;
  const dx0 = (t0.x - a0.x) * ASPECT;
  const dy0 = t0.y - a0.y;
  const span = Math.hypot(dx0, dy0);
  const dy1 = t1.y - a1.y;
  const dx1 = Math.sqrt(Math.max(span * span - dy1 * dy1, 0)) * Math.sign(dx0 || 1);
  return [t0, { x: a1.x + dx1 / ASPECT, y: t1.y }];
}

function plantedLegs(
  pelvis: Point,
  torso: number,
  view: View,
  feet: [Point, Point],
  bend: [1 | -1, 1 | -1],
  ends?: [number, number],
): [Limb, Limb] {
  // Unless the pose says otherwise, a planted side-view foot lies flat on the
  // ground -- a world angle, not a shin-relative one.
  const flat: [number, number] | undefined = ends ?? (view === "side" ? [88, 92] : undefined);
  const hips = [0, 1].map((side) => hipAt(pelvis, torso, side as 0 | 1, view)) as [Point, Point];
  const targets = equalizedPair(hips[0], hips[1], feet, view);
  return [0, 1].map((side) => ({
    ...reach(hips[side]!, targets[side]!, P.thigh, P.shin, bend[side]!),
    ...(flat ? { end: flat[side] } : {}),
  })) as [Limb, Limb];
}

// Both arms reaching a held object -- a bar, a handle, the ground.
function reachingArms(
  pelvis: Point,
  torso: number,
  view: View,
  hands: [Point, Point],
  bend: [1 | -1, 1 | -1],
  ends?: [number, number],
): [Limb, Limb] {
  const shoulders = [0, 1].map((side) => shoulderAt(pelvis, torso, side as 0 | 1, view)) as [Point, Point];
  const targets = equalizedPair(shoulders[0], shoulders[1], hands, view);
  return [0, 1].map((side) => ({
    ...reach(shoulders[side]!, targets[side]!, P.upperArm, P.forearm, bend[side]!),
    ...(ends ? { end: ends[side] } : {}),
  })) as [Limb, Limb];
}

// Two hands on a bar, spread either side of a centre point.
function grip(centre: Point, halfWidth: number, view: View): [Point, Point] {
  const dx = view === "front" ? halfWidth / ASPECT : SIDE_DEPTH / ASPECT;
  return [{ x: centre.x + dx, y: centre.y }, { x: centre.x - dx, y: centre.y }];
}

const STAND: Point = { x: 0.5, y: 0.52 };

// Base of the neck: where a bar sits for a back squat and where the arms hang
// from before the girdle spreads them.
function spineTop(pelvis: Point, torso: number): Point {
  return step(pelvis, torso, P.spine);
}

export {
  pose, bothArms, bothLegs, sideArms, sideLegs, STAND, P, ASPECT,
  hipAt, shoulderAt, spineTop, reach, plantedLegs, reachingArms, grip, step as along,
};
export type { Figure, Limb, Point, View };
