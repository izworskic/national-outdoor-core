// Kona manta ray night snorkel: how rough is the sea at the two manta sites tonight, and which of the next
// four nights is calmest. It does NOT predict whether mantas appear: that follows plankton, which no source here measures.
// Signals: NWS active alerts, NWS Surf Zone Forecast (leeward west-facing feet), the PacIOOS SWAN wave model judged against
// that site's own 2016-2025 evening record, Open-Meteo wind and rain. Rules are published on the page and unvalidated.
import { MANTA_CLIMATOLOGY } from './kona-manta-climatology.mjs';
import { fetchWithTimeout, fetchSwan, hstYmd, hstHour, addDaysYmd, parseSrf, srfFirstDate, nwsForCoast, nwsTier, fetchLatestSrf, dayLabel } from './big-island-coast.mjs';

export const URLS = {
  alerts: 'https://api.weather.gov/alerts/active?area=HI',
  openMeteo: 'https://api.open-meteo.com/v1/gfs'
};

export const THRESHOLDS = {
  windowStartHst: 18, // evening window 6:00 to 9:00 p.m. HST
  windowEndHst: 21,
  modelModeratePct: 70,
  modelLargePct: 90,
  seaMinModerateM: 0.4, // floors: Garden Eel Cove is so sheltered that its 90th percentile is only about 0.36 m,
  seaMinLargeM: 0.8, //   so a rare-for-this-site but still small sea must not be called rough on percentile alone
  longPeriodS: 14,
  longPeriodMinPct: 60,
  onshoreWatchMph: 15,
  onshoreRoughMph: 25,
  rainWatchMm: 0.5, // rain in the evening window
  rainRoughMm: 4,
  runoffWatchMm: 10, // rain in the 24 hours before the window
  nightsAhead: 4,
  srfMaxAgeHours: 36,
  swanBudgetMs: 8500
};

// Garden Eel Cove (also called Manta Heaven, officially Ho'ona Bay) is off Keahole Point near the airport; Manta Village is at
// Keauhou Bay in front of the Sheraton. Coordinates: Wikipedia (Ho'ona Bay) and the bay's published position.
export const SITES = [
  { id: 'garden-eel-cove', name: 'Garden Eel Cove (Keahole, near the airport)', short: 'Garden Eel Cove', coord: [19.7328, -156.0572], faces: 260 },
  { id: 'manta-village', name: 'Manta Village (Keauhou Bay)', short: 'Manta Village', coord: [19.5598, -155.9667], faces: 230 }
];
const ZONE = 'HIZ023'; // Kona
const LEVEL = ['GOOD', 'WATCH', 'ROUGH'];
export const LABEL = { GOOD: 'Good', WATCH: 'Watch', ROUGH: 'Rough', CHECK: 'Check', NO_DATA: 'No call' };
const PLAIN = {
  GOOD: 'Calm sea and no rain: a good night to go',
  WATCH: 'Rougher or wetter than usual: call your operator',
  ROUGH: 'Rough: expect tours to be cancelled or moved',
  CHECK: 'The forecast and the wave model disagree',
  NO_DATA: 'No source available'
};
const finite = (v) => typeof v === 'number' && Number.isFinite(v);

/** Evening window for an HST date, as UTC ms. */
export function eveningWindow(ymd) {
  const mid = Date.parse(`${ymd}T00:00:00Z`) + 10 * 3600000; // midnight HST
  return [mid + THRESHOLDS.windowStartHst * 3600000, mid + THRESHOLDS.windowEndHst * 3600000];
}
/** The night being planned: tonight until 9 p.m. HST, then tomorrow. Never a night that is over. */
export function primaryNight(now = Date.now()) {
  const ymd = hstYmd(now);
  return hstHour(now) >= THRESHOLDS.windowEndHst ? addDaysYmd(ymd, 1) : ymd;
}

export function percentileOf(siteId, hs) {
  const q = MANTA_CLIMATOLOGY[siteId]?.hsQuantiles;
  if (!q || !finite(hs)) return null;
  let i = 0;
  while (i < q.length && q[i] < hs) i++;
  return Math.min(100, i);
}

