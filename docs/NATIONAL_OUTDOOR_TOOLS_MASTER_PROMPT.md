# ChrisIzworski.com — National Outdoor Decision Intelligence Network

Updated: September 2, 2026 (America/Detroit)

This document supersedes the August 31 national-tools build prompt. Read it with `AGENTS.md`, `docs/SEARCH_STRATEGY.md`, `docs/SEARCH_AUTHORITY_PORTFOLIO.md`, the current experiment ledger, tool-network registry, source-lifecycle benchmark and location-admission benchmark before changing a national search surface.

## 1. Mission

Build National Outdoor Decision Intelligence on ChrisIzworski.com into a national network of high-utility, data-driven outdoor tools capable of generating many tens of thousands of qualified organic search impressions per day, substantial recurring direct usage, increasing pageviews per visitor, defensible search authority and meaningful advertising revenue.

This is not a mandate to build the largest number of tools. It is a mandate to create the most useful network of **outdoor decisions derived from authoritative data**.

> Public data tells people what is happening. We tell them what it means for the outdoor decision they are trying to make.

Every major product should attempt to answer:

**Where are you? → What changed? → What is happening now? → What happens next? → What does that mean for what you want to do?**

Do not stop at raw weather, gauges, maps, satellite pixels or agency feeds. Combine independent signals only when the combination produces materially new, explainable insight.

## 2. Operating mode

Work end-to-end. Inspect current production and current `main` first. Research the opportunity and source lifecycle. Score candidates internally. Select the highest-value work without a hard veto. Design, implement, test, integrate, search-optimize, benchmark and verify it.

Follow repository-specific release rules in `AGENTS.md`. In this repository, agents prepare verified PRs but do not merge `main`; Chris makes the merge decision.

Never overwrite or discard unrelated work from another agent.

## 3. North-star outcome

The target is a compounding search and usage flywheel supporting:
- tens of thousands of daily Google impressions;
- thousands of daily organic visits;
- recurring/direct visits driven by changing conditions;
- multiple useful pageviews during planning sessions;
- seasonal reactivation;
- earned links/citations;
- high-value contextual advertising inventory;
- future sponsorship and affiliate opportunities where appropriate.

Order of operations:

**utility → search visibility → repeat usage → page depth → monetization**

Never sacrifice source truth, user trust, page speed or first-screen utility merely to create ad inventory.

## 4. Protected national assets

Inventory national canonicals before creating anything. Current major product families:
- `/national-tools/aurora/`
- `/national-tools/rivers/`
- `/national-tools/frost/`
- `/national-tools/planting/`
- `/national-tools/fall-color/`

Existing intent networks include Garden, Fall-trip planning, River-trip planning and Night-sky planning. Existing platform capabilities include national location handling, source freshness contracts, saved places, cross-tool place continuity, sharing, multi-place comparison, analytics, the national benchmark and the location-page admission benchmark.

Every proposed surface must first be classified:
1. enhancement to an existing canonical;
2. new decision-intent entry point into an existing engine;
3. new product family;
4. supporting evergreen/search content;
5. potential long-tail location surface.

Prefer enhancement and cross-source intelligence over duplicate canonicals.

## 5. Immediate infrastructure audit

### Rivers

Do not deepen dependency on retiring USGS WaterServices. Production runtime and future discovery-index generation must use the modern USGS Water Data APIs. Preserve river-first discovery, explicit river/gauge selection, exact monitoring-point retrieval, historical context, sensor availability, NWPS context, source timestamps and transparent missing-data behavior.

The source lifecycle contract is `benchmarks/national-source-lifecycle.json`.

### Air quality and fire

Audit AirNow interface lifecycle before implementation; avoid service families scheduled for retirement. NASA FIRMS remains credential/configuration aware. Missing `AIRNOW_API_KEY`, `FIRMS_MAP_KEY` or another required secret must produce an explicit configuration/degraded state, never fabricated data.

## 6. Product doctrine

A product earns its place when multiple pieces of information become significantly more useful when interpreted together.

Weak:
`Temperature 72°F · Wind 9 mph · AQI 48`

