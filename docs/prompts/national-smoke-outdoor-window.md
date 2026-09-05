# National Smoke & Outdoor Air Window — Master Execution Prompt

## Mission
Build and operate a national outdoor-air decision tool that answers one practical question better than a generic AQI dashboard:

**When is the air likely to be better for being outside at this U.S. location over the next 48 hours?**

Canonical product: `/national-tools/smoke/`
Backend: `api/national-smoke-window.js`
Decision engine: `lib/smoke-window.js`
Benchmark: `benchmarks/national-smoke-outdoor-window.json`

Follow the national Outdoor Decision Intelligence loop:

**place → current evidence → what changed → what happens next → what it means → better time → confidence → provenance.**

Do not build another smoke map. Do not dump raw government data. Synthesize independent public sources into an explainable time-window decision while preserving the identity and limits of each source.

## User jobs
Primary jobs:
1. What is PM2.5 air quality near me right now?
2. Is smoke/PM2.5 expected to improve or worsen over the next several hours?
3. What is the cleaner contiguous outdoor window in the next 48 hours?
4. What evidence supports that call?
5. How confident should I be?
6. Is nearby fire activity relevant context?

Secondary search intents may include `wildfire smoke forecast`, `when will smoke clear`, `air quality tomorrow`, `best time to exercise outside`, `PM2.5 forecast`, and materially different location/state variants. Satisfy these through one real decision engine; do not manufacture thin query-permutation pages.

## Product truth
Keep these evidence types visibly separate:
1. **Official observation:** AirNow reporting-area PM2.5 AQI/category.
2. **Agency forecast:** AirNow reporting-area daily PM2.5 forecast when published.
3. **Numerical model guidance:** NOAA/NWS hourly PM2.5 concentration guidance.
4. **Weather context:** NWS hourly wind/weather.
5. **Satellite context:** NASA FIRMS active-fire detections when configured.
6. **Product inference:** cleaner 3-hour window, trend, confidence, explanation.

Never collapse them into an opaque “official” score.

AirNow real-time observations are preliminary. Preserve the published PM2.5 AQI value and category. Never recalculate, average, smooth, or blend AirNow AQI into a proprietary AQI.

NOAA hourly PM2.5 concentration is model guidance in µg/m³. **Never label an hourly concentration or a conversion from it as an official AQI forecast.** The decision engine may compare concentrations relative to one another to rank cleaner time windows.

The tool is outdoor-planning assistance, not medical advice, a health warning, or a replacement for AirNow/local-agency guidance.

## Supported data stack
### AirNow
Use supported `reportingarea.dat` from the AirNow file system rather than creating a new dependency on retiring ZIP/lat-long web-service interfaces.

Requirements:
- cache the national reporting-area file about 20–30 minutes per warm runtime
- parse observation (`O`) and forecast (`F`) records separately
- select PM2.5 specifically
- choose a geographically defensible nearest reporting area
- expose reporting-area name and approximate distance
- never silently present a distant area as a local sensor
- preserve forecast-agency attribution when present

### NOAA/NWS hourly PM2.5 guidance
Use NOAA/NWS `air_quality/ndgd_apm25_hr01` ImageServer.

Requirements:
- use a point identify/time-range request
- return catalog items and corresponding pixel values across the forecast extent
- pair each pixel value with catalog valid time
- deduplicate timestamps
- reject non-finite/impossible concentrations
- retain issued/reference time when available
- treat as model guidance, not observation
- degrade independently when unavailable

### National Weather Service
Use `api.weather.gov/points/{lat},{lon}` and its `forecastHourly` URL.

Requirements:
- send an identifying User-Agent
- use wind/weather only as contextual planning evidence
- do not let wind override observed AQI
- failure must not destroy a usable AirNow/NOAA result

### NASA FIRMS
FIRMS is optional contextual evidence requiring `FIRMS_MAP_KEY`.

Requirements:
- default to `VIIRS_NOAA21_NRT`; NOAA-20 may be a later fallback
- do not make Suomi-NPP the long-term default given its announced 2026 retirement
- query a bounded local area, never the world
- report detections as satellite fire detections, not confirmed smoke sources
- do not infer causation from distance alone
- missing key/failure must never block the core decision