/** Sea state in the evening window from model rows. */
export function seaNight(siteId, rows, ymd) {
  const [w0, w1] = eveningWindow(ymd);
  const win = rows.filter((r) => r.ms >= w0 && r.ms < w1);
  if (win.length < 2) return null;
  const peak = win.reduce((a, b) => (b.hs > a.hs ? b : a));
  const maxPer = Math.max(...win.map((r) => (Number.isFinite(r.per) ? r.per : 0)));
  return { peakM: Math.round(peak.hs * 100) / 100, periodS: Number.isFinite(peak.per) ? Math.round(peak.per) : null, maxPeriodS: Math.round(maxPer), dirDeg: Number.isFinite(peak.dir) ? Math.round(peak.dir) : null, percentile: percentileOf(siteId, peak.hs) };
}
/** The site's own 2016-2025 evening record, for the comparison chart. */
export function recordFor(siteId) {
  const q = MANTA_CLIMATOLOGY[siteId]?.hsQuantiles;
  return q ? { p50: q[50], p70: q[70], p90: q[90], p99: q[99] } : null;
}
export function seaTier(sea) {
  if (!sea || !finite(sea.percentile)) return null;
  const T = THRESHOLDS;
  if (sea.percentile >= T.modelLargePct && sea.peakM >= T.seaMinLargeM) return 2;
  if (sea.percentile >= T.modelModeratePct && sea.peakM >= T.seaMinModerateM) return 1;
  return 0;
}

export async function fetchWeather(site) {
  const [la, lo] = site.coord;
  const url = `${URLS.openMeteo}?latitude=${la}&longitude=${lo}&hourly=wind_speed_10m,wind_direction_10m,precipitation&wind_speed_unit=mph&past_days=1&forecast_days=${THRESHOLDS.nightsAhead + 1}&timezone=GMT`;
  const h = (await (await fetchWithTimeout(url, 20000)).json())?.hourly;
  if (!h?.time) throw new Error('Open-Meteo returned no hourly data');
  return h.time.map((t, i) => ({ ms: Date.parse(`${t}:00Z`), mph: h.wind_speed_10m?.[i], dir: h.wind_direction_10m?.[i], mm: h.precipitation?.[i] })).filter((r) => Number.isFinite(r.ms));
}

/** Wind (strongest onshore component) and rain (in the window, and in the 24 h before it). */
export function weatherNight(site, rows, ymd) {
  const [w0, w1] = eveningWindow(ymd);
  const win = rows.filter((r) => r.ms >= w0 && r.ms < w1);
  if (win.length < 2) return null;
  let wind = null;
  for (const r of win) {
    if (!finite(r.mph) || !finite(r.dir)) continue;
    const onshore = r.mph * Math.cos(((r.dir - site.faces) * Math.PI) / 180);
    if (!wind || onshore > wind.onshoreMph) wind = { onshoreMph: Math.round(onshore), mph: Math.round(r.mph), fromDeg: Math.round(r.dir) };
  }
  const sum = (a, b) => rows.filter((r) => r.ms >= a && r.ms < b && finite(r.mm)).reduce((s, r) => s + r.mm, 0);
  const priorHours = rows.filter((r) => r.ms >= w0 - 24 * 3600000 && r.ms < w0 && finite(r.mm)).length;
  return { wind, rainWindowMm: Math.round(sum(w0, w1) * 10) / 10, rainPrior24Mm: Math.round(sum(w0 - 24 * 3600000, w0) * 10) / 10, priorCovered: priorHours >= 20 };
}

export function alertsForSite(features, ymd) {
  const [w0, w1] = eveningWindow(ymd);
  return (features || []).filter((f) => {
    const p = f.properties || {};
    if (!/high surf|beach hazard|rip current|coastal flood|tsunami|small craft|high wind|flash flood|flood warning|flood watch/i.test(p.event || '')) return false;
    if (!(p.geocode?.UGC || []).includes(ZONE) && !(p.geocode?.UGC || []).some((u) => /^PHZ/.test(u))) return false;
    const from = Date.parse(p.onset || p.effective), to = Date.parse(p.ends || p.expires);
    return (!Number.isFinite(from) || from <= w1) && (!Number.isFinite(to) || to >= w0);
  }).map((f) => ({ event: f.properties.event, endsIso: f.properties.ends || f.properties.expires, severe: /high surf (advisory|warning)|flash flood warning|tsunami warning/i.test(f.properties.event) }));
}

