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

## Equipment-aware workouts and profile editing

- There are two exercise-selection paths. The primary one, `createWorkoutFromCatalog()` (`App.tsx`) + `buildProgram()` (`lib/programBuilder.ts`), pulls live exercise data from a MuscleWiki-backed serverless endpoint (`/api/exercise-catalog`) and filters it by `profile.equipment` via `equipmentCategory` in `lib/programBuilder.ts` -- but only for `minimal` and `bars`/`bodyweight`-style tiers; `gym`/`home-gym` apply no equipment filtering at all. If the live catalog call fails or returns too few slots (`MUSCLEWIKI_API_KEY` unset, upstream error, etc.), it silently falls back to the second path: the local, hardcoded `createWorkout()`.
- `createWorkout()` (`App.tsx`) is fully equipment-aware on its own and does not depend on the catalog: `profile.equipment === "bodyweight"` selects `femaleBodyweightExercises`/`maleBodyweightExercises` (6 exercises/gender), `profile.equipment === "bars"` selects `femaleBarsExercises`/`maleBarsExercises` (a smaller starter roster -- 2 for women, 3 for men, see below), and every other answer uses the original 8-exercise dumbbell/gym roster. All bodyweight-style exercises (bodyweight tier + bars tier) show "Bodyweight" instead of a kg value for every set and prompt "HOW MANY REPS DID YOU DO" (no KG wording) -- see `isBodyweightExerciseName()`.
- The Dashboard's "MY PROFILE" button opens `ProfileScreen`, which lets the user edit any onboarding answer (including equipment and sex) one at a time, at any time -- not only during onboarding. Saving updates `profile` immediately; the next workout started is generated fresh from the updated profile with no separate regeneration step or delay, through whichever of the two paths above is active at that moment.
- The "Pull-up bar / calisthenics" equipment option (`value: "bars"`) is a starter tier: only 2 real, fully-visible, gender-matched bar-exercise videos exist for women (Bar Dip, Knee Raise) and 3 for men (Pull-Up, Bar Dip, Hanging Leg Raise) so far -- a good full-body, well-lit female Pull-Up clip was not found during sourcing (see `ASSET_CREDITS.md` for what was tried and rejected). Expand this roster as better footage is sourced; do not pad it with unrelated exercises relabeled as bar work, and do not force asymmetric quality between genders just to match exercise counts.

## Known prototype exception

- Test mode currently permits sets to be completed before the timer expires.
- Before production release, lock completion to the prescribed tempo/rest rules and add an explicit test-mode switch.
- All eight female and all eight male test exercises use locally hosted, gender-matched MP4 demonstrations with autoplay, loop, muted audio, and no external player.
- Never simulate video by flashing between still frames.
- All exercise videos use one central playback component. On web/iPhone it must set inline playback, disable fullscreen/Picture-in-Picture controls, and ignore taps on the media surface.
- Any future exercise video inherits this playback contract automatically; do not implement per-exercise player behavior.
- The session-complete CALORIES stat is a MET-based formula (MET x body weight x session duration), not a measurement. It is an estimate only, not medical or nutritional advice, and falls back to a 70kg reference weight when the profile has none.

## Nutrition recipes

