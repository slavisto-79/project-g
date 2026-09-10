# Authoring a movement from a reference clip

How an exercise animation is made to match a video of the real lift: what
to pick, what to measure, what to change, what to check. This is the
method used for the back squat (#254), trap bar deadlift (#255, #256) and
bench press (#257, #258); it exists so the next batch starts from the
same rules, not from memory.

## 1. Picking the clip

A usable clip has, in this order of importance:

1. **One lifter, full body in frame, doing the real lift** — not a
   talking-head tutorial with cutaways.
2. **A static camera.** Any pan or zoom makes the tempo unreadable.
3. **A square side view** (the lifter's right or left side to the camera)
   for anything sagittal — squats, hinges, presses, rows, curls. A
   three-quarter view is readable but every angle read from it is a
   projection: say so, and treat it as ±5°. A view from the foot or head
   end (bench press clips love this) gives tempo and grip width but not
   trunk or leg angles.
4. **Two or more reps** so the tempo is a measurement, not one sample.
5. Short. 5–15 s is ideal; the OPEX library, Motiv8, and "How to X"
   shorts are the right shape.

The user approves the clips for a batch before any pose is touched.

## 2. Reading the clip

Frames come from the Browser pane. On youtube.com:

- the cookie banner has to be rejected once per browser session (ask the
  user before clicking it — it is a consent dialog);
- the page's CSP blocks external scripts, fetch/XHR to localhost, and
  even `<img>` requests to localhost, and popups are blocked; **a
  navigation is not** — so frames travel in the URL fragment.

`tools/pose-lab/` holds the two pieces:

- `serve-lab.js` — a static server on 8098 for the lab page, plus
  `POST /save?name=` (writes `shots/<name>.png`).
- `pose-lab.html` — MoveNet SinglePose Thunder (tfjs, from jsdelivr).
  It reads `{clip, frames:[{t, b64}]}` from `location.hash`, runs the
  model on every frame, and exposes `table()` (per-frame angles for the
  side facing the camera), `draw(t)` (skeleton overlay) and `save(t,
  name)`.

The capture script run on the YouTube page (see the session notes for
the exact snippet): pause the video, seek to each `t`, wait for
`seeked`, draw the video to a canvas **cropped to the lifter** (a crop
raises the model's accuracy a lot), JPEG q0.85, base64, pack the frames
into the hash, `location.href = lab#…`. 23 full-crop frames are ~550 KB
of URL; keep it under ~1.8 MB.

What `table()` gives per frame: trunk from vertical, thigh and shin from
vertical, knee / hip / elbow interior angles, upper arm and forearm from
vertical, and the hip and wrist heights (0–1 of the frame) — the two
curves the tempo is read from. Scores under 0.3 are dropped; check the
overlays for the frames that matter (the extremes) before trusting a
number.

**Tempo** is read from the wrist (presses, rows, curls) or the hip
(squats, hinges) curve: the time between the extremes is the phase
length; a plateau at an extreme is a hold. Round to 50 ms. The pose's
`tempo` is `{down, bottom, up, top}` in ms, with the movement's first
key position as "top".

## 3. Authoring the pose

The pose system authors in ONE plane (side or front) and builds the
world from it. Read `lib/poses.ts` first; the things that matter:

- **Solve the frames from the joints, not by nudging.** Pick shin/thigh
  angles per key position (hip height then falls out), and derive the
  trunk angle from the constraint the lift actually has — a bar on the
  back stays over the mid-foot, a hanging bar stays under the shoulders,
  a bench bar comes down to the chest surface. Write the numbers and
  the constraint in the comment above the frames.
- **Arms that hang are ropes**: author them `180/180`, not
  `reachingArms` to a fixed point (the fixed point let the trunk overtake
  the hands on the trap bar).
- **Legs have no width in a side view** until you give them one:
  `spread` (ankle out, knee half-way) and `turn` (toes out). Any time a
  stance is widened, re-measure every arm and prop against the thigh and
  shin capsules FACE ON — the side view hides the clash and the checker
  skips hex bars.
- **Elbows out of the plane**: `flare` on an arm turns the elbow about
  the shoulder→wrist line (bones keep their length, the wrist stays).
- **Two hands on one object in a side view**: a NEGATIVE arm `spread`
  brings the fists in from ±0.11 (medicine ball).
- `tempo` and `camera.azimuth` go in the 6th `pose()` argument; the
  azimuth is where the card's orbit starts (radians from straight in
  front, positive toward the figure's right side; π/2 = square on the
  right side, the figure facing screen-left).
- Shared frame constants (`SQUAT_FRAMES`) and shared builders (`bench()`)
  are used by other movements: change them opt-in, and say in the PR
  which movements moved with them.

Known limits of the mannequin, so they are not rediscovered: the
shoulder joint sits on the trunk axis (a bench bar at the chest is only
~8 cm above it, so the 2D elbow folds to ~64°); a knee below ~97° is
unreachable with the hip 33 cm up and the foot on the floor; a lying
figure's drawn pad is 4 cm shorter than its `width` and the rack is only
built for `width >= 0.5`.

## 4. Measuring what was built

In the dev build with the TEMPSWEEP hook (`window.__sweep = {
exercisePoses, PoseViewer3D }` after the imports in App.tsx — never
committed), an offscreen `PoseViewer3D(host, pose, implement,
{interactive:false, avatar})` at 626×440 (the card's canvas) gives:

- joint angles per key position from `pose.frames3d` (bones `a`/`b`);
- the skinned body per frame by patching `v.skinned.apply` to keep its
  `sample.bones` and `head` (the capsule meshes are null on the skinned
  build);
- the tempo by stepping `v.start = performance.now() - ms` and reading
  the hip / wrist height;
- prop-to-body clearances by segment distance minus the drawn radii
  (spine 0.052, shoulders 0.045, hips 0.052, thigh 0.041, shin 0.031,
  upper arm 0.031, forearm 0.028); chest surface under a bar from the
  SkinnedMesh vertices (`applyBoneTransform`).

Every number goes in the commit message. Both builds (male 180/80,
female 168/60) — the props follow the joints, but the body does not.

## 5. Shipping

Per movement: branch → PR (measured facts, what was NOT changed) →
squash-merge → wait for the Vercel deploy → verify on
project-g-blond.vercel.app with the `project-g-test-state` seed for both
sexes (the recipes that surface each exercise are in the session notes)
→ `check:poses` and the session sweep clean → memory note. One PR per
movement; a batch is 5–6 movements of one pattern.

Every movement PR also adds its clip to `lib/referenceClips.ts` (video id,
title, channel, view, what was measured, the PR, and which library
exercise the clip actually shows). `npm run check:references` validates
the entry against the poses and the library and regenerates
`docs/reference-clips.md`, the per-exercise record of what each animation
was corrected against; the PR commits both.