/** Pure function of the signals. Never throws. */
export function decide({ alerts = [], nws = null, sea = null, weather = null }) {
  const T = THRESHOLDS;
  const reasons = [];
  const severe = alerts.find((a) => a.severe);
  const nTier = nws ? nwsTier(nws.highFt) : null;
  const sTier = seaTier(sea);
  const wind = weather?.wind || null;
  const rain = weather || null;
  if (severe) {
    reasons.push(`${severe.event} is in effect.`);
    return { state: 'ROUGH', label: LABEL.ROUGH, plain: PLAIN.ROUGH, confidence: 'MODERATE', reasons, tiers: { nws: nTier, sea: sTier } };
  }
  if (nTier == null && sTier == null && !rain) {
    return { state: 'NO_DATA', label: LABEL.NO_DATA, plain: PLAIN.NO_DATA, confidence: 'NONE', reasons: ['No forecast source could be read.'], tiers: { nws: null, sea: null } };
  }
  if (nws) reasons.push(`NWS west-facing surf forecast for the day: ${nws.lowFt}-${nws.highFt} feet.`);
  if (sea) reasons.push(`Wave model, 6 to 9 p.m.: peak ${sea.peakM.toFixed(2)} m, rougher than ${sea.percentile} percent of evenings at this site.`);
  let level = Math.max(nTier ?? 0, sTier ?? 0);
  let confidence = nTier != null && sTier != null ? 'MODERATE' : 'LOW';
  if (nTier == null && sTier != null) reasons.push('No NWS forecast for this day, so the sea rating rests on the wave model alone.');
  if (sTier == null && nTier != null) reasons.push('No wave-model reading for this night, so the sea rating rests on the NWS forecast alone.');
  if (sea && sea.maxPeriodS >= T.longPeriodS && sea.percentile >= T.longPeriodMinPct && sea.peakM >= T.seaMinModerateM) {
    if (level < 1) level = 1;
    reasons.push(`Long-period swell (${sea.maxPeriodS} seconds) can cause surge even when the height looks modest.`);
  }
  if (wind && wind.onshoreMph >= T.onshoreWatchMph) {
    level = Math.max(level, wind.onshoreMph >= T.onshoreRoughMph ? 2 : 1);
    reasons.push(`Onshore wind up to ${wind.onshoreMph} mph.`);
  }
  if (rain) {
    if (rain.rainWindowMm >= T.rainWatchMm) {
      level = Math.max(level, rain.rainWindowMm >= T.rainRoughMm ? 2 : 1);
      reasons.push(`Rain in the evening forecast (${rain.rainWindowMm} mm).`);
    }
    if (rain.rainPrior24Mm >= T.runoffWatchMm) {
      level = Math.max(level, 1);
      reasons.push(`${rain.rainPrior24Mm} mm of rain in the 24 hours before: runoff can cloud the water.`);
    }
  }
  if (nTier != null && sTier != null && Math.abs(nTier - sTier) >= 2) {
    reasons.push('The NWS forecast and the wave model are two steps apart. Ask your operator before you book a non-refundable slot.');
    return { state: 'CHECK', label: LABEL.CHECK, plain: PLAIN.CHECK, confidence: 'LOW', reasons, tiers: { nws: nTier, sea: sTier } };
  }
  const state = LEVEL[Math.min(level, 2)];
  return { state, label: LABEL[state], plain: PLAIN[state], confidence, reasons, tiers: { nws: nTier, sea: sTier } };
}

const RANK = { GOOD: 0, WATCH: 1, CHECK: 2, ROUGH: 3, NO_DATA: 4 };
export const nightRank = (night) => Math.min(...night.sites.map((s) => RANK[s.decision.state]));

export function headline(nights) {
  const best = [...nights].filter((n) => nightRank(n) < RANK.CHECK).sort((a, b) => nightRank(a) - nightRank(b) || (a.sites[0].sea?.peakM ?? 9) - (b.sites[0].sea?.peakM ?? 9));
  if (!best.length) {
    if (nights.some((n) => n.sites.some((s) => s.decision.state === 'CHECK'))) return 'No clear answer: the sources disagree. Ask your operator.';
    if (nights.every((n) => n.sites.every((s) => s.decision.state === 'NO_DATA'))) return 'No source could be read right now.';
    return 'Rough on every night in the forecast. Expect cancellations.';
  }
  const top = best[0];
  const good = nights.filter((n) => nightRank(n) === 0);
  if (good.length === nights.length) return 'The sea looks calm every night. Pick any night that suits your plans.';
  const names = top.sites.filter((s) => RANK[s.decision.state] === nightRank(top)).map((s) => s.short).join(' and ');
  return `${nightRank(top) === 0 ? 'Calmest night' : 'Best of a rougher stretch'}: ${top.label}, at ${names}.`;
}

