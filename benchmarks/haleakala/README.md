# Haleakalā sunrise tool: value function and benchmark

`node scripts/score-haleakala.mjs --label NAME --live-ok 0|1 --first-screen-px N [--write]`

**Score** = persona-weighted capability score x 100. Six personas (trip planner months out, tomorrow-morning decider,
1 a.m. go/no-go, visitor without a reservation, family or older visitor, photographer), each weighting 7-13 capabilities.
Capability checks are static and reproducible: they read the generated page and client script. Two inputs are measured by hand:
`live-ok` (does the production API return summit data) and `first-screen-px` (top of the verdict on a 390x844 phone, the hub's
~390px ad slot excluded).

| Run | Planner | Tomorrow | 1 a.m. | No reservation | Family | Photographer | Overall |
|---|---|---|---|---|---|---|---|
| baseline, before PR #29 | 15.8 | 30.8 | 51.8 | 28.8 | 80 | 38.3 | 38.8 |
| baseline, after PR #29 | 15.8 | 50.8 | 76.8 | 28.8 | 80 | 66.9 | 51.6 |
| after this change | 100 | 97.4 | 95.8 | 100 | 100 | 96.2 | 98.2 |

**Read this honestly.** The rubric measures whether the page does the job a persona needs, not whether it is right. It saturates.
The one outcome measure is `decision_accuracy`: the summit-humidity rule scored against 19 mornings of all-sky frames
(`ground-truth.json`), 0 wrong calls, abstaining when unsure, 84.2 -> 86.8. That is 19 mornings from one month. The forecast
outlook (`lean`) has no validation at all and says so on the page. Real validation needs more labeled mornings, which the
daily capture workflow in the hub keeps adding.

`lib/haleakala-climate.json` comes from `scripts/build-haleakala-climate.mjs` (LCO archive 2023-2026). Mornings with no sensor
reading are reported, not counted.
