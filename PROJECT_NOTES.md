# Project G — Product decisions and QA rules

## Working agreement

- Implement obvious bug fixes without repeatedly asking for confirmation.
- Ask once only when the operating system requires permission to copy outside the protected workspace.
- Test every visual or interaction change at a real phone viewport before handing it off.
- Responsive screens must use both current viewport width and height, support small and large phones, and keep essential actions reachable through scrolling.
- Never describe a change as complete until the complete user flow has been tested.
- Every visible icon, button, card, and link must perform a meaningful action and provide visible feedback. Decorative controls that do nothing are prohibited.
- Test information, help, close, back, next, and finish controls explicitly whenever their screen is changed.

## Product rules

- Project G is unisex and must work equally well for women and men.
- Onboarding profile data must meaningfully affect the generated workout.
- Exercise media must play or animate inside the workout screen and never open an external player.
- The athlete must remain fully visible and the exercise media must use the available space well.
- Do not show pose contours/skeletons in the prototype. They were removed because manually aligned overlays were inaccurate.
- Selecting a woman or man must also select matching exercise demonstrators, not only different weights and exercise names.
- The test plan contains eight gender-matched exercises for both women and men. Sets per exercise scale with the selected weekly training frequency (4 sets at 2 days/week, 3 at 3-4 days/week, 2 at 5+ days/week), so total volume ranges from sixteen to thirty-two sets depending on that answer.
- Exercise phases, visual guidance, tempo, and rest state must remain synchronized.
- Completing the final exercise must always open a complete session analysis.
- The session analysis must lead to a dedicated progress screen and then back to the dashboard.

## Known prototype exception

- Test mode currently permits sets to be completed before the timer expires.
- Before production release, lock completion to the prescribed tempo/rest rules and add an explicit test-mode switch.
- All eight female and all eight male test exercises use locally hosted, gender-matched MP4 demonstrations with autoplay, loop, muted audio, and no external player.
- Never simulate video by flashing between still frames.
- All exercise videos use one central playback component. On web/iPhone it must set inline playback, disable fullscreen/Picture-in-Picture controls, and ignore taps on the media surface.
- Any future exercise video inherits this playback contract automatically; do not implement per-exercise player behavior.

## AI Coach prototype

- The dashboard Coach tab opens a dedicated interactive AI Coach screen.
- Quick scenarios cover fatigue, discomfort, limited time, and limited equipment.
- Free-text messages are classified into the same safe prototype scenarios.
- Applying a fatigue adjustment reduces the session to two working sets and extends recovery.
- Applying a 30-minute adjustment reduces the session to three priority exercises and a 30-minute target.
- The current responses are deterministic prototype logic, not a connected language model.
- Pain-related advice must remain conservative, avoid diagnosis, and recommend stopping or human review when symptoms increase.
- The live AI Coach uses a server-side Vercel function; `OPENAI_API_KEY` must never be exposed to the client or committed.
- If the live AI request fails, the app must remain usable and show the safe deterministic coaching fallback.

## Exercise video performance rules

- Production exercise videos must be compressed and normally stay within 2–6 MB per clip.
- Never download the complete exercise library when the app opens.
- Load only the current exercise and preload no more than the next exercise.
- Cache a downloaded exercise video for later sessions.
- Show a matching poster image immediately while a video is loading or when the connection is too slow.
- Do not hide the video while waiting for a first-frame callback; iPhone Safari may not emit that callback reliably. Keep the poster underneath and let the video replace it naturally.
- Use adaptive delivery or a lower-quality mobile version when network conditions require it.
- A new exercise video is not complete until its file size, startup time, inline playback, looping, and phone behavior have been verified.

## Nutrition tracker

- Food photos are resized and compressed on-device before analysis; never upload the full original photo.
- AI nutrition values are estimates and must remain editable before saving.
- Portion corrections recalculate every macro and the meal total.
- Saved meals update the dashboard calorie and protein totals.
- The OpenAI key remains server-side in the Vercel nutrition function.
## Test mode and future accounts

- Keep prototype testing separate from future production accounts and database records.
- Test mode persists the selected profile, nutrition totals, and AI coach adjustment after a browser refresh.
- The Dashboard must always provide a one-tap `RESET PROFILE` action so male, female, age, goal, equipment, and duration scenarios can be retested quickly.
- Resetting a test profile returns to onboarding and clears the locally saved test state.
- Never write test-mode data into the production user database.
- Do not automatically resume an active workout after refresh; only stable profile-level test data is persisted.
