// Big Island Beach Day engine: which coast is calm enough to get in the water.
// Four disagreeing sources are normalized to one three-step scale per coast and day:
//   1. active NWS High Surf / Beach Hazard alerts (authoritative)
//   2. the NWS Surf Zone Forecast (feet by facing, two days)
//   3. the PacIOOS SWAN wave model, judged against that coast's own 10-year record (four days)
//   4. Open-Meteo wind (onshore chop)
// Rules are published on the page. Confidence never exceeds MODERATE: the NWS-tier cutoffs are unvalidated.
import { CLIMATOLOGY } from './big-island-coast-climatology.mjs';

export const TZ = 'Pacific/Honolulu'; // HST, UTC-10, no daylight saving
export const URLS = {
  srfList: 'https://api.weather.gov/products/types/SRF/locations/HFO',
  alerts: 'https://api.weather.gov/alerts/active?area=HI',
  swan: 'http://pae-paha.pacioos.hawaii.edu/thredds/ncss/grid/swan_bigi/SWAN_Big_Island_Regional_Wave_Model_best.ncd',
  openMeteo: 'https://api.open-meteo.com/v1/gfs'
};

export const THRESHOLDS = {
  nwsModerateFt: 4, // NWS forecast high end at or above this: moderate
  nwsLargeFt: 7, // at or above this: large
  modelModeratePct: 70, // model peak height percentile for that coast, 2016-2025 daytime days
  modelLargePct: 90,
  longPeriodS: 14, // long-period swell: surge and shore break out of proportion to height
  longPeriodMinPct: 60,
  onshoreChopMph: 15,
  dayStartHst: 8,
  dayEndHst: 17,
  srfMaxAgeHours: 36,
  modelDays: 4
};

// nwsFacing: the row of the NWS Surf Zone Forecast that describes this coast.
// section: the NWS forecast block, identified by a zone it lists.
export const COASTS = [
  { id: 'kohala', name: 'Kohala coast', zone: 'HIZ026', nwsFacing: 'West', point: [19.9904, -155.8279], faces: 265, examples: "Hapuna, Spencer, Mauumae" },
  { id: 'north-kona', name: 'North Kona', zone: 'HIZ023', nwsFacing: 'West', point: [19.8085, -156.0083], faces: 285, examples: "Kua Bay, Makalawena" },
  { id: 'kona', name: 'Kailua to Two Step', zone: 'HIZ023', nwsFacing: 'West', point: [19.5755, -155.9681], faces: 240, examples: "Kailua pier, Kahalu'u, Magic Sands, Two Step" },
  { id: 'south', name: "Ka'u and the south", zone: 'HIZ051', nwsFacing: 'South', point: [19.1321, -155.5026], faces: 160, examples: "Punalu'u, Green Sand" },
  { id: 'puna', name: 'Puna', zone: 'HIZ052', nwsFacing: 'East', point: [19.4653, -154.8315], faces: 95, examples: "Isaac Hale (Pohoiki), Kapoho" },
  { id: 'hilo', name: 'Hilo and Hamakua', zone: 'HIZ053', nwsFacing: 'East', point: [19.7339, -155.0176], faces: 60, examples: "Richardson, Carlsmith" }
];

const LEVEL = ['CALM', 'MODERATE', 'ROUGH'];
export const LABEL = {
  CALM: 'Calm',
  MODERATE: 'Moderate',
  ROUGH: 'Rough',
  CHECK: 'Check',
  NO_DATA: 'No call'
};
const PLAIN = {
  CALM: 'Good day for the water',
  MODERATE: 'Stay in protected spots and watch the sets',
  ROUGH: 'Stay out of the water',
  CHECK: 'The forecast and the model disagree',
  NO_DATA: 'No source available'
};

const finite = (v) => typeof v === 'number' && Number.isFinite(v);

