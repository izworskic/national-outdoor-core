"use strict";

const { finite, sourceMeta } = require("../index");
const { buildWaterfallWindow, pickFlow } = require("../lib/waterfall-window");

const NLDI = "https://api.water.usgs.gov/nldi/linked-data";
const USGS_CONTINUOUS = "https://api.waterdata.usgs.gov/ogcapi/v0/collections/continuous/items";
const USGS_DAILY = "https://api.waterdata.usgs.gov/ogcapi/v0/collections/daily/items";
const NWPS_REACH = "https://api.water.noaa.gov/nwps/v1/reaches";
const NWS_POINTS = "https://api.weather.gov/points";
const UA = "ChrisIzworskiWaterfallWindow/1.0 (+https://chrisizworski.com/national-tools/waterfalls/)";
const DISCHARGE = "00060";
const DAILY_MEAN = "00003";

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function round(value, digits = 0) {
  const n = finite(value);
  if (n == null) return null;
  const p = 10 ** digits;
  return Math.round(n * p) / p;
}
function safeName(value) { return String(value || "Waterfall").replace(/\s+/g, " ").trim().slice(0, 120) || "Waterfall"; }
function isoDate(date) { return new Date(date).toISOString().slice(0, 10); }
function circularDayDistance(a, b) {
  const direct = Math.abs(a - b);
  return Math.min(direct, 366 - direct);
}
function dayOfYear(value) {
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return null;
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  return Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - start) / 86400000);
}
function quantile(values, q) {
  const a = values.map(Number).filter(Number.isFinite).sort((x, y) => x - y);
  if (!a.length) return null;
  const pos = (a.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  if (lo === hi) return a[lo];
  return a[lo] + (a[hi] - a[lo]) * (pos - lo);
}
function seasonalStats(rows, target = new Date()) {
  const targetDay = dayOfYear(target);
  if (targetDay == null) return null;
  const values = (rows || [])
    .map((row) => ({ time: row.time, value: finite(row.value, 0) }))
    .filter((row) => row.value != null && circularDayDistance(dayOfYear(row.time), targetDay) <= 21)
    .map((row) => row.value);
  if (values.length < 20) return null;
  return {
    p25: round(quantile(values, .25), 1),
    p50: round(quantile(values, .50), 1),
    p75: round(quantile(values, .75), 1),
    p90: round(quantile(values, .90), 1),
    sample_days: values.length,
    window_days: 43,
  };
}
function scaleSeasonal(stats, localModelFlow, gaugeFlow) {
  if (!stats) return null;
  const model = finite(localModelFlow, 0.001);
  const gauge = finite(gaugeFlow, 0.001);
  if (model == null || gauge == null) return { ...stats, scale_factor: 1, basis: "connected-gauge seasonal distribution" };
  const scale = clamp(model / gauge, 0.05, 20);
  return {
    p25: round(stats.p25 * scale, 1), p50: round(stats.p50 * scale, 1),
    p75: round(stats.p75 * scale, 1), p90: round(stats.p90 * scale, 1),
    sample_days: stats.sample_days, window_days: stats.window_days,
    scale_factor: round(scale, 3),
    basis: "connected-gauge seasonal distribution scaled to local NWM reach flow",
  };
}
function changePercent(current, prior) {
  const a = finite(current), b = finite(prior);
  return a == null || b == null || b === 0 ? null : Math.round(((a - b) / Math.abs(b)) * 100);
}
function priorPoint(points, hours) {
  if (!points.length) return null;
  const last = points.at(-1);
  const target = Date.parse(last.time) - hours * 3600000;
  return points.reduce((best, p) => !best || Math.abs(Date.parse(p.time) - target) < Math.abs(Date.parse(best.time) - target) ? p : best, null);
}
function featureProps(payload) { return (payload?.features || []).map((f) => f?.properties || {}).filter(Boolean); }
function nldiComid(payload) {
  const p = payload?.features?.[0]?.properties || {};
  const candidates = [p.nhdplus_comid, p.comid, p.identifier, p.featureid, p.feature_id];
  const found = candidates.find((v) => /^\d+$/.test(String(v || "")));
  return found ? String(found) : null;
}
function nldiFeatureId(feature) {
  const p = feature?.properties || {};
  return String(p.identifier || p.id || p.featureID || "").trim();
}
function parseGaugeFeature(feature, relation) {
  const p = feature?.properties || {};
  const id = nldiFeatureId(feature);
  if (!/^USGS-\d{5,15}$/.test(id)) return null;
  return {
    id,
    site_no: id.replace(/^USGS-/, ""),
    name: p.name || p.site_name || p.sourceName || id,
    relation,
    comid: p.comid || null,
  };
}
async function fetchJson(url, timeoutMs = 6500, options = {}) {
  const headers = { accept: "application/json, application/geo+json", "user-agent": UA, ...(options.headers || {}) };
  if (process.env.USGS_API_KEY && new URL(url).hostname === "api.waterdata.usgs.gov") headers["X-Api-Key"] = process.env.USGS_API_KEY;
  const response = await fetch(url, { method: options.method || "GET", headers, body: options.body, signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`${new URL(url).hostname} returned ${response.status}`);
  return response.json();
}
async function nldiPosition(lat, lon) {
  const makeUrl = (path) => {
    const url = new URL(`${NLDI}/${path}`);
    url.searchParams.set("f", "json");
    url.searchParams.set("coords", `POINT(${lon} ${lat})`);
    return url;
  };
  const hydroUrl = makeUrl("hydrolocation");
  try {
    const payload = await fetchJson(hydroUrl, 6500);
    const comid = nldiComid(payload);
    if (comid) return { comid, feature: payload?.features?.[0] || null, url: hydroUrl.toString(), method: "hydrolocation-snap" };
  } catch { /* use catchment lookup fallback */ }
  const positionUrl = makeUrl("comid/position");
  const payload = await fetchJson(positionUrl, 6000);
  const comid = nldiComid(payload);
  if (!comid) throw new Error("No hydrologic reach could be linked to this point");
  return { comid, feature: payload?.features?.[0] || null, url: positionUrl.toString(), method: "catchment-position-fallback" };
}
async function nldiNavigation(comid, mode, source, distanceKm) {
  const url = new URL(`${NLDI}/comid/${encodeURIComponent(comid)}/navigation/${mode}/${source}`);
  url.searchParams.set("f", "json");
  url.searchParams.set("distance", String(distanceKm));
  url.searchParams.set("excludeGeometry", "true");
  const payload = await fetchJson(url, 5000);
  return { payload, url: url.toString() };
}
async function connectedGauge(comid) {
  const attempts = [
    ["UM", "upstream-mainstem", 250],
    ["DM", "downstream-mainstem", 120],
  ];
  for (const [mode, relation, distance] of attempts) {
    try {
      const { payload, url } = await nldiNavigation(comid, mode, "nwissite", distance);
      const gauge = (payload?.features || []).map((f) => parseGaugeFeature(f, relation)).find(Boolean);
      if (gauge) return { ...gauge, navigation_url: url };
    } catch { /* try the next hydrologic direction */ }
  }
  return null;
}
async function regulationContext(comid) {
  const sources = ["ref_dams", "GRAND"];
  for (const source of sources) {
    try {
      const { payload, url } = await nldiNavigation(comid, "UT", source, 125);
      const features = payload?.features || [];
      if (features.length) {
        const names = features.slice(0, 4).map((f) => f?.properties?.name || f?.properties?.identifier).filter(Boolean);
        return { detected: true, source, count: features.length, names, url };
      }
    } catch { /* source may not have features for this network */ }
  }
  return { detected: false, source: null, count: 0, names: [], url: null };
}
function extractNwmSeries(payload) {
  const seriesCandidates = [
    payload?.analysisAssimilation?.series,
    payload?.analysis_assimilation?.series,
    payload?.shortRange?.series,
    payload?.short_range?.series,
    payload?.mediumRangeBlend?.series,
    payload?.medium_range_blend?.series,
    payload?.streamflow?.series,
    payload?.series,
  ].filter(Boolean);
  const series = seriesCandidates.find((s) => Array.isArray(s?.data)) || seriesCandidates.find(Array.isArray) || null;
  const data = Array.isArray(series) ? series : (series?.data || []);
  return data.map((row) => ({
    time: row.validTime || row.valid_time || row.time || null,
    flow: finite(row.flow ?? row.primary ?? row.value, 0),
  })).filter((row) => row.flow != null && Date.parse(row.time || ""));
}
async function nwmSeries(comid, seriesName) {
  const url = new URL(`${NWPS_REACH}/${encodeURIComponent(comid)}/streamflow`);
  url.searchParams.set("series", seriesName);
  const payload = await fetchJson(url, 6000);
  return { points: extractNwmSeries(payload), payload, url: url.toString() };
}
async function nwmBundle(comid) {
  const settled = await Promise.allSettled([
    nwmSeries(comid, "analysis_assimilation"),
    nwmSeries(comid, "short_range"),
    nwmSeries(comid, "medium_range_blend"),
  ]);
  const [analysis, short, medium] = settled.map((x) => x.status === "fulfilled" ? x.value : null);
  const analysisPoints = analysis?.points || [];
  const current = analysisPoints.length ? analysisPoints.at(-1) : null;
  const shortPick = pickFlow(short?.points || [], 24);
  const mediumPick = pickFlow(medium?.points || [], 72);
  return {
    current_cfs: current?.flow ?? null,
    current_time: current?.time ?? null,
    peak_24h_cfs: shortPick?.peak_flow ?? current?.flow ?? null,
    peak_24h_time: shortPick?.peak_time ?? null,
    peak_72h_cfs: mediumPick?.peak_flow ?? shortPick?.peak_flow ?? current?.flow ?? null,
    peak_72h_time: mediumPick?.peak_time ?? shortPick?.peak_time ?? null,
    available: Boolean(current || shortPick || mediumPick),
    urls: [analysis?.url, short?.url, medium?.url].filter(Boolean),
    degraded: settled.some((x) => x.status === "rejected"),
  };
}
async function usgsCurrent(gaugeId) {
  if (!gaugeId) return null;
  const end = new Date();
  const start = new Date(end.getTime() - 30 * 3600000);
  const url = new URL(USGS_CONTINUOUS);
  url.searchParams.set("f", "json");
  url.searchParams.set("limit", "500");
  url.searchParams.set("properties", "monitoring_location_id,parameter_code,time,value,unit_of_measure,approval_status,qualifier");
  const query = { op: "and", args: [
    { op: "=", args: [{ property: "monitoring_location_id" }, gaugeId] },
    { op: "=", args: [{ property: "parameter_code" }, DISCHARGE] },
    { op: "between", args: [{ property: "time" }, [start.toISOString(), end.toISOString()]] },
  ] };
  const payload = await fetchJson(url, 5500, { method: "POST", headers: { "content-type": "application/query-cql-json" }, body: JSON.stringify(query) });
  const points = featureProps(payload).map((p) => ({ time: p.time, value: finite(p.value, 0), approval: p.approval_status || null }))
    .filter((p) => p.value != null && Date.parse(p.time || "")).sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
  if (!points.length) return null;
  const last = points.at(-1), prior = priorPoint(points, 24);
  return { flow_cfs: last.value, measured_at: last.time, trend_percent_24h: changePercent(last.value, prior?.value), approval_status: last.approval, url: url.toString() };
}
async function usgsSeasonal(gaugeId) {
  if (!gaugeId) return null;
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear() - 8, now.getUTCMonth(), now.getUTCDate()));
  const url = new URL(USGS_DAILY);
  url.searchParams.set("f", "json");
  url.searchParams.set("limit", "10000");
  url.searchParams.set("properties", "monitoring_location_id,parameter_code,statistic_id,time,value,approval_status");
  const query = { op: "and", args: [
    { op: "=", args: [{ property: "monitoring_location_id" }, gaugeId] },
    { op: "=", args: [{ property: "parameter_code" }, DISCHARGE] },
    { op: "=", args: [{ property: "statistic_id" }, DAILY_MEAN] },
    { op: "between", args: [{ property: "time" }, [isoDate(start), isoDate(now)]] },
  ] };
  const payload = await fetchJson(url, 7500, { method: "POST", headers: { "content-type": "application/query-cql-json" }, body: JSON.stringify(query) });
  const rows = featureProps(payload).map((p) => ({ time: p.time, value: finite(p.value, 0) })).filter((p) => p.value != null && Date.parse(p.time || ""));
  const stats = seasonalStats(rows, now);
  return stats ? { ...stats, url: url.toString(), period_start: isoDate(start), period_end: isoDate(now) } : null;
}
function parseDurationHours(value) {
  const match = String(value || "").match(/^P(?:(\d+(?:\.\d+)?)D)?T?(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?$/i);
  if (!match) return null;
  return (Number(match[1] || 0) * 24) + Number(match[2] || 0) + Number(match[3] || 0) / 60;
}
function qpfSum(values, horizonHours, now = Date.now()) {
  const horizonEnd = now + horizonHours * 3600000;
  let totalMm = 0, used = 0;
  for (const row of values || []) {
    const [startRaw, durationRaw] = String(row.validTime || "").split("/");
    const start = Date.parse(startRaw || "");
    const hours = parseDurationHours(durationRaw);
    const mm = finite(row.value, 0);
    if (!Number.isFinite(start) || hours == null || hours <= 0 || mm == null) continue;
    const end = start + hours * 3600000;
    const overlap = Math.max(0, Math.min(end, horizonEnd) - Math.max(start, now));
    if (!overlap) continue;
    totalMm += mm * (overlap / (hours * 3600000));
    used += 1;
  }
  return used ? round(totalMm / 25.4, 2) : null;
}
async function precipitation(lat, lon) {
  const pointUrl = `${NWS_POINTS}/${lat.toFixed(4)},${lon.toFixed(4)}`;
  const point = await fetchJson(pointUrl, 4500, { headers: { accept: "application/geo+json" } });
  const gridUrl = point?.properties?.forecastGridData;
  if (!gridUrl) return null;
  const grid = await fetchJson(gridUrl, 6000, { headers: { accept: "application/geo+json" } });
  const values = grid?.properties?.quantitativePrecipitation?.values || [];
  return { qpf_24h_in: qpfSum(values, 24), qpf_72h_in: qpfSum(values, 72), grid_url: gridUrl, office: point?.properties?.cwa || null };
}
function responseSource(name, url, available, status, updatedAt = null) {
  return sourceMeta({ name, url, available, status, updatedAt });
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=3600");
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const lat = finite(req.query?.lat, 17, 72);
  const lon = finite(req.query?.lon, -180, -60);
  if (lat == null || lon == null) return res.status(400).json({ error: "A valid U.S. waterfall latitude and longitude are required." });
  const name = safeName(req.query?.name);

  try {
    const linked = await nldiPosition(lat, lon);
    const [gaugeResult, nwmResult, precipResult, regulationResult] = await Promise.allSettled([
      connectedGauge(linked.comid), nwmBundle(linked.comid), precipitation(lat, lon), regulationContext(linked.comid),
    ]);
    const gauge = gaugeResult.status === "fulfilled" ? gaugeResult.value : null;
    const nwm = nwmResult.status === "fulfilled" ? nwmResult.value : { available: false, urls: [] };
    const precip = precipResult.status === "fulfilled" ? precipResult.value : null;
    const regulation = regulationResult.status === "fulfilled" ? regulationResult.value : { detected: false, count: 0, names: [] };

    const [observedResult, seasonalResult] = gauge ? await Promise.allSettled([usgsCurrent(gauge.id), usgsSeasonal(gauge.id)]) : [null, null];
    const observed = observedResult?.status === "fulfilled" ? observedResult.value : null;
    const gaugeSeasonal = seasonalResult?.status === "fulfilled" ? seasonalResult.value : null;
    const seasonal = gaugeSeasonal && observed ? scaleSeasonal(gaugeSeasonal, nwm.current_cfs, observed.flow_cfs) : null;
    const localCurrent = nwm.current_cfs ?? observed?.flow_cfs ?? null;

    const intelligence = buildWaterfallWindow({
      current_flow_cfs: localCurrent,
      nwm_current_cfs: nwm.current_cfs,
      nwm_peak_24h_cfs: nwm.peak_24h_cfs,
      nwm_peak_24h_time: nwm.peak_24h_time,
      nwm_peak_72h_cfs: nwm.peak_72h_cfs,
      nwm_peak_72h_time: nwm.peak_72h_time,
      trend_percent_24h: observed?.trend_percent_24h,
      qpf_24h_in: precip?.qpf_24h_in,
      qpf_72h_in: precip?.qpf_72h_in,
      seasonal: seasonal || {},
      has_reach: true,
      has_nwm: Boolean(nwm.available),
      has_gauge: Boolean(observed),
      has_seasonal: Boolean(seasonal),
      has_precip: Boolean(precip && (precip.qpf_24h_in != null || precip.qpf_72h_in != null)),
      gauge_relation: gauge?.relation || null,
      regulated_flow: Boolean(regulation.detected),
    });

    const degraded = !nwm.available || !observed || !seasonal || !precip;
    if (degraded) res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=1200");
    const generated = new Date().toISOString();
    return res.status(200).json({
      generated_at: generated,
      methodology_version: "waterfall-window-v1.0.0",
      waterfall: { name, latitude: lat, longitude: lon },
      hydrologic_link: { comid: linked.comid, method: linked.method, nldi_url: linked.url },
      intelligence,
      observation: gauge ? {
        gauge_id: gauge.id, gauge_name: gauge.name, relation: gauge.relation,
        flow_cfs: observed?.flow_cfs ?? null, measured_at: observed?.measured_at ?? null,
        trend_percent_24h: observed?.trend_percent_24h ?? null,
        approval_status: observed?.approval_status ?? null,
      } : null,
      model: {
        source: "NOAA National Water Model guidance",
        current_cfs: nwm.current_cfs ?? null, current_time: nwm.current_time ?? null,
        peak_24h_cfs: nwm.peak_24h_cfs ?? null, peak_24h_time: nwm.peak_24h_time ?? null,
        peak_72h_cfs: nwm.peak_72h_cfs ?? null, peak_72h_time: nwm.peak_72h_time ?? null,
        degraded: Boolean(nwm.degraded),
        official_forecast: false,
      },
      seasonal: seasonal || null,
      precipitation: precip || null,
      regulation,
      degraded,
      sources: [
        responseSource("USGS Network Linked Data Index", linked.url, true, "waterfall point linked to NHDPlus river network"),
        responseSource("NOAA National Water Model via NWPS", nwm.urls?.[0] || `${NWPS_REACH}/${linked.comid}/streamflow`, Boolean(nwm.available), "local reach analysis and forecast guidance", nwm.current_time),
        responseSource("USGS Water Data for the Nation", observed?.url || "https://api.waterdata.usgs.gov/", Boolean(observed), "network-connected streamgage observation", observed?.measured_at),
        responseSource("USGS daily values", gaugeSeasonal?.url || "https://api.waterdata.usgs.gov/", Boolean(seasonal), "seasonal flow reference from connected streamgage"),
        responseSource("National Weather Service forecast grid", precip?.grid_url || "https://api.weather.gov/", Boolean(precip), "quantitative precipitation forecast"),
      ],
      disclaimer: "Waterfall Window estimates visual water-volume potential from multiple public hydrologic and weather signals. National Water Model values are guidance, not official forecasts. A high spectacle score is not a safety rating. Waterfall access, trails, river edges, crossings and viewing areas can be hazardous or closed, especially during high water.",
    });
  } catch (error) {
    res.setHeader("Cache-Control", "no-store");
    const detail = String(error?.message || error).slice(0, 260);
    const status = /No hydrologic reach/i.test(detail) ? 422 : 502;
    return res.status(status).json({ error: status === 422 ? "This waterfall could not be linked reliably to the mapped river network." : "Waterfall intelligence is temporarily unavailable.", detail });
  }
};

module.exports._test = { changePercent, circularDayDistance, dayOfYear, extractNwmSeries, nldiComid, parseDurationHours, qpfSum, quantile, scaleSeasonal, seasonalStats };
