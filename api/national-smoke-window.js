"use strict";

const smoke = require("../lib/smoke-window.js");

const AIRNOW_URL = "https://files.airnowtech.org/airnow/today/reportingarea.dat";
const NOAA_PM25 = "https://mapservices.weather.noaa.gov/raster/rest/services/air_quality/ndgd_apm25_hr01/ImageServer/identify";
const NWS_BASE = "https://api.weather.gov";
const USER_AGENT = "ChrisIzworski-National-Smoke-Window/1.0 (https://chrisizworski.com/national-tools/smoke/)";

let airNowCache = { expires: 0, text: null, fetchedAt: null };

function setHeaders(res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=1800");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("X-Content-Type-Options", "nosniff");
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 9000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response;
  } finally {
    clearTimeout(timer);
  }
}

async function airNowText() {
  const now = Date.now();
  if (airNowCache.text && airNowCache.expires > now) return { text: airNowCache.text, fetchedAt: airNowCache.fetchedAt, cache: "warm" };
  const response = await fetchWithTimeout(AIRNOW_URL, { headers: { "user-agent": USER_AGENT } }, 10000);
  const text = await response.text();
  if (!text || !text.includes("|")) throw new Error("AirNow reporting-area file was empty or malformed");
  airNowCache = { text, fetchedAt: new Date().toISOString(), expires: now + 20 * 60 * 1000 };
  return { text, fetchedAt: airNowCache.fetchedAt, cache: "refreshed" };
}

async function noaaPm25Guidance(latitude, longitude, now = Date.now()) {
  const url = new URL(NOAA_PM25);
  url.searchParams.set("geometryType", "esriGeometryPoint");
  url.searchParams.set("geometry", JSON.stringify({ x: longitude, y: latitude, spatialReference: { wkid: 4326 } }));
  url.searchParams.set("time", `${now - 30 * 60000},${now + 49 * 3600000}`);
  url.searchParams.set("returnGeometry", "false");
  url.searchParams.set("returnCatalogItems", "true");
  url.searchParams.set("returnPixelValues", "true");
  url.searchParams.set("maxItemCount", "60");
  url.searchParams.set("f", "json");
  const response = await fetchWithTimeout(url, { headers: { "user-agent": USER_AGENT } }, 10000);
  const payload = await response.json();
  if (payload?.error) throw new Error(payload.error.message || "NOAA PM2.5 image service error");
  return smoke.parseNoaaIdentify(payload, now);
}

async function nwsHourly(latitude, longitude) {
  const headers = { "user-agent": USER_AGENT, accept: "application/geo+json, application/json" };
  const pointResponse = await fetchWithTimeout(`${NWS_BASE}/points/${latitude.toFixed(4)},${longitude.toFixed(4)}`, { headers }, 8000);
  const point = await pointResponse.json();
  const hourlyUrl = point?.properties?.forecastHourly;
  if (!hourlyUrl) throw new Error("NWS hourly forecast URL unavailable");
  const hourlyResponse = await fetchWithTimeout(hourlyUrl, { headers }, 8000);
  const hourly = await hourlyResponse.json();
  return {
    updated_at: hourly?.properties?.updateTime || point?.properties?.updateTime || null,
    generated_at: hourly?.properties?.generatedAt || null,
    time_zone: point?.properties?.timeZone || null,
    periods: (hourly?.properties?.periods || []).slice(0, 50),
  };
}

function parseCsvLine(line) {
  const out = [];
  let value = "", quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') { value += '"'; i += 1; }
      else quoted = !quoted;
    } else if (ch === "," && !quoted) { out.push(value); value = ""; }
    else value += ch;
  }
  out.push(value);
  return out;
}