export async function fetchWithTimeout(url, ms = 20000, headers = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': 'chrisizworski.com big-island-beach-day (izworski@gmail.com)', Accept: '*/*', ...headers } });
    if (!res.ok) throw new Error(`${new URL(url).host} HTTP ${res.status}`);
    return res;
  } finally { clearTimeout(t); }
}

// ---- time helpers (HST is a fixed UTC-10 offset) ----
export const hstYmd = (ms) => new Date(ms - 10 * 3600000).toISOString().slice(0, 10);
export const hstHour = (ms) => new Date(ms - 10 * 3600000).getUTCHours();
export const addDaysYmd = (ymd, n) => new Date(Date.parse(`${ymd}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
/** Daytime window of an HST date, as UTC ms. */
export function dayWindow(ymd) {
  const base = Date.parse(`${ymd}T00:00:00Z`) + 10 * 3600000; // midnight HST
  return [base + THRESHOLDS.dayStartHst * 3600000, base + (THRESHOLDS.dayEndHst + 1) * 3600000];
}
/** The beach day being planned: today until 5 pm HST, then tomorrow. Never a day that is already over. */
export function primaryDay(now = Date.now()) {
  const ymd = hstYmd(now);
  return hstHour(now) >= THRESHOLDS.dayEndHst ? addDaysYmd(ymd, 1) : ymd;
}

// ---- NWS Surf Zone Forecast ----
export function expandUgc(line) {
  // "HIZ023-026-051-231930-" or "HIZ052>054-231930-"  ->  ['HIZ023','HIZ026','HIZ051']
  const body = String(line).trim().replace(/-\d{6}-?$/, '');
  const out = [];
  let prefix = '';
  for (const part of body.split('-')) {
    if (!part) continue;
    const m = /^([A-Z]{2}Z)?(\d{3})(?:>(\d{3}))?$/.exec(part);
    if (!m) continue;
    if (m[1]) prefix = m[1];
    const a = Number(m[2]), b = m[3] ? Number(m[3]) : a;
    for (let n = a; n <= b; n++) out.push(`${prefix}${String(n).padStart(3, '0')}`);
  }
  return out;
}

function feetRange(cell) {
  const s = String(cell).trim();
  const m = /^(\d+)\s*(?:-|to)\s*(\d+)$/.exec(s);
  if (m) return [Number(m[1]), Number(m[2])];
  const one = /^(\d+)$/.exec(s);
  if (one) return [Number(one[1]), Number(one[1])];
  return null;
}

/** Parse the Hawaii SRF text into blocks: { zones, days:[label,label], rows:{ 'West': [[lo,hi],...] } } */
export function parseSrf(text) {
  const blocks = [];
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!/^[A-Z]{2}Z\d{3}[->\d]*-\d{6}-?$/.test(lines[i].trim())) continue;
    const zones = expandUgc(lines[i]);
    // header: the "Today   Friday" line sits between the dashed rules, 2 lines before the table rows
    let end = i + 1;
    while (end < lines.length && !/^\$\$/.test(lines[end].trim())) end++;
    const seg = lines.slice(i, end);
    const hdrIdx = seg.findIndex((l) => /^\s*Shores\s+Surf/.test(l));
    if (hdrIdx < 2) continue;
    let di = hdrIdx - 1;
    while (di > 0 && (!seg[di].trim() || /^_+$/.test(seg[di].trim()))) di--;
    const dayLine = seg[di].trim().split(/\s{2,}/).filter(Boolean);
    const rows = {};
    for (const l of seg.slice(hdrIdx + 1)) {
      const m = /^(North|East|South|West) Facing\s+(.*)$/.exec(l.trim());
      if (!m) { if (/^\./.test(l.trim())) break; continue; }
      const cells = m[2].trim().split(/\s{2,}/).map(feetRange);
      if (cells.length >= 4) rows[m[1]] = cells.slice(0, 4);
    }
    blocks.push({ zones, days: dayLine, rows });
  }
  return blocks;
}