## Decision model
### Current condition
Use nearest defensible AirNow **PM2.5** observation.

Display current PM2.5 AQI, published category, reporting area, approximate distance, and published valid time/date when available.

Do not silently substitute ozone AQI into a PM2.5 smoke result.

### Hourly window
From NOAA hourly PM2.5 guidance:
1. consider future samples through the supported horizon, up to 48 hours
2. require a contiguous 3-hour sequence
3. reject gaps larger than 90 minutes
4. compute mean modeled PM2.5 for every candidate
5. select the sequence with the lowest mean
6. break essentially equal ties toward the earlier window
7. expose mean and maximum modeled concentration

Never claim the model minimum is guaranteed healthy. Call it **cleaner**, **lowest modeled PM2.5 window**, or equivalent.

### Trend
Compare the first several forecast hours with the subsequent several hours and classify:
- improving
- fairly steady
- worsening
- uncertain

Require material absolute or relative change so small model noise does not flip the label.

### Confidence
Confidence measures evidence quality, not probability of safety.

Suggested levels:
- **High:** nearby AirNow PM2.5 observation + substantial hourly NOAA guidance + fresh source state
- **Moderate:** strong hourly guidance without observation, or observation plus partial guidance
- **Low:** only one limited evidence family
- **Unavailable:** neither usable nearby PM2.5 observation nor enough model samples to compare a window

Always state why.

## Loss function
Minimize:

`L = 28F + 20D + 16S + 12G + 10U + 8C + 6P`

Where:
- **F** = false precision, source conflation, or health/official-status misrepresentation
- **D** = decision failure: user still cannot tell now/trend/better time
- **S** = source fragility: one dependency unnecessarily collapses the product
- **G** = geographic mismatch: wrong/distant reporting area silently presented as local
- **U** = hidden uncertainty, stale evidence, or unexplained degradation
- **C** = search cannibalization, thin geography pages, or crawler-hostile architecture
- **P** = performance, mobile, accessibility, or operational defects

Target weighted loss: **≤10/100**.

## Value function
Maximize a 100-point release value:

`V = 25D + 20T + 15H + 12R + 10X + 10S + 8O`

Where:
- **D — Decision utility (25):** now, trend, cleaner window, reason
- **T — Truth/provenance (20):** official vs model vs inference separated
- **H — Hourly intelligence (15):** valid 3-hour selection over real forecast samples
- **R — Resilience/uncertainty (12):** independent degradation and confidence
- **X — Mobile/accessibility UX (10):** answer-first, readable, accessible
- **S — Search/growth architecture (10):** canonical, intent coverage, useful crawlable shell, internal funnel
- **O — Operability/performance (8):** caching, timeouts, noindex APIs, deterministic tests

Ship target: **≥90/100**, with critical value functions at **≥85% of allocated points**.

## Hard vetoes
Do not ship if any are true:
1. AirNow AQI is recalculated, blended, or presented as proprietary AQI.
2. Modeled hourly PM2.5 is called an official AQI forecast or health advisory.
3. Reporting area selection lacks geographic distance logic.
4. One AirNow/NOAA/NWS/FIRMS failure unnecessarily destroys independent useful evidence.
5. Confidence/provenance is absent.
6. UI recommends a “safe” period solely because it is the model minimum.
7. APIs are crawlable/indexable.
8. Preview deployments are intentionally indexed.
9. Canonical URL changes without a migration decision.
10. Thin city/state pages are generated merely to target keywords.
11. Location search or device location regresses.
12. Deterministic tests fail or release score is below 90.

## UX contract
The first meaningful viewport after lookup must answer:
- place
- current PM2.5 AQI/category, if available
- cleaner 3-hour window, if available
- improving/steady/worsening trend
- confidence
- one concise explanation

Then show evidence, not before it.

Required secondary UI:
- compact hourly PM2.5 visualization
- AirNow daily PM2.5 forecast when available
- NWS wind/weather context for selected window
- optional FIRMS fire context
- source/freshness/provenance disclosure
- explicit product-truth note

