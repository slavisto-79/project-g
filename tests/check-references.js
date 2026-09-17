// The reference-clip database, checked and written out.
//
// lib/referenceClips.ts records, per pose, the video each animation was
// authored against. This joins it with App.tsx's POSE_FOR_EXERCISE and the
// exercise library into docs/reference-clips.md -- one line for every
// library exercise: the clip it was corrected against, the pose it shares
// with the exercise the clip actually shows, or "no clip yet". It fails on
// an entry that names a pose or an exercise that does not exist, an
// exercise not mapped to the pose it is listed under, or a malformed id.
//
//   npm run check:references          (run from the repo root)
const fs = require("fs");
const { load, lib } = require("./extract.js");

const { exercisePoses } = lib("lib/poseData.ts");
const { exerciseLibrary } = lib("lib/exerciseLibrary.ts");
const { REFERENCE_CLIPS } = lib("lib/referenceClips.ts");
const { POSE_FOR_EXERCISE } = load("App.tsx", ["POSE_FOR_EXERCISE"]).api;

const problems = [];
const note = (s) => problems.push(s);

const poseNames = new Set(Object.keys(exercisePoses));
const libraryNames = new Set(exerciseLibrary.map((e) => e.name));

for (const [pose, clip] of Object.entries(REFERENCE_CLIPS)) {
  if (!poseNames.has(pose)) note(`${pose}: not a pose in lib/poseData.ts`);
  if (!/^[A-Za-z0-9_-]{11}$/.test(clip.videoId)) note(`${pose}: video id "${clip.videoId}" is not a YouTube id`);
  for (const k of ["title", "channel", "view", "span", "date"]) {
    if (!clip[k]) note(`${pose}: missing ${k}`);
  }
  if (!Array.isArray(clip.prs) || !clip.prs.length) note(`${pose}: no pull request listed`);
  if (!Array.isArray(clip.exercises) || !clip.exercises.length) note(`${pose}: no exercise listed as shown by the clip`);
  for (const ex of clip.exercises ?? []) {
    if (!libraryNames.has(ex)) note(`${pose}: "${ex}" is not a library exercise`);
    else if (POSE_FOR_EXERCISE[ex] !== pose) note(`${pose}: "${ex}" is mapped to ${POSE_FOR_EXERCISE[ex] ?? "no pose"}, not to ${pose}`);
  }
  for (const c of clip.confirmations ?? []) {
    const tag = `${pose} confirmation "${c.exercise}"`;
    if (!libraryNames.has(c.exercise)) note(`${tag}: not a library exercise`);
    else if (POSE_FOR_EXERCISE[c.exercise] !== pose) note(`${tag}: mapped to ${POSE_FOR_EXERCISE[c.exercise] ?? "no pose"}, not to ${pose}`);
    if ((clip.exercises ?? []).includes(c.exercise)) note(`${tag}: already listed as shown by the pose's own clip`);
    if (!/^[A-Za-z0-9_-]{11}$/.test(c.videoId)) note(`${tag}: video id "${c.videoId}" is not a YouTube id`);
    for (const k of ["title", "channel", "view", "span", "date"]) {
      if (!c[k]) note(`${tag}: missing ${k}`);
    }
    if (!Array.isArray(c.prs) || !c.prs.length) note(`${tag}: no pull request listed`);
  }
  for (const s of clip.secondClips ?? []) {
    const tag = `${pose} second clip "${s.videoId}"`;
    if (!/^[A-Za-z0-9_-]{11}$/.test(s.videoId)) note(`${tag}: not a YouTube id`);
    if (s.videoId === clip.videoId) note(`${tag}: is the pose's own clip`);
    for (const k of ["title", "channel", "view", "span", "date", "read"]) {
      if (!s[k]) note(`${tag}: missing ${k}`);
    }
    if (!Array.isArray(s.prs) || !s.prs.length) note(`${tag}: no pull request listed`);
  }
}
for (const [ex, pose] of Object.entries(POSE_FOR_EXERCISE)) {
  if (!poseNames.has(pose)) note(`App.tsx maps "${ex}" to ${pose}, which is not a pose`);
}

