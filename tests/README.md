# Combination sweeps

Three exhaustive sweeps over the answers the interview can produce, run against
the shipped code rather than a copy of it.

```bash
npm run sweep
```

Each sweep exits non-zero on the first kind of problem it finds and prints one
example profile, so a failure is reproducible by pasting that profile back in.

## How they reach the real code

`extract.js` parses `App.tsx` with the TypeScript compiler's own AST, pulls the
named declarations out along with everything they transitively reference, and
evaluates that. Nothing is restated here, so a sweep cannot quietly drift away
from what ships — if a function changes, the sweep runs the changed function.

Symbols imported from `lib/` are supplied from the real modules. The one stub is
`shippedMediaFor`, because `lib/exerciseMedia.ts` `require()`s `.mp4` and `.jpg`
assets that Node cannot load; it returns "no footage", which is the branch these
sweeps care about.

## What each covers

**`sweep-derived.js`** — every answer combination, against every number derived
from it: metabolic rate, activity multiplier, calorie and protein targets, diet
mode, weeks-to-goal, rep range, set count, rest, session budget, load factor,
session burn. Continuous answers are sampled at three realistic extremes each
(age 16/45/90, weight 40/75/150, height 140/175/210) and the goal weight is
clamped to the picker's own 40–200 range.

```
139,968,000 combinations across 15 answers    ~150s
```

**`sweep-builder.js`** — every combination that reaches the session builder,
through the builder, checking the session a user would be shown: length, no
repeats, injury safety against the library's own flags, the pull-up/push-up
capability rule, and that every rendered weight, rep count and label is usable.

Axes the builder provably never reads (age, height, activity, diet pace, goal
weight, duration) are left to `sweep-derived.js`; including them here would
multiply the run four-hundredfold without changing a single session.

```
5,832,000 sessions    ~245s
```

**`sweep-display.js`** — the display and history layer, which is where the
defects actually were: unloaded work recorded as a weight, timed holds labelled
as reps, volume counted wrongly, strength ratings on movements that have no
standard, and the clock label over every second a timer can show.

```
777,600 sessions and 7,206 clock values    ~40s
```

## A note on thresholds

A sweep asserts bands, not exact values, and a band that is too tight reports a
false failure. The first run of `sweep-derived.js` flagged a resting metabolic
rate of 664 kcal as impossible; it is what Mifflin-St Jeor returns for a 90-year-
old, 40 kg, 140 cm woman, and the calorie target it feeds is floored at 1200
anyway. The band was wrong, not the formula. Widen a band only after working out
what the correct value is.
