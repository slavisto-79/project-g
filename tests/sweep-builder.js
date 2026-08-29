// Every answer combination that reaches the session builder, through the
// builder, checking what the user would actually be shown.
//
// The axes the builder provably never reads -- age, height, activity, dietPace,
// goalWeight, duration -- are exhausted by sweep-derived.js instead; including
// them here would multiply the run by 400 without changing a single session.
const fs = require("fs");
const ts = require("typescript");
const { load } = require("./extract.js");

function mod(p) {
  const js = ts.transpileModule(fs.readFileSync(p, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const m = { exports: {} };
  new Function("exports", "module", "require", js)(m.exports, m, require);
  return m.exports;
}
const lib = mod("lib/exerciseLibrary.ts");
const pb = mod("lib/programBuilder.ts");
const poses = mod("lib/poses.ts");

// Symbols imported from lib/ are not declared in App.tsx, so they are supplied
// from the real modules rather than stubbed.
const { api, pulled } = load("App.tsx", ["buildProgramFromLibrary"], {
  createElement: () => null,
  require: () => 0,
  exercisesForTier: lib.exercisesForTier,
  suitsGoal: lib.suitsGoal,
  splitDaySlots: pb.splitDaySlots,
  splitDaySpineLength: pb.splitDaySpineLength,
  suitsBodyweightCapability: pb.suitsBodyweightCapability,
  // exerciseMedia.ts require()s .mp4 and .jpg assets, which Node cannot load.
  // Stubbed to "no footage" -- this sweep checks weights, reps and labels, not
  // which exercises have a demo.
  // Pure data with no asset requires, so the real module is used.
  exercisePoses: poses.exercisePoses,
  shippedMediaFor: () => null,
});
console.log(`harness built from ${pulled} declarations lifted out of App.tsx`);
const build = api.buildProgramFromLibrary;

const byName = new Map();
for (const t of ["gym", "home-gym", "minimal", "bodyweight", "bars"])
  for (const e of lib.exercisesForTier(t)) byName.set(e.name, e);

const AXES = {
  sex: ["female", "male"],
  weight: ["40", "75", "150"],
  goal: ["muscle", "fat-loss", "strength", "fitness", "athletic"],
  experience: ["beginner", "novice", "intermediate", "advanced"],
  recentTraining: ["consistent", "patchy", "returning"],
  frequency: ["2", "3", "4", "5"],
  equipment: ["gym", "home-gym", "minimal", "bodyweight", "bars"],
  bodyweightStrength: ["both", "pushups", "neither"],
  limitations: ["none", "shoulder", "back", "knee", "other"],
  day: ["full-body", "push", "pull", "legs", "upper", "lower"],
  session: [0, 1, 2],
  block: [0, 1, 2],
};
const keys = Object.keys(AXES);
const total = keys.reduce((n, k) => n * AXES[k].length, 1);
console.log(`${total.toLocaleString()} sessions to build\n`);

const FLAG = { knee: "kneeSafe", shoulder: "shoulderSafe", back: "backSafe" };
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
const started = Date.now();

for (;;) {
  for (let i = 0; i < keys.length; i++) profile[keys[i]] = AXES[keys[i]][idx[i]];
  const day = profile.day;
  const session = Number(profile.session);
  const block = Number(profile.block);

  const built = build(profile, day, {}, false, 1, session, block);
  const slots = pb.splitDaySlots(day, profile.goal).length;

  if (built.length < 4) flag("session shorter than four exercises", profile, built.length);
  if (built.length < slots) flag("slot left unfilled", profile, `${built.length}/${slots}`);
  if (new Set(built.map((e) => e.name)).size !== built.length) flag("exercise repeated within a session", profile, built.map((e) => e.name).join(","));

  for (const item of built) {
    const e = byName.get(item.name);
    if (!e) { flag("exercise not in the library", profile, item.name); continue; }

    if (profile.limitations !== "none" && profile.limitations !== "other") {
      if (!e.injurySafe[FLAG[profile.limitations]]) flag(`unsafe for a stated ${profile.limitations} limitation`, profile, item.name);
    }
    if (!pb.suitsBodyweightCapability(item.name, profile.bodyweightStrength))
      flag("breaks the pull-up / push-up capability rule", profile, item.name);

    // What the screen renders.
    const w = item.weight;
    if (typeof w !== "string" || w.length === 0 || /NaN|undefined|Infinity/.test(w))
      flag("weight string unusable", profile, `${item.name}: ${w}`);
    if (w !== "Bodyweight" && !/^\d+(\.\d+)?\s*kg$/.test(w))
      flag("weight neither a number nor Bodyweight", profile, `${item.name}: ${w}`);
    if (w !== "Bodyweight" && !(parseFloat(w) > 0)) flag("loaded exercise with a non-positive weight", profile, `${item.name}: ${w}`);

    const reps = parseInt(item.reps, 10);
    if (!Number.isFinite(reps) || reps < 1 || reps > 120) flag("reps out of range", profile, `${item.name}: ${item.reps}`);
    if (item.repsHigh !== undefined) {
      const hi = parseInt(item.repsHigh, 10);
      if (!Number.isFinite(hi) || hi <= reps) flag("rep range top not above the working target", profile, `${item.name}: ${item.reps}-${item.repsHigh}`);
    }
    if (!item.target || /NaN|undefined/.test(item.target)) flag("target label unusable", profile, `${item.name}: ${item.target}`);
    if (!Array.isArray(item.phases) || item.phases.length === 0) flag("no phases", profile, item.name);
  }

  done++;
  if (done % 1000000 === 0) console.log(`  ...${(done / 1e6).toFixed(0)}M`);
  let i = keys.length - 1;
  while (i >= 0 && ++idx[i] === AXES[keys[i]].length) { idx[i] = 0; i--; }
  if (i < 0) break;
}

console.log(`\nbuilt ${done.toLocaleString()} sessions in ${((Date.now() - started) / 1000).toFixed(0)}s\n`);
if (problems.size === 0) console.log("no problem in any session");
else for (const [what, p] of problems) {
  console.log(`FAIL  ${what}`);
  console.log(`      ${p.count.toLocaleString()} sessions, e.g. ${p.example.detail}`);
  console.log(`      ${JSON.stringify(p.example.profile)}`);
}
process.exit(problems.size ? 1 : 0);
