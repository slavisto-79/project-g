# Project G — next session handoff

## Implemented and build-verified

- Unisex onboarding with age and sex affecting the generated workout.
- Separate eight-exercise test plans and matching demonstrators for women and men.
- Real inline exercise videos for all ten test exercises.
- Videos compressed from about 176 MB to 6.9 MB total.
- Only the current video is displayed and only the next exercise is preloaded.
- Matching poster image remains visible while video playback starts.
- Eight exercises, workout completion analysis, and progress screen. Sets per exercise now scale with weekly training frequency (4/3/3/2 sets for 2/3/4/5 days a week) instead of a fixed three.
- Roster expanded from five to eight exercises per gender: added Dumbbell Row, Glute Bridge, and Plank for women, and Dumbbell Lunge, Calf Raise, and Plank for men, each with dedicated gender-matched video and form-guide stills.
- Exercise information icon opens a form guide with setup, movement, breathing, tempo, and mistakes.
- Durable Project G rules and shared QA rules were recorded.
- The workout screen's Coach Cue now shows an exercise-specific movement cue instead of one static line for every exercise.
- The AI Coach screen is fully wired: quick scenarios and free-text messages call the live `/api/coach` function, fall back to the safe deterministic reply if the live call fails, and Apply Changes actually adjusts the session (the fatigue scenario reduces to two sets with longer rest, the 30-minute scenario trims to three priority exercises).
- Fixed two double-encoded (mojibake) characters in AI Coach text that were showing garbled output.
- Onboarding now asks for exact age, current weight, and height via a scrollable number picker (a new question type alongside the existing tap-to-choose buttons), instead of an age range bucket. Weight scales the suggested starting dumbbell weight (0.75x-1.3x vs a 70kg reference); height is captured but not yet used in any calculation.
- Weekly training frequency now scales sets per exercise (4 sets at 2 days/week, 3 at 3-4 days/week, 2 at 5+ days/week) instead of a fixed three, so total plan volume adapts to how often the user trains.

## Must be verified on the deployed iPhone version

1. Push the latest GitHub Desktop changes if they are still uncommitted.
2. Wait for Vercel deployment and refresh the phone without using an old cached version.
3. Test one full women’s workout and one full men’s workout.
4. Confirm every video starts without a black screen.
5. Confirm every video plays inline and never opens the native/fullscreen player.
6. Confirm every video matches the exercise and selected sex.
7. Confirm the information panel opens, shows exercise-specific guidance, closes with X, closes by tapping outside, and closes with GOT IT.
8. Confirm Next Exercise remains disabled until every set for that exercise is selected (set count now varies with the chosen weekly frequency).
9. Confirm Finish Workout opens the session analysis.
10. Confirm View My Progress opens Progress and the dashboard return control works.
11. Confirm the Coach Cue text changes per exercise and the AI Coach screen (quick scenarios and free text) replies and applies changes correctly.
12. Confirm all three new exercises per gender (women: Dumbbell Row, Glute Bridge, Plank; men: Dumbbell Lunge, Calf Raise, Plank) play their correct video, show correct form-guide stills and text, and that the workout still completes correctly with eight exercises instead of five.
13. Confirm the age/weight/height scroll pickers work smoothly on a real phone (live tracking while dragging, correct snap, no lag), and that choosing 2 vs 5 training days produces 4 vs 2 sets per exercise in the actual workout.

## Implemented rules that still need production infrastructure

- Persistent downloaded-video caching is specified but not yet implemented.
- Adaptive video delivery for different network speeds is specified but not yet implemented.

## Known prototype exceptions

- Test mode allows sets to be completed before the prescribed timer expires. Production mode must lock this behavior and expose an explicit test-mode switch.
- Workout completion analysis currently uses prototype values rather than measured technique data.
- Progress metrics currently use prototype values rather than a persistent user history.

## Recommended next build task

1. Complete the deployed iPhone regression test above, including the new Coach Cue and AI Coach checks.
2. Fix any failed item before adding a new feature.