- The daily protein target (1.6-2.2g per kg body weight depending on goal) is a general sports-nutrition heuristic, not medical or dietary advice.
- The Nutrition screen's "SEE RECIPES" card and the `/api/recipes` function suggest recipes to help close the day's remaining protein gap; these are AI-generated and framed as general food inspiration only, never a guarantee.
- The Recipe Library (Breakfast/Lunch/Dinner) is a separate, fixed set of 12 recipes with real photos. It does not respond to the protein gap or any other profile data; it is a static browse-only reference.
- Do not merge these two recipe systems: the library must stay fixed and category-organized, while the protein-gap suggestions must stay dynamic and AI-generated.
- The Nutrition screen's "Build a diet plan" card opens a short 3-question form (dietary style, meals per day, cooking time, plus an optional foods-to-avoid text field) and calls `/api/diet-plan` for an AI-generated sample day of meals sized to the profile's estimated daily calorie/protein target. It falls back to a small fixed sample day if the live call fails, framed the same way as the other AI nutrition features: general food inspiration only, never medical or dietary advice.
- The generated diet plan persists as a single "current" plan (like `coachAdjustment`, not a history like `workoutHistory`) -- building a new one overwrites the old. It syncs the same way as the rest of profile/progress state: `localStorage` in test mode, the `user_data.diet_plan` column in Supabase when signed in. Opening Diet Plan with a saved plan already present shows the result directly instead of the question form; "ADJUST AND REBUILD" returns to the form prefilled with the saved answers.
- `/api/diet-plan` generates a full week (7 days) of meaningfully varied meals in one request, not a single repeating day. The result screen shows all 7 days and tags the one matching today's date (by elapsed calendar days since generation, no background job) with a TODAY badge; once a full week has passed it nudges the user to rebuild for a fresh set.
- Tapping any meal (in the diet plan) opens a full-screen modal with an AI-generated ingredient list + numbered cooking steps (`/api/meal-detail`) and an AI-generated illustrative photo of the dish (`/api/meal-image`, `gpt-image-1-mini`, low quality -- cheap and only illustrative, not photorealistic). Both are generated on demand only when a meal is opened (not upfront for the whole week) and cached in memory for the current screen visit only; neither is persisted to Supabase/localStorage, to avoid bloating the saved plan with large base64 images. A failed image silently falls back to a placeholder icon; a failed detail request shows a retry-style error message. The modal is conditionally mounted (`{meal ? <Modal>...</Modal> : null}`) rather than relying on toggling Modal's `visible` prop, because react-native-web's Modal does not reliably react to `visible` changing after mount.

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
- The live AI Coach now receives a compact training-history summary (`summarizeCoachMemory` in `App.tsx`: total workouts, this week's count, last session's stats, current per-exercise working weights) alongside the profile, so replies can reference real progress instead of treating every conversation as the first one. Keep this summary short (a few lines) -- it's meant as context, not a full history dump.
- The AI Coach only discusses training, technique, soreness/pain from training, recovery, scheduling, and equipment for this user's plan. Diet/nutrition questions are redirected to the Nutrition -> "Build a diet plan" feature (the 'nutrition' scenario), not answered inline. Anything else off-topic (general knowledge, other apps, unrelated small talk) is classified as the 'off_topic' scenario: the model declines to answer the unrelated question and redirects to training in one brief sentence, rather than acting as a general-purpose assistant.

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
## Test mode and accounts

- Test mode (no account) persists the selected profile, nutrition totals, and AI coach adjustment in `localStorage` after a browser refresh, unchanged from before.
- The Dashboard must always provide a one-tap `RESET PROFILE` action so male, female, age, goal, equipment, and duration scenarios can be retested quickly.
- Resetting a test profile returns to onboarding and clears the locally saved test state.
- Do not automatically resume an active workout after refresh; only stable profile-level test data is persisted.
- **Real accounts are now implemented via Supabase** (not the earlier Neon + hand-rolled cookie session; that was replaced before shipping to users). The Dashboard's account bar offers "SIGN IN" / "CREATE ACCOUNT" (or shows "SIGNED IN · email" + "LOG OUT" once signed in). Supabase Auth handles signup/login/logout/session/password reset; app data lives in a `user_data` table in the same Supabase Postgres project, with Row Level Security restricting each row to its owner (`auth.uid() = user_id`). See `supabase-setup.sql` for the schema, RLS policies, and the trigger that creates an empty `user_data` row on signup.
- The client talks to Supabase directly via `@supabase/supabase-js` (`lib/supabase.ts`), using the public `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` (safe to expose; protection comes from RLS, not secrecy). There is no custom `/api/auth/*` or `/api/user-data` backend.
- Signing up (or a first-time Google/Facebook sign-in) migrates whatever profile/progress/history already existed locally into the new account, since the new `user_data` row starts empty. Logging in on a different device replaces local state with the account's saved data instead.
- While signed in, every change to profile/nutrition/coach-adjustment/exercise-progress/workout-history is upserted straight to the `user_data` table; `localStorage` is left alone until the user logs out.
- Forgot-password uses Supabase's built-in `resetPasswordForEmail` + a `/reset-password` route (handled client-side via `window.location.pathname`, not real server routing) where `ResetPasswordScreen` calls `supabase.auth.updateUser`.
- "Continue with Facebook" calls `supabase.auth.signInWithOAuth({ provider: "facebook" })`; the Facebook provider still needs a Facebook Developer App configured in the Supabase dashboard before it will actually work end to end.
- "Continue with Google" calls `supabase.auth.signInWithOAuth({ provider: "google" })`; the Google provider still needs a Google Cloud OAuth client (client ID/secret) configured in the Supabase dashboard (Authentication > Providers > Google) before it will actually work end to end.
