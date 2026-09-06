// The demo figure is built to the person using the app -- their sex, their
// build from height and weight, and how trained they are -- so the coach on
// the card looks like them. It reads the live profile, so when the weight
// they keep there changes, the figure changes with it.

export type AvatarBuild = {
  sex: "male" | "female" | "unknown";
  // 1 = the reference athlete (BMI 22.5); below is leaner, above heavier.
  // Drives trunk width, belly depth and limb thickness.
  bulk: number;
  // 1 = the reference; above is more trained. On a male build that means
  // shoulder, arm, chest and neck mass; on a female build it means tone --
  // a tighter waist and firmer hips, not bulk (the viewer decides how).
  muscle: number;
};

export const REFERENCE_AVATAR: AvatarBuild = { sex: "male", bulk: 1, muscle: 1 };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// How many completed sessions it takes to reach the full training bonus, and
// how big that bonus is. Sessions are the one thing the app can vouch for;
// the answers above are what the person said on day one. A session is worth
// a third of a percent of build, so twelve weeks of three a week (36) is
// about as much as moving from "novice" to "intermediate" -- visible, not
// cartoonish, and it keeps growing until the cap.
const PROGRESS_SESSIONS = 45;
const PROGRESS_BONUS = 0.15;

// `completedWorkouts`: sessions the person has actually finished. The figure
// grows with them -- that is the point of a figure that looks like you.
export function avatarFromProfile(profile: Record<string, string> | null | undefined, completedWorkouts = 0): AvatarBuild {
  if (!profile) return REFERENCE_AVATAR;
  const height = Number(profile.height);
  const weight = Number(profile.weight);
  const bmi = height > 0 && weight > 0 ? weight / (height / 100) ** 2 : 22.5;
  // BMI 19 -> 0.84, 22.5 -> 1, 27 -> 1.2, 32 -> 1.43. Clamped so an extreme
  // entry still draws a plausible figure.
  const bulk = clamp(1 + (bmi - 22.5) * 0.045, 0.82, 1.45);

  const sex = profile.sex === "male" ? "male" : profile.sex === "female" ? "female" : "unknown";
  let muscle = 1;
  if (profile.experience === "advanced") muscle += 0.12;
  else if (profile.experience === "intermediate") muscle += 0.05;
  else if (profile.experience === "beginner") muscle -= 0.04;
  if (profile.bodyweightStrength === "both") muscle += 0.06;
  else if (profile.bodyweightStrength === "neither") muscle -= 0.04;
  if (profile.goal === "muscle" || profile.goal === "strength") muscle += 0.03;
  muscle += PROGRESS_BONUS * clamp(completedWorkouts / PROGRESS_SESSIONS, 0, 1);
  return { sex, bulk, muscle: clamp(muscle, 0.82, 1.3) };
}