Strong:
`The next four hours are the best outdoor window today: temperatures remain comfortable, winds stay below the afternoon increase and current air quality is good. Smoke detections are west of the area; the wind forecast changes later today.`

The second answer is the product. The feeds are evidence.

## 7. Shared National Outdoor Intelligence Engine

Do not build technical islands.

### Common location object

Where available, resolve a place into:
- display place;
- latitude/longitude;
- state;
- timezone;
- elevation;
- watershed;
- coastal proximity;
- forecast zones;
- monitoring stations;
- public-land context;
- data coverage indicators.

Precise device location is optional. Coordinates never become analytics identity.

### Common signal contract

Every source-derived signal should support:
- source and source class;
- observation/issue time;
- retrieval time;
- data age and freshness threshold;
- current/stale/unavailable state;
- geographic relationship to the requested place;
- confidence;
- observed/forecast/historical/modeled/derived classification;
- derivation methodology;
- degraded state.

### Common temporal model

Support:
- now;
- previous 1–6 hours;
- previous 24 hours;
- next 3 hours;
- today;
- tonight;
- tomorrow;
- next several days;
- historical normal for the date.

### Independent degradation

One failed source must never blank unrelated truthful signals.

## 8. No universal outdoor score

Never create a fake universal recreation score such as “Outdoor Score 83/100.”

Produce individual decision statements such as:
- Clear-air window
- Rain arriving
- River rising rapidly
- Strong afternoon wind
- Snowpack melting
- Trail surface likely wet
- High tide approaching
- Smoke moving toward the area only when supported by the actual evidence
- Darkest clear-sky window
- Hard-freeze risk tonight

Priority may order urgent signals; priority is not a safety determination.

## 9. Candidate discovery

Before each major expansion wave identify at least 20 plausible data-combination products and research:
- actual search intent;
- competing tools;
- source availability and longevity;
- update frequency;
- national coverage;
- licensing;
- caching constraints;
- latency;
- cost;
- reliability;
- whether two or more feeds produce a genuinely new decision.

Store useful scoring artifacts in the repository. Never expose internal scores on consumer pages.

## 10. Product Value Function

Use `benchmarks/national-outdoor-tools.json.productValueFunction`.

| Component | Weight |
| --- | ---: |
| Real user decision usefulness | 20 |
| Organic search opportunity | 15 |
| Novelty of multi-source synthesis | 15 |
| Frequency/freshness of changing data | 10 |
| Repeat-use potential | 10 |
| National geographic reach | 8 |
| Defensibility versus ordinary content sites | 7 |
| Existing-network synergy | 5 |
| Long-tail expansion potential | 5 |
| Monetization/page-depth fit | 3 |
| Data sustainability/cost | 2 |
| **Total** | **100** |

Normally do not build a new product family below 82/100. Normally prioritize 88+. A hard veto always overrides the score.

## 11. Loss Function

Use `benchmarks/national-outdoor-tools.json.lossFunction`.

| Loss | Weight |
| --- | ---: |
| Data/factual integrity risk | 20 |
| Canonical/search cannibalization | 15 |
| Thin/programmatic-page risk | 15 |
| False certainty/misleading synthesis | 10 |
| Stale/failure-state weakness | 10 |
| Dependency/API sustainability risk | 10 |
| UX/performance complexity | 8 |
| Search-intent mismatch | 7 |
| Maintenance burden | 5 |
| **Total** | **100** |

Interpretation:
- 0–10: excellent
- 11–15: acceptable production
- 16–25: redesign before major search expansion
- >25: do not ship/index

## 12. Hard vetoes

Never ship:
- fabricated live data;
- silently stale live data;
- a derived result masquerading as an agency forecast;
- a universal recreation safety score;
- mass-generated location doorway pages;
- duplicate national canonicals;
- Michigan canonical clones;
- unsupported wildfire movement claims;
- unsupported flood predictions;
- unsupported trail-condition certainty;
- unsupported fish-bite scores;
- unsupported landscape foliage percentages;
- Kp represented as local aurora probability;
- plant-hardiness zones represented as frost dates;
- missing data turned into a neutral value;
- credentials embedded client-side;
- private/precise location data in analytics;
- arbitrary AI recommendations unsupported by supplied signals.

