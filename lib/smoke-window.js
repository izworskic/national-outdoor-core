"use strict";

const EARTH_RADIUS_MILES = 3958.7613;

function finite(value, min = -Infinity, max = Infinity) {
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

function haversineMiles(lat1, lon1, lat2, lon2) {
  const a1 = finite(lat1, -90, 90), o1 = finite(lon1, -180, 180);
  const a2 = finite(lat2, -90, 90), o2 = finite(lon2, -180, 180);
  if ([a1, o1, a2, o2].some((v) => v == null)) return null;
  const toRad = (v) => v * Math.PI / 180;
  const dLat = toRad(a2 - a1), dLon = toRad(o2 - o1);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a1)) * Math.cos(toRad(a2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function aqiCategory(value) {
  const aqi = finite(value, 0, 500);
  if (aqi == null) return { code: "unknown", label: "AQI unavailable", min: null, max: null };
  if (aqi <= 50) return { code: "good", label: "Good", min: 0, max: 50 };
  if (aqi <= 100) return { code: "moderate", label: "Moderate", min: 51, max: 100 };
  if (aqi <= 150) return { code: "usg", label: "Unhealthy for Sensitive Groups", min: 101, max: 150 };
  if (aqi <= 200) return { code: "unhealthy", label: "Unhealthy", min: 151, max: 200 };
  if (aqi <= 300) return { code: "very-unhealthy", label: "Very Unhealthy", min: 201, max: 300 };
  return { code: "hazardous", label: "Hazardous", min: 301, max: 500 };
}

function parseReportingArea(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const c = line.split("|");
      if (c.length < 17) return null;
      const latitude = finite(c[9], -90, 90);
      const longitude = finite(c[10], -180, 180);
      const aqi = finite(c[12], 0, 500);
      if (latitude == null || longitude == null) return null;
      return {
        issue_date: c[0] || null,
        valid_date: c[1] || null,
        valid_time: c[2] || null,
        time_zone: c[3] || null,
        record_sequence: finite(c[4]),
        data_type: c[5] || null,
        primary: String(c[6] || "").toUpperCase() === "Y",
        reporting_area: c[7] || null,
        state_code: c[8] || null,
        latitude,
        longitude,
        pollutant: c[11] || null,
        aqi,
        category: c[13] || (aqi == null ? null : aqiCategory(aqi).label),
        action_day: c[14] || null,
        discussion: c[15] || null,
        forecast_source: c.slice(16).join("|") || null,
      };
    })
    .filter(Boolean);
}

function selectNearestAirNow(records, latitude, longitude, options = {}) {
  const maxMiles = finite(options.maxMiles, 1, 1000) ?? 175;
  const pollutant = String(options.pollutant || "PM2.5").toUpperCase();
  const dataType = options.dataType ? String(options.dataType).toUpperCase() : null;
  const candidates = (Array.isArray(records) ? records : [])
    .filter((row) => String(row.pollutant || "").toUpperCase() === pollutant)
    .filter((row) => !dataType || String(row.data_type || "").toUpperCase() === dataType)
    .map((row) => ({ ...row, distance_miles: haversineMiles(latitude, longitude, row.latitude, row.longitude) }))
    .filter((row) => row.distance_miles != null && row.distance_miles <= maxMiles)
    .sort((a, b) => {
      if (a.distance_miles !== b.distance_miles) return a.distance_miles - b.distance_miles;
      if (a.primary !== b.primary) return a.primary ? -1 : 1;
      return (b.record_sequence ?? -999) - (a.record_sequence ?? -999);
    });
  return candidates[0] || null;
}

function selectAirNowBundle(records, latitude, longitude) {
  const observation = selectNearestAirNow(records, latitude, longitude, { pollutant: "PM2.5", dataType: "O", maxMiles: 175 });
  const forecasts = (Array.isArray(records) ? records : [])
    .filter((row) => String(row.pollutant || "").toUpperCase() === "PM2.5" && String(row.data_type || "").toUpperCase() === "F")
    .map((row) => ({ ...row, distance_miles: haversineMiles(latitude, longitude, row.latitude, row.longitude) }))
    .filter((row) => row.distance_miles != null && row.distance_miles <= 175)
    .sort((a, b) => a.distance_miles - b.distance_miles || (a.record_sequence ?? 999) - (b.record_sequence ?? 999));
  const area = observation?.reporting_area || forecasts[0]?.reporting_area || null;
  const state = observation?.state_code || forecasts[0]?.state_code || null;
  const sameAreaForecasts = forecasts.filter((row) => row.reporting_area === area && row.state_code === state);
  return { observation, forecasts: sameAreaForecasts.slice(0, 4) };
}