// --- The document -----------------------------------------------------------
const url = (clip) => `https://www.youtube.com/watch?v=${clip.videoId}`;
const rows = [];
let authored = 0, confirmed = 0, shared = 0, none = 0;
for (const ex of exerciseLibrary.map((e) => e.name).sort((a, b) => a.localeCompare(b))) {
  const pose = POSE_FOR_EXERCISE[ex];
  const clip = pose ? REFERENCE_CLIPS[pose] : undefined;
  const confirmation = clip && (clip.confirmations ?? []).find((c) => c.exercise === ex);
  let status, clipCell, prCell;
  if (!pose) {
    status = "no pose"; clipCell = ""; prCell = "";
    none++;
  } else if (!clip) {
    status = "no clip yet"; clipCell = ""; prCell = "";
    none++;
  } else if (clip.exercises.includes(ex)) {
    status = "authored from the clip"; authored++;
    clipCell = `[${clip.title}](${url(clip)}) (${clip.channel}, ${clip.view})`;
    prCell = clip.prs.map((n) => `#${n}`).join(", ");
  } else if (confirmation) {
    status = `shares \`${pose}\`, confirmed against its own clip`; confirmed++;
    clipCell = `[${confirmation.title}](${url(confirmation)}) (${confirmation.channel}, ${confirmation.view})`;
    prCell = confirmation.prs.map((n) => `#${n}`).join(", ");
  } else {
    status = `shares \`${pose}\` (the clip shows ${clip.exercises.join(", ")})`; shared++;
    clipCell = `[${clip.title}](${url(clip)}) (${clip.channel}, ${clip.view})`;
    prCell = clip.prs.map((n) => `#${n}`).join(", ");
  }
  rows.push(`| ${ex} | ${pose ? "`" + pose + "`" : ""} | ${status} | ${clipCell} | ${prCell} |`);
}

const posesWithClip = Object.keys(REFERENCE_CLIPS).filter((p) => poseNames.has(p));
const posesWithout = [...poseNames].filter((p) => !REFERENCE_CLIPS[p]).sort();
const usedPoses = new Set(Object.values(POSE_FOR_EXERCISE));

const clipRows = Object.entries(REFERENCE_CLIPS)
  .sort((a, b) => Math.min(...a[1].prs) - Math.min(...b[1].prs))
  .map(([pose, c]) =>
    `| \`${pose}\` | [${c.title}](${url(c)}) | ${c.channel} | ${c.view} | ${c.span} | ${c.prs.map((n) => `#${n}`).join(", ")} | ${c.date} | ${c.exercises.join(", ")} | ${(c.secondClips ?? []).map((s) => `[${s.title}](${url(s)}) (${s.channel}, ${s.view}, ${s.prs.map((n) => `#${n}`).join(", ")}): ${s.read}`).join("; ")} | ${c.notes ?? ""} |`,
  );
const secondClips = Object.values(REFERENCE_CLIPS).reduce((n, c) => n + (c.secondClips ?? []).length, 0);

const doc = `# Reference clips

Generated by \`npm run check:references\` from \`lib/referenceClips.ts\` (the
clips, per pose) and \`App.tsx\`'s \`POSE_FOR_EXERCISE\` (which exercises use
which pose). Do not edit by hand; edit the source and rerun. The method the
clips are used with is \`docs/animation-from-clip.md\`.

## Summary

| | |
|---|---|
| library exercises | ${exerciseLibrary.length} |
| authored from a clip (the clip shows the exercise) | ${authored} |
| sharing a pose, confirmed against a clip of its own | ${confirmed} |
| sharing a pose that was authored from a clip, unconfirmed | ${shared} |
| without a clip yet | ${none} |
| poses with a clip | ${posesWithClip.length} of ${poseNames.size} (${usedPoses.size} in use) |
| second clips, read for what the first could not settle | ${secondClips} |

Poses without a clip yet: ${posesWithout.map((p) => `\`${p}\``).join(", ")}.

## Every exercise

| Exercise | Pose | Status | Clip | PR |
|---|---|---|---|---|
${rows.join("\n")}

## Every clip

| Pose | Clip | Channel | View | Measured | PR | Merged | Shows | Second clip | Notes |
|---|---|---|---|---|---|---|---|---|---|
${clipRows.join("\n")}
`;

if (problems.length) {
  console.error("reference clips: " + problems.length + " problem(s)");
  for (const p of problems) console.error("  " + p);
  process.exit(1);
}
fs.writeFileSync("docs/reference-clips.md", doc);
console.log(`${exerciseLibrary.length} exercises: ${authored} authored from a clip, ${confirmed} sharing a pose confirmed by their own clip, ${shared} sharing an authored pose unconfirmed, ${none} without a clip`);
console.log(`${posesWithClip.length} of ${poseNames.size} poses have a clip, ${secondClips} second clips; docs/reference-clips.md written`);