/** Date of the first forecast column, from the product issue time and the header label. */
export function srfFirstDate(issuedMs, dayLabels) {
  const first = String(dayLabels?.[0] || '').toLowerCase();
  const ymd = hstYmd(issuedMs);
  if (/^(today|this afternoon|rest of today)$/.test(first)) return ymd;
  if (/^(tonight|tomorrow)$/.test(first)) return first === 'tomorrow' ? addDaysYmd(ymd, 1) : null;
  return null; // unknown header: do not guess a date
}

export function nwsForCoast(blocks, coast, firstYmd) {
  if (!firstYmd) return null;
  const block = blocks.find((b) => b.zones.includes(coast.zone) && b.rows[coast.nwsFacing]);
  if (!block) return null;
  const cells = block.rows[coast.nwsFacing];
  const out = {};
  const day = (a, b, ymd) => {
    const parts = [a, b].filter(Boolean);
    if (!parts.length) return;
    out[ymd] = { lowFt: Math.min(...parts.map((p) => p[0])), highFt: Math.max(...parts.map((p) => p[1])) };
  };
  day(cells[0], cells[1], firstYmd);
  day(cells[2], cells[3], addDaysYmd(firstYmd, 1));
  return out;
}

export function nwsTier(highFt) {
  if (!finite(highFt)) return null;
  const T = THRESHOLDS;
  return highFt >= T.nwsLargeFt ? 2 : highFt >= T.nwsModerateFt ? 1 : 0;
}

// ---- alerts ----
const ALERT_RE = /high surf|beach hazard|rip current|coastal flood|tsunami/i;
export function alertsForCoast(features, coast, ymd) {
  const [w0, w1] = dayWindow(ymd);
  return (features || []).filter((f) => {
    const p = f.properties || {};
    if (!ALERT_RE.test(p.event || '')) return false;
    if (!(p.geocode?.UGC || []).includes(coast.zone)) return false;
    const from = Date.parse(p.onset || p.effective);
    const to = Date.parse(p.ends || p.expires);
    return (!Number.isFinite(from) || from <= w1) && (!Number.isFinite(to) || to >= w0);
  }).map((f) => ({ event: f.properties.event, headline: f.properties.headline, onsetIso: f.properties.onset || f.properties.effective, endsIso: f.properties.ends || f.properties.expires, severe: /high surf (advisory|warning)/i.test(f.properties.event) }));
}

// ---- wave model ----
export function percentileOf(coastId, hs) {
  const q = CLIMATOLOGY[coastId]?.hsQuantiles; // 101 values: quantile 0..100 of daytime peak Hs
  if (!q || !finite(hs)) return null;
  let lo = 0;
  while (lo < q.length && q[lo] < hs) lo++;
  return Math.min(100, lo);
}

export async function fetchSwan(coast, startMs, endMs) {
  const iso = (ms) => new Date(ms).toISOString().replace(/\.\d+Z$/, 'Z');
  const q = new URLSearchParams();
  q.append('var', 'shgt'); q.append('var', 'mper'); q.append('var', 'pdir');
  q.set('latitude', coast.point[0]); q.set('longitude', coast.point[1]);
  q.set('time_start', iso(startMs)); q.set('time_end', iso(endMs)); q.set('accept', 'csv');
  return parseSwanCsv(await (await fetchWithTimeout(`${URLS.swan}?${q}`, 10000)).text());
}

export function parseSwanCsv(txt) {
  const lines = String(txt).trim().split('\n');
  if (lines.length < 2) throw new Error('SWAN returned no rows');
  const head = lines[0].split(',');
  const ih = head.findIndex((h) => h.startsWith('shgt')), ip = head.findIndex((h) => h.startsWith('mper')), id = head.findIndex((h) => h.startsWith('pdir'));
  if (ih < 0) throw new Error('SWAN response missing height');
  return lines.slice(1).map((l) => {
    const c = l.split(',');
    return { ms: Date.parse(c[0]), hs: Number(c[ih]), per: ip >= 0 ? Number(c[ip]) : NaN, dir: id >= 0 ? Number(c[id]) : NaN };
  }).filter((r) => Number.isFinite(r.ms) && Number.isFinite(r.hs));
}