function parseNoaaIdentify(payload, now = Date.now()) {
  const features = payload?.catalogItems?.features;
  const attrs = Array.isArray(features) ? features.map((f) => f?.attributes || {}) : [];
  let values = payload?.properties?.Values ?? payload?.properties?.values ?? [];
  if (typeof values === "string") {
    try { values = JSON.parse(values); } catch (_) { values = values.split(","); }
  }
  if (!Array.isArray(values)) values = [];
  const rows = attrs.map((a, index) => {
    const t = finite(a.idp_validtime ?? a.IDP_ValidTime ?? a.ValidTime ?? a.valid_time);
    const issued = finite(a.idp_issueddate ?? a.IDP_IssuedDate ?? a.IssuedDate);
    const value = finite(values[index] ?? a.value ?? a.Value, 0, 5000);
    return {
      time: t == null ? null : new Date(t).toISOString(),
      valid_time_ms: t,
      issued_time: issued == null ? null : new Date(issued).toISOString(),
      forecast_hour: finite(a.idp_fcst_hour ?? a.IDP_FCST_HOUR ?? a.ForecastHour),
      pm25_ug_m3: value,
    };
  }).filter((row) => row.valid_time_ms != null && row.pm25_ug_m3 != null)
    .filter((row) => row.valid_time_ms >= now - 90 * 60 * 1000)
    .sort((a, b) => a.valid_time_ms - b.valid_time_ms);

  const deduped = [];
  const seen = new Set();
  for (const row of rows) {
    if (seen.has(row.valid_time_ms)) continue;
    seen.add(row.valid_time_ms);
    deduped.push(row);
  }
  return deduped;
}

function average(values) {
  const valid = values.map((v) => finite(v)).filter((v) => v != null);
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
}

function chooseBestWindow(samples, windowHours = 3, horizonHours = 48, now = Date.now()) {
  const horizon = now + Math.max(1, horizonHours) * 3600000;
  const rows = (Array.isArray(samples) ? samples : [])
    .map((row) => ({ ...row, ms: Date.parse(row.time || "") }))
    .filter((row) => Number.isFinite(row.ms) && row.ms >= now - 30 * 60000 && row.ms <= horizon && finite(row.pm25_ug_m3, 0, 5000) != null)
    .sort((a, b) => a.ms - b.ms);
  const size = Math.max(2, Math.min(6, Number(windowHours) || 3));
  let best = null;
  for (let i = 0; i <= rows.length - size; i += 1) {
    const slice = rows.slice(i, i + size);
    let contiguous = true;
    for (let j = 1; j < slice.length; j += 1) {
      const gap = slice[j].ms - slice[j - 1].ms;
      if (gap < 30 * 60000 || gap > 90 * 60000) { contiguous = false; break; }
    }
    if (!contiguous) continue;
    const avg = average(slice.map((row) => row.pm25_ug_m3));
    const max = Math.max(...slice.map((row) => row.pm25_ug_m3));
    const candidate = {
      start_time: slice[0].time,
      end_time: new Date(slice.at(-1).ms + 3600000).toISOString(),
      average_pm25_ug_m3: Math.round(avg * 10) / 10,
      max_pm25_ug_m3: Math.round(max * 10) / 10,
      hours: slice.length,
      samples: slice.map(({ ms, ...row }) => row),
    };
    if (!best || candidate.average_pm25_ug_m3 < best.average_pm25_ug_m3 - 0.05 ||
      (Math.abs(candidate.average_pm25_ug_m3 - best.average_pm25_ug_m3) <= 0.05 && Date.parse(candidate.start_time) < Date.parse(best.start_time))) {
      best = candidate;
    }
  }
  return best;
}

