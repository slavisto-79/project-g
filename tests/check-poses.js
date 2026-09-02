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
  // Calf raises genuinely travel less than anything else here; the seated
  // one moves only the ankle, on purpose.
  const floor = { calfRaise: 0.09, seatedCalfRaise: 0.04 }[name] ?? 0.12;
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
  squat: 0, frontSquat: 0, gobletSquat: 0, bodyweightSquat: 0, goodMorning: 0,
  hinge: 0, singleLegHinge: 0, curl: 0, frontRaise: 0,
  overheadPress: 0, pulldown: 0, lateralRaise: 0, fly: 0,
  tricepsExtension: 0, jump: 0, lateralLunge: 0, clean: 4,
  straightArmPulldown: 0, facePull: 0, landminePress: 0, burpee: 1,
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

// Joints obey anatomy. Two rules on the 3D frames, both born from a review
// where knees folded backward and elbows flipped their hinge mid-rep:
//  1. A knee or elbow may not FLIP its fold side between ADJACENT key
//     positions while strongly bent on both -- the interpolation would carry
//     the joint through hyperextension. (A flip across a near-straight
//     middle frame is a legitimate swing.)
//  2. Where the foot is dorsiflexed-ish (shin-to-foot under 100 degrees, so
//     the toes reliably mark the leg's front), the knee vertex must deviate
//     from the hip-ankle line TOWARD the toe side -- knees break over the
//     toes, never away from them. Plantarflexed feet make the toes swing
//     behind the shin, so the rule stands down there instead of guessing.
{
  const V = (a, b) => [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const crossX = (u, v) => u[1] * v[2] - u[2] * v[1];
  const angleDeg = (u, v) => {
    const dot = u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
    const m = Math.hypot(...u) * Math.hypot(...v) || 1;
    return (Math.acos(Math.max(-1, Math.min(1, dot / m))) * 180) / Math.PI;
  };
  for (const [name, pose] of Object.entries(exercisePoses)) {
    for (const [upperPart, lowerPart, endPart, label] of [
      ["thigh", "shin", "foot", "knee"],
      ["upperArm", "forearm", "hand", "elbow"],
    ]) {
      for (const side of [0, 1]) {
        let prev = null;
        pose.frames3d.forEach((f, fi) => {
          const up = f.bones.find((b) => b.part === upperPart && b.side === side);
          const lo = f.bones.find((b) => b.part === lowerPart && b.side === side);
          const en = f.bones.find((b) => b.part === endPart && b.side === side);
          if (!up || !lo) return;
          const T = V(up.a, up.b), S = V(lo.a, lo.b);
          const bend = angleDeg(T, S);
          const sign = Math.sign(crossX(T, S));
          if (bend > 25) {
            if (prev && prev.sign !== sign) {
              note(`${name} ${label}${side}: fold side flips between frames ${prev.fi} and ${fi} (${prev.bend}deg vs ${bend.toFixed(0)}deg) -- the joint hinges the other way mid-rep`);
            }
            prev = { fi, sign, bend: bend.toFixed(0) };
          } else if (bend < 12) {
            prev = null; // a near-straight frame resets the hinge reference
          }
          if (label === "knee" && en && bend > 14) {
            const F = V(en.a, en.b);
            if (angleDeg(S, F) < 100 && Math.abs(crossX(S, F)) > 0.02) {
              const HA = V(up.a, lo.b), HK = T;
              if (Math.hypot(...HA) > 0.15 && Math.sign(crossX(HA, HK)) !== Math.sign(crossX(S, F))) {
                note(`${name}[${fi}] knee${side}: bends ${bend.toFixed(0)}deg away from the toe side -- a backward knee`);
              }
            }
          }
        });
      }
    }
  }
}

// A bar must never pass through a leg -- in the gym the bar does not go
// through you. The bar runs along X at one (y, z); a leg bone whose YZ
// distance to that point is smaller than the two radii is being skewered.
// The hip thrust is the one lift where the bar genuinely rests against the
// thighs, so it gets a small allowance instead of an exemption.
const LEG_RADII = { thigh: 0.048, shin: 0.034, foot: 0.02 };
const BAR_RADIUS = 0.011;
for (const [name, pose] of Object.entries(exercisePoses)) {
  const slack = name === "hipThrust" ? 0.03 : 0.008;
  pose.frames3d.forEach((frame, fi) => {
    for (const prop of frame.props) {
      // A leaning (dir) bar does not run along X, which is what this
      // clearance model assumes -- it is checked by eye instead.
      if (prop.kind !== "bar" || prop.rails || prop.dir) continue;
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

// Stance knees move in sync: when both ankles stand together (same height,
// near-equal depth), both legs must hold the same angles -- one straight leg
// beside a folded one is how the squat's far knee drifted out of sync.
const GAITS = new Set(["carry", "run"]); // walking strides are asymmetric on purpose
for (const [name, pose] of Object.entries(exercisePoses)) {
  if (GAITS.has(name)) continue;
  pose.frames3d.forEach((frame, fi) => {
    const th = [0, 1].map((s) => frame.bones.find((b) => b.part === "thigh" && b.side === s));
    const sh = [0, 1].map((s) => frame.bones.find((b) => b.part === "shin" && b.side === s));
    if (!th[0] || !th[1] || !sh[0] || !sh[1]) return;
    const ankles = sh.map((b) => b.b);
    if (Math.abs(ankles[0][1] - ankles[1][1]) > 0.02) return; // different heights: not a stance
    if (Math.abs(ankles[0][2] - ankles[1][2]) > 0.15) return; // staggered: a lunge, a stride
    const ang = (b) => (Math.atan2(b.b[2] - b.a[2], b.b[1] - b.a[1]) * 180) / Math.PI;
    const diff = (x, y) => { const d = Math.abs(x - y) % 360; return Math.min(d, 360 - d); };
    const dTh = diff(ang(th[0]), ang(th[1]));
    const dSh = diff(ang(sh[0]), ang(sh[1]));
    if (dTh > 5.5 || dSh > 5.5) {
      note(`${name}[${fi}]: stance knees out of sync (thigh ${dTh.toFixed(1)}deg apart, shin ${dSh.toFixed(1)}deg)`);
    }
  });
}

// The CATALOG path picks its movement by name. It once hardcoded the back
// squat for every catalog exercise, and no local run ever saw it because the
// catalog API only exists in production -- so the selector is checked here,
// against the code actually in App.tsx.
{
  const src = fs.readFileSync("App.tsx", "utf8");
  const fnStart = src.indexOf("function poseForCatalogExercise");
  const fnEnd = src.indexOf("function catalogExerciseToWorkoutExercise");
  const mapStart = src.indexOf("const POSE_FOR_EXERCISE");
  const mapEnd = src.indexOf("};", mapStart) + 2;
  if (!src.includes("poseForCatalogExercise(tag)")) {
    note("catalog pose selector: catalogExerciseToWorkoutExercise no longer calls it -- a hardcoded pose is how every catalog exercise once demoed as a squat");
  }
  if (fnStart < 0 || fnEnd < 0 || mapStart < 0) {
    note("catalog pose selector: cannot find poseForCatalogExercise/POSE_FOR_EXERCISE in App.tsx");
  } else {
    const code =
      src.slice(mapStart, mapEnd).replace(": Record<string, PoseName>", "") +
      "\n" +
      src.slice(fnStart, fnEnd).replace(": ExerciseTag)", ")").replace(": PoseName | undefined", "");
    const pick = new Function(code + "\nreturn poseForCatalogExercise;")();
    const expect = [
      ["Barbell Squat", "Barbell", "push", "squat"],
      ["Barbell Deadlift", "Barbell", "hinge", "hinge"],
      ["Barbell Bench Press", "Barbell", "push", "bench"],
      ["Dumbbell Curl", "Dumbbells", "pull", "curl"],
      ["Cable Lat Pulldown", "Cable", "pull", "pulldown"],
      ["Push Up", "Bodyweight", "push", "pushUp"],
      ["Machine Leg Press", "Machine", "squat", "legPress"],
      ["Dumbbell Lateral Raise", "Dumbbells", "push", "lateralRaise"],
      ["Rower Pike", "Machine", "pull", "pikePushUp"],
      ["Barbell Z Press", "Barbell", "push", "overheadPress"],
    ];
    for (const [name, equipment, movementPattern, want] of expect) {
      const got = pick({ name, equipment, movementPattern });
      if (got !== want) note("catalog pose selector: " + name + " -> " + got + " (expected " + want + ")");
      else if (!exercisePoses[got]) note("catalog pose selector: " + name + " -> unknown movement " + got);
    }
    // The production bug, verbatim: nothing that is not a squat demos as one.
    for (const [name, mp] of [["Barbell Deadlift", "hinge"], ["Barbell Bench Press", "push"], ["Seated Cable Row", "pull"], ["Standing Military Press", "push"]]) {
      const got = pick({ name, equipment: "Barbell", movementPattern: mp });
      if (got === "squat") note("catalog pose selector: " + name + " demos as a SQUAT -- the production bug is back");
    }
  }
}

console.log(Object.keys(exercisePoses).length + " movements checked");
console.log(problems.length ? problems.join("\n") : "no structural problems");
