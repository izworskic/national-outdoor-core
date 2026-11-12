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

Full `npm run verify:all` passed locally (231 tests plus the smoke gate) on Node 24.22.1; CI uses repository-required Node 22. Eleven added DOM/behavior regressions cover changing coast order, stale/invalid/future timestamps, failed refresh, out-of-order response, selected manta date, Maunakea hidden road/sky state, planner filtering and bookmark restore. GitHub verification passed on the initial review commit fd7bad6. Vercel preview built successfully. Browser verification of the revised UI is BLOCKED: the preview redirects to Vercel authentication, the connected Vercel account cannot access this team/project, and no authenticated CLI is available. The public baseline was inspected in a desktop browser; revised mobile/desktop layout is not claimed as verified. A local HTTP preview was also unavailable from the separate browser environment. The PR remains unmerged pending browser acceptance. No measured search or revenue uplift is claimed.

Known limits: six places is a starter collection, not comprehensive island coverage. Closure sources require the visitor's fresh check. No live road ETA, entrance capacity or beach-level swimming clearance. The long-range Kīlauea episode-history model and Haleakalā engine are outside this change.

## South Kona expansion: research translated into six visit plans

The second pass adds `#south-kona-access` within Beach Day. Visitors select a rental, guided tour, private vessel, hike, Two Step snorkeling visit, or national park cultural visit. Each result explains the relevant approach, permission, parking limits and next action. The Puʻuhonua outing links directly to the separate Two Step plan. Selections are shareable and same-page links restore the selected plan.

The module remains independent of forecast availability. Generated HTML includes readable access essentials for visitors without JavaScript; existing mirrored shells receive the chooser through the owner-hosted beach script. No extra canonical page, live access assertion, invented self-launch pin, or vendor endorsement. Only the cultural park visit gets the previously verified NPS entrance coordinates. The guide carries its review date and explicitly requests an updated review after 30 days; this is an age warning, not an automated source refresh.

### Source reconciliation, November 12, 2026

- State Parks manager page: https://dlnr.hawaii.gov/dsp/parks/hawaii/kealakekua-bay-state-historical-park/ . Establishes rental permit verification and the upland trail approach. Its narrative mentions three tour companies, but its table lists two. Do not publish a count or infer a missing company. Link the authority's list and have the visitor confirm their exact booking.
- DLNR permit portal: https://outdoor.hawaii.gov/state-parks/permit/ . Its Kealakekua section expressly separates vessel transit from written landing approval and requests applications at least 14 days ahead. The application is not an approval. Unrelated placeholder text elsewhere on that portal is not used.
- State Parks permit guidance: https://dlnr.hawaii.gov/dsp/parks/state-parks-special-use-permit/ . Explains guided-tour permission to launch at the wharf and land under conditions. This is an exception for authorized tours, not a blanket launch recommendation for rentals or private vessels.
- The park page's form introduction says 2025, while non-commercial links say 2027 and commercial links say 2026. No form is copied or labeled current by this tool. Visitors use official instructions and contact the permit office when visit-year requirements are unclear.
- NPS: https://www.nps.gov/puho/planyourvisit/snorkeling.htm . Separates County-managed Hōnaunau Bay access from national park entry, describes the signed one-way approach and requests snorkeling parking outside the park gate. The linked County shoreline page returned 403 to retrieval; no individual roadside stall, availability, fee or current facility status is asserted. The old sunscreen paragraph is not used.
- DLNR 2023 master plan and historical enforcement releases corroborate the transit/landing distinction but do not establish today's operator permissions. Obsolete third-party permit PDFs are excluded.

Seven additional regression tests exercise all six decisions, replace/reset behavior, bookmark and same-page link restoration, malformed input, review expiry, restricted map destinations and progressive enhancement of generated HTML. Browser layout verification remains blocked by preview access. Next release action is mobile/desktop acceptance on an accessible preview, then review PR #45 for merge.

Second-pass validation: `npm run verify:all` passed with all 238 tests and smoke score 100, no failures. `git diff --check` passed. Seven new tests supplement the original 11 Hawaii behavior tests. Unrelated generated Haleakalā, smoke and other tool output is excluded from the commit.
