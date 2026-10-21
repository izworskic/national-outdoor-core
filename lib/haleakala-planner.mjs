// Trip-planning layer for the Haleakala sunrise tool: pick a morning, see when reservations open,
// get a lead-time-honest forecast lean, and a monthly base rate. Pure functions where possible.
import { createRequire } from 'node:module';
import { sunriseOnHstDate, profileSignal, fetchGfs, fetchNws, localDateParts, URLS } from './haleakala-sunrise.mjs';

export const RELEASE_HOUR_UTC = 17; // 7:00 a.m. HST (UTC-10, no daylight saving)
export const FORECAST_HORIZON_DAYS = 7;

const DAY = 86400000;
const ymdToUtcNoon = (ymd) => { const [y, m, d] = ymd.split('-').map(Number); return Date.UTC(y, m - 1, d, 12); };
const shiftYmd = (ymd, days) => new Date(ymdToUtcNoon(ymd) + days * DAY).toISOString().slice(0, 10);
const hstLabel = (iso) => new Intl.DateTimeFormat('en-US', { timeZone: 'Pacific/Honolulu', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date(iso));

export function hstToday(now = Date.now()) {
  const p = localDateParts(new Date(now), 'Pacific/Honolulu');
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

// NPS: reservations are released up to 60 days ahead, and a portion 2 days (48 hours) ahead, both at 7:00 a.m. HST.
export function reservationRelease(ymd, now = Date.now()) {
  const sixtyYmd = shiftYmd(ymd, -60), twoYmd = shiftYmd(ymd, -2);
  const sixty = new Date(`${sixtyYmd}T${String(RELEASE_HOUR_UTC).padStart(2, '0')}:00:00Z`).toISOString();
  const two = new Date(`${twoYmd}T${String(RELEASE_HOUR_UTC).padStart(2, '0')}:00:00Z`).toISOString();
  const entry = new Date(`${ymd}T13:00:00Z`).getTime(); // 3:00 a.m. HST
  let status = 'past';
  if (now < Date.parse(sixty)) status = 'sixty-day-not-open';
  else if (now < Date.parse(two)) status = 'sixty-day-open';
  else if (now < entry + 4 * 3600000) status = 'two-day-open';
  return {
    date: ymd, status,
    sixtyDay: { iso: sixty, label: hstLabel(sixty), daysAway: Math.ceil((Date.parse(sixty) - now) / DAY) },
    twoDay: { iso: two, label: hstLabel(two), daysAway: Math.ceil((Date.parse(two) - now) / DAY) },
    rules: { oneReservationPer: '3-day period', refundable: false, holderMustBePresentWithId: true, phoneOrWalkUp: false },
    source: URLS.npsSunrise
  };
}

// Forecast-only lean. Never says FAVORABLE: summit sensors, the other half of that call, do not exist days ahead.
export function outlookFor(gfs, leadHours) {
  const sig = profileSignal(gfs);
  const tier = leadHours <= 30 ? 'near' : leadHours <= 72 ? 'mid' : 'far';
  const caveat = {
    near: 'Summit sensors start counting toward the real call 8 hours before sunrise. Recheck then.',
    mid: 'Three days out the model still moves. Treat this as a lean, not a call.',
    far: 'Several days out the model still moves a lot. Use this only to compare mornings, and recheck as the date gets closer.'
  }[tier];
  let lean = 'toss-up', headline = 'Forecast moisture near the summit is in the middle. No lean either way.';
  if (sig.kind === 'dry' && sig.strength !== 'weak') { lean = 'clearer'; headline = 'The forecast leans toward drier air at summit level.'; }
  else if (sig.kind === 'dry') { lean = 'slightly-clearer'; headline = 'The forecast leans slightly drier at summit level.'; }
  else if (sig.kind === 'moist') { lean = 'cloudier'; headline = 'The forecast leans toward moist air at summit level, which means fog or cloud.'; }
  if (sig.kind === 'unknown') { lean = 'unknown'; headline = 'No forecast moisture profile is available for this morning yet.'; }
  return { lean, headline, tier, confidence: 'LOW', leadHours: Math.round(leadHours), profile: sig, caveat, validated: false,
    note: 'Forecast-only lean from GFS humidity at summit level. It has not been validated against past mornings at this lead time.' };
}

let climateCache;
export function loadClimate() {
  if (climateCache !== undefined) return climateCache;
  try { climateCache = createRequire(import.meta.url)('./haleakala-climate.json'); } catch { climateCache = null; }
  return climateCache;
}
export function climateForMonth(month) {
  const c = loadClimate();
  const m = c?.months?.[String(month)];
  if (!m) return null;
  return { ...m, month: Number(month), years: c.years, method: c.method, proxy: true };
}

// Planned-morning payload: any date from today through a year out.
export async function buildHaleakalaMorning(ymd, now = Date.now()) {
  const sunrise = sunriseOnHstDate(ymd);
  const lead = (Date.parse(sunrise.iso) - now) / 3600000;
  if (lead < -1) { const e = new Error('That sunrise has already happened. Pick today or a later date.'); e.status = 400; throw e; }
  if (lead > 366 * 24) { const e = new Error('Pick a date within the next year.'); e.status = 400; throw e; }
  const month = Number(ymd.slice(5, 7));
  const release = reservationRelease(ymd, now);
  const climate = climateForMonth(month);
  const errors = {};
  let gfs = null, nws = null, outlook = null;
  if (lead <= FORECAST_HORIZON_DAYS * 24 - 6) {
    const [g, n] = await Promise.allSettled([fetchGfs(sunrise), fetchNws(sunrise)]);
    if (g.status === 'fulfilled') gfs = g.value; else errors.gfs = String(g.reason?.message || g.reason);
    if (n.status === 'fulfilled') nws = n.value; else errors.nws = String(n.reason?.message || n.reason);
    outlook = outlookFor(gfs, lead);
  }
  const far = !outlook;
  const decision = far
    ? { state: 'TOO_FAR', confidence: 'NONE', headline: 'Too far ahead for a weather call.',
        action: 'Plan the reservation and the backup, not the weather. The call becomes possible about a week out.',
        reasons: [`Sunrise is ${Math.round(lead / 24)} days away; the forecast model reaches about ${FORECAST_HORIZON_DAYS} days.`],
        cautions: climate ? [] : ['No seasonal base rate is available.'], sourceAgreement: 'NOT APPLICABLE' }
    : { state: 'OUTLOOK', confidence: 'LOW', headline: outlook.headline, action: outlook.caveat, reasons: [outlook.note], cautions: [], sourceAgreement: 'NOT APPLICABLE', outlook };
  const near = nws?.nearSunrise;
  return {
    ok: true, id: 'haleakala-sunrise', mode: 'planned', date: ymd, updated: new Date().toISOString(),
    status: decision.state, headline: decision.headline, decision,
    astronomy: { sunriseIso: sunrise.iso, sunriseLabel: sunrise.label, civilTwilightIso: sunrise.civilTwilightIso, azimuthDeg: sunrise.azimuthDeg },
    summary: { summitMoisture: outlook?.profile?.label || 'Not forecast this far out', trend: 'Not applicable', confidence: decision.confidence,
      wind: near?.windSpeed || 'Unavailable', temperature: near?.temperature != null ? `${near.temperature}°${near.temperatureUnit || 'F'}` : 'Unavailable',
      precipitationProbability: near?.precipitationProbability ?? null },
    nws: nws ? { nearSunrise: near, alerts: nws.alerts, hardStops: nws.hardStops, forecastUpdatedAt: nws.forecastUpdatedAt } : null,
    forecastProfile: gfs ? { source: gfs.provider, model: gfs.model, targetTime: gfs.row.time, rh850: gfs.row.rh850, rh700: gfs.row.rh700, rh600: gfs.row.rh600,
      geopotentialHeight700M: gfs.row.z700, note: 'Forecast humidity at three heights for this morning.' } : null,
    reservation: release, climate, outlook, errors, evidence: [], sources: []
  };
}
