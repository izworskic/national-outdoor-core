# Hawaii day tools: implementation and evidence

Owner: national-outdoor-core. Date: 2026-11-13. Baseline: merged PR46, 264 tests; no open owner PRs at kickoff.

## Visitor decision and design
Two independent local tools in the existing Big Island Beach Day page: (1) assemble a volcano day and see its drive, visit, buffer and home-return costs; (2) compare Hawaii daylight by place/date and across a year. No new canonical route or live data contract. The existing owner loader adds the modules even when the main site's HTML mirror has not rebuilt.

Compared a geographic route map with a time-budget workbench. The map cannot responsibly show live routes/closures without a routing source. Choose the workbench: directly labelled duration bars, a chronological itinerary, explicit over-budget and after-sunset checks, and a companion annual daylight band. Unlike the coast charts, these answer scheduling rather than sea conditions. Route links open Google Maps searches for named official places, not unverified tracks.

Renderer: vanilla JavaScript owns two DOM/SVG islands, fewer than 100 data marks in the visible year chart, no D3 dependency needed for these linear scales. Native controls and complete text values support keyboard/touch. Mobile stacks controls and uses a fixed-height year chart with recalculated width; timeline durations are percentages with labels outside the bars. 44px minimum controls, no hover requirement, no animation, no pinch ownership. Neutral ink, teal visit/daylight, orange selected date, slate driving, red conflict. Optional print view and independent URL hashes encode validated input only; no visitor coordinates or persistence service.

Considered request-time Python and Rust/Wasm. Browser math is small and deterministic, so keep it local; use Python/Astral as an independent numerical check. No new server, paid API or scheduled job. Blender is available but no terrain surface is needed for the decisions; no invented 3D geography. Rust toolchain is unavailable and would add no measured speed benefit here.

## Sources, rights and limitations
Public US federal NPS/NOAA facts and equations are paraphrased; no third-party images. Sources reviewed 2026-11-13. This is a dated guide, never a live closure report. If the review is older than 90 days, the UI says to recheck the planning guidance. No source absence becomes an all-clear.

- NPS directions: https://www.nps.gov/havo/planyourvisit/directions.htm . Hilo45min, Kailua-Kona via Hwy11 120–150min, Waikoloa via Hwy200120min; adjustable one-way allowances, not traffic estimates. Kona defaults to upper bound. Return uses the same allowance, explicitly labelled.
- NPS Kilauea Iki: https://www.nps.gov/havo/planyourvisit/hike_day_kilaueaiki.htm . Overlook3.3mi/2–3h, Devastation start6mi/4–5h including Nahuku. Defaults use upper bound; limited parking changes the itinerary. Long option already includes the lava tube and does not double-count it.
- NPS Nahuku: https://www.nps.gov/havo/planyourvisit/day-hike-nahuku.htm . Lights8am–8pm; limited parking, uneven footing. Separate tube visit uses an editorial60min allowance, not an official hike time. No guarantee of opening.
- NPS Devastation: https://www.nps.gov/havo/planyourvisit/hike_day_devastation.htm .1mi/approximately1h.
- NPS road tour: https://www.nps.gov/thingstodo/crd-coc.htm and https://www.nps.gov/havo/planyourvisit/ccr_tour.htm . Chain of Craters about18.8mi each way; tool allows3h for return drive and stops, explicitly an editorial budget. No through route to Puna. No food/water/fuel along road.
- Current checks: https://www.nps.gov/havo/planyourvisit/conditions.htm . Closures/air quality/parking can change. No eruption promise.
- Solar equations: https://gml.noaa.gov/grad/solcalc/solareqns.PDF . NOAA fractional-year approximation at local noon; all output minutes after midnight HST(UTC−10), sunrise/sunset zenith90.833°, civil twilight96°. Approximate geographic centers, level unobstructed horizon, no terrain/cloud/elevation correction. No summit viewing or hiking-safety claim. Display rounded to nearest5min with approximation label. Dates2020–2040; invalid dates fail closed.
- Independent comparator: Astral3.2, Apache2.0; developer-only pinned requirements. Sea-level observer. Generated astronomical values, not observed ground truth. Python validates all daily dates2026–2028 at six representative places plus boundary/leap fixtures. Numerical comparisons must stay within5min; no observational forecast accuracy claim.

Source refresh is manual review; astronomical calculations do not expire at year end. National park access must be checked on the travel day. No GSC/AdSense input available; no traffic/revenue uplift claimed.

## QA / release
Unit tests cover valid dates/leap years, malformed URL input, overnight return, sunset crossing, itinerary budget, no duplicate tube, input reset/share restoration, independent solar fixtures and static fallback. Full owner build/tests/smoke plus browser checks. State preserved in URL; invalid input does not leave a successful previous result. No extra weather/API requests. Rollback: remove one owner-loader script entry and generated shells. Release record appended after checks; unmerged is not live.

## Verification record, 2026-11-13
- Full `npm run verify:all`: 276 tests passed, smoke100/100 (required90).
- Python independent comparison: 6,594 place/date cases; maximum absolute differences in minutes: sunrise1.430, sunset2.050, dawn1.841, dusk1.833. Threshold5min. 2026–2028 daily six-place comparison plus boundary/leap dates; sampled independent fixtures committed and checked by Node CI.
- Functional DOM checks:12 new tests, including both mounts on older mirrored HTML, invalid input clearing, saved URL restoration, long-trailhead/tube deduplication, presets/reset, clipboard fallback, midnight rollover and return drive crossing sunset.
- Visual/browser acceptance remains pending: the available cloud browser could not reach the local test server (`ERR_CONNECTION_REFUSED`). No desktop/mobile visual pass or production release is claimed. The temporary harness was not committed. The change is opened as a draft until preview review completes.
- Existing ads/analytics scripts and canonical unchanged. The added generator shells receive the owner global analytics contract. No new network data request.
