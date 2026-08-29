import type { ImageSourcePropType } from "react-native";

// Demo footage the app already ships, keyed by the exercise-library name.
//
// The library is much larger than our media, and will stay that way until
// footage is shot for the rest. Rather than let that hold the library back,
// these are the movements we can already show; everything else falls back to
// its written cue.
//
// Keys must match `name` in exerciseLibrary.ts exactly -- there is a test for
// that in the verification script, since a typo here fails silently as
// "no demo yet" rather than as an error.
export type ShippedMedia = {
  video: number;
  formFrames: [ImageSourcePropType, ImageSourcePropType];
};

const maleMedia: Record<string, ShippedMedia> = {
  "Bodyweight Squat": {
    video: require("../assets/exercise-videos/male-bodyweight-squat.mp4"),
    formFrames: [
      require("../assets/exercises/male-bodyweight-squat/start.jpg"),
      require("../assets/exercises/male-bodyweight-squat/finish.jpg"),
    ],
  },
  "Bodyweight Reverse Lunge": {
    video: require("../assets/exercise-videos/male-bodyweight-lunge.mp4"),
    formFrames: [
      require("../assets/exercises/male-bodyweight-lunge/start.jpg"),
      require("../assets/exercises/male-bodyweight-lunge/finish.jpg"),
    ],
  },
  Burpee: {
    video: require("../assets/exercise-videos/male-burpee.mp4"),
    formFrames: [
      require("../assets/exercises/male-burpee/start.jpg"),
      require("../assets/exercises/male-burpee/finish.jpg"),
    ],
  },
  Plank: {
    video: require("../assets/exercise-videos/male-plank.mp4"),
    formFrames: [
      require("../assets/exercises/male-plank/start.jpg"),
      require("../assets/exercises/male-plank/finish.jpg"),
    ],
  },
  "High Knees": {
    video: require("../assets/exercise-videos/male-high-knees.mp4"),
    formFrames: [
      require("../assets/exercises/male-high-knees/start.jpg"),
      require("../assets/exercises/male-high-knees/finish.jpg"),
    ],
  },
  "Bodyweight Calf Raise": {
    video: require("../assets/exercise-videos/male-calf-raise.mp4"),
    formFrames: [
      require("../assets/exercises/male-calf-raise/start.jpg"),
      require("../assets/exercises/male-calf-raise/finish.jpg"),
    ],
  },
  "Pull-Up": {
    video: require("../assets/exercise-videos/male-pull-up.mp4"),
    formFrames: [
      require("../assets/exercises/male-pull-up/start.jpg"),
      require("../assets/exercises/male-pull-up/finish.jpg"),
    ],
  },
  "Bar Dip": {
    video: require("../assets/exercise-videos/male-bar-dip.mp4"),
    formFrames: [
      require("../assets/exercises/male-bar-dip/start.jpg"),
      require("../assets/exercises/male-bar-dip/finish.jpg"),
    ],
  },
  "Hanging Leg Raise": {
    video: require("../assets/exercise-videos/male-hanging-leg-raise.mp4"),
    formFrames: [
      require("../assets/exercises/male-hanging-leg-raise/start.jpg"),
      require("../assets/exercises/male-hanging-leg-raise/finish.jpg"),
    ],
  },
  "Dumbbell Bench Press": {
    video: require("../assets/exercise-videos/male-dumbbell-bench-press.mp4"),
    formFrames: [
      require("../assets/exercises/dumbbell-bench-press/start.jpg"),
      require("../assets/exercises/dumbbell-bench-press/finish.jpg"),
    ],
  },
  "Dumbbell Shoulder Press": {
    video: require("../assets/exercise-videos/male-shoulder-press.mp4"),
    formFrames: [
      require("../assets/exercises/dumbbell-shoulder-press/start.jpg"),
      require("../assets/exercises/dumbbell-shoulder-press/finish.jpg"),
    ],
  },
  "Dumbbell Lunge": {
    video: require("../assets/exercise-videos/male-dumbbell-lunge.mp4"),
    formFrames: [
      require("../assets/exercises/male-dumbbell-lunge/start.jpg"),
      require("../assets/exercises/male-dumbbell-lunge/finish.jpg"),
    ],
  },
  "Seated Cable Row": {
    video: require("../assets/exercise-videos/male-seated-row.mp4"),
    formFrames: [
      require("../assets/exercises/seated-cable-row/start.jpg"),
      require("../assets/exercises/seated-cable-row/finish.jpg"),
    ],
  },
  "Goblet Squat": {
    video: require("../assets/exercise-videos/male-bodyweight-squat.mp4"),
    formFrames: [
      require("../assets/exercises/goblet-squat/start.jpg"),
      require("../assets/exercises/goblet-squat/finish.jpg"),
    ],
  },
};