export async function buildMantaNight(now = Date.now(), deps = {}) {
  const T = THRESHOLDS;
  const first = primaryNight(now);
  const dates = Array.from({ length: T.nightsAhead }, (_, i) => addDaysYmd(first, i));
  const start = eveningWindow(dates[0])[0], end = eveningWindow(dates[dates.length - 1])[1];
  const errors = {};
  const guard = async (name, fn) => { try { return await fn(); } catch (e) { errors[name] = String(e.message || e); return null; } };
  const swanSite = (s) => ({ id: s.id, point: MANTA_CLIMATOLOGY[s.id]?.cell || s.coord });
  const [srf, alertsJson, seaRows, wxRows] = await Promise.all([
    guard('srf', () => (deps.srf ? deps.srf() : fetchLatestSrf(now))),
    guard('alerts', async () => (deps.alerts ? deps.alerts() : (await (await fetchWithTimeout(URLS.alerts, 15000, { Accept: 'application/geo+json' })).json()))),
    Promise.all(SITES.map((s) => guard(`sea:${s.id}`, () => (deps.sea ? deps.sea(s) : fetchSwan(swanSite(s), start, end))))),
    Promise.all(SITES.map((s) => guard(`wx:${s.id}`, () => (deps.wx ? deps.wx(s) : fetchWeather(s)))))
  ]);
  const srfFresh = srf && srf.ageHours <= T.srfMaxAgeHours;
  const blocks = srfFresh ? parseSrf(srf.text) : [];
  const srfFirst = srfFresh ? srfFirstDate(srf.issuedMs, blocks[0]?.days) : null;
  const westCoast = { zone: ZONE, nwsFacing: 'West' };
  const nwsAll = nwsForCoast(blocks, westCoast, srfFirst);

  const nights = dates.map((ymd) => {
    const sites = SITES.map((s, i) => {
      const nws = nwsAll?.[ymd] || null;
      const sea = seaRows[i] ? seaNight(s.id, seaRows[i], ymd) : null;
      const weather = wxRows[i] ? weatherNight(s, wxRows[i], ymd) : null;
      const alerts = alertsJson ? alertsForSite(alertsJson.features, ymd) : [];
      return { id: s.id, name: s.name, short: s.short, nws, sea, wind: weather?.wind || null, rain: weather ? { windowMm: weather.rainWindowMm, prior24Mm: weather.rainPrior24Mm } : null, record: recordFor(s.id), alerts, decision: decide({ alerts, nws, sea, weather }) };
    });
    return { date: ymd, label: dayLabel(ymd, now), sites, nwsCovered: sites.some((s) => s.nws) };
  });
  const sources = [
    { name: 'NWS Surf Zone Forecast (Honolulu)', ok: Boolean(srfFresh), asOf: srf ? new Date(srf.issuedMs).toISOString() : null, note: srf && !srfFresh ? 'Older than 36 hours, not used' : errors.srf },
    { name: 'NWS active alerts', ok: Boolean(alertsJson), note: errors.alerts },
    { name: 'PacIOOS SWAN Big Island wave model', ok: seaRows.some(Boolean), note: seaRows.every((r) => !r) ? 'Server not responding. Calls use the forecast, wind and rain only.' : undefined },
    { name: 'Open-Meteo wind and rain (GFS)', ok: wxRows.some(Boolean), note: errors['wx:garden-eel-cove'] || errors['wx:manta-village'] },
    { name: '2016-2025 evening wave record per site (PacIOOS SWAN archive)', ok: true, note: `${MANTA_CLIMATOLOGY.nights} evenings per site` }
  ];
  return { ok: true, updated: new Date(now).toISOString(), today: hstYmd(now), primary: first, headline: headline(nights), nights, sources, errors, thresholds: T, validated: false };
}