## 13. High-potential intelligence families

Research broadly and challenge the order.

### Smoke & Clear-Air Window
Potential inputs: supported AirNow observations/forecast, NASA FIRMS, NWS wind/hourly weather, alerts and only defensible smoke-model guidance. Do not claim a fire caused local smoke unless evidence supports that relationship. Candidate canonical: `/national-tools/smoke/`.

### Coastal Water Window
Potential inputs: NOAA NDBC observations, wave height/period/direction, wind, water temperature, NOAA CO-OPS tides/currents, NWS marine forecasts/advisories and sunrise/sunset. Activity lenses may include paddling, shore fishing, boating, beach walking and general coastal planning. Never label water recreation universally safe.

### Trail Surface / Mud / Freeze-Thaw
Use recent/forecast precipitation, temperature history, freeze/thaw cycles, snow, defensible soil-moisture products, elevation/terrain and official closure data where accessible. Always label the result as a derived estimate and show the evidence.

### Snowpack & Melt
Use NOAA National Snow Analysis, NRCS SNOTEL where available, temperature, precipitation type, SWE, elevation and nearby river response where relevant. Explain current pack, direction, melt and possible trail/runoff implications without unsupported certainty.

### Wildfire Trip Impact
Separate detected fire activity, smoke, air quality, official closures, official warnings and fire-weather conditions. Never invent evacuation guidance.

### Outdoor Weather Window
This is primarily an intelligence capability powering activity-specific decisions, not a generic weather app.

### Rivers + aquatic stress
Extend Rivers where actual sensors support water temperature, historical context, discharge, dissolved oxygen and trend. Do not infer species-specific fish behavior without ecological inputs.

### Garden water stress
Prefer extension of Garden/Frost/Planting. Combine recent rain, forecast rain, drought, soil moisture, temperature and defensible evapotranspiration context. Do not invent inch-perfect watering prescriptions.

### Night-sky intelligence
Extend Night Sky/Aurora with darkness, cloud, moon, smoke, precipitation and event context. Do not create a duplicate night-sky canonical merely to add another URL.

## 14. National Outdoor Decision Desk

The hub `/national-tools/` is the National Outdoor Decision Desk, not a directory.

One place should yield:
- **NOW** — what matters now;
- **CHANGED** — what changed recently;
- **NEXT** — what is likely to change next;
- **OPPORTUNITIES** — useful windows worth knowing about.

Each statement remains linked to its evidence. No overall winner or universal outdoor score.

## 15. Standalone canonical rule

Create a standalone canonical only when all are true:
1. clearly distinct search intent;
2. substantial independent search demand;
3. enough depth to satisfy the query by itself;
4. meaningful recurring/update behavior;
5. no existing canonical should own the intent.

Otherwise enhance an existing product or intent surface.

## 16. Long-tail search architecture

Use four layers:
1. major canonical tools;
2. substantial decision-intent surfaces;
3. admitted geographic pages;
4. deep authority/support pages.

A geographic page becomes indexable only after passing `benchmarks/national-location-admission.json`. Never generate thousands of city pages merely because the cities exist.

## 17. Search Opportunity Engine

Use Search Console evidence when available. Identify:
- rising queries;
- high impressions / poor CTR;
- rankings roughly positions 4–20;
- query clusters already touching a tool;
- unexpected location demand;
- near-me/question variants;
- seasonal demand beginning to rise;
- pages with impressions but weak engagement.

Choose the proper response: title/snippet improvement, better first answer, additional data, section depth, intent surface, admitted location surface or internal links. Do not reflexively create a URL.

## 18. Search Opportunity Matrix

Use `benchmarks/national-outdoor-tools.json.searchOpportunityMatrix`.

| Criterion | Weight |
| --- | ---: |
| Search evidence | 25 |
| Distinct intent | 15 |
| Unique localized/data answer | 15 |
| Tool conversion opportunity | 10 |
| Repeat usage | 10 |
| Internal-network relevance | 10 |
| Competition vulnerability | 5 |
| Backlink/share potential | 5 |
| Monetization fit | 5 |

