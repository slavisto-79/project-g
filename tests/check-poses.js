// Structural checks on the movement data. Every rule here exists because it
// caught something; they run before anything ships.
const fs = require("fs");
const ts = require("typescript");

// The movement data is TypeScript, so it is transpiled and evaluated here the
// same way the sweeps do it.
const loaded = new Map();
function mod(p) {
  if (loaded.has(p)) return loaded.get(p);
  const js = ts.transpileModule(fs.readFileSync(p, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const m = { exports: {} };
  loaded.set(p, m.exports);
  const resolve = (name) => (name.startsWith("./") ? mod("lib/" + name.slice(2) + ".ts") : require(name));
  new Function("exports", "module", "require", js)(m.exports, m, resolve);
  loaded.set(p, m.exports);
  return m.exports;
}
const { exercisePoses } = mod("lib/poseData.ts");
const ASPECT = 850 / 567;
const P = { thigh: 0.225, shin: 0.215, upperArm: 0.152, forearm: 0.138, spine: 0.245 };

const problems = [];
const note = (m) => problems.push(m);

for (const [name, pose] of Object.entries(exercisePoses)) {
  const frames = pose.frames;
  if (frames.length < 2) note(`${name}: only ${frames.length} key position`);

  const shapes = new Set(frames.map((f) => f.segments.length + ":" + f.props.map((p) => p.kind).join(",")));
  if (shapes.size !== 1) note(`${name}: key positions disagree on how many parts there are`);

  frames.forEach((f, i) => {
    const where = `${name}[${i}]`;
    const nums = f.segments.flatMap((s) => [s.x1, s.y1, s.x2, s.y2]).concat([f.head.x, f.head.y, f.head.r]);
    if (nums.some((n) => !Number.isFinite(n))) note(`${where}: non-finite coordinate`);

    // Bone lengths must match the fixed proportions: a limb that grew or shrank
    // means an angle was written where a solved position was meant.
    const lens = f.segments.map((s) => Math.hypot((s.x2 - s.x1) * ASPECT, s.y2 - s.y1));
    const spine = lens[0];
    if (Math.abs(spine - P.spine) > 0.02 && f.segments.length > 6) {
      // Front views draw a trunk box first, so segment 0 is the shoulder line.
      const box = lens.slice(0, 4).some((l) => Math.abs(l - P.spine) < 0.02);
      if (!box) note(`${where}: first bone is ${spine.toFixed(3)}, expected a trunk`);
    }

    const ys = f.segments.flatMap((s) => [s.y1, s.y2]);
    const floor = f.props.find((p) => p.kind === "floor");
    if (floor) {
      const deepest = Math.max(...ys) - floor.y;
      if (deepest > 0.014) note(`${where}: sinks ${deepest.toFixed(3)} through the floor`);
      // A seated machine holds the whole body off the floor on purpose.
      if (-deepest > 0.16 && name !== "legExtension") note(`${where}: floats ${(-deepest).toFixed(3)} above the floor`);
    }
  });

  // A floor that slides between key positions reads as the world moving.
  const floors = frames.map((f) => f.props.find((p) => p.kind === "floor")?.y).filter((y) => y !== undefined);
  if (floors.length > 1 && Math.max(...floors) - Math.min(...floors) > 0.015 && name !== "calfRaise") {
    note(`${name}: floor drifts ${(Math.max(...floors) - Math.min(...floors)).toFixed(3)}`);
  }

  // Two key positions that are the same are a still frame sold as motion.
  for (let i = 1; i < frames.length; i++) {
    const a = JSON.stringify(frames[i - 1].segments), b = JSON.stringify(frames[i].segments);
    if (a === b) note(`${name}: key positions ${i - 1} and ${i} are identical`);
  }

  // How far the figure actually travels. A movement whose extremes barely
  // differ is showing a partial range, which is the complaint that started
  // this rebuild. Holds are allowed to be still.
  const HOLDS = new Set(["plank", "sidePlank", "wallSit", "carry", "quadruped", "hollowHold"]);
  const travel = Math.max(
    ...frames[0].segments.map((s, i) => {
      const t = frames[frames.length - 1].segments[i];
      return Math.max(Math.hypot((t.x1 - s.x1) * ASPECT, t.y1 - s.y1), Math.hypot((t.x2 - s.x2) * ASPECT, t.y2 - s.y2));
    }),
  );
  // A calf raise genuinely travels less than anything else here.
  const floor = name === "calfRaise" ? 0.09 : 0.12;
  if (!HOLDS.has(name) && travel < floor) note(`${name}: widest joint moves only ${travel.toFixed(3)} -- partial range`);

  // Union proportions: a lying figure fitted into a square card is small, but
  // one wider than about 3.4:1 becomes a smear.
  const all = frames.flatMap((f) => f.segments);
  const W = (Math.max(...all.map((s) => Math.max(s.x1, s.x2))) - Math.min(...all.map((s) => Math.min(s.x1, s.x2)))) * 850;
  const H = (Math.max(...all.map((s) => Math.max(s.y1, s.y2))) - Math.min(...all.map((s) => Math.min(s.y1, s.y2)))) * 567;
  if (W / H > 3.4) note(`${name}: lying flat at ${(W / H).toFixed(1)}:1 wide`);
}

// A standing figure must stand with straight knees. Two-link IK turns a small
// reach shortfall into a large fold -- the first 3D render stood in a
// 40-degree crouch -- so the straight-leg band in reach() plus these frames
// staying inside it is load-bearing, and this assertion keeps it that way.
const STANDING_FRAMES = {
  squat: 0, hinge: 0, singleLegHinge: 0, curl: 0, frontRaise: 0,
  overheadPress: 0, pulldown: 0, lateralRaise: 0, fly: 0,
  tricepsExtension: 0, jump: 0, lateralLunge: 0, clean: 4,
};
function kneeBend(frame, side) {
  const bones = frame.bones.filter((b) => b.part === "thigh" || b.part === "shin");
  const th = bones[side * 2], sh = bones[side * 2 + 1];
  const v1 = [th.a[0] - th.b[0], th.a[1] - th.b[1], th.a[2] - th.b[2]];
  const v2 = [sh.b[0] - sh.a[0], sh.b[1] - sh.a[1], sh.b[2] - sh.a[2]];
  const dot = v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
  const mag = Math.hypot(...v1) * Math.hypot(...v2);
  return 180 - (Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180) / Math.PI;
}
for (const [name, idx] of Object.entries(STANDING_FRAMES)) {
  const frame = exercisePoses[name].frames3d[idx];
  const sides = name === "singleLegHinge" ? [0] : [0, 1];
  for (const side of sides) {
    const bendDeg = kneeBend(frame, side);
    if (bendDeg > 4) note(name + "[" + idx + "]: standing knee bent " + bendDeg.toFixed(1) + " degrees");
  }
}

// A bar must never pass through a leg -- in the gym the bar does not go
// through you. The bar runs along X at one (y, z); a leg bone whose YZ
// distance to that point is smaller than the two radii is being skewered.
// The hip thrust is the one lift where the bar genuinely rests against the
// thighs, so it gets a small allowance instead of an exemption.
const LEG_RADII = { thigh: 0.032, shin: 0.026, foot: 0.02 };
const BAR_RADIUS = 0.011;
for (const [name, pose] of Object.entries(exercisePoses)) {
  const slack = name === "hipThrust" ? 0.03 : 0.008;
  pose.frames3d.forEach((frame, fi) => {
    for (const prop of frame.props) {
      if (prop.kind !== "bar" || prop.rails) continue;
      for (const bone of frame.bones) {
        const legR = LEG_RADII[bone.part];
        if (!legR) continue;
        // Closest approach in the YZ plane between the bar point and the bone.
        const ay = bone.a[1] - prop.center[1], az = bone.a[2] - prop.center[2];
        const by = bone.b[1] - prop.center[1], bz = bone.b[2] - prop.center[2];
        const dy = by - ay, dz = bz - az;
        const len2 = dy * dy + dz * dz;
        const t = len2 > 0 ? Math.max(0, Math.min(1, -(ay * dy + az * dz) / len2)) : 0;
        const dist = Math.hypot(ay + t * dy, az + t * dz);
        const clash = legR + BAR_RADIUS - dist;
        if (clash > slack) note(name + "[" + fi + "]: bar passes through a " + bone.part + " by " + clash.toFixed(3));
      }
    }
  });
}

console.log(Object.keys(exercisePoses).length + " movements checked");
console.log(problems.length ? problems.join("\n") : "no structural problems");