/** Peak daytime height (and the period/direction at that hour) for an HST day. */
export function modelDay(coastId, rows, ymd) {
  const [w0, w1] = dayWindow(ymd);
  const day = rows.filter((r) => r.ms >= w0 && r.ms < w1);
  if (day.length < 6) return null; // not enough of the day covered
  const peak = day.reduce((a, b) => (b.hs > a.hs ? b : a));
  const longPer = Math.max(...day.map((r) => (Number.isFinite(r.per) ? r.per : 0)));
  return { peakM: Math.round(peak.hs * 100) / 100, periodS: Number.isFinite(peak.per) ? Math.round(peak.per) : null, maxPeriodS: Math.round(longPer), dirDeg: Number.isFinite(peak.dir) ? Math.round(peak.dir) : null, percentile: percentileOf(coastId, peak.hs) };
}

export function modelTier(m) {
  if (!m || !finite(m.percentile)) return null;
  const T = THRESHOLDS;
  return m.percentile >= T.modelLargePct ? 2 : m.percentile >= T.modelModeratePct ? 1 : 0;
}

// ---- wind ----
export async function fetchWind(coast) {
  const [la, lo] = coast.point;
  const url = `${URLS.openMeteo}?latitude=${la}&longitude=${lo}&hourly=wind_speed_10m,wind_direction_10m&wind_speed_unit=mph&forecast_days=${THRESHOLDS.modelDays + 1}&timezone=GMT`;
  const j = await (await fetchWithTimeout(url, 20000)).json();
  const h = j?.hourly;
  if (!h?.time) throw new Error('Open-Meteo returned no hourly wind');
  return h.time.map((t, i) => ({ ms: Date.parse(`${t}:00Z`), mph: h.wind_speed_10m?.[i], dir: h.wind_direction_10m?.[i] })).filter((r) => Number.isFinite(r.ms) && finite(r.mph) && finite(r.dir));
}

/** Strongest daytime wind component blowing toward the shore (positive = onshore). */
export function windDay(coast, rows, ymd) {
  const [w0, w1] = dayWindow(ymd);
  const day = rows.filter((r) => r.ms >= w0 && r.ms < w1);
  if (day.length < 6) return null;
  let best = null;
  for (const r of day) {
    const onshore = r.mph * Math.cos(((r.dir - coast.faces) * Math.PI) / 180);
    if (!best || onshore > best.onshoreMph) best = { onshoreMph: Math.round(onshore), mph: Math.round(r.mph), fromDeg: Math.round(r.dir) };
  }
  return best;
}