function trendFromSamples(samples, now = Date.now()) {
  const rows = (Array.isArray(samples) ? samples : [])
    .map((row) => ({ ...row, ms: Date.parse(row.time || "") }))
    .filter((row) => Number.isFinite(row.ms) && row.ms >= now - 30 * 60000 && finite(row.pm25_ug_m3, 0, 5000) != null)
    .sort((a, b) => a.ms - b.ms)
    .slice(0, 12);
  if (rows.length < 6) return { code: "unknown", label: "Trend uncertain", change_pm25_ug_m3: null };
  const split = Math.min(6, Math.floor(rows.length / 2));
  const first = average(rows.slice(0, split).map((r) => r.pm25_ug_m3));
  const second = average(rows.slice(split, Math.min(rows.length, split * 2)).map((r) => r.pm25_ug_m3));
  if (first == null || second == null) return { code: "unknown", label: "Trend uncertain", change_pm25_ug_m3: null };
  const delta = second - first;
  const relative = first > 0 ? delta / first : 0;
  const rounded = Math.round(delta * 10) / 10;
  if (delta <= -2 || relative <= -0.2) return { code: "improving", label: "Improving", change_pm25_ug_m3: rounded };
  if (delta >= 2 || relative >= 0.2) return { code: "worsening", label: "Worsening", change_pm25_ug_m3: rounded };
  return { code: "steady", label: "Fairly steady", change_pm25_ug_m3: rounded };
}

function confidence({ observation = null, samples = [], sourceFresh = true } = {}) {
  const count = Array.isArray(samples) ? samples.length : 0;
  if (observation && count >= 18 && sourceFresh) return { code: "high", label: "High confidence", reason: "Current AirNow PM2.5 AQI plus a substantial hourly NOAA forecast window are available." };
  if ((observation && count >= 6) || count >= 18) return { code: "moderate", label: "Moderate confidence", reason: "Useful evidence is available, but one evidence family is limited or missing." };
  if (observation || count >= 3) return { code: "low", label: "Lower confidence", reason: "The result relies on limited current or forecast evidence." };
  return { code: "unavailable", label: "Insufficient evidence", reason: "Neither a nearby PM2.5 observation nor enough hourly forecast guidance is available." };
}

function decision({ observation = null, bestWindow = null, trend = null, confidenceResult = null } = {}) {
  const category = observation?.aqi == null ? aqiCategory(null) : aqiCategory(observation.aqi);
  const conf = confidenceResult || confidence({ observation, samples: bestWindow?.samples || [] });
  let headline = "Check the cleaner outdoor window";
  if (category.code === "good" && trend?.code !== "worsening") headline = "Outdoor air looks favorable right now";
  else if (category.code === "moderate") headline = bestWindow ? "A cleaner outdoor window is available" : "Air quality is moderate right now";
  else if (["usg", "unhealthy", "very-unhealthy", "hazardous"].includes(category.code)) headline = bestWindow ? "Plan around the cleaner window" : "Current PM2.5 air quality is elevated";
  else if (!observation && bestWindow) headline = "Use the modeled cleaner window";

  const why = [];
  if (observation?.aqi != null) why.push(`AirNow reports PM2.5 AQI ${Math.round(observation.aqi)} (${category.label}) for the nearest reporting area.`);
  if (trend?.code && trend.code !== "unknown") why.push(`NOAA hourly PM2.5 guidance is ${trend.label.toLowerCase()} across the next several hours.`);
  if (bestWindow) why.push("The recommended window is the lowest modeled 3-hour PM2.5 period in the forecast horizon; it is planning guidance, not an official AQI forecast.");
  if (!why.length) why.push("Live evidence is too limited to make a useful outdoor-window call.");
  return { headline, category, confidence: conf, explanation: why.join(" ") };
}

function nearestWeatherForWindow(hours, window) {
  if (!window || !Array.isArray(hours) || !hours.length) return null;
  const start = Date.parse(window.start_time), end = Date.parse(window.end_time);
  const matches = hours.filter((h) => {
    const t = Date.parse(h.startTime || h.time || "");
    return Number.isFinite(t) && t >= start - 30 * 60000 && t < end + 30 * 60000;
  });
  if (!matches.length) return null;
  const speeds = matches.map((h) => {
    const m = String(h.windSpeed || "").match(/\d+(?:\.\d+)?/);
    return m ? Number(m[0]) : null;
  }).filter(Number.isFinite);
  const directions = matches.map((h) => h.windDirection).filter(Boolean);
  return {
    wind_direction: directions[0] || null,
    wind_speed_mph: speeds.length ? Math.round(average(speeds)) : null,
    short_forecast: matches[0]?.shortForecast || null,
  };
}

module.exports = {
  aqiCategory,
  average,
  chooseBestWindow,
  confidence,
  decision,
  finite,
  haversineMiles,
  nearestWeatherForWindow,
  parseNoaaIdentify,
  parseReportingArea,
  selectAirNowBundle,
  selectNearestAirNow,
  trendFromSamples,
};
