# Waterfall Window — product contract

## Mission
Build a national hydrologic decision product that answers a question no single source can answer: **How spectacular is this waterfall's flow now, and is the viewing window likely to improve over the next three days?**

The output is derived intelligence, not a repackaged gauge or weather forecast.

## Required fusion
1. **Waterfall identity/location:** OpenStreetMap discovery/search.
2. **Hydrologic network:** USGS NLDI hydrolocation snap/raindrop trace, with catchment fallback.
3. **Observed water:** network-connected USGS discharge observation; never select by straight-line proximity alone.
4. **Seasonal context:** connected USGS daily-mean discharge history in a same-season window.
5. **Local reach guidance:** NOAA National Water Model analysis, short range and medium-range blend.
6. **Incoming precipitation:** NWS quantitative precipitation forecast.
7. **Regulation context:** upstream NLDI dam/reservoir feature detection; use as uncertainty, not as a release forecast.

## Derived output
Return three separate spectacle scores: **Now, next 24 hours, next 3 days**. Scores are 0–100, with editorial labels from Very low flow through Exceptional. Explain the dominant reasons, show a confidence label, expose the live signals, and always display a separate safety/access caution.

## Hydrologic matching rule
The waterfall must be attached to the river network first. Gauge selection happens by NLDI navigation from that reach. A physically closer gauge in another basin is irrelevant and must not be used.

## Seasonal normalization
Use same-season daily mean discharge at the connected gauge. When current local NWM reach flow and live gauge flow are both available, scale gauge percentiles by the current model:gauge ratio (bounded) to form a local reach reference. Disclose this as a derived baseline.

## Confidence
Confidence is based on evidence coverage, not on how strong the score is. Reach linkage and NWM provide the base. Connected observation, seasonal history, and NWS precipitation add confidence. Detected upstream regulation reduces confidence because national feeds do not provide complete release intent.

## Safety
Spectacle and safety are intentionally independent. High water can increase spectacle while increasing hazard. Never use language such as safe, safe to approach, safe trail, safe crossing, or safe swimming. Direct users to local closures/warnings for access decisions.

## SEO / growth
The canonical is `/national-tools/waterfalls/`. Keep the tool page indexable and API endpoints noindex. Query-string analyses remain canonicalized to the tool root. Future long-tail expansion should be built from real named-waterfall entities with useful, changing hydrologic content, not thin generated city pages.

## Release gate
Score >= 90/100 against `benchmarks/national-waterfall-window.json`, all unit tests pass, canonical route works, search works, at least one gauged and one ungauged benchmark waterfall produce honest degraded/non-degraded results, and no hard veto is violated.
