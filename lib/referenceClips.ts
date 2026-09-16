// The reference clips: for every movement that was authored against a
// video of the real lift (docs/animation-from-clip.md), which video, seen
// from where, and which library exercise it actually shows.
//
// This is the record of what each animation was corrected against. It is
// kept per POSE (the thing that was measured and re-authored); which
// exercises use a pose is App.tsx's POSE_FOR_EXERCISE, and
// `npm run check:references` joins the two into docs/reference-clips.md --
// one line per library exercise -- and fails on an entry that names a pose
// or an exercise that does not exist. Add an entry with every movement PR.

import type { PoseName } from "./poseData";

// Where the camera stood. Sagittal numbers (trunk, knee, hip) are only
// trustworthy from a side view; a three-quarter view gives them as
// projections (+-5 degrees); a front view gives the frontal plane; the head
// or foot end of a bench gives tempo and grip width and little else.
// "back" earns its place with the standing calf raise: a clip filmed from
// behind gives tempo and vertical travel and NO sagittal angle at all, and
// the record should say so rather than call it a side view.
export type ReferenceView = "side" | "three-quarter" | "front" | "back" | "head-end" | "foot-end";

// An exercise that shares a pose and was measured against a clip of its
// own, which CONFIRMED the shared pose rather than earning a new one. The
// record says what was checked and what the clip could not settle.
export type Confirmation = {
  exercise: string;
  videoId: string;
  title: string;
  channel: string;
  view: ReferenceView;
  span: string;
  prs: number[];
  date: string;
  notes?: string;
};

export type ReferenceClip = {
  // YouTube video id; the URL is https://www.youtube.com/watch?v=<id>.
  videoId: string;
  title: string;
  channel: string;
  view: ReferenceView;
  // What was measured: reps and seconds, or the length of a hold.
  span: string;
  // The pull requests that authored (and corrected) the pose from this clip.
  prs: number[];
  // Date of the (last) merge, ISO.
  date: string;
  // The library exercises this clip actually shows. Every other exercise
  // mapped to the pose borrows it, and the generated doc says so.
  exercises: string[];
  notes?: string;
  // Sharers of this pose that were measured against their own clip and
  // found to match it (batch 20). Still not "authored from" the pose's
  // clip, but no longer an assumption either.
  confirmations?: Confirmation[];
};

