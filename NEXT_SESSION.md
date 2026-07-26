# Project G — next session handoff

## Implemented and build-verified

- Unisex onboarding with age and sex affecting the generated workout.
- Separate five-exercise test plans and matching demonstrators for women and men.
- Real inline exercise videos for all ten test exercises.
- Videos compressed from about 176 MB to 6.9 MB total.
- Only the current video is displayed and only the next exercise is preloaded.
- Matching poster image remains visible while video playback starts.
- Three sets per exercise, five exercises, workout completion analysis, and progress screen.
- Exercise information icon opens a form guide with setup, movement, breathing, tempo, and mistakes.
- Durable Project G rules and shared QA rules were recorded.

## Must be verified on the deployed iPhone version

1. Push the latest GitHub Desktop changes if they are still uncommitted.
2. Wait for Vercel deployment and refresh the phone without using an old cached version.
3. Test one full women’s workout and one full men’s workout.
4. Confirm every video starts without a black screen.
5. Confirm every video plays inline and never opens the native/fullscreen player.
6. Confirm every video matches the exercise and selected sex.
7. Confirm the information panel opens, shows exercise-specific guidance, closes with X, closes by tapping outside, and closes with GOT IT.
8. Confirm Next Exercise remains disabled until all three test sets are selected.
9. Confirm Finish Workout opens the session analysis.
10. Confirm View My Progress opens Progress and the dashboard return control works.

## Implemented rules that still need production infrastructure

- Persistent downloaded-video caching is specified but not yet implemented.
- Adaptive video delivery for different network speeds is specified but not yet implemented.

## Known prototype exceptions

- Test mode allows sets to be completed before the prescribed timer expires. Production mode must lock this behavior and expose an explicit test-mode switch.
- Workout completion analysis currently uses prototype values rather than measured technique data.
- Progress metrics currently use prototype values rather than a persistent user history.

## Recommended next build task

1. Complete the deployed iPhone regression test above.
2. Fix any failed item before adding a new feature.
3. Replace generic coaching copy with exercise-specific cues everywhere.
4. Add the AI Coach interaction flow without changing the approved visual concept.