function parseFirmsCsv(text, latitude, longitude) {
  const lines = String(text || "").trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((v) => v.trim().toLowerCase());
  const latIndex = headers.indexOf("latitude"), lonIndex = headers.indexOf("longitude");
  if (latIndex < 0 || lonIndex < 0) return [];
  return lines.slice(1).map((line) => {
    const row = parseCsvLine(line);
    const lat = smoke.finite(row[latIndex], -90, 90), lon = smoke.finite(row[lonIndex], -180, 180);
    if (lat == null || lon == null) return null;
    const distance = smoke.haversineMiles(latitude, longitude, lat, lon);
    return {
      latitude: lat,
      longitude: lon,
      distance_miles: distance == null ? null : Math.round(distance),
      confidence: headers.indexOf("confidence") >= 0 ? row[headers.indexOf("confidence")] : null,
      frp: headers.indexOf("frp") >= 0 ? smoke.finite(row[headers.indexOf("frp")], 0) : null,
      acquired_date: headers.indexOf("acq_date") >= 0 ? row[headers.indexOf("acq_date")] : null,
      acquired_time: headers.indexOf("acq_time") >= 0 ? row[headers.indexOf("acq_time")] : null,
      satellite: headers.indexOf("satellite") >= 0 ? row[headers.indexOf("satellite")] : null,
    };
  }).filter((row) => row && row.distance_miles != null && row.distance_miles <= 150)
    .sort((a, b) => a.distance_miles - b.distance_miles)
    .slice(0, 12);
}