// ---- the call ----
/** Pure function of the four signals. Never throws. */
export function decide({ alerts = [], nws = null, model = null, wind = null }) {
  const T = THRESHOLDS;
  const reasons = [];
  const severe = alerts.find((a) => a.severe);
  const nTier = nws ? nwsTier(nws.highFt) : null;
  const mTier = modelTier(model);

  if (severe) {
    reasons.push(`${severe.event} is in effect for this coast.`);
    if (nws) reasons.push(`NWS surf forecast: ${nws.lowFt}-${nws.highFt} feet.`);
    return { state: 'ROUGH', label: LABEL.ROUGH, plain: PLAIN.ROUGH, confidence: 'MODERATE', reasons, tiers: { nws: nTier, model: mTier } };
  }

  if (nTier == null && mTier == null) {
    return { state: 'NO_DATA', label: LABEL.NO_DATA, plain: PLAIN.NO_DATA, confidence: 'NONE', reasons: ['Neither the NWS surf forecast nor the wave model could be read.'], tiers: { nws: null, model: null } };
  }

  if (nws) reasons.push(`NWS surf forecast: ${nws.lowFt}-${nws.highFt} feet (${LEVEL[nTier].toLowerCase()}).`);
  if (model) reasons.push(`Wave model: peak ${model.peakM.toFixed(2)} m, bigger than ${model.percentile} percent of days on this coast (${mTier != null ? LEVEL[mTier].toLowerCase() : 'n/a'}).`);

  let level = Math.max(nTier ?? 0, mTier ?? 0);
  let confidence = nTier != null && mTier != null ? 'MODERATE' : 'LOW';
  if (nTier == null) reasons.push('No NWS forecast for this day, so this rests on the wave model alone.');
  if (mTier == null && nTier != null) reasons.push('No wave-model reading for this day, so this rests on the NWS forecast alone.');

  if (model && model.maxPeriodS >= T.longPeriodS && model.percentile >= T.longPeriodMinPct && level < 1) {
    level = 1;
    reasons.push(`Long-period swell (${model.maxPeriodS} seconds): surge and shore break can be strong even when the height looks modest.`);
  } else if (model && model.maxPeriodS >= T.longPeriodS && level >= 1) {
    reasons.push(`Long-period swell (${model.maxPeriodS} seconds) adds surge and shore break.`);
  }
  if (wind && wind.onshoreMph >= T.onshoreChopMph) {
    if (level < 1) level = 1;
    reasons.push(`Onshore wind up to ${wind.onshoreMph} mph will chop the surface.`);
  }

  if (nTier != null && mTier != null && Math.abs(nTier - mTier) >= 2) {
    reasons.push('The NWS forecast and the wave model are two steps apart. Look at the water before you get in.');
    return { state: 'CHECK', label: LABEL.CHECK, plain: PLAIN.CHECK, confidence: 'LOW', reasons, tiers: { nws: nTier, model: mTier } };
  }
  const state = LEVEL[Math.min(level, 2)];
  return { state, label: LABEL[state], plain: PLAIN[state], confidence, reasons, tiers: { nws: nTier, model: mTier } };
}

const RANK = { CALM: 0, MODERATE: 1, CHECK: 2, ROUGH: 3, NO_DATA: 4 };

export function rankCoasts(items) {
  return [...items].sort((a, b) => (RANK[a.decision.state] - RANK[b.decision.state]) || ((a.nws?.highFt ?? 99) - (b.nws?.highFt ?? 99)) || ((a.model?.peakM ?? 99) - (b.model?.peakM ?? 99)));
}

export function headline(ranked) {
  const calm = ranked.filter((c) => c.decision.state === 'CALM');
  if (calm.length) return `Calmest water: ${calm.map((c) => c.name).join(', ')}.`;
  const mod = ranked.filter((c) => c.decision.state === 'MODERATE');
  if (mod.length) return `No coast is fully calm. Best bets: ${mod.map((c) => c.name).join(', ')}, in protected spots only.`;
  if (ranked.some((c) => c.decision.state === 'CHECK')) return 'No clear answer: the sources disagree. Look at the water before you get in.';
  if (ranked.every((c) => c.decision.state === 'NO_DATA')) return 'No source could be read right now.';
  return 'Rough everywhere. Stay out of the water, or stay on the sand.';
}

export function dayLabel(ymd, now = Date.now()) {
  const today = hstYmd(now);
  if (ymd === today) return 'Today';
  if (ymd === addDaysYmd(today, 1)) return 'Tomorrow';
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long' }).format(new Date(`${ymd}T12:00:00Z`));
}

export async function fetchLatestSrf(now = Date.now()) {
  const list = (await (await fetchWithTimeout(URLS.srfList, 15000, { Accept: 'application/ld+json' })).json())['@graph'] || [];
  const latest = [...list].sort((a, b) => Date.parse(b.issuanceTime) - Date.parse(a.issuanceTime))[0];
  if (!latest) throw new Error('No surf zone forecast listed');
  const prod = await (await fetchWithTimeout(`https://api.weather.gov/products/${latest.id}`, 15000, { Accept: 'application/ld+json' })).json();
  const issuedMs = Date.parse(prod.issuanceTime);
  return { text: prod.productText, issuedMs, ageHours: (now - issuedMs) / 3600000 };
}

