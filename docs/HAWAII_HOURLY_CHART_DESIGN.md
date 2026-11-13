# Coast-by-hour investment

## Reading path and implementation contract

Analytical job: compare six coast model samples over one HST daytime window, then inspect a selected hour. One interactive chart group, six SVG small multiples, two selectable metrics (significant wave height in feet and wind speed in mph), shared zero-based y scale within each metric/day. No combined safety score or hourly use of daily-peak historical percentiles. Blue means waves, purple means wind; red bands and text identify alert overlap, a dark dashed cursor identifies selection, gray crosses identify missing samples. No animation or map is needed to read these data.

The existing client owns loading, date selection and refresh failure. A separate native SVG/DOM module owns chart geometry and controls; reusing the site's lightweight SVG approach avoids a chart dependency for 54 points. The backend adds a versioned hourly contract to the existing response using already-fetched rows, with zero additional provider requests. Exact hourly timestamps only, no interpolation, no blank-to-zero conversion, no carrying values across gaps. Alert absence is distinct from alert-feed failure. Time is HST, including dates on the other side of UTC midnight.

Interaction: native date select, wave/wind pressed buttons, native range input with earlier/later buttons and a visible hour label. No hover-only values or pinch requirements. Selected hour values appear on every coast card. A semantic full-data table is the fallback. `#coast-hours?date=YYYY-MM-DD&hour=H&metric=wave|wind` is validated against returned dates and supported values; other page hashes remain intact until chart interaction. Same-page and browser-history changes restore valid chart state. Refresh clears the chart, including partial-render failure, before loading new data.

Mobile: controls wrap, cards stack below 700px, all buttons at least 44px, SVG recomputes x coordinates from measured container width. Portrait uses three time ticks; larger cards may show five. Values and units stay in HTML at readable sizes. Only the fallback table can scroll horizontally. Desktop uses two columns, not a shrunk six-series plot. Max 54 marks per metric plus alert overlays; a single ResizeObserver redraws charts without replacing focused controls.

Limits: significant wave height at a model grid cell is not breaking surf height or swimming clearance. NWS daytime ranges remain whole-period context, not invented hourly readings. Forecast-valid timestamps and response retrieval time are exposed; retrieval is not a model-run issue timestamp. Earlier hours are labeled model history, not observations. Closures, runoff, entry conditions and lifeguard advice remain separate checks.

QA: exact UTC/HST joins, missing/negative/duplicate values, alert interval boundaries and unknown intervals, daily contract compatibility, URL restore/invalid input, keyboard/native controls, common axes, discontinuous paths, failed refresh, full-data table and generated site tags. Browser acceptance must distinguish an actual inspected page from unverified layout; no visual pass is claimed from DOM tests.

## Evidence and verification

PacIOOS describes SWAN Big Island as an hourly forecast at approximately 500 m grid resolution: https://www.pacioos.hawaii.edu/waves/model-hawaiiisland/ and https://www.pacioos.hawaii.edu/metadata/swan_bigi.html . This supports retaining actual hourly samples, not treating a grid cell as a specific beach entry. The engine's existing Open-Meteo GFS request already retrieves hourly wind speed and direction. The new contract performs exact timestamp joins and retains separate quantities rather than reusing daily-peak percentiles as hourly probabilities.

npm run verify:all passed: 264 tests and smoke score 100. Eleven added tests cover the contract, provider-call counts, timestamps, missing data, duplicate rejection, units, alerts between sample times, common domains, path gaps, interactive controls, page synchronization, bookmark handling, HTML escaping and failure cleanup. Blank SWAN CSV heights previously parsed as zero; they now remain missing, and negative heights are rejected.

Browser visual acceptance is NOT complete. The existing Vercel preview is protected; the cloud browser also rejected a data-URL test page because it permits only HTTP(S) navigation. No attempt was made to bypass that restriction. The synthetic test page was not published. DOM tests are not represented as screenshots or a mobile layout pass. Review widths: 375/390, 768 and 1200 px, plus 200% zoom, should be inspected on an accessible preview.

No Python/runtime dependency, additional provider requests, datastore, changed canonical URL, ad change, or production release is introduced. Only the explicit chart/API/generator/test files are included; unrelated generated tool output and local dependency links are excluded.