async function firmsContext(latitude, longitude) {
  const key = process.env.FIRMS_MAP_KEY;
  if (!key) return { available: false, reason_code: "firms_key_not_configured", detections: [] };
  const latPad = 2.2, lonPad = 2.8;
  const bbox = [longitude - lonPad, latitude - latPad, longitude + lonPad, latitude + latPad]
    .map((v) => Math.max(-180, Math.min(180, v)).toFixed(3)).join(",");
  const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${encodeURIComponent(key)}/VIIRS_NOAA21_NRT/${bbox}/1`;
  const response = await fetchWithTimeout(url, { headers: { "user-agent": USER_AGENT } }, 9000);
  const text = await response.text();
  return { available: true, reason_code: null, detections: parseFirmsCsv(text, latitude, longitude) };
}

function sourceStatus(name, type, available, details = {}) {
  return { name, evidence_type: type, available: Boolean(available), ...details };
}

async function buildResult(latitude, longitude, now = Date.now()) {
  const outcomes = await Promise.allSettled([
    airNowText(),
    noaaPm25Guidance(latitude, longitude, now),
    nwsHourly(latitude, longitude),
    firmsContext(latitude, longitude),
  ]);

  const [airResult, modelResult, weatherResult, firmsResult] = outcomes;
  let air = { observation: null, forecasts: [] }, airMeta = null;
  if (airResult.status === "fulfilled") {
    airMeta = airResult.value;
    air = smoke.selectAirNowBundle(smoke.parseReportingArea(airMeta.text), latitude, longitude);
  }
  const model = modelResult.status === "fulfilled" ? modelResult.value : [];
  const weather = weatherResult.status === "fulfilled" ? weatherResult.value : { periods: [], updated_at: null, time_zone: null };
  const fires = firmsResult.status === "fulfilled" ? firmsResult.value : { available: false, reason_code: "firms_request_failed", detections: [] };

  const bestWindow = smoke.chooseBestWindow(model, 3, 48, now);
  const trend = smoke.trendFromSamples(model, now);
  const conf = smoke.confidence({ observation: air.observation, samples: model, sourceFresh: Boolean(airMeta) });
  const call = smoke.decision({ observation: air.observation, bestWindow, trend, confidenceResult: conf });
  const windowWeather = smoke.nearestWeatherForWindow(weather.periods, bestWindow);

  const degraded = [];
  if (airResult.status === "rejected" || !air.observation) degraded.push("airnow_pm25_observation");
  if (modelResult.status === "rejected" || model.length < 3) degraded.push("noaa_hourly_pm25_guidance");
  if (weatherResult.status === "rejected") degraded.push("nws_hourly_weather");
  if (!fires.available) degraded.push("nasa_firms_fire_context");

  return {
    generated_at: new Date(now).toISOString(),
    location: { latitude, longitude, time_zone: weather.time_zone || null },
    status: conf.code === "unavailable" ? "insufficient_evidence" : degraded.length ? "degraded" : "ok",
    reason_code: conf.code === "unavailable" ? "no_pm25_observation_or_hourly_guidance" : null,
    decision: call,
    current: air.observation ? {
      pm25_aqi: air.observation.aqi,
      aqi_category: air.observation.category || call.category.label,
      reporting_area: air.observation.reporting_area,
      state_code: air.observation.state_code,
      distance_miles: Math.round(air.observation.distance_miles),
      valid_date: air.observation.valid_date,
      valid_time: air.observation.valid_time,
      time_zone: air.observation.time_zone,
      primary: air.observation.primary,
    } : null,
    daily_airnow_forecasts: air.forecasts.map((row) => ({
      valid_date: row.valid_date,
      pm25_aqi: row.aqi,
      aqi_category: row.category || (row.aqi == null ? null : smoke.aqiCategory(row.aqi).label),
      discussion: row.discussion,
      forecast_source: row.forecast_source,
    })),
    hourly_pm25_guidance: model.slice(0, 49),
    best_window: bestWindow ? { ...bestWindow, weather: windowWeather } : null,
    trend,
    fire_context: {
      available: fires.available,
      reason_code: fires.reason_code,
      detection_count_within_150_miles: fires.detections.length,
      nearest_detections: fires.detections.slice(0, 5),
      caveat: "Satellite fire detections are context only and do not prove that a particular fire caused smoke at this location."
    },
    degraded_families: degraded,
    sources: [
      sourceStatus("AirNow reporting-area data", "official observation and agency forecast", airResult.status === "fulfilled", {
        url: AIRNOW_URL,
        fetched_at: airMeta?.fetchedAt || null,
        note: "PM2.5 AQI values and categories are preserved as published; observations are preliminary real-time data."
      }),
      sourceStatus("NOAA/NWS hourly PM2.5 forecast guidance", "numerical model guidance", modelResult.status === "fulfilled" && model.length > 0, {
        url: "https://mapservices.weather.noaa.gov/raster/rest/services/air_quality/ndgd_apm25_hr01/ImageServer",
        sample_count: model.length,
        issued_at: model[0]?.issued_time || null,
        note: "Hourly concentration guidance is used to compare windows and is not presented as an official AQI forecast."
      }),
      sourceStatus("National Weather Service hourly forecast", "official weather forecast", weatherResult.status === "fulfilled", {
        url: "https://api.weather.gov/",
        updated_at: weather.updated_at,
        note: "Wind and weather provide planning context; they do not override AirNow AQI."
      }),
      sourceStatus("NASA FIRMS NOAA-21 VIIRS", "satellite fire-detection context", fires.available, {
        url: "https://firms.modaps.eosdis.nasa.gov/api/",
        reason_code: fires.reason_code,
        note: "Optional context family requiring a FIRMS MAP_KEY."
      }),
    ],
    product_truth: "AirNow AQI is official agency-reported air-quality information. The outdoor window is an independent planning inference from public observations and NOAA model guidance, not a health advisory or official AQI forecast."
  };
}

module.exports = async function handler(req, res) {
  setHeaders(res);
  if (req.method !== "GET") return res.status(405).end(JSON.stringify({ error: "Method not allowed" }));
  const latitude = smoke.finite(req.query?.lat ?? req.query?.latitude, -90, 90);
  const longitude = smoke.finite(req.query?.lon ?? req.query?.longitude, -180, 180);
  if (latitude == null || longitude == null) return res.status(400).end(JSON.stringify({ error: "Valid lat and lon are required" }));
  try {
    const result = await buildResult(latitude, longitude);
    return res.status(result.status === "insufficient_evidence" ? 503 : 200).end(JSON.stringify(result));
  } catch (error) {
    return res.status(502).end(JSON.stringify({ error: "Smoke-window data is temporarily unavailable", reason_code: "unexpected_backend_failure", detail: String(error?.message || error).slice(0, 180) }));
  }
};

module.exports._test = { buildResult, parseCsvLine, parseFirmsCsv };
