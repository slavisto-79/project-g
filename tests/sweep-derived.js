// Every answer combination the interview can produce, against every number the
// app derives from it.
const { load } = require("./extract.js");

const ROOTS = [
  "restingMetabolicRateKcal", "activityMultiplier", "dailyCalorieTargetKcal",
  "dailyProteinTargetGrams", "weeksToGoalWeight", "baseRepRangeForProfile",
  "restSecondsForProfile", "setCountForProfile", "sessionBudgetMinutes",
  "experienceLoadFactor", "estimateSessionCalories", "inferDietMode",
];
const { api, pulled } = load("App.tsx", ROOTS, { createElement: () => null, require: () => 0 });
console.log(`harness built from ${pulled} declarations lifted out of App.tsx\n`);

const AXES = {
  sex: ["female", "male"],
  age: ["16", "45", "90"],
  weight: ["40", "75", "150"],
  height: ["140", "175", "210"],
  goal: ["muscle", "fat-loss", "strength", "fitness", "athletic"],
  goalDelta: [-15, 0, 25],
  dietPace: ["slow", "steady", "fast"],
  experience: ["beginner", "novice", "intermediate", "advanced"],
  recentTraining: ["consistent", "patchy", "returning"],
  frequency: ["2", "3", "4", "5"],
  activity: ["sedentary", "light", "active", "physical"],
  duration: ["30", "45", "60", "75"],
  equipment: ["gym", "home-gym", "minimal", "bodyweight", "bars"],
  bodyweightStrength: ["both", "pushups", "neither"],
  limitations: ["none", "shoulder", "back", "knee", "other"],
};
const keys = Object.keys(AXES);
const total = keys.reduce((n, k) => n * AXES[k].length, 1);
console.log(`${total.toLocaleString()} combinations across ${keys.length} answers`);

const CHECKS = [
  ["resting metabolic rate", (p) => api.restingMetabolicRateKcal(p), 600, 4000],
  ["activity multiplier", (p) => api.activityMultiplier(p), 1.1, 2.0],
  ["daily calorie target", (p) => api.dailyCalorieTargetKcal(p), 1000, 6000],
  ["daily protein target", (p) => api.dailyProteinTargetGrams(p), 40, 400],
  ["rest seconds", (p) => api.restSecondsForProfile(p), 20, 300],
  ["set count", (p) => api.setCountForProfile(p), 1, 8],
  ["session budget minutes", (p) => api.sessionBudgetMinutes(p), 10, 180],
  ["experience load factor", (p) => api.experienceLoadFactor(p), 0.3, 2.0],
];

const problems = new Map();
function flag(what, profile, value) {
  if (!problems.has(what)) problems.set(what, { count: 0, example: null, lo: Infinity, hi: -Infinity });
  const p = problems.get(what);
  p.count++;
  if (typeof value === "number") { p.lo = Math.min(p.lo, value); p.hi = Math.max(p.hi, value); }
  if (!p.example) p.example = { value, profile: { ...profile } };
}

const idx = new Array(keys.length).fill(0);
const profile = {};
let done = 0;
const started = Date.now();

for (;;) {
  for (let i = 0; i < keys.length; i++) profile[keys[i]] = AXES[keys[i]][idx[i]];
  profile.goalWeight = String(Math.min(200, Math.max(40, Number(profile.weight) + profile.goalDelta)));

  for (const [name, fn, lo, hi] of CHECKS) {
    const v = fn(profile);
    if (!Number.isFinite(v) || v < lo || v > hi) flag(`${name} outside ${lo}-${hi}`, profile, v);
  }

  if (api.dailyCalorieTargetKcal(profile) < 1200) flag("calorie floor of 1200 breached", profile, api.dailyCalorieTargetKcal(profile));

  const weeks = api.weeksToGoalWeight(profile);
  if (weeks !== null && (!Number.isFinite(weeks) || weeks <= 0 || weeks > 520))
    flag("weeks-to-goal not a sane positive number", profile, weeks);

  const range = api.baseRepRangeForProfile(profile);
  if (!Number.isFinite(range.low) || !Number.isFinite(range.high) || range.low < 1 || range.high <= range.low || range.high > 40)
    flag("rep range invalid", profile, `${range.low}-${range.high}`);

  const mode = api.inferDietMode(profile);
  if (!["cut", "bulk", "recomp"].includes(mode)) flag("diet mode not one of cut/bulk/recomp", profile, mode);

  const burn = api.estimateSessionCalories(Number(profile.weight), api.sessionBudgetMinutes(profile) * 60);
  if (!Number.isFinite(burn) || burn < 0 || burn > 3000) flag("session calorie estimate implausible", profile, burn);

  done++;
  if (done % 20000000 === 0) console.log(`  ...${(done / 1e6).toFixed(0)}M`);
  let i = keys.length - 1;
  while (i >= 0 && ++idx[i] === AXES[keys[i]].length) { idx[i] = 0; i--; }
  if (i < 0) break;
}

console.log(`\nchecked ${done.toLocaleString()} in ${((Date.now() - started) / 1000).toFixed(0)}s\n`);
if (problems.size === 0) console.log("no invalid derived value in any combination");
else for (const [what, p] of problems) {
  console.log(`FAIL  ${what}`);
  console.log(`      ${p.count.toLocaleString()} combinations, range seen ${p.lo} .. ${p.hi}`);
  console.log(`      e.g. ${JSON.stringify(p.example.value)} for ${JSON.stringify(p.example.profile)}`);
}
process.exit(problems.size ? 1 : 0);
