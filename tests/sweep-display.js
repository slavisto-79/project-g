// The display and history layer: every exercise the library can produce, for
// every profile that changes how it is shown or counted.
//
// This is where the defects in this session actually were -- NaN weights, "1 kg"
// on unloaded work, REPS on a timed hold -- so it is checked directly rather
// than inferred from the builder passing.
const fs = require("fs");
const ts = require("typescript");
const { load } = require("./extract.js");

// lib/ modules are transpiled and evaluated in place rather than required, so
// a relative import between two of them has to be resolved here. Loaded
// modules are cached, so the pose model is built once.
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
const lib = mod("lib/exerciseLibrary.ts");
const pb = mod("lib/programBuilder.ts");
// The movements moved out of poses.ts when the model was rebuilt; this is the
// module that now exports them.
const poses = mod("lib/poseData.ts");

const ROOTS = [
  "buildProgramFromLibrary", "exerciseVolumeKg", "strengthStandingFor",
  "isHoldExercise", "unloadedExerciseWeight", "snapToLoadableWeight",
  "implementForExerciseName", "isPerHandLoad", "volumeComparison", "clockLabel",
];
const { api, pulled } = load("App.tsx", ROOTS, {
  createElement: () => null,
  require: () => 0,
  exercisesForTier: lib.exercisesForTier,
  suitsGoal: lib.suitsGoal,
  splitDaySlots: pb.splitDaySlots,
  splitDaySpineLength: pb.splitDaySpineLength,
  suitsBodyweightCapability: pb.suitsBodyweightCapability,
  // Pure data with no asset requires, so the real module is used.
  exercisePoses: poses.exercisePoses,
  shippedMediaFor: () => null,
});
console.log(`harness built from ${pulled} declarations lifted out of App.tsx\n`);

const AXES = {
  sex: ["female", "male"],
  weight: ["40", "75", "150"],
  goal: ["muscle", "fat-loss", "strength", "fitness", "athletic"],
  experience: ["beginner", "novice", "intermediate", "advanced"],
  recentTraining: ["consistent", "patchy", "returning"],
  frequency: ["2", "5"],
  equipment: ["gym", "home-gym", "minimal", "bodyweight", "bars"],
  bodyweightStrength: ["both", "pushups", "neither"],
  limitations: ["none", "shoulder", "back", "knee"],
  day: ["full-body", "push", "pull", "legs", "upper", "lower"],
  session: [0, 1, 2],
};
const keys = Object.keys(AXES);
console.log(`${keys.reduce((n, k) => n * AXES[k].length, 1).toLocaleString()} sessions\n`);

const problems = new Map();
function flag(what, profile, detail) {
  if (!problems.has(what)) problems.set(what, { count: 0, example: null });
  const p = problems.get(what);
  p.count++;
  if (!p.example) p.example = { detail, profile: { ...profile } };
}

const idx = new Array(keys.length).fill(0);
const profile = { age: "30", height: "175", duration: "60", activity: "light", dietPace: "steady", goalWeight: "75" };
let done = 0;
let totalVolume = 0;
const started = Date.now();

for (;;) {
  for (let i = 0; i < keys.length; i++) profile[keys[i]] = AXES[keys[i]][idx[i]];
  const bodyWeightKg = Number(profile.weight);
  const built = api.buildProgramFromLibrary(profile, profile.day, {}, false, 1, Number(profile.session), 0);

  for (const item of built) {
    const unloaded = api.unloadedExerciseWeight(item);
    const isHold = api.isHoldExercise(item);
    const libEntry = lib.exerciseByName(item.name);

    // A timed movement must be labelled as one, and vice versa.
    if (libEntry && Boolean(libEntry.isHold) !== isHold)
      flag("hold flag disagrees with the library", profile, `${item.name}: library ${!!libEntry.isHold}, screen ${isHold}`);

    // "Bodyweight" and only "Bodyweight" is unloaded.
    if (unloaded !== (item.weight === "Bodyweight"))
      flag("unloaded detection disagrees with the weight string", profile, `${item.name}: ${item.weight}`);

    // The history entry the app would write, and the volume it would count.
    const entry = {
      name: item.name,
      weightKg: unloaded ? null : parseFloat(item.weight),
      reps: parseInt(item.reps, 10),
      sets: 3,
      weightPerHand: item.weightPerHand === true,
      isHold,
      ...(item.repsPerSide ? { repsPerSide: item.repsPerSide } : {}),
    };
    if (entry.weightKg !== null && !(entry.weightKg > 0))
      flag("history would record a non-positive weight", profile, `${item.name}: ${item.weight}`);

    const volume = api.exerciseVolumeKg(entry, bodyWeightKg);
    if (!Number.isFinite(volume) || volume < 0) flag("volume not a non-negative number", profile, `${item.name}: ${volume}`);
    if (volume > 100000) flag("single-exercise volume implausibly large", profile, `${item.name}: ${volume}`);
    totalVolume += volume;

    const standing = api.strengthStandingFor(item.name, entry.weightKg ?? 0, entry.reps, bodyWeightKg, profile.sex);
    if (standing) {
      if (!Number.isFinite(standing.percentile) || standing.percentile < 0 || standing.percentile > 95)
        flag("strength percentile outside 0-95", profile, `${item.name}: ${standing.percentile}`);
      if (!["Beginner", "Novice", "Intermediate", "Advanced"].includes(standing.level))
        flag("strength level not one of the four bands", profile, `${item.name}: ${standing.level}`);
      if (unloaded) flag("unloaded exercise given a strength rating", profile, item.name);
    }

    const snapped = api.snapToLoadableWeight(entry.weightKg ?? 0, api.implementForExerciseName(item.name));
    if (!Number.isFinite(snapped) || snapped < 0) flag("weight snapping produced a bad number", profile, `${item.name}: ${snapped}`);
  }

  const comparison = api.volumeComparison(Math.round(totalVolume) % 500000);
  if (comparison !== null && (typeof comparison !== "string" || /NaN|undefined/.test(comparison)))
    flag("volume comparison string unusable", profile, String(comparison));

  done++;
  let i = keys.length - 1;
  while (i >= 0 && ++idx[i] === AXES[keys[i]].length) { idx[i] = 0; i--; }
  if (i < 0) break;
}

// The clock, over every second a rest timer or session timer can show.
for (let s = -5; s <= 7200; s++) {
  const label = api.clockLabel(s);
  if (!/^\d+:[0-5]\d$/.test(label)) flag("clock label malformed", { seconds: s }, `${s} -> ${label}`);
}

console.log(`checked ${done.toLocaleString()} sessions and 7206 clock values in ${((Date.now() - started) / 1000).toFixed(0)}s\n`);
if (problems.size === 0) console.log("no problem in any of them");
else for (const [what, p] of problems) {
  console.log(`FAIL  ${what}`);
  console.log(`      ${p.count.toLocaleString()} occurrences, e.g. ${p.example.detail}`);
  console.log(`      ${JSON.stringify(p.example.profile)}`);
}
process.exit(problems.size ? 1 : 0);
