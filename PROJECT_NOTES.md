# Project G — Product decisions and QA rules

## Working agreement

- Implement obvious bug fixes without repeatedly asking for confirmation.
- Ask once only when the operating system requires permission to copy outside the protected workspace.
- Test every visual or interaction change at a real phone viewport before handing it off.
- Never describe a change as complete until the complete user flow has been tested.

## Product rules

- Project G is unisex and must work equally well for women and men.
- Onboarding profile data must meaningfully affect the generated workout.
- Exercise media must play or animate inside the workout screen and never open an external player.
- The athlete must remain fully visible and the exercise media must use the available space well.
- Do not show pose contours/skeletons in the prototype. They were removed because manually aligned overlays were inaccurate.
- Selecting a woman or man must also select matching exercise demonstrators, not only different weights and exercise names.
- The test plan contains five gender-matched exercises and fifteen sets for both women and men.
- Exercise phases, visual guidance, tempo, and rest state must remain synchronized.
- Completing the final exercise must always open a complete session analysis.
- The session analysis must lead to a dedicated progress screen and then back to the dashboard.

## Known prototype exception

- Test mode currently permits sets to be completed before the timer expires.
- Before production release, lock completion to the prescribed tempo/rest rules and add an explicit test-mode switch.
- The first female and male exercises use locally hosted MP4 demonstrations with autoplay, loop, muted audio, and no external player.
- Remaining prototype exercises use one stable still image until each has a verified matching video. Never simulate video by flashing between still frames.
- All exercise videos use one central playback component. On web/iPhone it must set inline playback, disable fullscreen/Picture-in-Picture controls, and ignore taps on the media surface.
- Any future exercise video inherits this playback contract automatically; do not implement per-exercise player behavior.