export const REFERENCE_CLIPS: Partial<Record<PoseName, ReferenceClip>> = {
  // --- Batch 1: the three big lifts ------------------------------------
  squat: {
    videoId: "-bJIpOq-LWk",
    title: "How to do a Barbell Back Squat",
    channel: "National Academy of Sports Medicine (NASM)",
    view: "three-quarter",
    span: "three reps in 11.8 s",
    prs: [254],
    date: "2026-09-08",
    exercises: ["Barbell Back Squat"],
    notes: "Stance and toe angle read face on; depth to parallel; SQUAT_FRAMES are shared by the goblet and bodyweight squats.",
  },
  trapBarDeadlift: {
    videoId: "ZJPZQklCSLs",
    title: "How To Hex Bar Deadlift Correctly",
    channel: "Motiv8 Fitness",
    view: "side",
    span: "two reps in 4.6 s",
    prs: [255, 256],
    date: "2026-09-08",
    exercises: ["Trap Bar Deadlift"],
  },
  bench: {
    videoId: "ejI1Nlsul9k",
    title: "Barbell Bench Press - OPEX Exercise Library",
    channel: "OPEX Fitness",
    view: "foot-end",
    span: "three reps in 5.5 s",
    prs: [257, 258],
    date: "2026-09-08",
    exercises: ["Barbell Bench Press"],
    notes: "Foot-end camera: bar path, tempo and grip width; the chest-touch depth came from the skinned chest surface.",
  },

  // --- Batch 2: hinges and squats ---------------------------------------
  romanianDeadlift: {
    videoId: "ionx2qnNVMo",
    title: "BB RDL (Romanian Deadlift) Side View",
    channel: "Coach Savela",
    view: "side",
    span: "three reps in 9.8 s",
    prs: [260],
    date: "2026-09-09",
    exercises: ["Romanian Deadlift"],
  },
  stiffLegDeadlift: {
    videoId: "u3krqJlu7uc",
    title: "BB Stiff Legged Deadlift",
    channel: "Theory of Motion Exercise Library",
    view: "side",
    span: "five reps in 14.5 s",
    prs: [261],
    date: "2026-09-09",
    exercises: ["Stiff-Leg Deadlift"],
  },
  goodMorning: {
    videoId: "dEJ0FTm-CEk",
    title: "High Bar Good Morning",
    channel: "Renaissance Periodization",
    view: "side",
    span: "three reps in 17.3 s",
    prs: [262],
    date: "2026-09-09",
    exercises: ["Good Morning"],
  },
  kettlebellSwing: {
    videoId: "OPcG_thX6Dc",
    title: "The Russian Kettlebell Swing",
    channel: "Onnit",
    view: "side",
    span: "nine swings in 14.3 s",
    prs: [263],
    date: "2026-09-09",
    exercises: ["Kettlebell Swing"],
  },
  hipThrust: {
    videoId: "TSz4XEoFSFw",
    title: "Barbell Hip Thrust",
    channel: "My PT Hub",
    view: "side",
    span: "shoulders on a bench, three reps",
    prs: [264],
    date: "2026-09-09",
    exercises: ["Barbell Hip Thrust"],
    notes: "The OPEX clip in the batch list was a floor thrust with no bench, so this one was used instead.",
  },
  sumoDeadlift: {
    videoId: "OKMDYjnK8m8",
    title: "Sumo Deadlift - OPEX Exercise Library",
    channel: "OPEX Fitness",
    view: "three-quarter",
    span: "four reps in 16 s",
    prs: [265],
    date: "2026-09-09",
    exercises: ["Sumo Deadlift"],
    notes: "The plates hide the knees at the bottom; knee angles were read off the overlays.",
  },
  frontSquat: {
    videoId: "Q1Ypb8ZNzI4",
    title: "How To Do A Barbell front squat",
    channel: "PureGym",
    view: "side",
    span: "the first 8 s, two reps before the cut to a close-up",
    prs: [266],
    date: "2026-09-09",
    exercises: ["Barbell Front Squat"],
  },
  splitSquat: {
    videoId: "Fmjj7wFJWRE",
    title: "Bulgarian Split Squat with Dumbbells",
    channel: "The Active Life",
    view: "side",
    span: "two reps after a 14 s setup",
    prs: [267],
    date: "2026-09-09",
    exercises: ["Bulgarian Split Squat", "Dumbbell Bulgarian Split Squat"],
    notes: "Step-Up and Dumbbell Step-Up still borrow this pose; a step-up's box is in FRONT of the lifter.",
  },
  splitSquatStatic: {
    videoId: "Py2Qeg-D5T0",
    title: "Split Squat - OPEX Exercise Library",
    channel: "OPEX Fitness",
    view: "side",
    span: "three reps in 11 s",
    prs: [268],
    date: "2026-09-09",
    exercises: ["Split Squat"],
  },
  walkingLunge: {
    videoId: "6wZoPedlpok",
    title: "Walking Lunge - OPEX Exercise Library",
    channel: "OPEX Fitness",
    view: "side",
    span: "two steps in 6.4 s",
    prs: [269],
    date: "2026-09-09",
    exercises: ["Walking Lunge"],
  },
  legPress: {
    videoId: "B8KqmwdomoU",
    title: "Leg Press Machine Press - OPEX Exercise Library",
    channel: "OPEX Fitness",
    view: "side",
    span: "four reps in 12 s",
    prs: [270],
    date: "2026-09-09",
    exercises: ["Leg Press"],
    notes: "The program builder never puts the leg press in a session; the pose is reachable only through the library.",
  },
  boxSquat: {
    videoId: "rMEPHwNhQfo",
    title: "Box Squat Movement Demo",
    channel: "The Active Life",
    view: "side",
    span: "three reps after a 7 s walk-out",
    prs: [271],
    date: "2026-09-09",
    exercises: ["Box Squat"],
  },

  // --- Batch 3: push and pull -------------------------------------------
  overheadPress: {
    videoId: "0YYeELi896g",
    title: "How to Overhead Press Correctly (Military Press)",
    channel: "TylerPath",
    view: "three-quarter",
    span: "three reps between the cuts",
    prs: [272],
    date: "2026-09-09",
    exercises: ["Barbell Overhead Press"],
  },
  bentRow: {
    videoId: "bm0_q9bR_HA",
    title: "How to do a Barbell Bent Over Row Pronated",
    channel: "National Academy of Sports Medicine (NASM)",
    view: "side",
    span: "three reps after a 6 s hinge down",
    prs: [273],
    date: "2026-09-09",
    exercises: ["Barbell Row"],
  },
  pullUp: {
    videoId: "jgFel4wZl3I",
    title: "Strict Pull Up - OPEX Exercise Library",
    channel: "OPEX Fitness",
    view: "side",
    span: "four reps in 8.6 s",
    prs: [274],
    date: "2026-09-09",
    exercises: ["Pull-Up"],
  },
  pulldown: {
    videoId: "PEv0gTcMY3g",
    title: "Cable Lat Pulldown Machine - OPEX Exercise Library",
    channel: "OPEX Fitness",
    view: "three-quarter",
    span: "four reps in 10.5 s",
    prs: [275],
    date: "2026-09-09",
    exercises: ["Lat Pulldown"],
  },
  seatedRow: {
    videoId: "4ZbqM_gcgAI",
    title: "Seated Cable Row - OPEX Exercise Library",
    channel: "OPEX Fitness",
    view: "side",
    span: "three reps in 9.5 s",
    prs: [276],
    date: "2026-09-09",
    exercises: ["Seated Cable Row"],
  },
  pushUp: {
    videoId: "Ql8PKKsDE70",
    title: "Push Up - OPEX Exercise Library",
    channel: "OPEX Fitness",
    view: "side",
    span: "three reps in 4.8 s",
    prs: [277],
    date: "2026-09-09",
    exercises: ["Push-Up"],
    notes: "Knee, Incline and Decline Push-Up have their own poses, each from its own clip.",
  },

  // --- Batch 4: arms and shoulders --------------------------------------
  curl: {
    videoId: "-gSM-kqNlUw",
    title: "EZ Bar Curl - OPEX Exercise Library",
    channel: "OPEX Fitness",
    view: "side",
    span: "three reps in 10 s",
    prs: [278],
    date: "2026-09-09",
    exercises: ["Barbell Curl"],
  },
  tricepsExtension: {
    videoId: "y6EdXBdL75A",
    title: "Rope Cable Tricep Pushdown - OPEX Exercise Library",
    channel: "OPEX Fitness",
    view: "side",
    span: "five reps in 11.6 s",
    prs: [279],
    date: "2026-09-09",
    exercises: ["Triceps Pushdown"],
    notes: "Overhead Triceps Extension borrows this pushdown; it needs its own overhead pose.",
  },
  lateralRaise: {
    videoId: "8aUc9snLOxU",
    title: "Dumbbell Lateral Raise - OPEX Exercise Library",
    channel: "OPEX Fitness",
    view: "front",
    span: "five reps in 9 s",
    prs: [280],
    date: "2026-09-09",
    exercises: ["Dumbbell Lateral Raise"],
  },
  skullCrusher: {
    videoId: "eluOhtYkm-0",
    title: "EZ Bar Skull Crusher - OPEX Exercise Library",
    channel: "OPEX Fitness",
    view: "head-end",
    span: "three reps in 9 s",
    prs: [281],
    date: "2026-09-09",
    exercises: ["Skull Crusher"],
  },
  dip: {
    videoId: "VNa0hX_y6Fk",
    title: "Weighted Dip - OPEX Exercise Library",
    channel: "OPEX Fitness",
    view: "three-quarter",
    span: "four reps in 11 s",
    prs: [282],
    date: "2026-09-09",
    exercises: ["Bar Dip"],
  },
  fly: {
    videoId: "AVIBmE5iQrQ",
    title: "Dumbbell Neutral Grip Fly - OPEX Exercise Library",
    channel: "OPEX Fitness",
    view: "head-end",
    span: "three reps in 11.5 s",
    prs: [283],
    date: "2026-09-09",
    exercises: ["Dumbbell Fly"],
  },

  // --- Batch 5: core and carries ----------------------------------------
  plank: {
    videoId: "rfPf3HCg2Ac",
    title: "Front Plank to Forearm Plank",
    channel: "OPEX Fitness",
    view: "side",
    span: "the forearm phases at 2.5-3, 6-6.5 and 9.5-10 s",
    prs: [284],
    date: "2026-09-09",
    exercises: ["Plank"],
  },
  sidePlank: {
    videoId: "tbWPBOgju9g",
    title: "Side Plank - OPEX Exercise Library",
    channel: "OPEX Fitness",
    view: "front",
    span: "a 9 s hold",
    prs: [285],
    date: "2026-09-09",
    exercises: ["Side Plank"],
    notes: "Copenhagen Plank (feet on a bench) borrows this floor side plank.",
  },
  // --- Batch 6: the borrowed exercises get their own poses ----------------
  copenhagenPlank: {
    videoId: "tKb76R21AfM",
    title: "Copenhagen Plank",
    channel: "OPEX Fitness",
    view: "front",
    span: "a 7 s hold",
    prs: [293],
    date: "2026-09-10",
    exercises: ["Copenhagen Plank"],
  },
  pallofPress: {
    videoId: "syYBcVbEAFk",
    title: "Cable Standing Pallof Press",
    channel: "OPEX Fitness",
    view: "three-quarter",
    span: "three reps in 10 s",
    prs: [294],
    date: "2026-09-10",
    exercises: ["Pallof Press"],
  },
  overheadCarry: {
    videoId: "dwGP7RAYtxY",
    title: "Dual Kettlebell Overhead Carry - OPEX Exercise Library",
    channel: "OPEX Fitness",
    view: "front",
    span: "2.5 s of walking toward the camera",
    prs: [295],
    date: "2026-09-10",
    exercises: ["Overhead Carry"],
    notes: "The arms only; the stride is the farmer's carry's, from its side-view clip.",
  },
  frontRackCarry: {
    videoId: "0OzaglIheOc",
    title: "Front Rack Kettlebell Carry - OPEX Exercise Library",
    channel: "OPEX Fitness",
    view: "front",
    span: "3.5 s of walking toward the camera",
    prs: [295],
    date: "2026-09-10",
    exercises: ["Front Rack Carry"],
    notes: "The arms only; the stride is the farmer's carry's.",
  },
  suitcaseCarry: {
    videoId: "28BIZccT5fs",
    title: "Single Arm Farmers Carry - OPEX Exercise Library",
    channel: "OPEX Fitness",
    view: "front",
    span: "5 s of walking toward the camera",
    prs: [295],
    date: "2026-09-10",
    exercises: ["Suitcase Carry"],
    notes: "The arms only; the stride is the farmer's carry's.",
  },

  stepUp: {
    videoId: "RRuWVDefORg",
    title: "Step Up - OPEX Exercise Library",
    channel: "OPEX Fitness",
    view: "three-quarter",
    span: "four step-ups in 19 s",
    prs: [296],
    date: "2026-09-10",
    exercises: ["Step-Up"],
    notes: "Dumbbell Step-Up shares the pose with the bells drawn in the hands.",
  },

  overheadTricepsExtension: {
    videoId: "7h3lG2WnLXg",
    title: "Single Dumbbell Overhead Tricep Extension - OPEX Exercise Library",
    channel: "OPEX Fitness",
    view: "side",
    span: "three reps in 8 s",
    prs: [297],
    date: "2026-09-10",
    exercises: ["Overhead Triceps Extension"],
  },

  boxJump: {
    videoId: "W5QzqIbEWvk",
    title: "Box Jump Step Down - OPEX Exercise Library",
    channel: "OPEX Fitness",
    view: "side",
    span: "three jumps in 10 s",
    prs: [299],
    date: "2026-09-10",
    exercises: ["Box Jump"],
    notes: "Up by a jump, down by a step: the first looping movement.",
  },

  broadJump: {
    videoId: "YjFr2OEivz0",
    title: "Broad Jump | Strength & Conditioning Exercise Library",
    channel: "Flow High Performance",
    view: "side",
    span: "one jump in 6 s",
    prs: [300],
    date: "2026-09-10",
    exercises: ["Broad Jump"],
    notes: "One rep, so the tempo is a single sample. The loop glides back to the start.",
  },

  jumpingLunge: {
    videoId: "BR1A8T9SjIU",
    title: "Jump Lunge - OPEX Exercise Library",
    channel: "OPEX Fitness",
    view: "side",
    span: "eight switches in 9 s",
    prs: [301],
    date: "2026-09-10",
    exercises: ["Jumping Lunge"],
  },

  skaterBound: {
    videoId: "Xqzq9w42-z4",
    title: "Skater Jumps",
    channel: "Exercise Library",
    view: "front",
    span: "nine bounds in 12 s",
    prs: [302],
    date: "2026-09-10",
    exercises: ["Skater Bound"],
    notes: "Frontal keypoints read directly (hip travel, lean, free-foot height), not the lab's sagittal table.",
  },

  kettlebellSnatch: {
    videoId: "y12D2GApeO0",
    title: "Kettlebell Snatch",
    channel: "OPEX Fitness",
    view: "side",
    span: "four reps in 9 s",
    prs: [303],
    date: "2026-09-10",
    exercises: ["Kettlebell Snatch"],
    notes: "The way down is the pull reversed; the clip drops the bell a little further out in front.",
  },

  bearCrawl: {
    videoId: "w089AXf1f_g",
    title: "Crawl - OPEX Exercise Library",
    channel: "OPEX Fitness",
    view: "side",
    span: "ten hand-steps in 9 s",
    prs: [304],
    date: "2026-09-10",
    exercises: ["Bear Crawl"],
    notes: "Raw keypoints (the lab's table drops a crawling figure's legs). Ours crawls on the spot.",
  },

  highKnees: {
    videoId: "cUmfCd-Hznk",
    title: "High Knees | Movement Demo",
    channel: "CrossFit",
    view: "three-quarter",
    span: "nine seconds on the spot",
    prs: [305],
    date: "2026-09-11",
    exercises: ["High Knees"],
    notes: "Near-side view: the angles are projections, +-5.",
  },

  tuckJump: {
    videoId: "w0cI_zLXJFo",
    title: "Tuck Jump",
    channel: "OPEX Bristol - The Future of Personal Training",
    view: "side",
    span: "three jumps in 8.5 s",
    prs: [306],
    date: "2026-09-11",
    exercises: ["Tuck Jump"],
    notes: "Read as raw keypoints (heights, knee under hip). The video sits behind YouTube's consent page.",
  },

  powerClean: {
    videoId: "YEXjyc22Jek",
    title: "Power Clean (side view)",
    channel: "Fitness Pain Free",
    view: "side",
    span: "two reps in 14 s",
    prs: [307],
    date: "2026-09-11",
    exercises: ["Power Clean"],
    notes: "Kettlebell Clean and Hang Clean were later given poses of their own (`kettlebellClean`, `clean`).",
  },

  kettlebellClean: {
    videoId: "JrNe81MYEuI",
    title: "Single Arm Kettlebell Clean From Floor",
    channel: "Functional Bodybuilding",
    view: "side",
    span: "six reps in 9 s",
    prs: [308],
    date: "2026-09-11",
    exercises: ["Kettlebell Clean"],
    notes: "Near-side view; the swing-through key keeps the bell out of the thighs, as the snatch's.",
  },

  pushPress: {
    videoId: "xcCYH-UcoZ0",
    title: "Push press (side view)",
    channel: "Armory HPFT",
    view: "side",
    span: "three reps in 11.6 s",
    prs: [309],
    date: "2026-09-11",
    exercises: ["Push Press"],
    notes: "Push Jerk still borrows the strict press; it drops under the bar, which this one does not.",
  },

  pushJerk: {
    videoId: "dboDOX7xY_Q",
    title: "Push Jerk (Side view)",
    channel: "Fitness Pain Free",
    view: "side",
    span: "three reps in 10 s",
    prs: [310],
    date: "2026-09-11",
    exercises: ["Push Jerk"],
    notes: "The second dip -- dropping under a locked-out bar -- is what separates it from the push press.",
  },

  jumpSquat: {
    videoId: "3jJt5gCMRNQ",
    title: "Jump Squats",
    channel: "OPEX Abbotsford",
    view: "three-quarter",
    span: "ten reps in 13 s",
    prs: [311],
    date: "2026-09-11",
    exercises: ["Jump Squat"],
    notes: "Near-side view: the angles are projections, +-5. The arms reach forward at the bottom as a counterbalance.",
  },

  depthJump: {
    videoId: "GeN0S3XCZnM",
    title: "Depth Jump | Olympic Weightlifting Exercise Library",
    channel: "Catalyst Athletics",
    view: "side",
    span: "two reps out of a 1:20 tutorial",
    prs: [312],
    date: "2026-09-11",
    exercises: ["Depth Jump"],
    notes: "A step off the box, not a jump down; the contact before the rebound is 0.2-0.4 s.",
  },

  arnoldPress: {
    videoId: "hHmFzFaSn7U",
    title: "Standing Arnold Dumbbell Press - OPEX Exercise Library",
    channel: "OPEX Fitness",
    view: "front",
    span: "four reps in 14 s",
    prs: [314],
    date: "2026-09-11",
    exercises: ["Arnold Press"],
    notes: "Front view: the hand path is the lift. The mannequin has no forearm twist, so the palm rotation is not drawn.",
  },

  pecDeck: {
    videoId: "X3Nj2ZPwW04",
    title: "Chest Fly Machine",
    channel: "OPEX Fitness",
    view: "three-quarter",
    span: "three reps in 14 s",
    prs: [298],
    date: "2026-09-10",
    exercises: ["Pec Deck"],
    notes: "The machine's arms are not drawn; the seat is.",
  },

  hangingRaise: {
    videoId: "w0IDQ_05X34",
    title: "Hanging Leg Raises",
    channel: "OPEX San Juan",
    view: "three-quarter",
    span: "four reps in 12 s",
    prs: [286],
    date: "2026-09-09",
    exercises: ["Hanging Leg Raise"],
    notes: "The clip's knees bend (a knee raise); the leg raise keeps its hang, trunk lean and tempo with the knees held straight and the thighs stopping level.",
  },
  hangingKneeRaise: {
    videoId: "w0IDQ_05X34",
    title: "Hanging Leg Raises",
    channel: "OPEX San Juan",
    view: "three-quarter",
    span: "four reps in 12 s",
    prs: [286],
    date: "2026-09-09",
    exercises: ["Hanging Knee Raise"],
    notes: "The clip as measured: knees to the chest.",
  },
  woodchop: {
    videoId: "KnbgKcvOG_c",
    title: "High to Low Cable Oblique Rotation",
    channel: "OPEX Fitness",
    view: "three-quarter",
    span: "three reps in 11 s",
    prs: [287],
    date: "2026-09-09",
    exercises: ["Cable Woodchopper"],
    notes: "Pallof Press (a straight-out press against the cable) borrows this chop.",
  },
  carry: {
    videoId: "K4R8uc1x_OA",
    title: "Dumbbell Farmer's Carry",
    channel: "OPEX Fitness",
    view: "side",
    span: "2.6 s of walking in frame",
    prs: [288],
    date: "2026-09-09",
    exercises: ["Farmer's Carry"],
    notes: "Suitcase, Front Rack and Overhead Carry walk the same way; their loads differ and are not drawn differently yet.",
  },
  russianTwist: {
    videoId: "Hvtxbidjins",
    title: "Russian Twist",
    channel: "OPEX Fitness",
    view: "side",
    span: "six twists in 9.5 s",
    prs: [289],
    date: "2026-09-10",
    exercises: ["Russian Twist"],
  },
  deadBug: {
    videoId: "-VykQ1HD0Vw",
    title: "Alternating Dead Bug",
    channel: "OPEX Fitness",
    view: "side",
    span: "four reaches in 17 s",
    prs: [290],
    date: "2026-09-10",
    exercises: ["Dead Bug"],
  },
  hollowHold: {
    videoId: "EsnM8eBtazU",
    title: "Hollow Body Hold - OPEX Exercise Library",
    channel: "OPEX Fitness",
    view: "side",
    span: "1.25 s into the hold, 3.5 s holding it",
    prs: [291],
    date: "2026-09-10",
    exercises: ["Hollow Hold"],
    notes: "V-Up borrows this hold.",
  },

  // --- Batch 8 correction: the push-up variants -------------------------
  inclinePushUp: {
    videoId: "E--Ls5QtFqI",
    title: "Incline Push Up on Bench - OPEX Exercise Library",
    channel: "OPEX Fitness",
    view: "side",
    span: "four reps in 12 s",
    prs: [315],
    date: "2026-09-11",
    exercises: ["Incline Push-Up"],
  },

  declinePushUp: {
    videoId: "cnsPwJ2f2B4",
    title: "Decline Push Up - OPEX Exercise Library",
    channel: "OPEX Fitness",
    view: "side",
    span: "four reps in 11 s",
    prs: [315],
    date: "2026-09-11",
    exercises: ["Decline Push-Up"],
    notes: "On a bench the arm is about as long as the bench is tall, so the lockout is level rather than head-down.",
  },

  // --- Batch 9: the highest-reach poses never authored from a clip --------
  // --- Batch 20: the last nine sharers, measured against their own clips ----
  dumbbellShoulderPress: {
    videoId: "OM23fjJB3-0",
    title: "Standing Dumbbell Press - OPEX Exercise Library",
    channel: "OPEX Fitness",
    view: "front",
    span: "four presses in 13.7 s",
    prs: [401],
    date: "2026-09-16",
    exercises: ["Dumbbell Shoulder Press"],
    notes:
      "Borrowed the barbell overhead press before, whose grip is fixed by the bar. Face on, as ratios of the shoulder width: at the bottom the wrists are 1.55-1.8 apart at shoulder height with the elbows 1.85-2.0 apart and 0.7-0.8 below the shoulders; at the top the wrists converge to 1.05-1.15 over the shoulders (the bar pose keeps 2.05), the elbows 1.1-1.2, the arms straight (170-179). Not settled: the sagittal plane (how far ahead of the shoulders the bells sit). Tempo at 0.15 s: press 1.05 s, 0.75 at the top, lower 2.25 -- slow -- 0.45-0.6 at the shoulders; presses 4.35 s apart.",
  },
  bandChestPress: {
    videoId: "9NGo4lZd65o",
    title: "Banded Chest Press",
    channel: "RADCENTRE",
    view: "side",
    span: "six presses in 14 s (the side-view half of the clip)",
    prs: [401],
    date: "2026-09-16",
    exercises: ["Band Chest Press"],
    notes:
      "Borrowed the barbell bench press before -- lying on a bench, where the cue stands. Standing, the band anchored behind at shoulder height. Start: the hands at the chest, 0.2-0.3 trunk lengths ahead of the shoulders and 0.5 below them, elbow 55-70 with the upper arm 25-30 behind plumb; pressed: elbow 164-172, the hands 0.95-1.2 ahead and 0.1-0.2 below the shoulders, the upper arm 15-20 below level; trunk within 5-10 of vertical, knees soft (167-175). Tempo at 0.2 s: press 0.6-0.8 s, 0.6-0.8 pressed, return 0.6-0.8, 0.4-0.6 at the chest; 2.5 s a rep.",
  },

  // --- Batch 19: machines, grips and tempos the shared pose could not show --
  dumbbellBenchPress: {
    videoId: "ZaDlbm8E8Tg",
    title: "Dumbbell Bench Press - OPEX Exercise Library",
    channel: "OPEX Fitness",
    view: "side",
    span: "three reps in 9 s",
    prs: [399],
    date: "2026-09-16",
    exercises: ["Dumbbell Bench Press"],
    notes:
      "Borrowed the barbell bench press before, whose bar stops on the chest. The dumbbells come lower: at the bottom the wrists are 0.0-0.17 trunk lengths above the shoulder line (the bar's 0.32) and the elbows 0.35-0.45 below it, past the bench, the wrists over the shoulders; at the top the elbow is 155-176 with the wrists 1.0-1.3 above. Not used: the bottom elbow angle, a projection of a flared upper arm pointing at the camera (reads 0-20). Ours: the bench's path with the bottom 5.8 cm lower and the hands 4.7 cm toward the feet (an in-plane fold cannot put the elbow under a plumb wrist), flare 20 / 40 / 60; elbow 178 / 74 / 45, elbows 11 cm below the shoulder line and 2.34 shoulder widths apart at the bottom. Tempo at 0.15 s: down 0.75-0.9 s, 0.5-0.75 at the bottom, up 0.45-0.6, 0.6-0.8 locked out; reps 2.9 s apart.",
  },
  hammerCurl: {
    videoId: "RIEMoYL_h1Y",
    title: "Dumbbell Hammer Curl - OPEX Exercise Library",
    channel: "OPEX Fitness",
    view: "front",
    span: "three reps in 11 s",
    prs: [398],
    date: "2026-09-16",
    exercises: ["Hammer Curl"],
    notes:
      "Borrowed the curl (underhand) before; the grip is a property of the pose, so the bells drew palms up. Neutral. The curl's own keys: hanging elbow 165-175, the top 45-55 with the wrists 0.27 trunk lengths under the shoulders (from 1.05). Camera from the front, so those are projections and the curl's side-on keys are kept; what this clip gives is the grip and the tempo: curl 0.6-0.75 s, 0.5-0.6 at the top, lower 1.4-1.5, 0.7-0.9 hanging; reps 3.65-3.75 s apart.",
  },
  neutralGripPulldown: {
    videoId: "RMvSbvaoVG4",
    title: "Neutral Grip Lat Pulldown",
    channel: "OPEX Fitness",
    view: "back",
    span: "four reps in 11.5 s",
    prs: [398],
    date: "2026-09-16",
    exercises: ["Neutral-Grip Pulldown"],
    notes:
      "Borrowed the wide overhand pulldown before. From behind: the hands on a V-handle 0.55-0.85 shoulder widths apart (the wide bar's are 2 shoulder widths), the elbows 1.0-1.3; the handle pulled to 0.3-0.45 trunk lengths under the shoulder line (the bar's 4 cm). Ours: the pulldown's seat, lean and top, the hands 0.7 widths apart (spread -0.05) pulled to 9 cm under the shoulders, neutral grip on two fore-aft handles. Tempo at 0.15 s: pull 0.6 s, 1.0 at the chest, release 1.05, 0.6 at the top; reps 3.3 s apart.",
  },
  neutralGripDumbbellPress: {
    videoId: "Q7omzf7Bt1I",
    title: "Dumbbell Neutral Grip Bench Press - OPEX Exercise Library",
    channel: "OPEX Fitness",
    view: "side",
    span: "three reps in 8.5 s",
    prs: [398],
    date: "2026-09-16",
    exercises: ["Neutral-Grip Dumbbell Press"],
    notes:
      "Borrowed the barbell bench press (wide overhand, elbows flared 45, bar stopping on the chest) before. Side view: at the bottom the elbow closes to 16-32 with the wrists 0.17-0.20 trunk lengths above the shoulder line (the bar stops 0.32 above it) and the elbows 0.27-0.38 BELOW it, past the bench; at the top the elbow is 155-167 with the wrists 1.05-1.3 above. Ours: the bench's bar path with the bottom 3 cm lower, the flare cut to 0 / 10 / 20 so the elbows stay in beside the ribs, palms facing on twin dumbbells (neutral grip). Tempo at 0.15 s: down 0.75-0.9 s, 0.5-0.75 at the bottom, up 0.6, 0.6 locked out; reps 2.7 s apart.",
  },
  chinUp: {
    videoId: "QGSYnup3-u4",
    title: "Supinated Pull Up",
    channel: "OPEX Fitness",
    view: "three-quarter",
    span: "three reps in 11 s",
    prs: [397],
    date: "2026-09-16",
    exercises: ["Chin-Up"],
    notes:
      "Borrowed the pull-up (overhand) before -- the grip is a property of the pose, not the exercise, so the fists drew overhand. Underhand. Dead hang with the elbow 160-179 and the shoulder 3.4-4.1 shoulder widths under the bar; at the top the elbow closes to 17-28 with the nose 0.3-1.0 shoulder widths over the bar and the shoulder within 0.35 of it. The hang, the path and the top match the pull-up pose, which is kept: what changes is the grip and the hands a shade closer. The grip width itself is not read from this clip (the shoulders project 17-25 px three-quarters on). Tempo at 0.15 s: pull 0.75 s, 0.3 at the top, lower 1.05, 0.9-1.0 hanging; reps 2.9-3.1 s apart.",
  },
  negativePullUp: {
    videoId: "jBSMDqs7OzM",
    title: "How To Do Negative Pull Ups",
    channel: "PureGym",
    view: "three-quarter",
    span: "two negatives in 12.6 s",
    prs: [397],
    date: "2026-09-16",
    exercises: ["Negative Pull-Up"],
    notes:
      "Borrowed the pull-up before, which pulls up and drops down at the same speed. The positions are the pull-up's; what the clip gives is the tempo. Starts at the top (elbow 6-33, nose over the bar) and lowers under control to a dead hang (elbow 172-180) in 3.2-3.6 s, twice; a step back up from a box and a 0.6 s pull to the top between them. Bulldog Gear's clip (EkpJkHpJXmM) was measured too: one negative of about 8 s, 'as slowly as you can' taken literally. The pose runs the pull-up's keys top-first: 0.4 s at the top, 3.5 s down, 0.5 s hanging, 0.6 s back up (the cue's jump, which the clip does off a box).",
  },
  tBarRow: {
    videoId: "hYo72r8Ivso",
    title: "How To Do T Bar Rows (Landmine Rows)",
    channel: "PureGym",
    view: "side",
    span: "four reps in 10 s",
    prs: [396],
    date: "2026-09-16",
    exercises: ["T-Bar Row"],
    notes:
      "Borrowed the barbell bent-over row (a free bar) before. Straddling a landmine bar, both hands on the handle. Trunk 36-44 from vertical on the near side (the far side reads 15-25 behind the trunk and is not used), knees soft at 164-173, the handle from 0.68-0.73 of the hip height to 0.87-0.95; the elbows are hidden by the plates and not quoted. Ours: trunk 50 (the keypoints read shallow on a bent trunk; the frame looks 45-50), knee 166, hands 0.70 -> 0.96, elbow 180 / 106 / 75, a landmine bar pivoting on the floor ahead. Also triaged: RP (chest-supported machine, three-quarter) and OPEX landmine row (one hand, bar beside the lifter). Tempo at 0.15 s: pull 0.6-0.75 s, 0.45-0.6 at the ribs, lower 0.75-0.9, 0.45-0.6 hanging.",
  },
  smithSquat: {
    videoId: "QcmonZUuumg",
    title: "Smith Machine Back Squat",
    channel: "OPEX Fitness",
    view: "three-quarter",
    span: "three reps in 8 s",
    prs: [395],
    date: "2026-09-16",
    exercises: ["Smith Machine Squat"],
    notes:
      "Borrowed the free back squat before (no rails, the bar travelling forward through the rep). Camera three-quarters from behind. Bottom: thigh level, knee 56-64, hip 0.40-0.47 of standing height, trunk 27-30 as projected, the feet about a quarter hip-height ahead of the hips. Ours: legs from the ankle up, the trunk solved per key so the bar stays plumb on its track (5 / 23 / 29 / 30), knee 72, hip 0.44, feet 12 cm ahead. New bar option `smith` draws the uprights. Tempo at 0.15 s: down 1.35-1.5 s, 0.15-0.3 at the bottom, up 0.9, 0.3-0.45 standing.",
  },

  // --- Batch 18: the last visibly different borrowers ----------------------
  closeGripBench: {
    videoId: "FiQUzPtS90E",
    title: "Narrow Grip Bench Press",
    channel: "Renaissance Periodization",
    view: "head-end",
    span: "four reps in 12 s",
    prs: [394],
    date: "2026-09-16",
    exercises: ["Close-Grip Bench Press"],
    notes:
      "Borrowed the barbell bench press (76 cm grip, elbows flared 45 at the chest) before. This clip gives the grip: wrists 1.04-1.18 shoulder widths apart at lockout -- shoulder width, as the cue says -- and the elbows barely wider on the way down (1.2-1.35). OPEX's own \"Close Grip Bench Press\" (CGqKy5wiY8o) was measured too, on the same camera and set as the bench clip whose geometry this pose reuses: its grip is only a tenth narrower than that one's (1.95 against 2.15 shoulder widths, ours draws the bench at 2.26), a moderate grip rather than the cue's, so the width is this clip's and the tempo is OPEX's (down 0.7-0.8 s, a touch, up 0.5, 0.6 locked out). Ours: wrists 1.10, elbows 1.05 / 1.16 / 1.26, elbow 180 / 80 / 52, the bench's own bar path.",
  },
  heelsElevatedGobletSquat: {
    videoId: "YWrs2r_mYg0",
    title: "How to: Heels Elevated Goblet Squat",
    channel: "Core Blend Training",
    view: "side",
    span: "six reps between 9 and 33 s",
    prs: [393, 400],
    date: "2026-09-16",
    exercises: ["Heels-Elevated Goblet Squat"],
    notes:
      "Borrowed the flat-footed goblet squat before. Heels on a wedge, bell at the chest. At the bottom: shin 45-51 forward of plumb (goblet frames 32), trunk 20-26 from vertical (goblet 36), thigh level, knee 47-51, hip 0.38 of standing height (goblet 0.42); standing knees soft (164-174). Five other clips triaged: The Active Life, Lance Goyke, Josh Bowers, PR Fitness and The Barbell Physio are all three-quarter or front views. Ours: knee 170 / 101 / 51, trunk 0 / 16 / 24, hip 0.39, heels on a 3 cm plate with the toes on the floor. Tempo at 0.3 s: down 1.5-1.8 s, 0.3 at the bottom, up 1.2-1.5, 0.3-0.6 standing.",
  },
  bodyweightGoodMorning: {
    videoId: "nS_BEj0mjhQ",
    title: "Bodyweight Good Morning | Exercise Demo | Male",
    channel: "Exercise Library dot com",
    view: "side",
    span: "two reps in 17 s",
    prs: [392],
    date: "2026-09-16",
    exercises: ["Bodyweight Good Morning"],
    notes:
      "Borrowed the barbell good morning (bar on the back, trunk to 75, knees bending to 147) before. Hands laced behind the head, elbows out. The trunk goes all the way to level (88-92 from vertical) on knees that stay soft and barely move (165-170, thigh 13-17 behind vertical, shin plumb), the hips 0.15-0.18 standing hip heights back of the ankle. Ours: trunk 0 / 45 / 88, knee 172 / 168 / 167, hands behind the head 4 cm off the midline with the elbows flared out. A slow demonstration: down 4.6 s, 0.6-0.8 at the bottom, up 1.8-2.4, 1.6 standing -- the tempo is the clip's, and it is slow.",
  },
  wallHinge: {
    videoId: "cGUhSLyYcpY",
    title: "Wall Tap Hip Hinge",
    channel: "Jack Hanrahan Fitness",
    view: "side",
    span: "six reps in 35 s, each a little further from the wall",
    prs: [391],
    date: "2026-09-16",
    exercises: ["Hip Hinge Wall Touch"],
    notes:
      "Borrowed the conventional deadlift (a loaded barbell) before. No weight: hands folded in front, the hips pushed back until the seat touches the wall behind. The lifter steps further out each rep, so the depth grows (trunk 54 -> 86 from vertical); the pose takes the middle reps, the 'foot from the wall' of the cue: trunk 72-79, knee 131-134, the hip joint 0.3 standing hip heights behind the ankle, the shin near plumb (3-5 ahead). Standing: knees soft (160-166). Ours: trunk 0 / 64 / 76, knee 166 / 143 / 132, hip 14 cm behind the ankle, the wall 7 cm behind the hip joint so the seat meets it. The 3D build of the female figure's hips carries a few millimetres into the (translucent) wall. Tempo at 0.3 s: down 1.8-2.7 s (slow, 2.2), 0.6-0.9 touching, up 0.9, 0.9-1.2 standing.",
  },
  pendlayRow: {
    videoId: "cosDas3E5ok",
    title: "Pendlay Row - OPEX Exercise Library",
    channel: "OPEX Fitness",
    view: "three-quarter",
    span: "three reps in 9.3 s",
    prs: [390],
    date: "2026-09-16",
    exercises: ["Pendlay Row"],
    notes:
      "Borrowed the bent-over row (bar hanging at the knees, trunk 60 from vertical) before. Every rep from a dead stop on the floor, arms straight, trunk 7-11 above horizontal as projected; the pull to the lower chest with the upper arm swept back level (elbow 55-59 projected), the trunk rising to 30-38 projected (about 20-25 in the sagittal plane, three-quarters on). Ours: trunk 5 / 12 / 22 above horizontal, bar 12.3 cm up at the floor key (the deadlift's floor: 12.5), elbow 178 / 108 / 72, knee 127. Cue corrected: 'torso parallel throughout' is not what the clip does -- the trunk lifts as the bar reaches the chest. Tempo at 0.15 s: pull 0.6-0.75 s, 0.3-0.45 at the chest, lower 0.9-1.2, 1.2 on the floor.",
  },
  dumbbellFrontSquat: {
    videoId: "7CuKlSgu1B0",
    title: "Front Rack Dumbbell Squat",
    channel: "OPEX Fitness",
    view: "three-quarter",
    span: "three reps in 10.5 s",
    prs: [389],
    date: "2026-09-16",
    exercises: ["Dumbbell Front Squat"],
    notes:
      "Borrowed the goblet squat (one bell hugged at the chest) before. The legs and trunk reuse the barbell front squat's frames, which the clip confirms: hip crease level with the knee at the bottom (0.45 of standing hip height against the frames' 0.49), trunk 25-28 as projected three-quarters on (the frames' 32). New is the rack: a dumbbell on each shoulder, the upper arm about 40 forward of plumb through the whole rep, the forearm folded back so the wrist sits level with the shoulder just in front (elbow 18-28 projected, drawn 36). Tempo at 0.2 s: down 1.6 s, 0.2-0.4 at the bottom, up 0.8-1.0, 0.6-0.8 standing.",
  },
  sideLunge: {
    videoId: "MvpBUsQrt_4",
    title: "Lateral Lunges",
    channel: "MGHOrthopaedics",
    view: "front",
    span: "four lunges, alternating sides, in 13 s (of 28)",
    prs: [388],
    date: "2026-09-16",
    exercises: ["Lateral Lunge"],
    notes:
      "Borrowed the cossack squat's pose before. Feet together, step out to one side, sit into that hip, push back to the middle. Hip height as a fraction of the standing hip-to-ankle height: the hips drop 0.33 (the cossack pose drops 0.41); the ankles land 1.17 apart (cossack 1.04); the trunk leans 9-14 over the bent knee (cossack 6 the other way); the long leg stays straight (172-180). The bent knee reads 122-136 face on, opened by the thigh pointing forward; ours solves to 86 in the plane. Ours: drop 0.33, ankles 1.17, lean 12. The clip alternates sides; the library counts per side, so the pose does one. Tempo at 0.2 s: step out 0.6 s, sink 0.8, 0.4 at the bottom, back to the middle 0.8-1.0, 0.4 standing; about 3.1 s a side.",
  },
  diamondPushUp: {
    videoId: "Bhuscxybjf4",
    title: "Diamond Push Up",
    channel: "E3 Rehab Exercise Library",
    view: "side",
    span: "four reps in 13 s",
    prs: [387],
    date: "2026-09-15",
    exercises: ["Diamond Push-Up"],
    notes:
      "Borrowed the push-up before. Widths from a second, face-on clip: Marcus Filly \"Diamond Push Up\" (XtU2VQVuLYs). Side on the profile matches the push-up (lockout elbow 164-174, bottom trunk 7-9 head-down, elbow 44-48, upper arm swept toward the feet), so its keys are kept. Face on: wrists 0.71-0.74 shoulder widths apart, elbows 0.84-0.90 at the top opening to 1.55-1.73 at the bottom. Ours: hands meeting fingertip to fingertip (centres 0.50, turned in 40), elbows 0.75 / 1.29 / 1.64. Cue corrected: the elbows do not stay tight to the ribs, they travel back toward the feet and open to 1.6 shoulder widths. Tempo at 0.15 s: down 0.75 s, 0.15-0.3 at the bottom, up 0.75, 0.15-0.3 locked out.",
  },
  towelRow: {
    videoId: "L2HkSlrAacA",
    title: "Towel Rows",
    channel: "Nicolas Sart",
    view: "side",
    span: "four reps in 24 s",
    prs: [386],
    date: "2026-09-15",
    exercises: ["Towel Row"],
    notes:
      "Borrowed the inverted row (under a bar, near horizontal) before. The clip loops the towel round wall bars, not a door handle; the body and the pull are the same. A rigid body turning about the ankles: hanging 23-27 behind vertical with the elbow 169-178 and knee 170-177; up to 7-10 back with the elbow 66-76. The hands sit over the ankles and drift a couple of centimetres forward and down as the towel swings, so each key's hands are taken from the clip rather than fixed. Ours: trunk 25 / 15 / 8, elbow 180 / 79 / 60, hip 164-169 (clip 171-178). Tempo at 0.25 s: pull 1.0 s, 0.75-1.0 up, back 1.0-1.5, 0.5-0.75 hanging; tops 3.65-3.85 s apart.",
  },

  // --- Batch 17: exercises that borrowed a different movement's pose ------
  machineShoulderPress: {
    videoId: "WvLMauqrnK8",
    title: "Machine Shoulder Press",
    channel: "Renaissance Periodization",
    view: "three-quarter",
    span: "four presses in 12 s",
    prs: [385],
    date: "2026-09-15",
    exercises: ["Machine Shoulder Press"],
    notes:
      "Borrowed the standing barbell overhead press before. OPEX's clip of this machine is dark and never shows the arms overhead in the triage frames. One continuous shot from three-quarters in front. Ratios across the body: wrists 1.9-2.2 shoulder widths apart throughout; elbows 2.0-2.3 at the bottom (wrists level with the shoulders), 2.3-2.6 half way (just above the shoulders), 1.5-1.7 at the top with the arms straight (164-180). Not settled: the bottom elbow angle (projected 15-50) and the exact recline (16-20 as projected). Ours: wrists 2.05, elbows 2.16 / 2.57 / 1.52, elbow 41 / 87 / 178, pad 18 back. Tempo at 0.2 s: up 0.6-0.8 s, 0.4-0.6 at the top, down 1.0-1.2, 0.6-1.2 at the bottom; tops 3.0-3.6 s apart. Handles drawn one per hand.",
  },
  machineChestPress: {
    videoId: "dYF2d_I24uE",
    title: "Seated Chest Press Machine Quick Tips",
    channel: "Jacob Price",
    view: "three-quarter",
    span: "four presses in 17 s",
    prs: [384],
    date: "2026-09-15",
    exercises: ["Machine Chest Press"],
    notes:
      "Borrowed the lying barbell bench press before. OPEX's machine clips are all incline variants. One continuous shot from three-quarters in front. Settled: back pad reclined about 10, knees 93-98, near elbow 155-166 at full reach, hands 0.34-0.36 trunk lengths below the shoulders there and 0.17-0.21 at the chest. Not settled: the elbow width at the chest -- the upper arm points half at the camera and its projected length swings by a third, so the bottom is drawn with a 50-degree flare (elbow 68) rather than read. Tempo at 0.25 s: out 1.0 s, 0.5-0.75 at reach, back 1.0, 1.0-1.5 at the chest; presses 4.0 s apart. Handles drawn as one short bar at the grip.",
  },
  doorwayRow: {
    videoId: "aa0yCQqbYaM",
    title: "Single Doorframe Row",
    channel: "Gymless Fitness",
    view: "side",
    span: "three reps in 7 s",
    prs: [383],
    date: "2026-09-15",
    exercises: ["Doorway Row"],
    notes:
      "Borrowed the inverted row before. One hand on the door frame (the library has the movement per side), the other at the waist. Filmed upright and cut off at the knees, so the ankles are extrapolated from the thigh and knee angles and the feet are not seen. Near side: hanging back, trunk 20 behind vertical, knee 162, elbow 156-168; upright at the top, trunk 0-2, knee 168-173, elbow 57-73 (the forearm foreshortens at the top, so that is the projected angle). A clean full-body clip of the two-handed version (Nomads Playbook, eCojBl6k_HE) was triaged and not used. Ours: trunk 20 / 10 / 0, elbow 160 / 99 / 73, knee 162 at the hang and straight above it, hand fixed on a post beside the body. Tempo at 0.2 s: pull 0.6 s, 0.6-0.8 at the frame, back in 0.6-0.8, 0.4-0.6 hanging, tops 2.3 s apart.",
  },
  barbellWalkingLunge: {
    videoId: "bdbJ_aRjw-4",
    title: "Barbell Walking Lunge - OPEX Exercise Library",
    channel: "OPEX Fitness",
    view: "side",
    span: "three lunges in 9 s",
    prs: [382],
    date: "2026-09-14",
    exercises: ["Barbell Walking Lunge"],
    notes:
      "Borrowed the dumbbell reverse lunge before. Bar on the back; step forward into a lunge, rear leg through to feet together, repeat. Bottom: front knee 70-72 with the shin 28 forward, rear knee 70-74 just off the floor, trunk 15 forward, hips dropping about half a leg length, step about three quarters of one. Plates hide the head; the legs read cleanly. Ours, walked in place as a loop (stand, lunge one leg, stand, lunge the other): front knee 74, rear 84 (0.7 cm off the floor), trunk 15, hips 22 cm down. Tempo at 0.2 s: stand 0.6 s, step and lower 1.4, bottom 0.2-0.4, rise 1.2, about 3.4 s a stride; loop 1700 / 1800 per half with holds shared in.",
  },
  singleLegCalfRaise: {
    videoId: "a6YrB_aULZY",
    title: "Single Leg Standing Calf Raise",
    channel: "OPEX Fitness",
    view: "back",
    span: "five reps in 8 s",
    prs: [381],
    date: "2026-09-14",
    exercises: ["Single-Leg Calf Raise"],
    notes:
      "Borrowed the two-legged calf raise before. One foot on a low step, the other hooked behind the working ankle, hands flat on a wall. Hips rise 12 percent of hip-to-ankle length, the ankle 14. From behind there is no ankle angle; drawn from the floor with the two-legged raise's range, as that pose is. Added the hooked free foot (4 cm behind the working leg, above its ankle) and the wall. Tempo at 0.15 s: up 0.3-0.45 s, top 0.45-0.75, down 0.45-0.6, bottom 0.3-0.6; tops 1.7-1.8 s apart.",
  },
  reverseSnowAngel: {
    videoId: "vSou6Vup5W8",
    title: "Prone Snow Angels",
    channel: "Functional Bodybuilding",
    view: "head-end",
    span: "three sweeps in 12 s",
    prs: [380],
    date: "2026-09-14",
    exercises: ["Reverse Snow Angel"],
    notes:
      "Borrowed the superman before. Face down, legs down, arms just off the floor swept round the body: overhead, straight (elbow 168-180), 4-8 out from the body line; through the sides with the arms long; to the hips with the elbows bent 82-125 and the hands over the lower back; and back. Ours: overhead 16 out, sides 96, hips elbow 100 with the hand beside the hip. Tempo at 0.2 s: down to the hips 0.8-1.0 s, held 1.4, up 1.2, overhead 0.4-0.6; sweeps 4.4-4.5 s apart. Arm height off the floor is not visible from the raised camera.",
  },
  proneYTW: {
    videoId: "X-b1S-rQc9k",
    title: "Prone Y-T-W",
    channel: "Cardinal Strength and Conditioning",
    view: "head-end",
    span: "one Y-T-W round in 15 s",
    prs: [379],
    date: "2026-09-14",
    exercises: ["Prone Y-T-W Raise"],
    notes:
      "Borrowed the superman before. Face down, legs down, arms just off the floor. Y (0.4-6.4 s): straight arms overhead 30-54 out from the body line (near arm). T (6.8-11 s): arms out to the sides; the raised camera stretches it to 121-134 from the head line, taken as square. W (11.8-15.4 s): elbows 40-96, drawn toward the hips, hands beside the shoulders. Ours: Y 51, T 96, W elbow 73 with the upper arm 150 from the head line. Arm height and any pulses within each hold are not measurable from this camera: no tempo. Simone Sports Performance's clip (LSy6R7j3PDc) has two lifters overlapping at an angle and was not used.",
  },
  concentrationCurl: {
    videoId: "Xc47YLxFftQ",
    title: "Seated Concentration Curl - OPEX Exercise Library",
    channel: "OPEX Fitness",
    view: "front",
    span: "two slow reps in 20 s",
    prs: [378],
    date: "2026-09-14",
    exercises: ["Concentration Curl"],
    notes:
      "Borrowed the standing barbell curl before. Seated, knees apart, leaning forward (about 35, from the trunk's projected length against shoulder width). Working upper arm plumb, elbow braced on the inner thigh just above the knee, still all rep: arm long elbow 159-169, curled 13-24 with the forearm straight up. Free hand on its knee, elbow about 100. Ours: trunk 35, working arm swung 20 in so the elbow sits inside the knee, elbow 178 / 91 / 32 (the fold limit stops the curl short of hers), free hand solved onto its knee (elbow 86). Tempo at 0.25 s, a slow demo: up 2.25-2.75 s, top 1.75-2.0, down 1.5, bottom 2.0-2.5.",
  },
  preacherCurl: {
    videoId: "w1qaVGYTtKk",
    title: "Preacher Curl - Exercise Library",
    channel: "Stable Strength Training",
    view: "three-quarter",
    span: "five reps in 17 s",
    prs: [377],
    date: "2026-09-14",
    exercises: ["Preacher Curl"],
    notes:
      "Borrowed the standing barbell curl before. Camera about 30 degrees off the side. Seated, trunk 23-39 forward, upper arms on the pad and still at 47-61 below level (as projected). Arms long: elbow 160-172. Curled: elbow 27-39, forearm plumb, bar at shoulder height. Ours: trunk 30, upper arm 36 from plumb, elbow 169 / 100 / 46 (the curled elbow reads wider in 3D for the hands' spread). Pad drawn as a block under the elbows. OPEX EZ Bar Preacher Curl (dgaJQXa0kbg) and Body-Solid's clip are filmed from the front with the arm pointing at the camera and were not used. Tempo at 0.3 s: up 1.2 s, top 0.3-0.6, down 2.1, bottom ~0.3.",
  },

  // --- Batch 16: exercises that borrowed a different movement's pose ------
  plyoPushUp: {
    videoId: "Y-uF4F3mQIs",
    title: "HOW TO: Plyometric Push Up",
    channel: "Goodlife Health Clubs",
    view: "three-quarter",
    span: "two reps, 24-29.6 s",
    prs: [376],
    date: "2026-09-14",
    exercises: ["Plyo Push-Up"],
    notes:
      "Borrowed the push-up before. Down 0.9 s, a 0.9-1.3 s pause at the bottom (shoulders still sinking), the push 0.5-0.7, hands in the air 0.2-0.3 with elbows straight (169-178) and shoulders 0.13 trunk lengths over the plank, landing into the next descent. Bottom elbows read 85-93 but the three-quarter camera opens them; the bottom is the side-on push-up's. Ours: loop of plank, bottom, deeper bottom (the pause), flight; flight elbows 163, legs straight, hands 3.5 cm off the mat, shoulders 3.5 cm over the plank (more air bent the knees). OPEX's Plyometric Push Up (GNVQos5I0qk) is a plate drill with the hips piked and was not used. Loop 900 / 1100 / 700 / 250 ms.",
  },
  chestSupportedRow: {
    videoId: "0-DXJiceG-0",
    title: "Chest Supported Incline Dumbbell Row - OPEX Exercise Library",
    channel: "OPEX Fitness",
    view: "side",
    span: "three reps in 11.5 s",
    prs: [375],
    date: "2026-09-14",
    exercises: ["Chest-Supported Row"],
    notes:
      "Borrowed the seated cable row before. Face down on an incline bench: trunk 25-36 above level, legs near straight (hip 152-176, knee 165-180), toes on the floor. Arms long: bells hang straight down, elbow 158-169, wrists 1.10-1.19 trunk lengths under the shoulders. Rowed: upper arm level and back along the trunk, elbow 65-74, wrists 0.42-0.50 under. Ours: trunk 30, hip 151, knee 163; elbow 175 / 125 / 71, wrists 1.18 and 0.53 under. Tempo at 0.2 s: row 0.8 s, hold 0.8-1.2, lower 1.2, hang 0.4-0.8.",
  },
  seatedDumbbellPress: {
    videoId: "RgkzQ008m3I",
    title: "Seated Dumbbell Press - OPEX Exercise Library",
    channel: "OPEX Fitness",
    view: "front",
    span: "three reps in 12 s",
    prs: [374],
    date: "2026-09-14",
    exercises: ["Seated Dumbbell Press"],
    notes:
      "Borrowed the standing barbell overhead press before. Seated tall on a flat bench, no backrest. Bottom: bells at the shoulders, wrists level with them and 1.15-1.24 shoulder widths apart, elbows under them 0.52-0.59 trunk lengths down, elbow 15-30. Half way: elbows out 1.9-2.0 shoulder widths apart, 0.17-0.35 up, elbow 88-105, wrists 0.72-0.88 up. Top: arms straight (160-180), wrists 1.03-1.09 up, a shoulder width apart. Ours: bottom elbow 32, elbows 0.55 down; half 95, elbows 2.3 apart and 0.37 up, wrists 0.86 up; top 179, wrists 1.18 up. The cue said 'back supported'; the clip has no backrest, so the cue now says sit tall. Tempo at 0.2 s: down 1.8-2.0 s, 0.4 at the bottom, up 1.0, 0.6-0.8 at the top.",
  },
  dumbbellFloorPress: {
    videoId: "jjlekYs1cfQ",
    title: "Dumbbell Floor Press - OPEX Exercise Library",
    channel: "OPEX Fitness",
    view: "side",
    span: "three reps in 9.5 s",
    prs: [373],
    date: "2026-09-14",
    exercises: ["Dumbbell Floor Press"],
    notes:
      "Borrowed the barbell bench press before. On the floor, knees 47-58, feet flat, hips down. Top: arms straight up over the shoulders (elbow 173-180, upper arm within 5 of plumb), wrists 0.94-1.01 trunk lengths over the shoulders. Bottom: the upper arm level on the floor, the far elbow 72-91, forearm near plumb, wrists 0.35-0.47 over the shoulders; the near elbow is hidden against the floor. Ours: top elbow 179, wrists 1.18 over (longer arms than hers); bottom elbow 81 on the floor, wrists 0.55. The elbows' 45-degree angle out from the trunk is not visible side on and is the usual floor-press position, not measured. Tempo at 0.2 s: down 1.2-1.4 s, 0.4-0.6 on the floor, up 0.4-0.6, 0.6-0.8 at the top.",
  },
  rackPull: {
    videoId: "d9sK2R95MMM",
    title: "Rack Pull",
    channel: "Testosterone Nation",
    view: "side",
    span: "three reps in 11 s",
    prs: [372],
    date: "2026-09-14",
    exercises: ["Rack Pull"],
    notes:
      "Borrowed the conventional deadlift (bar to the floor) before. Bar on pins just above the knee: wrists 0.17-0.23 trunk lengths over the knee, 0.24-0.28 ahead of the ankle; shins plumb, knee 150-164, hip 97-113, trunk 42-58 from vertical. Top: hip and knee 171-180. Half way: trunk ~34, hip 128, knee 163. Elbows 166-179. Ours: pins trunk 54, hip 105, knee 159, bar 0.25 ahead of the ankle and 0.29 over the knee; half 34/128/162; top 0/177/175. Tempo at 0.2 s: down 1.0-1.6 s, dead stop 0.8-1.4 on the pins, up 0.4-0.6, 0.6-0.8 at the top. 360p source.",
  },
  hackSquat: {
    videoId: "rYgNArpwE7E",
    title: "Hack Squat",
    channel: "Renaissance Periodization",
    view: "side",
    span: "three reps in 13 s",
    prs: [371],
    date: "2026-09-14",
    exercises: ["Hack Squat"],
    notes:
      "Borrowed the barbell back squat before. Camera about 25 degrees off square: horizontal lengths divided by 0.90, the scale at which thigh and shin keep their length across frames. Back on the pad 55-62 above level all rep. Top: knee 172-176, hip 163-166. Bottom: knee 24-32, hip 41-47. Half way: knee ~60, hip ~78. Ours: trunk 58; top knee 175, hip 165; half 60/79; bottom 27/41; ankle fixed, the hips then travel 5 degrees off the back's line. Tempo at 0.25 s: down 3.25-3.75 s, 0.25 at the bottom, up 1.0-1.25, 0.25-0.5 at the top. Hype Training & Coaching (u_1a0nWG7vQ) was more oblique and shallower (knee 48-59) and was not used.",
  },
  backExtension: {
    videoId: "muPROfbUBeg",
    title: "Exercise Library:  Back Extensions",
    channel: "Exercise Library",
    view: "side",
    span: "three reps, 15-27.5 s",
    prs: [370],
    date: "2026-09-14",
    exercises: ["Back Extension"],
    notes:
      "Borrowed the conventional deadlift before. 45-degree bench: hips on the pad, legs straight (knee 170-180) 53-56 down to the ankle roller, arms folded on the chest. Bottom: trunk 33-40 below level, hip 88-95 (ours 36, 90). Top: trunk 6-20 past the leg line (65-74 up); the cue says no further than straight, so ours takes the clip's least, 6 (trunk 60 up, hip 174). Tempo at 0.25 s: down 2.25-2.5 s, ~0.25 at the bottom, up 1.5-1.75, 0.5 at the top. OPEX's Roman Chair Back Extension (ZaLvgeHC_54) is filmed obliquely from behind and was not measured.",
  },

  // --- Batch 15: exercises that borrowed a different movement's pose ------
  archerPushUp: {
    videoId: "FcttBOkat5M",
    title: "Archer Push Up",
    channel: "OPEX Fitness",
    view: "head-end",
    span: "three sides in 9 s, the camera on the head",
    prs: [369],
    date: "2026-09-13",
    exercises: ["Archer Push-Up"],
    notes:
      "Borrowed the push-up before. Hands wide (wrists 2.5-2.7 shoulder widths apart) and fixed. Top: both elbows 178-180, shoulders centred, 1.03 shoulder widths over the wrists. Bottom: the shoulders ride 0.48-0.56 shoulder widths toward one hand, that elbow bends to 40-55 while the other stays straight (163-177), shoulders 0.29-0.35 over the wrists; then the other side. Authored side on with a new world-build `shift` for the trunk and `yaw` on each arm to reach the wide hands. Ours: top straight, the straight arm 38 off plumb as hers (wrists 3.1 shoulder widths apart on the figure's narrower shoulders); bottom elbow 48, shift 0.58, shoulders 0.42 over the wrists; half way elbow 82. Tempo at 0.2 s: down 1.0 s, 0.2-0.4 held, up 0.8, 0.4 at the top, a side every 2.4-2.6 s; the loop cannot hold, so the holds are shared into the legs. Fore-aft hand placement is not visible head-on.",
  },
  benchDip: {
    videoId: "yvAzWxRsnqU",
    title: "Bench Dip",
    channel: "OPEX Fitness",
    view: "side",
    span: "three reps in 14 s",
    prs: [368],
    date: "2026-09-13",
    exercises: ["Bench Dip"],
    notes:
      "Borrowed the parallel-bar dip before. Hands on a flat bench's edge behind, legs straight (knee 171-180), heels on the floor. Top: elbow 175-179, upper arm 18-23 back of plumb, trunk 19-27 back, hip 141-146, legs sloping 25-30. Bottom: elbow 88-97, upper arm near level (8-14 below), trunk 13-15 back, hip 115-117, legs 7-9, hips 0.36-0.44 trunk lengths under the hands. Ours: top elbow 179, trunk 23, legs 25; bottom elbow 89, upper arm 17 below level, trunk 14, legs 10 (at her 8 the figure's elbow bends to 81), hips 0.26 under the hands. Tempo at 0.25 s: down 2.75-3.0 s, ~0.25 at the bottom, up 1.0, 0.5 at the top.",
  },
  nordicCurl: {
    videoId: "UoR6civMWF8",
    title: "Nordic Hamstring Curls",
    channel: "OPEX Abbotsford",
    view: "side",
    span: "three reps in 14 s",
    prs: [367],
    date: "2026-09-13",
    exercises: ["Nordic Hamstring Curl"],
    notes:
      "Borrowed the lying machine leg curl before. Heels hooked under a dumbbell rack's low bar (drawn as an ankle roller). Kneeling tall: hip 171-176, thigh 1-7 behind plumb, trunk plumb, shins 16-24 up behind the knees throughout, arms along the sides. Half way: thigh 20-23 forward, trunk 28-38, hip 165-174, knee 90-95. Catch: thigh 81-83 forward, trunk 78-83, hip 175-179, knee 158-162, hands on the floor under the chest, elbows 77-81 (ours 77; the hands sit 0.61 trunk lengths back of the shoulders against her 0.39-0.48 -- her arms are shorter against her trunk). Tempo at 0.2 s: down 2.0-2.2 s (slow, then a fall into the hands), 0.2-0.4 on the hands, up 1.0-1.2, kneeling 1.2-1.4; tops 4.6 s apart. Her way up bends the hips (146-159); ours returns along the way down.",
  },
  vUp: {
    videoId: "4X3xVPrSNNg",
    title: "V-Up - OPEX Exercise Library",
    channel: "OPEX Fitness",
    view: "side",
    span: "three reps in 8 s",
    prs: [366],
    date: "2026-09-13",
    exercises: ["V-Up"],
    notes:
      "Borrowed the hollow hold before, which never leaves this movement's bottom. Bottom: a hollow, trunk 0-4 up, straight legs 6-10 up, straight arms overhead 10-16 up (ours 2, 8, 13). Top: a V on the seat, trunk 57-66 up, thighs 63-65, shins 43-52, arms 27-36 up toward the shins, hands 0.27-0.49 trunk lengths from the ankles (ours 61, 64, 48, 28, 0.51 -- her arms are longer against her trunk). Half way: trunk about 40, thighs 50, shins 25. Tempo at 0.2 s: up 0.8-1.0 s, 0.2 at the top, down 1.2-1.4, 0.4-0.6 in the hollow; tops 2.8 s apart.",
  },
  frogPump: {
    videoId: "KvdJEqifOLk",
    title: "Frog Pump",
    channel: "Impact Online Fitness Coaching",
    view: "side",
    span: "four reps, 25-35 s",
    prs: [365],
    date: "2026-09-13",
    exercises: ["Frog Pump"],
    notes:
      "Borrowed the barbell hip thrust (shoulders on a bench, knees forward) before. Side on: hips on the floor at the bottom (hip 130-142), one line to the knees at the top (171-180), trunk 15-20 up from the shoulders; hip-to-ankle over shoulder-to-hip 0.70-0.77 at the bottom, 0.95-1.04 at the top (ours 0.77, 0.95). The knee width is from a second clip, Colossus Fitness 'How to Do Frog Pumps for Bigger Glutes' (rgljhH1X4vc, 76-81 s, three-quarter view from the feet): ankles 0.6 hip widths apart, knees 1.9-2.4 (ours 0.65, 2.2), a ratio only. Tempo from the four side-on reps at 0.25 s: rise 0.5-0.75 s, hold 0.25-0.5, lower 0.5, rest 0.4-0.75, tops 2.0-2.25 s apart. A new leg `flare` opens the knees about the hip-to-ankle line. Cue: 'pulse the hips up' became a full rep with a squeeze and a controlled lowering, as both clips show.",
  },
  singleLegGluteBridge: {
    videoId: "6pvdY3sXUbo",
    title: "Single Leg Glute Bridge - OPEX Exercise Library",
    channel: "OPEX Fitness",
    view: "side",
    span: "one bridge held 7 s",
    prs: [364],
    date: "2026-09-13",
    exercises: ["Single-Leg Glute Bridge"],
    notes:
      "Borrowed the barbell hip thrust (shoulders on a bench, both feet down) before. The working side is the glute bridge's: shoulders on the floor, trunk 22-25 up from them, the working thigh on the same line, knee 69-72. The free leg is held straight up (knee 171-176), 10-14 past plumb toward the feet; OPEX's other single-leg bridge (F0JMcMVxJAU) holds the same straight leg. The library cue said the free knee was pulled in; it now says the leg is straight up. Already at the top when the clip starts, so the rise is never shown: no tempo.",
  },
  gluteBridge: {
    videoId: "szgXdRA2R6Y",
    title: "Glute Bridge - OPEX Exercise Library",
    channel: "OPEX Fitness",
    view: "side",
    span: "one bridge held 8 s",
    prs: [363],
    date: "2026-09-13",
    exercises: ["Glute Bridge"],
    notes:
      "Borrowed the barbell hip thrust (shoulders on a bench) before. On the floor: at the top the shoulders stay down and the body is one line to the knees (hip 179-180), trunk 25 up from the shoulders, knee 71-73, shin 8 off plumb, arms long on the floor. A second OPEX clip (ayy8owPQ61w) holds a lower bridge, hip 151-154, knee 95-100. Both clips are holds: the rise takes 0.6 s and nothing else of a rep is shown, so no tempo. Our hip line reaches 166 at the top with the ankle on the floor.",
  },

  // --- Batch 14: dumbbells, a medicine ball and a run ---------------------
  run: {
    videoId: "Jd8Jijb7jZY",
    title: "Slow motion running - side view",
    channel: "EMU Running Science Laboratory",
    view: "side",
    span: "about three stride cycles of slow motion",
    prs: [360],
    date: "2026-09-13",
    exercises: ["Sprint Intervals"],
    notes:
      "A college track athlete on a treadmill at 10 mph (~16 km/h): a fast run, not a flat-out sprint, and no real-time side-on sprint clip was found. MoveNet swaps the leg labels as they pass; legs told apart by what they do. Swing thigh at most 44-50 forward of plumb with the knee folded to 56-63; contact: front thigh 34-40 forward, knee 155-164, rear thigh 21-25 back, knee 103-117; support knee 137-145 under the body. Arms swing 13 forward to 55-64 back, elbows 60-95. Trunk 5-13 forward; hip 0.05 of the frame higher at contact than at midstance. CADENCE NOT MEASURED: the description says 100 fps capture and it plays at 30, but read that way it gives 73 steps a minute at 16 km/h, so the slow-down factor is unknown. A pre-roll ad with a Skip button runs first.",
  },

  medBallThrow: {
    videoId: "PNI1QKiWfiY",
    title: "Standing Med Ball Rotational Throw - Viking Strength Systems",
    channel: "Viking Strength Systems",
    view: "front",
    span: "two throws at a wall in 16 s",
    prs: [359],
    date: "2026-09-13",
    exercises: ["Rotational Med Ball Throw"],
    notes:
      "Facing the camera, the wall to one side; distances scaled by her shoulder width (0.15 of the frame). Load: ball just above the back hip, back knee 139-150, front 165-171. Release: hands 0.06-0.10 of the frame under the shoulders, 1.5 shoulder widths across from the hips' centre, elbows 141-155, trunk leaning 10-15 toward the wall. The shoulders turn past side-on (projected width +0.15 through zero to -0.04..-0.09), hips to ~100 degrees: our trunk has no twist about its long axis, so the turn is carried by the arms and lean and the far arm stays folded (97). Throw 0.2-0.4 s, follow-through held ~1 s, return 0.7 s, load ~1 s.",
  },

  medBallSlam: {
    videoId: "CkO1mfSBvv4",
    title: "How To Med Ball Slam",
    channel: "Third Space London",
    view: "three-quarter",
    span: "four slams in 8 s",
    prs: [358],
    date: "2026-09-13",
    exercises: ["Medicine Ball Slam"],
    notes:
      "A 30 s pre-roll ad with a Skip button runs first. The camera is a little in front: at the bottom the trunk and thigh point partly toward it (projected trunk 0.11-0.14 against 0.16-0.17 standing), so the trunk angle is read from its height (50-62) and the knee angle is not quoted. Bottom: hip down 23% of its standing height, hands 0.27 hip-heights over the ankle. Overhead: elbows 160-168. After the slam she stands with the ball at the belly (elbows 126-135) and presses it overhead. 2.25 s a slam: ~0.45 s overhead (the load at its end: knees 161-170, trunk 7-15), 0.45 s slam, 0.15 s at the floor, 0.6 s up, 0.6 s press. Our arms cannot reach the floor from that shallow a hinge: our bottom is trunk 65, hip down a third, knees 101.",
  },

  hipAbduction: {
    videoId: "CRpDEFu-a9c",
    title: "Standing Band Hip Abduction",
    channel: "OPEX Fitness",
    view: "front",
    span: "five reps in 10 s",
    prs: [357],
    date: "2026-09-13",
    exercises: ["Standing Hip Abduction"],
    notes:
      "Square front view; the working leg's projected length holds 0.31-0.33 of the frame all the way out, so it moves in the film plane. A first capture cropped the working ankle out of frame at the top (score 0.1): widen the crop to the side the leg goes. Top: leg 53-61 from plumb, knee 177-180; the working hip hikes 10-13 and the trunk leans away 6-9 more than at rest. Hands on the hips, elbows 84-112. 0.6 s out, a moment at the top, 0.75 s back, ~0.5 s standing -- 2.0 s a rep.",
  },

  oneArmRow: {
    videoId: "iLhwICt4R9A",
    title: "Dumbbell Three Point Row",
    channel: "OPEX Fitness",
    view: "side",
    span: "three reps in 7.2 s after a 1.4 s set-up",
    prs: [356],
    date: "2026-09-13",
    exercises: ["One-Arm Dumbbell Row"],
    notes:
      "Feet side by side under the hips (ankles 0.07 of the frame apart), knees 143-155, shins near plumb. Trunk 80 from vertical hanging, reading 67 at the top -- partly a turn of the rowing shoulder, which a side camera reads as pitch; our fixed brace hand allows 80 -> 74. Top: upper arm straight back along the body 3-7 above level, elbow 65-69, forearm 17-22 forward of plumb. Brace arm 140-155 at the elbow. 0.8 s up, 0.25 s top, 1.0-1.2 s down, 0.5 s hanging.",
  },

  kickback: {
    videoId: "MQOnCts9N9c",
    title: "Single Arm Dumbbell Tricep Kickback",
    channel: "OPEX Fitness",
    view: "side",
    span: "four reps in 7.8 s",
    prs: [355],
    date: "2026-09-13",
    exercises: ["Triceps Kickback"],
    notes:
      "One arm works, the other hand rests on the thigh. Trunk 61-68 from vertical over knees at 150-155 with the shins plumb. Upper arm 7-25 under level with the elbow folded to 77-87 and the forearm 10-30 forward of plumb, rising to 5-11 above level as the elbow locks out at 163-174 with the forearm straight back. 0.6 s to lock out, 0.3 s held, 0.8 s back, 0.2 s folded.",
  },

  frontRaise: {
    videoId: "E-E0EqERFBg",
    title: "Dumbbell Front Raise",
    channel: "OPEX Fitness",
    view: "front",
    span: "three reps in 8.4 s",
    prs: [354],
    date: "2026-09-13",
    exercises: ["Dumbbell Front Raise"],
    notes:
      "Face on, so the raise is read from height alone: hanging, the wrists sit 0.220-0.228 of the frame under the shoulders (the arm's full length), and the angle is the arccosine of the wrist's drop over that. Top: wrists 0.05-0.12 OVER the shoulders, 107-120 degrees from plumb, all three reps. The elbow sits 0.01-0.04 over the shoulder at the top where a straight arm puts it 0.035-0.06: about 158. 0.8 s up, 0.2-0.4 s top, 0.8-1.0 s down, 0.8 s hanging. The exercise cue says to shoulder height; the clip goes above it.",
  },

  // --- Batch 13: bodyweight, on the floor and upside down -----------------
  quadruped: {
    videoId: "FWjz8ozyVq8",
    title: "2 Point Bird Dog",
    channel: "OPEX Fitness",
    view: "side",
    span: "four reaches in 18 s, alternating",
    prs: [353],
    date: "2026-09-13",
    exercises: ["Bird Dog"],
    notes:
      "Held: reaching thigh straight back 2-5 above level, knee 145-165, reaching arm 5-15 UNDER level with the elbow straight; support arm plumb and locked (166-180), support thigh near plumb, knee 66-80; trunk 9-10 head-up on all fours, 3-6 reaching. Reach 1.0 s, hold 1.0 s (still lengthening: arm 14 to 11 under level, knee 148 to 152), return 0.75 s, 1.75 s on all fours, then the other side. Our trunk is 15-16 because our arm is long against our thigh; flatter bends the support elbow.",
  },

  mountainClimber: {
    videoId: "0Smb04SpyhU",
    title: "Mountain Climbers",
    channel: "OPEX Abbotsford",
    view: "side",
    span: "eight drives in 4 s at full pace",
    prs: [352],
    date: "2026-09-13",
    exercises: ["Mountain Climbers"],
    notes:
      "An unskippable-looking ad plays first; its Skip button appears after a few seconds. MoveNet swaps the legs' labels as they pass, so legs are told apart by shape (the one folded under 60 drives). Driving knee 40-55, hip 59-68, the knee a hand's height off the floor two fifths of the way from hip to shoulders, the foot trailing behind it. Elbows 172-180, shoulders over the hands, trunk within 7 degrees of level; planted knee 155-172, hip 139-156. A drive every 0.5 s, alternating: 1.0 s a full cycle.",
  },

  handstandPushUp: {
    videoId: "ic8cg0SQ8A4",
    title: "Strict Handstand Push Ups",
    channel: "Functional Bodybuilding",
    view: "three-quarter",
    span: "three reps in 5 s",
    prs: [351],
    date: "2026-09-13",
    exercises: ["Handstand Push-Up"],
    notes:
      "Frames ROTATED 180 degrees before MoveNet saw them (it is trained on upright people); every keypoint then scored 0.7-0.9. The camera stands off to the front, so the bottom elbow reads 98-103 on one arm and 143-147 on the other and is not quoted. Back and heels against a wall, legs straight up together (hip angle 170-180, knees locked). Nose ends 0.2 trunk lengths over the hands (crown on the floor); shoulders fall to 0.64 of their locked-out height over the hands. 0.7 s down, touch and go, 0.75 s up, ~0.1 s locked out -- 1.6 s a rep. The video autoplays into another clip after 9.9 s, which ruined one capture: check the title in the capture loop.",
  },

  pikePushUp: {
    videoId: "XckEEwa1BPI",
    title: "How to do a Pike Push-Up",
    channel: "National Academy of Sports Medicine (NASM)",
    view: "three-quarter",
    span: "four reps in 14 s",
    prs: [350],
    date: "2026-09-13",
    exercises: ["Pike Push-Up"],
    notes:
      "Three-quarter camera: horizontal distances not quoted. At the bottom the near wrist is hidden (score 0.1-0.2), so the bottom elbow is not quoted either. Top: near-side elbow 174-180, hip angle 63-72. Top to bottom the shoulders fall 0.5 trunk lengths and the hips 0.43, the hip angle opening to 75-78, the nose reaching the height of the hands. Hands at least 1.4 trunk lengths from the feet (projected). 1.0 s down, 0.3 s bottom, 0.8 s up, about 1 s at the top.",
  },

  pistolSquat: {
    videoId: "D934zSaVtU0",
    title: "Pistol Squat - OPEX Exercise Library",
    channel: "OPEX Fitness",
    view: "side",
    span: "three reps in 11 s",
    prs: [349],
    date: "2026-09-13",
    exercises: ["Pistol Squat"],
    notes:
      "MoveNet trades the left and right legs whenever they cross, so legs are told apart by behaviour (the folding knee is the support) and the trunk is read from shoulder-over-hip height, not the hip keypoint's jumping x. Standing, the free foot hangs just off the floor, knee 132-138; a fifth of the way down it is long at 40-47 forward of plumb, half way 60-75, level at the bottom (85-94) with the knee 153-157 and the heel just off the floor. Bottom: hip at 0.27 of standing height over the ankle, support knee 53-55, trunk 34-41. Arms forward 7-15 under level throughout. 1.3 s down, 0.25 s bottom, 1.0 s up, about 1 s standing. Our leg cannot reach her 0.27 without folding the knee to 46; the bottom takes knee 50 at 0.32.",
  },

  wallSit: {
    videoId: "cWTZ8Am1Ee0",
    title: "How to Do a Wall Sit Exercise | 30 Seconds | MedBridge",
    channel: "MedBridge",
    view: "side",
    span: "one sit held about 14 s",
    prs: [348],
    date: "2026-09-13",
    exercises: ["Wall Sit"],
    notes:
      "The video cuts between a side camera and a front one; numbers are from the side camera (thigh projects 0.15 of the frame there, 0.09 face on). Held: knee 101-104, shin plumb, trunk 3, the hip 0.13 trunk lengths above the knee (thigh 14 degrees under level), hands resting on the thighs (28 degrees forward of plumb, elbows 155). Standing she is half a trunk length clear of the wall with the hips over the ankles; she slides back and down in 2.5 s and up in 2.5 s. OPEX's face-on Wall Sit (CoGaiX4P_BQ) agrees on the thigh: knees 0.1 trunk lengths under the hips. The 14 s hold is a prescription; the card holds 4 s.",
  },

  bodyweightSquat: {
    videoId: "iiKn5FiVUjI",
    title: "Air Squat - OPEX Exercise Library",
    channel: "OPEX Fitness",
    view: "side",
    span: "three reps in 7 s",
    prs: [347],
    date: "2026-09-13",
    exercises: ["Bodyweight Squat"],
    notes:
      "The arms swing: hanging when standing (3 degrees off plumb, elbows 160), 121-125 from up a third of the way down, 106-113 at two thirds, 14 degrees under level at the bottom (elbows 146-149). The bottom is parallel -- hip crease level with the knee, thigh 78-88 from vertical, shin 23-26, knee 69-76, trunk 34-38, hip at 0.45 of its standing height over the ankle. 0.7 s down, 0.4 s at the bottom, 0.7 s up, 0.6 s standing. Model sides alternate frame to frame (near ankle 0.90 of the crop, far 0.85); angles are from the near-side frames.",
  },

  // --- Batch 12: the conditioning movements, which want a CADENCE ---------
  abWheelRollout: {
    videoId: "4HZCJLM5wBk",
    title: "Ab Wheel Rollout",
    channel: "OPEX Fitness",
    view: "side",
    span: "three reps in 14 s",
    prs: [346],
    date: "2026-09-13",
    exercises: ["Ab Wheel Rollout"],
    notes:
      "The start sits back: hips behind the knees (thigh 26 back from vertical), trunk 66 forward, hip angle 85-89, arms near plumb. Fully out knee, hip and shoulder make one line (hip angle 165-171), trunk level (87-91), arms reaching forward with the elbows long (142-175), wrists 0.26 trunk lengths under the shoulders. The camera looks down a little: the projected trunk grows 0.40 to 0.53 of the frame as it levels, so the START's trunk angle is the least certain number; hip angle and thigh direction are unaffected. Our wheel handles cannot sit lower than the kneeling knee joint (5 cm minimum wheel radius), so the arms land near 80 from plumb against her 71. 1.75 s out and 1.75 s back in all three reps, about 0.4 s held long and 0.6 s at the start.",
  },

  clean: {
    videoId: "0u97BVlVib0",
    title: "Hang Clean",
    channel: "OPEX Fitness",
    view: "side",
    span: "two reps in 18 s",
    prs: [345],
    date: "2026-09-13",
    exercises: ["Hang Clean"],
    notes:
      "The old pose was a clean from the floor. From a stand with the bar at the hips she dips -- shoulders down 0.24 trunk lengths, bar to just above the knee -- pulls tall onto her toes with the bar at the chest, and catches in a FULL squat: hip at 0.28 of its standing height over the ankle, knee 0.3 trunk lengths above the hip, trunk 20-25 forward (ours caught at 0.86, knee 117). Wrists 0.02-0.04 of the frame over the shoulders in the rack. The near plate covers the hip in the dip (the projected trunk shrinks 0.23 to 0.17, which a rigid segment cannot), so the dip is read from the shoulder's fall, not the hip angle. Dip 0.5 s, pull 0.5, into the catch 1.0 (both reps), stand 0.9, lower 0.8, stand 0.5; the 1.5 s demonstration holds in the rack and the hang are left out.",
  },

  burpee: {
    videoId: "Ozqwsv3kggA",
    title: "Burpee",
    channel: "OPEX Fitness",
    view: "side",
    span: "four burpees in 10.75 s",
    prs: [344],
    date: "2026-09-13",
    exercises: ["Burpee"],
    notes:
      "Measured in the lifter's own trunk lengths (hip to shoulder, 0.271 of the crop standing). The bottom is chest to floor in all three reps it is seen in -- hip and shoulder down at the wrists' height for two frames running, elbows 59-73 -- not a plank. With the hands planted the crouch is high: knees 121-136, hip angle 36-56, heels up, the hip within 0.08 trunk lengths of standing. The press out leads with the chest (shoulders 0.40 up, hips still down, elbows 104-113). At the apex the wrists are 0.32 above the shoulders with the elbows bent 72-91 and the hip 0.28 over standing. 3.25 s a burpee, apex to apex. He turns toward the camera in flight, so the plane the arms rise in is not quotable -- only their height and bend.",
  },

  sledPush: {
    videoId: "rB4LFuZM_i8",
    title: "Sled Push",
    channel: "OPEX Fitness",
    view: "side",
    span: "three stride cycles in 3.75 s",
    prs: [343],
    date: "2026-09-13",
    exercises: ["Sled Push"],
    notes:
      "She crosses the frame, so the crop FOLLOWED her, centred on a position read off two probe frames; at a fixed full-frame crop MoveNet found only part of her. The sled does not hide the legs -- ankles score 0.61 to 0.94. One leg drives out to 166-177 while the other folds to 72-84, the recovering foot lifting 0.42 trunk lengths, trading every step. The elbows hold 161 to 179, the arm forward and 24 degrees below horizontal. The trunk leans 67 degrees off vertical. A full stride cycle takes 1.1 s. The projected trunk grows from 0.228 to 0.316 of the frame over the clip because she walks toward the camera, not because of any yaw.",
  },

  battleRopes: {
    videoId: "4aT3IyKOo5M",
    title: "Battling Ropes",
    channel: "OPEX Fitness",
    view: "side",
    span: "eight wave cycles in 3.5 s",
    prs: [342],
    date: "2026-09-13",
    exercises: ["Battle Ropes"],
    notes:
      "Read at 0.1 s rather than the usual 0.3, because a rope wave is fast enough to alias at the slower rate. The camera was expected to give little and gave a lot. The trunk holds 57 to 63 degrees off vertical, mean 59.5, in every frame -- bent over the ropes. The hands never rise above the shoulder: the up hand turns at 0.29 trunk lengths below it with the elbow at 88, the down hand drives to 1.06 below with the elbow at 145. The two wrists run in clean antiphase, their height difference swinging plus and minus 0.21 of the frame. A full cycle takes 0.44 s -- nine peaks over 3.5 s, 2.3 waves a second. The squat under it matched ours already: hip height over trunk length 1.51.",
  },

  landminePress: {
    videoId: "y5RxyrjwKFk",
    title: "Landmine Standing Press",
    channel: "OPEX Fitness",
    view: "side",
    span: "three reps in 12.6 s",
    prs: [341],
    date: "2026-09-13",
    exercises: ["Landmine Press"],
    notes:
      "Pressed with ONE hand while the other hangs, matching the library's unilateral flag; ours cupped the bar with both. Shoulder-to-wrist over a straight arm runs 40% with the bar at the shoulder (elbow 40), 67% at half the extension, 94% locked out (elbow 149), the arm sweeping from 118 degrees off vertical to 56. The trunk leans 8 degrees at the shoulder and 20 locked out. Period 4.2 s: 1.05 s up, 0.7 s locked, 1.75 s down, 0.7 s at the shoulder. The clip offers only 480p.",
  },

  bicycleCrunch: {
    videoId: "cbKIDZ_XyjY",
    title: "Bicycle Crunch",
    channel: "Wodstar",
    view: "side",
    span: "two full pedal cycles in the 4 s MoveNet could read",
    prs: [340],
    date: "2026-09-12",
    exercises: ["Bicycle Crunch"],
    notes:
      "The only non-OPEX clip in the library: OPEX has no bicycle crunch. MoveNet reads only 3.3 to 7.2 s of the 10 s clip. In that window the elbows ALTERNATE in antiphase with the knees -- the near elbow travels 0.46 of the frame toward the tucked knee and back, twice -- and the shoulder keypoints separate from 0.001 of the frame to 0.139 as the trunk turns. The tucked knee reads 52 to 60 and the long knee 147 to 168. A full pedal takes 1.96 s. What it CANNOT settle is the twist in degrees: a side camera reads rotation about the long axis as keypoints sliding past each other, not as an angle.",
  },

  bandedLateralWalk: {
    videoId: "pzQ2M_iY0D8",
    title: "Banded Lateral Walks",
    channel: "OPEX Fitness",
    view: "front",
    span: "six step cycles in 8.4 s",
    prs: [339],
    date: "2026-09-12",
    exercises: ["Banded Lateral Walk"],
    notes:
      "A square front view -- the shoulder separation holds 0.172 to 0.183 of the frame throughout. The body TRAVELS: the hip crosses 1.10 of the frame in 8.4 s because the feet alternate, lead out then trail in, six times. The step is 1.04 shoulder widths and the stance swings between 0.71 closed and 1.73 open, which differ by exactly one step -- that is what says the trail foot closes the whole gap the lead opened. The stepping foot lifts 3 cm. A full cycle takes 1.44 s, the mean of five gaps. What the clip CANNOT settle is the knee: a front camera cannot read a knee bending toward the lens and reports 146 to 180 with no pattern, so the squat depth is set from the hip HEIGHT instead, 2.25 shoulder widths above the ankle.",
  },

  // --- Batch 11: the leftovers, picked by measured defect -----------------
  legExtension: {
    videoId: "s1JfTvyWdTs",
    title: "Leg Extension Machine",
    channel: "OPEX Fitness",
    view: "side",
    span: "three reps in 6.6 s",
    prs: [338],
    date: "2026-09-12",
    exercises: ["Leg Extension"],
    notes:
      "It CANNOT measure the leg, which on a leg extension is awkward: the machine's frame stands between the camera and the shin, so the ankle keypoint scores 0.03 to 0.27 across all 37 frames and the knee 0.10 to 0.39, and the knee angle they give wanders 66 / 128 / 137 / 105 with no rep in it. A second clip on the same machine (U0tcA7b4c3k) is no better, 0.12 to 0.39, and a brightness probe of the patch the shin sweeps through -- which needs no pose model -- varied four levels out of 255. So NO TEMPO was taken from it and the knee range was left alone. What it does settle is the TRUNK: reclined against a backrest at 25 degrees off vertical, 23.8 to 29.4 over 27 frames with shoulder scores 0.69 to 0.81 and the projected trunk steady to 4%, against our bolt-upright 4.",
  },

  singleLegHinge: {
    videoId: "pJewPISyHjw",
    title: "Dumbbell Single Leg Romanian Deadlift",
    channel: "OPEX Fitness",
    view: "side",
    span: "four reps in 14.8 s",
    prs: [337],
    date: "2026-09-12",
    exercises: ["Single-Leg Romanian Deadlift", "Single-Leg Deadlift"],
    notes:
      "Read as fractions of the standing hip height. The hip travels 28% of it BACK -- from 11% in front of the standing ankle to 17% behind -- while the shoulder goes the other way; ours walked the pelvis 20% FORWARD. The standing knee holds 173 to 153, twenty degrees, against our fifty four. The trunk reaches 104 off vertical and the hip gives up only 3% of its height. The FREE LEG is taken by angle, not position: its ankle projects 0.370 of the frame from the hip where a straight leg of hers is 0.481, so it swings a fifth of its length out of the film plane -- but the clip does settle that it hangs plumb at the top, reaches 57 degrees behind plumb at the halfway point, and finishes level with the hip, knee near straight at 158.",
  },

  inclineCurl: {
    videoId: "aG7CXiKxepw",
    title: "Incline Dumbbell Curl",
    channel: "OPEX Fitness",
    view: "side",
    span: "three reps in 11.2 s",
    prs: [336],
    date: "2026-09-12",
    exercises: ["Incline Dumbbell Curl"],
    notes:
      "Square side view -- the projected trunk holds 0.249 to 0.288 of the frame throughout. The elbow runs 178 straight down to 26 at the top, the same to within 4 degrees across three reps; ours stopped at 87. The upper arm does not quite hold still either: it drifts 23 degrees further behind the torso as the curl closes, 183 to 206. And the trunk measures 41.5 degrees off vertical, mean over 33 frames, against our 54 -- unlike the incline PRESS, whose lifter arches and whose trunk therefore reads 19 degrees more upright than his own pad, nobody arches on a curl, so here the trunk IS the pad.",
  },

  inclinePress: {
    videoId: "PZ7waXzAzZc",
    title: "Incline Barbell Bench Press",
    channel: "OPEX Fitness",
    view: "side",
    span: "three reps in 6 s",
    prs: [335],
    date: "2026-09-12",
    exercises: ["Incline Barbell Bench Press", "Incline Dumbbell Press"],
    notes:
      "Square side view -- the projected trunk holds 0.123 to 0.158 of the frame throughout, so the sagittal angles are usable. Shoulder-to-wrist over a straight arm runs 98% at lockout to 50% at the chest, the same to within 2% across three reps, elbow 157 to 48. What it CANNOT give is the trunk: his hip-to-shoulder line sits 31 degrees off vertical while the pad is nearer 50, the difference being his arch, and our trunk is a rigid segment lying on the pad. So the arm angles are taken RELATIVE TO THE TRUNK -- 58 degrees off it at lockout, 121 at the chest -- and re-projected onto ours.",
  },

  reverseFly: {
    videoId: "qDnwFycUW0I",
    title: "Cable Reverse Fly",
    channel: "OPEX Fitness",
    view: "back",
    span: "three reps in 10.5 s",
    prs: [334],
    date: "2026-09-12",
    exercises: ["Dumbbell Reverse Fly"],
    notes:
      "A SUBSTITUTION, and the reason is the camera. The two dumbbell clips in the OPEX library (o8x-WppEits, 3cKWQo6tCg0) were measured first and set aside: both are filmed near side on, shoulders only 23 and 30 px apart in frame, so the lateral spread -- the one thing this movement is -- lies along the camera axis and cannot be told apart from one arm forward and one arm back. This one is filmed from BEHIND and settles it: the wrists run 1.0 shoulder widths, hanging straight under the shoulders, to 3.8 wide open, the same to within 0.07 across three reps, with the wrist within 0.005 of shoulder height at every top and the elbow held at 143 to 158, mean 151. It is the STANDING cable version, so it settles nothing about the trunk -- ours stays hinged at 92 -- but the joint doing the work, horizontal abduction of the shoulder, is the same lift.",
  },

  seatedCalfRaise: {
    videoId: "2Q-HQ3mnePg",
    title: "Seated Calf Raise Machine",
    channel: "OPEX Fitness",
    view: "side",
    span: "five reps in 8.4 s",
    prs: [333],
    date: "2026-09-12",
    exercises: ["Seated Calf Raise"],
    notes:
      "What it settles beyond argument: the machine puts the ball of the foot on a RAISED PLATE and the heel drops below plate level, which is where the calf is stretched -- ours had the foot flat on the floor, so that half of the range did not exist. It also holds the knee at 83 to 89 degrees in all 37 frames, mean 86. What it CANNOT settle is any travel distance: its hip keypoint rises 8 cm over a rep, which a seated hip on a fixed seat cannot do, so the whole skeleton estimate drifts in phase with the lift and its scale is untrustworthy here. The heel range is therefore authored from the plate geometry and capped by keeping the knee inside the clip's own band at the start.",
  },

  curtsyLunge: {
    videoId: "7ptRZXL5MBs",
    title: "Goblet Curtsy Squat",
    channel: "OPEX Fitness",
    view: "front",
    span: "three reps in 10.8 s",
    prs: [332],
    date: "2026-09-12",
    exercises: ["Curtsy Lunge"],
    notes:
      "Read as RATIOS of the standing hip height, because his proportions are not the model's -- his thigh is 0.58 of his hip height and ours 0.50. The hip drops 47% of that height (ours 30%); the TRAILING KNEE arrives at the floor, level with the standing ankle, where ours stopped 22% up; the trailing heel lifts to 14% with the knee BELOW it; the trailing foot finishes 1.5 shoulder widths past the standing foot from a stance of 0.72; and the trunk leaves vertical by 15 degrees AWAY from the crossing leg. A front camera cannot read a knee angle in this movement -- the standing shin travels forward, out of the film plane -- so no knee angle is quoted.",
  },

  // --- Batch 10: the cable family ----------------------------------------
  cableKickback: {
    videoId: "iElJ4Ngx--k",
    title: "Cable Glute Kickback",
    channel: "OPEX Fitness",
    view: "side",
    span: "four reps in 12.3 s",
    prs: [331],
    date: "2026-09-12",
    exercises: ["Cable Kickback"],
    notes: "Close to square -- the projected trunk holds 0.234 to 0.264 of the frame throughout -- so the sagittal angles are usable. The working KNEE NEVER STRAIGHTENS: 134 at the bottom, 119 at full extension, and the largest reading anywhere in the clip is 151 on a single frame. The trunk is hinged over a bench at 46 degrees at every top position in all four reps. The hands are still, moving 0.014 of the frame horizontally across a whole rep, and sit only 0.085 in front of the pelvis.",
  },

  cableCrunch: {
    videoId: "2ndlUfl5JPo",
    title: "Kneeling Cable Crunch",
    channel: "OPEX Fitness",
    view: "three-quarter",
    span: "three reps in 9.6 s",
    prs: [330],
    date: "2026-09-11",
    exercises: ["Cable Crunch"],
    notes: "Not square to the lifter -- the projected trunk runs 0.23 to 0.33 of the frame as she turns through the rep -- so the angles are read the projection-proof way, from the VERTICAL drop of the shoulder below the hip over a trunk of 0.330. On those terms the hip-to-shoulder line sweeps 33 to 121 degrees off vertical, the same to within 3 degrees in all three reps, and at the bottom her NOSE IS BELOW HER KNEE. Her hips also rise off the heels as she curls, 0.255 to 0.279 above the knee. Our trunk is one rigid segment and hers rounds, so the pose matches the line her hip and shoulder make, not the shape of her spine.",
  },

  cablePullThrough: {
    videoId: "A30YKvpWGu4",
    title: "Cable Pull Through",
    channel: "OPEX Fitness",
    view: "three-quarter",
    span: "four reps in 12.6 s",
    prs: [329],
    date: "2026-09-11",
    exercises: ["Cable Pull-Through"],
    notes: "NOT square to the lifter: the trunk projects 0.268 of the frame standing and 0.181 at the bottom, and a rigid trunk cannot lose a third of its length to a square side camera. So no horizontal distance from this clip is quotable. What it does settle is anything measured in HEIGHT -- the hip stays level (0.432 to 0.430 above the ankle), the trunk reaches 104 from vertical, the arm swings from 9 degrees forward of straight down to 66 behind it -- plus the DIRECTION of hip and shoulder travel, which no projection reverses, plus the tempo.",
  },

  straightArmPulldown: {
    videoId: "nAkTIeJ_Aus",
    title: "Standing Cable Straight Arm Pulldown",
    channel: "OPEX Fitness",
    view: "side",
    span: "three reps in 11.2 s",
    prs: [328],
    date: "2026-09-11",
    exercises: ["Straight-Arm Pulldown"],
    notes: "The shoulder-to-wrist line -- the line a locked arm makes -- reads 64 from vertical at the start and 167 at the finish, in all three reps within 5 degrees; ours started at 41, almost straight overhead. The clip CANNOT settle the elbow at the top: this lifter stands close enough that the bar reaches his forehead and his elbow folds to about 135 there, which is the clip rather than the lift, so the hand path is taken and the arm is kept locked.",
  },

  facePull: {
    videoId: "5ZC4LagfDQ4",
    title: "Cable Rope Face Pull",
    channel: "OPEX Fitness",
    view: "side",
    span: "four reps in 11.6 s",
    prs: [327],
    date: "2026-09-11",
    exercises: ["Face Pull"],
    notes: "Both hands finish beside the head and MoveNet tangles the near and far arm there, so the elbow angles are unusable and are not quoted. What the frames show plainly is the pulley height -- well above the head -- and that the elbows stay high.",
  },

  cableCurl: {
    videoId: "h9DPY5pCaGA",
    title: "Cable Curl",
    channel: "OPEX Fitness",
    view: "side",
    span: "four reps in 12.1 s",
    prs: [326],
    date: "2026-09-11",
    exercises: ["Cable Curl"],
    notes: "Elbow 160 hanging to 24-31 at the top, upper arm staying at the side. Ours stopped at 102 and its first two keys were 160 and 158, so the opening third of the animation did not move.",
  },

  cableLateralRaise: {
    videoId: "dQPTeeqgJqA",
    title: "Cable Lateral Raise",
    channel: "OPEX Fitness",
    view: "front",
    span: "four reps in 12.1 s",
    prs: [325],
    date: "2026-09-11",
    exercises: ["Cable Lateral Raise"],
    notes: "Low pulleys, which the pose already had. What it corrected was the finish: the clip takes the hand ABOVE the shoulder, ours stopped 5 cm below it.",
  },

  cableFly: {
    videoId: "jtkaC-mq1Xk",
    title: "Cable Fly - OPEX Exercise Library",
    channel: "OPEX Fitness",
    view: "front",
    span: "four reps in 12.4 s",
    prs: [324],
    date: "2026-09-11",
    exercises: ["Cable Chest Fly"],
    notes: "A front camera cannot see an arm reaching forward, so the elbow angle in this clip is a projection and is not used; what it settles is the HAND PATH -- one height, wide to together -- and the pulley height.",
  },

  lateralLunge: {
    videoId: "rSaWYv37zzE",
    title: "Goblet Cossack Squat - OPEX Exercise Library",
    channel: "OPEX Fitness",
    view: "front",
    span: "four reps in 15.7 s",
    prs: [323],
    date: "2026-09-11",
    exercises: ["Cossack Squat"],
    notes: "The pose STEPS OUT from a narrow stance, which Lateral Lunge did while it shared it; the clip holds one wide stance throughout and shifts side to side, which is the cossack. What transferred is the depth, the dead-straight trailing leg, the hands and the tempo. Lateral Lunge has its own pose now (sideLunge).",
  },

  proneRaise: {
    videoId: "W8vlZfmxOpM",
    title: "Superman Hold - OPEX Exercise Library",
    channel: "OPEX Fitness",
    view: "side",
    span: "a 7 s hold",
    prs: [322],
    date: "2026-09-11",
    exercises: ["Superman"],
    notes: "A hold, so it gives one position and no tempo. It confirmed the trunk and legs (ankle lift 19.2 cm against the clip's 19.3) and corrected the arms, which finished 15.6 cm above the head. Prone Y-T-W Raise and Reverse Snow Angel share this pose and both lift the arms, so the top is a compromise between the three.",
  },

  invertedRow: {
    videoId: "B90sF7dbP04",
    title: "Ring Row",
    channel: "OPEX Fitness",
    view: "side",
    span: "four reps in 10.8 s",
    prs: [321],
    date: "2026-09-11",
    exercises: ["Inverted Row"],
    notes: "The clip is on rings; the pose draws a fixed bar, which is why the top stops at the shallow end of the clip's elbow band -- on rings the head passes between them, under a bar it does not.",
  },

  calfRaise: {
    videoId: "LnWEIjIls-M",
    title: "Standing Calf Raise",
    channel: "OPEX Fitness",
    view: "back",
    span: "four reps in 11.6 s",
    prs: [320],
    date: "2026-09-11",
    exercises: ["Bodyweight Calf Raise", "Dumbbell Calf Raise"],
    notes: "Filmed from behind and done on a LEDGE with the heels dropping below the step, so it settles the tempo and nothing about the angles; the pose draws the floor version the library cue describes and its range was left alone. Single-Leg Calf Raise borrows this pose.",
  },

  legCurl: {
    videoId: "xKOyGU0AfOE",
    title: "Prone Hamstring Curl Machine",
    channel: "OPEX Fitness",
    view: "side",
    span: "four reps in 12.4 s",
    prs: [319],
    date: "2026-09-11",
    exercises: ["Lying Leg Curl", "Seated Leg Curl"],
    notes: "MoveNet scores only 0.26-0.71 on this one (small figure, gym clutter, the two legs confused when curled), so the range was read from the clusters the whole clip agrees on rather than per-frame angles. Nordic Hamstring Curl is ALSO mapped to this pose and should not be: it is a kneeling bodyweight movement with no machine.",
  },

  lunge: {
    videoId: "Q2k3kYbtOcI",
    title: "Dumbbell Reverse Lunge",
    channel: "OPEX Fitness",
    view: "side",
    span: "three reps in 11.7 s",
    prs: [318],
    date: "2026-09-11",
    exercises: ["Bodyweight Reverse Lunge", "Dumbbell Lunge"],
    notes: "Barbell Walking Lunge borrows this pose; the split stance is held throughout rather than stepped, which is the library convention for the lunge family.",
  },

  gobletSquat: {
    videoId: "pEGfGwp6IEA",
    title: "Goblet Squat - OPEX Exercise Library",
    channel: "OPEX Fitness",
    view: "three-quarter",
    span: "three reps in 11.2 s",
    prs: [317, 400],
    date: "2026-09-11",
    exercises: ["Goblet Squat"],
    notes: "Confirms the shared squat frames (parallel bottom, same hip drop) rather than correcting them; a three-quarter camera cannot settle the trunk angle. What it settled was the tempo and the fact that the bell stays ON the chest.",
  },

  hinge: {
    videoId: "TN3DHmd1Fe8",
    title: "Conventional Deadlift - OPEX Exercise Library",
    channel: "OPEX Fitness",
    view: "side",
    span: "three reps in 13.8 s",
    prs: [316],
    date: "2026-09-11",
    exercises: ["Conventional Deadlift"],
    notes: "The clip lowers the bar to just off the floor rather than setting it down.",
  },

  kneePushUp: {
    videoId: "8XQ-okb5NWE",
    title: "Knee Push Up - OPEX Exercise Library",
    channel: "OPEX Fitness",
    view: "side",
    span: "six reps in 11 s",
    prs: [315],
    date: "2026-09-11",
    exercises: ["Knee Push-Up"],
  },
};

export function referenceClipUrl(clip: ReferenceClip): string {
  return `https://www.youtube.com/watch?v=${clip.videoId}`;
}