const femaleMedia: Record<string, ShippedMedia> = {
  "Bodyweight Squat": {
    video: require("../assets/exercise-videos/female-bodyweight-squat.mp4"),
    formFrames: [
      require("../assets/exercises/female-bodyweight-squat/start.jpg"),
      require("../assets/exercises/female-bodyweight-squat/finish.jpg"),
    ],
  },
  "Push-Up": {
    video: require("../assets/exercise-videos/female-push-up.mp4"),
    formFrames: [
      require("../assets/exercises/female-bodyweight-pushup/start.jpg"),
      require("../assets/exercises/female-bodyweight-pushup/finish.jpg"),
    ],
  },
  "Bodyweight Reverse Lunge": {
    video: require("../assets/exercise-videos/female-bodyweight-lunge.mp4"),
    formFrames: [
      require("../assets/exercises/female-bodyweight-lunge/start.jpg"),
      require("../assets/exercises/female-bodyweight-lunge/finish.jpg"),
    ],
  },
  Plank: {
    video: require("../assets/exercise-videos/female-plank.mp4"),
    formFrames: [
      require("../assets/exercises/female-plank/start.jpg"),
      require("../assets/exercises/female-plank/finish.jpg"),
    ],
  },
  "Glute Bridge": {
    video: require("../assets/exercise-videos/female-glute-bridge.mp4"),
    formFrames: [
      require("../assets/exercises/female-glute-bridge/start.jpg"),
      require("../assets/exercises/female-glute-bridge/finish.jpg"),
    ],
  },
  "Mountain Climbers": {
    video: require("../assets/exercise-videos/female-mountain-climbers.mp4"),
    formFrames: [
      require("../assets/exercises/female-mountain-climbers/start.jpg"),
      require("../assets/exercises/female-mountain-climbers/finish.jpg"),
    ],
  },
  "Hanging Knee Raise": {
    video: require("../assets/exercise-videos/female-knee-raise.mp4"),
    formFrames: [
      require("../assets/exercises/female-knee-raise/start.jpg"),
      require("../assets/exercises/female-knee-raise/finish.jpg"),
    ],
  },
  "Dumbbell Romanian Deadlift": {
    video: require("../assets/exercise-videos/female-dumbbell-deadlift.mp4"),
    formFrames: [
      require("../assets/exercises/female-dumbbell-rdl/start.jpg"),
      require("../assets/exercises/female-dumbbell-rdl/finish.jpg"),
    ],
  },
  "Dumbbell Shoulder Press": {
    video: require("../assets/exercise-videos/female-shoulder-press.mp4"),
    formFrames: [
      require("../assets/exercises/female-dumbbell-bench-press/start.jpg"),
      require("../assets/exercises/female-dumbbell-bench-press/finish.jpg"),
    ],
  },
  "One-Arm Dumbbell Row": {
    video: require("../assets/exercise-videos/female-dumbbell-row.mp4"),
    formFrames: [
      require("../assets/exercises/female-dumbbell-row/start.jpg"),
      require("../assets/exercises/female-dumbbell-row/finish.jpg"),
    ],
  },
  "Dumbbell Lunge": {
    video: require("../assets/exercise-videos/female-dumbbell-lunge.mp4"),
    formFrames: [
      require("../assets/exercises/female-reverse-lunge/start.jpg"),
      require("../assets/exercises/female-reverse-lunge/finish.jpg"),
    ],
  },
  "Goblet Squat": {
    video: require("../assets/exercise-videos/female-dumbbell-squat.mp4"),
    formFrames: [
      require("../assets/exercises/female-goblet-squat/start.jpg"),
      require("../assets/exercises/female-goblet-squat/finish.jpg"),
    ],
  },
  "Bar Dip": {
    video: require("../assets/exercise-videos/female-bar-dip.mp4"),
    formFrames: [
      require("../assets/exercises/female-bar-dip/start.jpg"),
      require("../assets/exercises/female-bar-dip/finish.jpg"),
    ],
  },
};

// Push-ups have male footage under a differently-shaped asset folder than the
// rest, so the male entry is added here rather than inline above.
maleMedia["Push-Up"] = {
  video: require("../assets/exercise-videos/male-push-up.mp4"),
  formFrames: [
    require("../assets/exercises/male-bodyweight-squat/start.jpg"),
    require("../assets/exercises/male-bodyweight-squat/finish.jpg"),
  ],
};

export function shippedMediaFor(name: string, sex: string | undefined): ShippedMedia | null {
  const roster = sex === "male" ? maleMedia : femaleMedia;
  return roster[name] ?? null;
}

export function shippedMediaNames(): string[] {
  return [...new Set([...Object.keys(maleMedia), ...Object.keys(femaleMedia)])];
}
