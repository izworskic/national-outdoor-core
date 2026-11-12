# Hawaii tools: reliable comparisons and a next-outing chooser

## Scope and ownership

Implemented in national-outdoor-core, the owning repository. Existing canonical URLs, ads and identity remain intact. No new indexable route, external datastore or forecast model. Production shell mirrors already request these owner-hosted JavaScript and CSS assets, so the added interactions do not depend on a mirror refresh. The generator changes keep future builds in agreement.

## Visitor problem and design choice

A coastal rating does not answer where a visitor should go. The first pass improves Big Island Beach Day, Kona Manta Ray Night and Mauna Kea Tonight, then adds a Big Island outing chooser within the existing beach page at `#island-outings`.

Two approaches considered: a new island-wide map with combined weather rankings; or a small, editable outing selection next to the existing specialist tools. Chose the second: the source material does not justify ranking a volcano, a beach and a mountain by a common condition score. A new map would also require verified entrance geometry beyond the current place evidence. The chooser instead explains a place, matches starting area/time/interest, and links the relevant authority and specialist. Maps links are named entrance searches (or NPS-published coordinates for Puʻuhonua), not invented precise parking pins.

Distinct interaction: five starting areas, three time budgets, six interest choices and six destinations. A short Kona volcano outing returns an honest empty match; allowing a full day reveals the volcano option. Filter state lives in a shareable hash. No geolocation permission or API traffic is needed for this chooser. The time classes are editorial planning suggestions, explicitly not computed ETAs. Access is a dated reviewed guide, never represented as a current open status. The chooser remains useful when forecasts fail.

## Defects corrected

- Coast rankings change by date. The four-day grid now joins each cell by coast ID rather than treating independently sorted arrays as identical row order.
- Beach, manta and Maunakea clients clear/withhold earlier favorable results during refresh and on failure. Invalid, future-skewed or over-15-minute response timestamps are retried once then rejected. Requests time out after 25 seconds. Existing source-level freshness rules are preserved.
- Manta headline now describes the selected night instead of a different best night across the four-night window.
- Beach and manta date selectors use ordinary pressed buttons, replacing an incomplete tab implementation.
- Missing NWS coverage is labeled unavailable for the date; it no longer automatically claims the date lies beyond the forecast horizon.
- Regional calm/moderate wording no longer tells a visitor the water is good for entry. Kapoho is removed from the Puna beach examples; no replacement access claim is invented.
- Maunakea explicitly separates summit sunset access from visitor-station stargazing and explains that whole-night moon calculations extend beyond visiting hours.
- Vercel preview builds for the three pages point to preview assets/API, enabling meaningful review without changing production asset URLs.

## Reviewed sources, November 12, 2026

- https://dlnr.hawaii.gov/dsp/parks/Hawaii/hapuna-beach-state-recreation-area/ : main Hāpuna beach, fees, hours, lifeguard and high-surf cautions.
- https://dlnr.hawaii.gov/dsp/important-park-notices/ : reviewed dated notices; ʻAkaka partial trail closure remained documented, Waialea distinguished from main Hāpuna. A new date on the page is not treated as a reopening of earlier closures.
- https://dlnr.hawaii.gov/dsp/parks/Hawaii/akaka-falls-state-park/ : normal 0.4-mile route, steps, access road. The chooser does not promise the full route and withholds directions pending the closure check.
- https://www.nps.gov/puho/planyourvisit/things2do.htm and https://www.nps.gov/puho/planyourvisit/directions.htm : cultural walking visit, picnic area, no ocean entry within park, published destination coordinates.
- https://www.nps.gov/puho/planyourvisit/conditions.htm : official access check.
- https://www.nps.gov/kaho/planyourvisit/directions.htm and https://www.nps.gov/kaho/planyourvisit/things2do.htm : distinct visitor-center, harbor and Kaloko entrances; coastal trails and wildlife.
- https://www.nps.gov/kaho/planyourvisit/conditions.htm : visitor-center access check.
- https://www.nps.gov/havo/planyourvisit/eruption-viewing.htm and https://www.nps.gov/havo/planyourvisit/conditions.htm : changing viewing/access/parking; existing Kīlauea Live owns the decision.
- https://hilo.hawaii.edu/maunakea/visitor-information/station : VIS at 9,200 ft, 9 a.m.–9 p.m. published hours, summit 4WD requirement and summit visiting cutoff 30 minutes after sunset. The one-day November 10 late opening is not generalized to future dates.

## Verification and release

Full `npm run verify:all` passed locally on Node 24.22.1; CI uses repository-required Node 22. Ten added DOM/behavior regressions cover changing coast order, stale/invalid/future timestamps, failed refresh, out-of-order response, selected manta date, Maunakea hidden road/sky state, planner filtering and bookmark restore. Browser and remote CI results are recorded below before handoff. No measured search or revenue uplift is claimed.

Known limits: six places is a starter collection, not comprehensive island coverage. Closure sources require the visitor's fresh check. No live road ETA, entrance capacity or beach-level swimming clearance. The long-range Kīlauea episode-history model and Haleakalā engine are outside this change.

Next action: expand the verified South Kona shore-access choices, including the separate Kealakekua kayak launch/landing permissions, before adding a snorkeling-specific recommender.