// The wave-model host (a single university THREDDS server) is slow and throttles bursts, and it has real outages.
// Two requests at a time, and if a whole pair fails, stop asking: the rest of the call runs on the NWS forecast and wind.
async function inPairs(items, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += 2) {
    const got = await Promise.all(items.slice(i, i + 2).map(fn));
    out.push(...got);
    if (got.every((g) => g == null)) { while (out.length < items.length) out.push(null); break; }
  }
  return out;
}

export async function buildBeachDay(now = Date.now(), deps = {}) {
  const T = THRESHOLDS;
  const first = primaryDay(now);
  const dates = Array.from({ length: T.modelDays }, (_, i) => addDaysYmd(first, i));
  const [w0] = dayWindow(dates[0]);
  const wEnd = dayWindow(dates[dates.length - 1])[1];
  const errors = {};
  const guard = async (name, fn) => { try { return await fn(); } catch (e) { errors[name] = String(e.message || e); return null; } };

  const [srf, alertsJson, swanRows, windRows] = await Promise.all([
    guard('srf', () => (deps.srf ? deps.srf() : fetchLatestSrf(now))),
    guard('alerts', async () => (deps.alerts ? deps.alerts() : (await (await fetchWithTimeout(URLS.alerts, 15000, { Accept: 'application/geo+json' })).json()))),
    inPairs(COASTS, (c) => guard(`swan:${c.id}`, () => (deps.swan ? deps.swan(c) : fetchSwan(c, w0, wEnd)))),
    Promise.all(COASTS.map((c) => guard(`wind:${c.id}`, () => (deps.wind ? deps.wind(c) : fetchWind(c)))))
  ]);

  const srfFresh = srf && srf.ageHours <= T.srfMaxAgeHours;
  const blocks = srfFresh ? parseSrf(srf.text) : [];
  const srfFirst = srfFresh ? srfFirstDate(srf.issuedMs, blocks[0]?.days) : null;

  const days = dates.map((ymd, di) => {
    const coasts = COASTS.map((c, ci) => {
      const nwsAll = nwsForCoast(blocks, c, srfFirst);
      const nws = nwsAll?.[ymd] || null;
      const model = swanRows[ci] ? modelDay(c.id, swanRows[ci], ymd) : null;
      const wind = windRows[ci] ? windDay(c, windRows[ci], ymd) : null;
      const alerts = alertsJson ? alertsForCoast(alertsJson.features, c, ymd) : [];
      const decision = decide({ alerts, nws, model, wind });
      return { id: c.id, name: c.name, examples: c.examples, nws, model, wind, alerts, decision };
    });
    const ranked = rankCoasts(coasts);
    return { date: ymd, label: dayLabel(ymd, now), coasts: ranked, headline: headline(ranked), nwsCovered: coasts.some((x) => x.nws) };
  });

  const sources = [
    { name: 'NWS Surf Zone Forecast (Honolulu)', ok: Boolean(srfFresh), asOf: srf ? new Date(srf.issuedMs).toISOString() : null, note: srf && !srfFresh ? 'Older than 36 hours, not used' : errors.srf },
    { name: 'NWS active alerts (High Surf, Beach Hazards)', ok: Boolean(alertsJson), note: errors.alerts },
    { name: 'PacIOOS SWAN Big Island wave model', ok: swanRows.some(Boolean), note: swanRows.every((r) => !r) ? 'Server not responding. Calls below use the NWS forecast and wind only.' : swanRows.some((r) => !r) ? 'Missing for some coasts, which then use the NWS forecast alone.' : undefined },
    { name: 'Open-Meteo wind (GFS)', ok: windRows.some(Boolean), note: undefined },
    { name: '2016-2025 daytime wave record, per coast (PacIOOS SWAN archive)', ok: true, note: `${CLIMATOLOGY.days} days per coast` }
  ];

  return { ok: true, updated: new Date(now).toISOString(), today: hstYmd(now), primary: first, days, sources, errors, thresholds: T, validated: false };
}