Minimum 80/100 plus all hard gates.

## 19. UX

The useful answer wins the page.

Ideal flow:
1. Enter city or ZIP
2. Headline answer
3. Why — strongest 2–4 signals
4. Changed
5. Next
6. Explore — map, graph, source details, alternate places
7. Related decision — a contextual route to the next useful tool

Avoid large banners and explanatory copy before the answer.

## 20. Maps

Maps answer spatial questions; they are not decoration. Core decisions must remain readable without the map.

## 21. Freshness

Freshness is a product feature. Distinguish real-time, near-real-time, hourly, daily, weekly, climatological and static-reference inputs. Never label mixed-age sources as one generic “LIVE” state.

## 22. Technical architecture

Prefer:

**source → server ingestion/cache → normalized contract → deterministic intelligence rules → client**

Not:

**browser → many federal APIs**

Use central caching, local indexes for slow discovery, exact live retrieval for selected assets, request deduplication, timeouts, stale-while-revalidate where appropriate, clearly labeled last-known-good data, circuit breakers, source-health logging, deterministic derivations and threshold tests. Secrets stay server-side.

## 23. Derived intelligence

Every derived statement must define:
- exact inputs;
- time window;
- auditable rule/model;
- confidence from input completeness/relevance;
- inspectable explanation.

Do not ask an LLM to invent numerical environmental conclusions from unstructured readings. LLMs may explain deterministic/source-backed calculations; they do not replace them.

## 24. Production benchmark

Use `benchmarks/national-outdoor-tools.json.productionBenchmark`.

Targets:
- factual/source integrity: 100%, hard gate;
- freshness transparency: >=95;
- decision usefulness: >=90;
- distinct search intent: >=90;
- first-screen usefulness: >=90;
- failure/degradation behavior: >=95;
- mobile usability: >=90;
- accessibility: >=90;
- performance: >=90;
- internal-network integration: >=90;
- analytics coverage: >=90;
- canonical/cannibalization integrity: 100%, hard gate.

Overall target: **>=92/100 with no hard veto**.

## 25. Scenario testing

Do not test only Michigan. At minimum exercise:
- Seattle/Cascades;
- Denver/Colorado mountains;
- Atlanta/Appalachians;
- Burlington/New England;
- Phoenix/Flagstaff;
- New Orleans/Gulf;
- California coast;
- Michigan coexistence with deeper local canonicals.

## 26. SEO requirements

Every indexable product needs:
- query-aligned H1;
- unique title and meta description;
- canonical URL;
- useful HTML before JS;
- Chris Izworski Person/entity linkage;
- truthful schema;
- source/methodology content;
- contextual internal links;
- breadcrumbs where useful;
- truthful `dateModified`;
- sitemap inclusion;
- strong OG/social metadata;
- no indexation of APIs/transient location state.

No keyword stuffing.

## 27. Search CTR optimization

For pages with impressions, compare query language with title, H1, description, visible first answer and SERP intent. Improve poor-CTR surfaces from evidence, not guesswork.

## 28. Internal-link flywheel

Contextual decisions should strengthen neighboring tools: Aurora → Night Sky; Snowpack → Rivers/Trails; Smoke → outdoor timing/Night Sky; Frost → Planting; Rivers → precipitation/snowmelt; Fall → trip-weather context. Avoid generic card walls when a meaningful next decision exists.

## 29. Promotion

Promotion is part of the build.

Execute on-site promotion, sitemap/canonical/structured-data checks, Search Console inspection when available and linkable assets without external authorization.

Research earned-promotion targets and prepare outreach drafts, but **never send external outreach email without Chris's explicit approval**.

## 30. Seasonal calendar

Build before demand peaks:
- Winter: snow depth, snowpack, trail snow, aurora, freeze, supported river-ice context.
- Spring: frost, planting, snowmelt, rivers, trail mud, high water.
- Summer: smoke, wildfire, heat, coastal conditions, rivers, outdoor windows.
- Fall: foliage, frost, smoke/fire where relevant, outdoor travel, aurora.

## 31. Advertising architecture