Do not bury the answer under methodology.

## Accessibility and mobile
- mobile-first at 390px
- no page-level horizontal overflow; hourly strip may scroll inside its own container
- keyboard-operable forms/buttons/details/links
- semantic headings and labels
- `aria-live` for result/status changes
- no meaning conveyed by color alone
- respect reduced-motion preference
- no mandatory map; the decision must work without one

## SEO and growth architecture
Canonical: `https://chrisizworski.com/national-tools/smoke/`

The crawlable shell must explain the tool and evidence model before JavaScript runs. Live results hydrate after search.

Rules:
- target real decision intent, not smoke-map imitation
- geographic pages only when geography materially changes durable crawlable content
- preserve one canonical decision engine
- later state/metro pages require real location-specific data/history/seasonality and thin-content review
- instrument tool start/completion/error/confidence without sending exact coordinates or raw location query in analytics
- connect contextually to relevant national tools when user intent overlaps

## Privacy
- round device coordinates through shared national geocode contract
- do not send exact coordinates/query strings as analytics event properties
- do not persist exact coordinates as server telemetry
- share URLs use query-based place continuity, not raw lat/lon

## Resilience
Use `Promise.allSettled` or equivalent independent-family handling.

Expected degraded behavior:
- AirNow fails → modeled cleaner window survives with lower confidence and no current AQI
- NOAA hourly model fails → AirNow current/agency forecast survives with lower confidence; no invented window
- NWS fails → window survives without wind
- FIRMS fails/missing key → core result survives; fire context labeled unavailable
- all core PM2.5 evidence fails → true insufficient-evidence state with reason code

Do not replace failed live evidence with fabricated values.

## API observability
Return non-personal diagnostics:
- `status`
- `reason_code`
- `degraded_families`
- model sample count
- model issue/reference time
- reporting-area distance
- source availability/freshness
- confidence level/reason
- FIRMS configuration/failure reason without exposing key

Never echo secrets.

## Deterministic regression scenarios
Mandatory fixture coverage:
- AQI category boundaries
- AirNow `O` observation vs `F` forecast parsing
- nearest PM2.5 reporting area
- NOAA catalog attributes paired to pixel-value array
- duplicate timestamp handling
- contiguous 3-hour best window
- non-contiguous gap rejection
- improving/worsening/steady/uncertain trend
- high/moderate/low/unavailable confidence
- AirNow-only degradation
- NOAA-model-only degradation
- NWS degradation
- FIRMS missing-key degradation
- FIRMS distance filter
- no-evidence true failure
- explicit guardrail that modeled concentration is not an official AQI forecast

Tests must never require a live wildfire or live source response.

## Geographic live checks
Before declaring production healthy, smoke-test:
- Bay City, MI
- Detroit, MI
- Minneapolis, MN
- Denver, CO
- Seattle, WA
- Spokane, WA
- Phoenix, AZ
- Miami, FL

Verify location resolution and that displayed claims match actually available source families. Missing nearby PM2.5 data lowers confidence rather than fabricating locality.

## Release benchmark
Use `benchmarks/national-smoke-outdoor-window.json` and `scripts/verify-smoke.js`.

Release gate:
1. syntax checks pass
2. deterministic Node tests pass
3. benchmark verifier passes ≥90
4. CI green
5. PR contains no unrelated national-core changes
6. merge completes
7. Vercel production deployment succeeds
8. live API returns useful or truthful degraded/insufficient-evidence payload
9. canonical page resolves through production routing

## Completion standard
Do not call this complete because code exists.

Completion requires:
1. master prompt committed with implementation
2. API + decision engine implemented
3. answer-first mobile UI implemented
4. analytics-safe shared location flow preserved
5. deterministic regression suite green
6. release benchmark green
7. PR checked against hard vetoes
8. merged to production branch
9. deployment verified
10. production smoke tests performed
11. national tools hub/canonical routing updated without breaking existing tools

If deployment credentials, domain routing, or optional source keys are unavailable, complete every executable step, leave the independent feature gracefully degraded, and report the exact boundary rather than pretending completion.