Advertising follows utility. Never place ads before the primary answer, between a warning and explanation, inside critical controls, where it resembles official data or where it harms mobile usability. Prefer inventory after the initial answer and between deeper modules/support content.

Optimize qualified sessions, repeat frequency, pages/session, seasonality, viewability and performance — not ads per page.

## 32. Analytics

Measure:
- location-resolution success;
- first useful answer rendered;
- source degradation;
- selected river/station or activity lens;
- transitions between tools;
- repeat usage;
- saved places;
- shares;
- long-tail → tool conversion;
- result depth;
- privacy-safe return behavior.

Never send raw coordinates, ZIPs, saved place names or precise device position.

## 33. Growth measurement

Track per product:
- Google impressions/day;
- clicks/day;
- CTR;
- median rank;
- indexed pages;
- organic landings;
- engagement;
- transitions;
- repeat use;
- source reliability;
- page performance.

Network funnel:

**Impressions → clicks → useful answers → second decisions → repeat visits → monetizable pageviews**

Find the bottleneck. Do not celebrate impressions with collapsing CTR or traffic without tool use.

## 34. Build sequence

Unless research materially changes it:
- Phase 0: audit/harden existing five national products and source lifecycles, especially USGS.
- Phase 1: evolve `/national-tools/` into the Decision Desk by reusing existing products.
- Phase 2: Smoke & Clear-Air if supported interfaces and credentials pass.
- Phase 3: Coastal Water Window.
- Phase 4: Snowpack + Melt; decide whether trail surface is a canonical or activity lens.
- Phase 5: Wildfire Trip Impact if incident/closure integration passes source audit.
- Phase 6: deepen existing products with cross-source intelligence.

Rerun the candidate matrix at every phase. Search evidence and source reliability may change the order.

## 35. End-to-end execution loop

For every expansion:
1. Inspect current main, routes, APIs, experiments and benchmarks.
2. Research intent, competition, datasets, source viability and freshness.
3. Score Product Value + Loss + Search Opportunity internally.
4. Select the highest-value candidate without vetoes.
5. Design decision statement, data contract, failure state, canonical ownership and long-tail architecture.
6. Build backend, caching, deterministic synthesis and responsive UI.
7. Integrate shared place state, Decision Desk, cross-tool links and analytics.
8. Search-optimize metadata, crawlable content, schema, sitemap and OG.
9. Test unit, integration, failure, freshness, multi-region, accessibility and mobile.
10. Benchmark internally.
11. Run all repository verification.
12. Prepare a PR. Follow `AGENTS.md` for merge authority.
13. After merge, verify production deployment.
14. Production-smoke real public URLs/live behavior.
15. Execute internal promotion and prepare external opportunities.
16. Record baselines.
17. Improve from actual impressions, CTR and usage.

Then repeat.

## 36. Required state after each execution

Leave behind where applicable:
- production-ready code;
- normalized source adapters;
- source/freshness documentation;
- automated tests;
- machine-readable benchmarks;
- current master doctrine;
- search metadata/schema/sitemap;
- analytics;
- internal links;
- Decision Desk integration;
- promotion assets;
- baseline metrics;
- production verification;
- public URLs after merge.

State clearly what shipped, what deliberately did not ship, what data are live/derived/forecast, what degraded, source/API risk and the next highest-value move.

## 37. Final product principle

Do not beat NOAA at weather, USGS at gauges, NASA at satellite fire detection or EPA at AQI.

Build the layer those systems generally do not provide:

**What do these signals mean together, for this place, at this moment, for the outdoor decision I am trying to make?**

That is the product moat. Search compounds through changing local decisions; retention compounds because conditions change every day.

The recurring user questions are:

**Should I go? When should I go? Where should I go? What changed? What should I pay attention to next?**

### Core-before-enrichment rule

Core authoritative decision data must not wait on optional enrichment. Slow discovery may be precomputed, but selected condition values remain exact and current. Optional enrichment fails independently.

### Measurement before expansion

Use existing Vercel Analytics to measure location resolution, tool transitions, saved-place use and Decision Desk source health. Location state is product state, not analytics identity. Measurement informs but does not itself grant indexability.
