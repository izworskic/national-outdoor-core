// Mauna Kea tonight: one go / no-go for a visitor's summit sunset and stargazing evening.
// Single purpose, deterministic rules, every threshold exported so the page can publish the method.

export const LAT = 19.8207;
export const LON = -155.4681;
export const SUMMIT_M = 4205;
export const VIS_M = 2800;
export const TZ = 'Pacific/Honolulu';
const HST_OFFSET_H = 10; // Hawaii has no DST: HST = UTC-10 all year
const UA = 'ChrisIzworskiMaunaKeaTonight/1.0 (+https://chrisizworski.com/national-tools/mauna-kea-tonight/)';
const TIMEOUT_MS = 12000;
const RAD = Math.PI / 180;
// Sea-horizon dip seen from the summit: 1.76 arcmin per sqrt(metre). The sun sets about 9 minutes later up there than at the coast.
export const SUMMIT_DIP_DEG = (1.76 / 60) * Math.sqrt(SUMMIT_M);
const SUN_HORIZON_DEG = -0.833 - SUMMIT_DIP_DEG;

export const URLS = {
  mkwcRoad: 'http://mkwc.ifa.hawaii.edu/current/road-conditions/',
  mkwcForecast: 'http://mkwc.ifa.hawaii.edu/forecast/mko/',
  openMeteo: 'https://api.open-meteo.com/v1/gfs'
};

// Starting rules. They are NOT validated against labeled nights yet, and the payload says so.
export const THRESHOLDS = {
  windStopMph: 55,        // MKWC closure criterion: sustained winds above 55 mph
  windGustStopMph: 65,    // MKWC closure criterion: gusts above 65 mph
  windCautionMph: 40,
  snowPrecipMm: 0.1,      // hourly precipitation that counts as wet
  snowFreezingLevelM: 4400, // freezing level at or below this with precipitation = snow or ice on the summit road
  summitMoistRh: 85,      // RH at 600 hPa (about the summit) at or above this = in cloud or fog
  summitDampRh: 70,
  visCloudRh: 92,         // RH at 700 hPa (about the Visitor Station) at or above this = station in cloud
  midCloudPct: 60,
  starsGoFraction: 0.7,   // share of dark hours that must be clear for GO
  starsMixedFraction: 0.35,
  seaOfCloudsLowPct: 50,  // low cloud cover with a dry summit = a cloud deck below you
  moonUpAltDeg: -0.5,
  astroDarkSunAltDeg: -18,
  forecastHorizonDays: 7,
  mkwcMaxAgeHours: 18
};

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const finite = (v) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
const round = (v, d = 0) => (finite(v) ? Math.round(Number(v) * 10 ** d) / 10 ** d : null);

// ---------- astronomy (low-precision; checked against ephem in tests) ----------

const julian = (ms) => ms / 86400000 + 2440587.5;
const nDays = (ms) => julian(ms) - 2451545;
const wrap360 = (x) => ((x % 360) + 360) % 360;

function sunEclipticLon(ms) {
  const n = nDays(ms);
  const L = wrap360(280.46 + 0.9856474 * n);
  const g = wrap360(357.528 + 0.9856003 * n) * RAD;
  return wrap360(L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g));
}

function altitude(ms, lonEclDeg, latEclDeg) {
  const n = nDays(ms);
  const lam = lonEclDeg * RAD, beta = latEclDeg * RAD;
  const eps = (23.439 - 0.0000004 * n) * RAD;
  const ra = Math.atan2(Math.sin(lam) * Math.cos(eps) - Math.tan(beta) * Math.sin(eps), Math.cos(lam));
  const dec = Math.asin(Math.sin(beta) * Math.cos(eps) + Math.cos(beta) * Math.sin(eps) * Math.sin(lam));
  const gmst = wrap360(280.46061837 + 360.98564736629 * n);
  const H = (gmst + LON) * RAD - ra;
  const lat = LAT * RAD;
  return Math.asin(Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(H)) / RAD;
}

export function sunAltitude(ms) {
  return altitude(ms, sunEclipticLon(ms), 0);
}

function moonEcliptic(ms) {
  const T = nDays(ms) / 36525;
  const s = (a, b) => Math.sin((a + b * T) * RAD);
  const c = (a, b) => Math.cos((a + b * T) * RAD);
  const lon = wrap360(218.32 + 481267.881 * T + 6.29 * s(135.0, 477198.87) - 1.27 * s(259.3, -413335.36) + 0.66 * s(235.7, 890534.22) + 0.21 * s(269.9, 954397.74) - 0.19 * s(357.5, 35999.05) - 0.11 * s(186.5, 966404.03));
  const lat = 5.13 * s(93.3, 483202.02) + 0.28 * s(228.2, 960400.89) - 0.28 * s(318.3, 6003.15) - 0.17 * s(217.6, -407332.21);
  const par = 0.9508 + 0.0518 * c(135.0, 477198.87) + 0.0095 * c(259.3, -413335.36) + 0.0078 * c(253.7, 890534.22) + 0.0028 * c(269.9, 954397.74);
  return { lon, lat, par };
}

export function moonAltitude(ms) {
  const m = moonEcliptic(ms);
  const geo = altitude(ms, m.lon, m.lat);
  return geo - m.par * Math.cos(geo * RAD); // topocentric
}

export function moonIllumination(ms) {
  const m = moonEcliptic(ms);
  const dl = (m.lon - sunEclipticLon(ms)) * RAD;
  const cosPsi = Math.cos(m.lat * RAD) * Math.cos(dl);
  return clamp((1 - cosPsi) / 2, 0, 1);
}

export function moonPhaseName(ms) {
  const m = moonEcliptic(ms);
  const elong = wrap360(m.lon - sunEclipticLon(ms));
  const ill = moonIllumination(ms);
  if (ill < 0.03) return 'New moon';
  if (ill > 0.97) return 'Full moon';
  const waxing = elong < 180;
  if (ill < 0.4) return waxing ? 'Waxing crescent' : 'Waning crescent';
  if (ill < 0.6) return waxing ? 'First quarter' : 'Last quarter';
  return waxing ? 'Waxing gibbous' : 'Waning gibbous';
}

const hstNoonMs = (ymd) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ''));
  if (!m) throw badRequest('Date must be YYYY-MM-DD');
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12 + HST_OFFSET_H));
  if (hstYmd(d.getTime()) !== ymd) throw badRequest('Not a calendar date');
  return d.getTime();
};

function badRequest(msg) {
  const e = new Error(msg);
  e.status = 400;
  return e;
}

export function hstYmd(ms) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(ms));
}

export function addDaysYmd(ymd, n) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + n, 12)).toISOString().slice(0, 10);
}

const iso = (ms) => (ms == null ? null : new Date(ms).toISOString());

/**
 * The evening a visitor means by "tonight". An evening runs from noon HST to noon HST, so at 2 a.m. the night
 * in progress began yesterday. Once the sun is up (plus a margin) that night is over and "tonight" is the next one.
 */
export function currentNightKey(now = Date.now()) {
  let key = hstYmd(now - 12 * 3600000);
  const n = nightFor(key);
  if (n.sunriseIso && Date.parse(n.sunriseIso) + 30 * 60000 < now) key = addDaysYmd(key, 1);
  return key;
}

// Linear-interpolated crossing between two samples.
function crossing(t0, v0, t1, v1, level) {
  if (v1 === v0) return t0;
  return t0 + ((level - v0) / (v1 - v0)) * (t1 - t0);
}

/**
 * The evening that begins on HST date `ymd`: noon HST that day to noon HST the next day.
 * Sampled every 5 minutes. Pure astronomy, no weather.
 */
export function nightFor(ymd) {
  const start = hstNoonMs(ymd);
  const STEP = 5 * 60000;
  const N = 288;
  const t = [], sun = [], moon = [];
  for (let i = 0; i <= N; i++) {
    const ms = start + i * STEP;
    t.push(ms); sun.push(sunAltitude(ms)); moon.push(moonAltitude(ms));
  }
  const find = (arr, level, dir, from = 0) => {
    for (let i = Math.max(1, from); i < arr.length; i++) {
      const down = arr[i - 1] > level && arr[i] <= level;
      const up = arr[i - 1] < level && arr[i] >= level;
      if ((dir === 'down' && down) || (dir === 'up' && up)) return { ms: crossing(t[i - 1], arr[i - 1], t[i], arr[i], level), i };
    }
    return null;
  };
  const sunset = find(sun, SUN_HORIZON_DEG, 'down');
  const sunrise = sunset ? find(sun, SUN_HORIZON_DEG, 'up', sunset.i) : null;
  const dusk = find(sun, THRESHOLDS.astroDarkSunAltDeg, 'down');
  const dawn = dusk ? find(sun, THRESHOLDS.astroDarkSunAltDeg, 'up', dusk.i) : null;
  const moonLevel = THRESHOLDS.moonUpAltDeg;
  let darkMin = 0, moonFreeMin = 0, run = 0, best = { len: 0, from: null, to: null }, runStart = null;
  for (let i = 0; i < N; i++) {
    const dark = sun[i] < THRESHOLDS.astroDarkSunAltDeg;
    const free = dark && moon[i] < moonLevel;
    if (dark) darkMin += 5;
    if (free) {
      moonFreeMin += 5; run += 5; if (runStart == null) runStart = t[i];
      if (run > best.len) best = { len: run, from: runStart, to: t[i] + STEP };
    } else { run = 0; runStart = null; }
  }
  const mid = dusk && dawn ? (dusk.ms + dawn.ms) / 2 : start + 12 * 3600000;
  const lo = sunset ? sunset.ms : start, hi = sunrise ? sunrise.ms : start + 24 * 3600000;
  const moonRise = [], moonSet = [];
  for (let i = 1; i < N; i++) {
    if (moon[i - 1] < moonLevel && moon[i] >= moonLevel) moonRise.push(crossing(t[i - 1], moon[i - 1], t[i], moon[i], moonLevel));
    if (moon[i - 1] > moonLevel && moon[i] <= moonLevel) moonSet.push(crossing(t[i - 1], moon[i - 1], t[i], moon[i], moonLevel));
  }
  const inNight = (x) => x >= lo - 3600000 && x <= hi + 3600000;
  return {
    date: ymd,
    sunsetIso: iso(sunset?.ms), sunriseIso: iso(sunrise?.ms),
    astroDuskIso: iso(dusk?.ms), astroDawnIso: iso(dawn?.ms),
    darkMinutes: darkMin,
    moonFreeMinutes: moonFreeMin,
    moonFreeFromIso: best.len ? iso(best.from) : null,
    moonFreeToIso: best.len ? iso(best.to) : null,
    moonriseIso: iso(moonRise.find(inNight)),
    moonsetIso: iso(moonSet.find(inNight)),
    moonIllumination: round(moonIllumination(mid), 3),
    moonPhase: moonPhaseName(mid)
  };
}

// ---------- source parsing ----------

function cleanText(html = '') {
  return String(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&#39;|&apos;/gi, "'").replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ').trim();
}

const MONTHS = { january: 0, february: 1, march: 2, april: 3, may: 4, june: 5, july: 6, august: 7, september: 8, october: 9, november: 10, december: 11 };

/** MKWC road page: status text, when the message was written, summit conditions in the page header. */
export function parseMkwcRoad(html, now = Date.now()) {
  const text = cleanText(html);
  const status = /Road Status:\s*(.+?)\s+Comments/i.exec(text)?.[1]?.trim() || null;
  const stamp = /Comments\s+(?:[A-Za-z]+day,\s+)?([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})\s*-\s*(\d{1,2}):(\d{2})\s*([ap])\.?m/i.exec(text);
  let messageIso = null;
  if (stamp && MONTHS[stamp[1].toLowerCase()] != null) {
    let h = +stamp[4] % 12 + (stamp[6].toLowerCase() === 'p' ? 12 : 0);
    messageIso = new Date(Date.UTC(+stamp[3], MONTHS[stamp[1].toLowerCase()], +stamp[2], h + HST_OFFSET_H, +stamp[5])).toISOString();
  }
  const cur = /Current Conditions\s+Temp\s+(-?[\d.]+)\s*C\s+RH\s+(\d+)\s*%\s+Wind\s+([A-Z]{1,3})\s+(\d+)\s*mph/i.exec(text);
  const hstMonth = Number(new Intl.DateTimeFormat('en-US', { timeZone: TZ, month: 'numeric' }).format(new Date(now)));
  const seasonalSilence = hstMonth >= 4 && hstMonth <= 11; // MKWC: message is not updated April 1 to November 30 unless something unusual develops
  const ageDays = messageIso ? (now - Date.parse(messageIso)) / 86400000 : null;
  const open = status ? /\bopen\b/i.test(status) && !/\bclos/i.test(status) : null;
  const closed = status ? /\bclos/i.test(status) : null;
  return {
    ok: Boolean(status),
    status, open, closed,
    messageIso, ageDays: round(ageDays, 1),
    seasonalSilence,
    // In the quiet season an old "Open" is a default, not a fresh reading.
    isDefault: Boolean(open && seasonalSilence && (ageDays == null || ageDays > 3)),
    fourWheelDrive: status ? /4-?\s*wheel|4wd|4x4/i.test(status) : null,
    summitNow: cur ? { tempC: +cur[1], rh: +cur[2], windDir: cur[3], windMph: +cur[4], timeNote: 'MKWC page header; reading time not published' } : null
  };
}

/** MKWC forecast page: the forecaster's own words, plus the numbers they quote. */
export function parseMkwcForecast(html, now = Date.now()) {
  const text = cleanText(html);
  const issued = /\((\d{2})(\d{2})\s+UTC\s+[A-Za-z]+\s+(\d{1,2})\s+([A-Za-z]+)\)\s*(\d{4})/.exec(text);
  let issuedIso = null;
  if (issued && MONTHS[issued[4].toLowerCase()] != null) issuedIso = new Date(Date.UTC(+issued[5], MONTHS[issued[4].toLowerCase()], +issued[3], +issued[1], +issued[2])).toISOString();
  const grab = (re) => re.exec(text)?.[1]?.trim() || null;
  const warning = grab(/Warning\(s\)\s+(.+?)\s+Cloud Cover and Fog\/Precipitation Forecast/i);
  const cloud = grab(/Cloud Cover and Fog\/Precipitation Forecast\s+(.+?)\s+Summary of Key Meteorological Variables/i);
  const summary = grab(/Summary of Key Meteorological Variables\s+(.+?)\s+Discussion/i);
  const seeing = /Seeing will be\s+(?:near|about|around)?\s*([\d.]+)(?:\s*-\s*([\d.]+))?\s*arcsec/i.exec(text);
  const pwv = /precipitable water[^.]*?([\d.]+)\s*-\s*([\d.]+)\s*mm/i.exec(text);
  const ageH = issuedIso ? (now - Date.parse(issuedIso)) / 3600000 : null;
  return {
    ok: Boolean(cloud),
    issuedIso, ageHours: round(ageH, 1),
    fresh: ageH != null && ageH >= -1 && ageH <= THRESHOLDS.mkwcMaxAgeHours,
    warning,
    warningActive: warning ? !/^none\b/i.test(warning) : null,
    cloudText: cloud, summaryText: summary,
    seeingArcsec: seeing ? [+seeing[1], seeing[2] ? +seeing[2] : +seeing[1]] : null,
    precipitableWaterMm: pwv ? [+pwv[1], +pwv[2]] : null,
    signal: forecastSignal(cloud)
  };
}

/** Plain keyword read of the forecaster's cloud paragraph. Deliberately crude, used only to cross-check. */
export function forecastSignal(cloudText) {
  if (!cloudText) return 'unknown';
  const neg = /\b(fog|foggy|snow|rain|showers?|ice|icing|precipitation|socked|overcast|cloudy|extensive clouds?|widespread clouds?)\b/i.test(cloudText.replace(/\b(no|not|without)\s+(fog|snow|rain|showers?|ice|precipitation)\b/gi, ''));
  const pos = /\b(dry|stable|clear)\b/i.test(cloudText);
  if (neg && !pos) return 'wet';
  if (pos && !neg) return 'clear';
  if (pos && neg) return 'mixed';
  return 'unknown';
}

// ---------- weather model ----------

function fetchWithTimeout(url) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  return fetch(url, { signal: ctl.signal, redirect: 'follow', headers: { 'User-Agent': UA, Accept: '*/*' } })
    .then((r) => { if (!r.ok) throw new Error(`${r.status} ${r.statusText}`); return r; })
    .finally(() => clearTimeout(timer));
}

const GFS_VARS = ['relative_humidity_700hPa', 'relative_humidity_600hPa', 'temperature_600hPa', 'wind_speed_600hPa', 'wind_gusts_10m', 'wind_speed_10m', 'cloud_cover_low', 'cloud_cover_mid', 'cloud_cover_high', 'precipitation', 'freezing_level_height', 'temperature_2m'];

export async function fetchGfs() {
  const url = `${URLS.openMeteo}?latitude=${LAT}&longitude=${LON}&elevation=${SUMMIT_M}&hourly=${GFS_VARS.join(',')}&forecast_days=${THRESHOLDS.forecastHorizonDays + 2}&timezone=GMT&wind_speed_unit=mph`;
  const j = await (await fetchWithTimeout(url)).json();
  return gfsRows(j);
}

export function gfsRows(j) {
  const h = j?.hourly;
  if (!h?.time) throw new Error('Open-Meteo returned no hourly data');
  return h.time.map((tt, i) => ({
    ms: Date.parse(`${tt}:00Z`),
    rh600: h.relative_humidity_600hPa?.[i] ?? null,
    rh700: h.relative_humidity_700hPa?.[i] ?? null,
    temp600: h.temperature_600hPa?.[i] ?? null,
    temp2m: h.temperature_2m?.[i] ?? null,
    wind600: h.wind_speed_600hPa?.[i] ?? null,
    wind10: h.wind_speed_10m?.[i] ?? null,
    gust: h.wind_gusts_10m?.[i] ?? null,
    low: h.cloud_cover_low?.[i] ?? null,
    mid: h.cloud_cover_mid?.[i] ?? null,
    high: h.cloud_cover_high?.[i] ?? null,
    precip: h.precipitation?.[i] ?? null,
    freezingM: h.freezing_level_height?.[i] ?? null
  })).filter((r) => Number.isFinite(r.ms));
}

export function hourFlags(r) {
  const T = THRESHOLDS;
  const wind = Math.max(finite(r.wind600) ? r.wind600 : 0, finite(r.gust) ? r.gust : 0, finite(r.wind10) ? r.wind10 : 0);
  const wet = finite(r.precip) && r.precip >= T.snowPrecipMm;
  const snow = wet && finite(r.freezingM) && r.freezingM <= T.snowFreezingLevelM;
  const moist = finite(r.rh600) && r.rh600 >= T.summitMoistRh;
  const damp = finite(r.rh600) && r.rh600 >= T.summitDampRh;
  const visCloud = finite(r.rh700) && r.rh700 >= T.visCloudRh;
  const midCloud = finite(r.mid) && r.mid >= T.midCloudPct;
  const rime = finite(r.temp2m) && r.temp2m <= 0 && moist;
  return {
    wind, windStop: wind >= T.windStopMph, windCaution: wind >= T.windCautionMph,
    wet, snow, moist, damp, visCloud, midCloud, rime,
    clear: !wet && !damp && !visCloud && !midCloud,
    seaOfClouds: !wet && !damp && finite(r.low) && r.low >= T.seaOfCloudsLowPct
  };
}

const hoursBetween = (rows, a, b) => rows.filter((r) => r.ms >= a - 1800000 && r.ms <= b);
const nearest = (rows, ms) => rows.reduce((best, r) => (best == null || Math.abs(r.ms - ms) < Math.abs(best.ms - ms) ? r : best), null);

/** Weather judgement for one evening. Pure function of astronomy + model rows. */
export function judgeNight(night, rows) {
  const T = THRESHOLDS;
  const sunset = Date.parse(night.sunsetIso), sunrise = Date.parse(night.sunriseIso);
  const dusk = night.astroDuskIso ? Date.parse(night.astroDuskIso) : sunset + 3600000;
  const dawn = night.astroDawnIso ? Date.parse(night.astroDawnIso) : sunrise - 3600000;
  const near = rows && nearest(rows, sunset);
  if (!rows?.length || !near || Math.abs(near.ms - sunset) > 3 * 3600000) return { available: false };

  const evening = hoursBetween(rows, sunset - 3600000, sunrise);
  const dark = hoursBetween(rows, dusk, dawn);
  const flagsAll = evening.map((r) => ({ r, f: hourFlags(r) }));
  const darkFlags = dark.length ? dark.map((r) => ({ r, f: hourFlags(r) })) : flagsAll;
  const sunsetRow = near, sf = hourFlags(sunsetRow);

  const windStopHours = flagsAll.filter((x) => x.f.windStop).length;
  const snowHours = flagsAll.filter((x) => x.f.snow).length;
  const cautionHours = flagsAll.filter((x) => x.f.windCaution || x.f.rime).length;
  const maxWind = Math.max(...flagsAll.map((x) => x.f.wind));
  const clearFraction = darkFlags.length ? darkFlags.filter((x) => x.f.clear).length / darkFlags.length : null;

  let road = 'OPEN';
  const roadWhy = [];
  if (windStopHours) { road = 'AT_RISK'; roadWhy.push(`Model winds reach ${round(maxWind)} mph; MKWC closes the road above 55 mph sustained or 65 mph gusts.`); }
  if (snowHours) { road = 'AT_RISK'; roadWhy.push('Model shows precipitation with the freezing level at or below the summit road: snow or ice closes it.'); }
  if (road === 'OPEN' && cautionHours) { road = 'CAUTION'; roadWhy.push(maxWind >= T.windCautionMph ? `Model winds reach ${round(maxWind)} mph.` : 'Freezing and moist at the summit: rime ice is possible.'); }

  let sunsetCall, sunsetWhy;
  if (road === 'AT_RISK') { sunsetCall = 'NO_GO'; sunsetWhy = 'The summit road may close.'; }
  else if (sf.wet || sf.moist) { sunsetCall = 'NO_GO'; sunsetWhy = sf.wet ? 'Precipitation at sunset.' : `Summit-level air is saturated (RH ${round(sunsetRow.rh600)}% at about 14,000 ft): fog.`; }
  else if (sf.damp || sf.midCloud) { sunsetCall = 'MIXED'; sunsetWhy = sf.midCloud ? `Mid-level cloud near ${round(sunsetRow.mid)}% over the summit.` : `Summit air is damp (RH ${round(sunsetRow.rh600)}%).`; }
  else { sunsetCall = 'GO'; sunsetWhy = sf.seaOfClouds ? 'Dry summit with a cloud deck below: the classic above-the-clouds sunset.' : 'Dry air at summit level and no mid-level cloud.'; }

  let starsCall, starsWhy;
  if (road === 'AT_RISK') { starsCall = 'NO_GO'; starsWhy = 'The summit road may close.'; }
  else if (clearFraction == null) { starsCall = 'UNKNOWN'; starsWhy = 'No model hours inside the dark window.'; }
  else if (clearFraction >= T.starsGoFraction) { starsCall = 'GO'; starsWhy = `${Math.round(clearFraction * 100)}% of the dark hours look clear.`; }
  else if (clearFraction >= T.starsMixedFraction) { starsCall = 'MIXED'; starsWhy = `Only ${Math.round(clearFraction * 100)}% of the dark hours look clear; expect gaps.`; }
  else { starsCall = 'NO_GO'; starsWhy = `Only ${Math.round(clearFraction * 100)}% of the dark hours look clear.`; }

  const visBad = darkFlags.some((x) => x.f.visCloud);
  const summitTemps = flagsAll.map((x) => x.r.temp2m).filter(finite);
  return {
    available: true, road, roadWhy,
    sunset: { call: sunsetCall, why: sunsetWhy, seaOfClouds: sf.seaOfClouds, rh600: round(sunsetRow.rh600), rh700: round(sunsetRow.rh700), midCloudPct: round(sunsetRow.mid), lowCloudPct: round(sunsetRow.low) },
    stars: { call: starsCall, why: starsWhy, clearFraction: clearFraction == null ? null : round(clearFraction, 2), visitorStationInCloud: visBad },
    weather: {
      maxWindMph: round(maxWind),
      tempLowC: summitTemps.length ? round(Math.min(...summitTemps), 1) : null,
      tempSunsetC: round(sunsetRow.temp2m, 1),
      freezingLevelM: round(sunsetRow.freezingM),
      hours: flagsAll.length
    }
  };
}

// ---------- verdict ----------

export const LABEL = {
  GO: 'Go: full evening',
  MIXED: 'Partly: choose your half',
  NO_GO: 'No-go tonight',
  CHECK: 'Sources disagree, check before driving',
  UNCERTAIN: 'Not enough data to call it',
  TOO_FAR: 'Too far ahead for a weather call'
};

export function planFor(j) {
  if (!j.available) return null;
  const s = j.sunset.call, st = j.stars.call;
  if (j.road === 'AT_RISK') return 'Skip the drive up unless MKWC and the rangers say the road is open when you reach the Visitor Station.';
  if (s === 'GO' && st === 'GO') return 'Summit for sunset, then stay at the Visitor Station (9,200 ft) for the stars.';
  if (s === 'GO') return 'Summit for sunset. The late sky looks unreliable, so treat stargazing as a bonus.';
  if (st === 'GO') return 'Sunset at the summit looks compromised, but the night sky should open up. Plan for the Visitor Station after dark.';
  if (s === 'MIXED' || st === 'MIXED') return 'Either half could work. Decide at the Visitor Station once you can see the sky.';
  return 'Both halves look poor. Keep the evening flexible.';
}

/** Moon is a separate dimension from cloud: a clear night can still be washed out. */
export function moonNote(night) {
  if (!night) return null;
  const free = night.moonFreeMinutes ?? 0;
  const pct = Math.round((night.moonIllumination ?? 0) * 100);
  const fmt = (x) => new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }).format(new Date(x)).replace(' AM', ' a.m.').replace(' PM', ' p.m.');
  if (free >= 240) return { level: 'DARK', reason: `Moon: ${pct}% lit, but it is down for about ${Math.round(free / 60)} hours of the dark window.`, plan: 'The moon is out of the way for most of the night.' };
  if (free >= 60) return { level: 'PARTIAL', reason: `Moon: ${pct}% lit; moon-free dark sky only ${night.moonFreeFromIso ? `${fmt(night.moonFreeFromIso)} to ${fmt(night.moonFreeToIso)}` : 'briefly'}.`, plan: `For faint sky objects, wait for the moon-free window${night.moonFreeFromIso ? ` (${fmt(night.moonFreeFromIso)} to ${fmt(night.moonFreeToIso)})` : ''}.`.replace(/\.\)\.$/, '.)') };
  return { level: 'MOONLIT', reason: `Moon: ${pct}% lit and up most of the night, so the sky stays bright.`, plan: 'Expect a moonlit sky: planets, the moon and bright stars show well, the Milky Way and faint objects do not.' };
}

export function decide({ night, judge, road, forecast, mode, now = Date.now() }) {
  if (road?.closed) {
    return { state: 'NO_GO', confidence: 'MODERATE', reasons: [`MKWC road status: ${road.status}.`], plan: 'The summit road is closed. Watch the MKWC road page for a change.' };
  }
  if (!judge?.available) {
    return { state: 'UNCERTAIN', confidence: 'LOW', reasons: ['The weather model was unavailable, so only the moon, sunset and road message are shown.'], plan: null };
  }
  let state;
  if (judge.road === 'AT_RISK') state = 'NO_GO';
  else if (judge.sunset.call === 'GO' && judge.stars.call === 'GO') state = 'GO';
  else if (judge.sunset.call === 'NO_GO' && judge.stars.call === 'NO_GO') state = 'NO_GO';
  else state = 'MIXED';
  const reasons = [`Sunset: ${judge.sunset.why}`, `Stars: ${judge.stars.why}`, ...judge.roadWhy];

  let confidence = 'LOW'; // unvalidated rules never earn more than MODERATE
  let crossCheck = 'not-applicable';
  const sunset = Date.parse(night.sunsetIso);
  const applies = mode === 'tonight' && forecast?.ok && forecast.fresh && sunset - Date.parse(forecast.issuedIso) < 36 * 3600000;
  if (applies) {
    const sig = forecast.signal;
    const skyGo = state === 'GO' || state === 'MIXED';
    if ((sig === 'wet' && state === 'GO') || (sig === 'clear' && state === 'NO_GO' && judge.road !== 'AT_RISK')) {
      crossCheck = 'disagree';
      state = 'CHECK';
      confidence = 'LOW';
      reasons.unshift(sig === 'wet' ? 'The MKWC forecaster expects fog, precipitation or cloud, but the model shows a clear summit.' : 'The MKWC forecaster expects a dry, clear summit, but the model shows a wet or cloudy one.');
    } else if (sig === 'unknown' || sig === 'mixed') {
      crossCheck = 'inconclusive';
    } else if ((sig === 'clear' && skyGo) || (sig === 'wet' && state !== 'GO')) {
      crossCheck = 'agree';
      confidence = 'MODERATE';
      reasons.push('The MKWC forecaster’s own cloud forecast points the same way.');
    }
  } else if (mode === 'tonight') {
    crossCheck = forecast?.ok ? 'stale' : 'unavailable';
    if (!forecast?.ok || !forecast.fresh) confidence = 'LOW';
  }
  const moon = moonNote(night);
  if (moon && state !== 'NO_GO') reasons.push(moon.reason.replace(/\.\.$/, '.'));
  let plan = state === 'CHECK' ? 'Check MKWC and the Visitor Station conditions, and look at the sky as you climb.' : planFor(judge);
  if (plan && moon && state !== 'NO_GO' && state !== 'CHECK' && judge.stars.call !== 'NO_GO') plan += ` ${moon.plan}`;
  return { state, confidence, reasons, plan, crossCheck, darkSky: moon?.level || null };
}

// ---------- payload ----------

const shortDate = (ymd) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' }).format(new Date(`${ymd}T12:00:00Z`));
const rangeLabel = (a, b) => (a === b ? shortDate(a) : `${shortDate(a)} to ${shortDate(b)}`);

/** Which stretch of nights has real dark sky, and which is moonlit. Pure astronomy, exact for any date. */
export function summarizeNights(nights) {
  const runs = (pred) => {
    const out = []; let cur = null;
    for (const n of nights) {
      if (pred(n)) { if (!cur) cur = { from: n.date, to: n.date, nights: [n] }; else { cur.to = n.date; cur.nights.push(n); } }
      else if (cur) { out.push(cur); cur = null; }
    }
    if (cur) out.push(cur);
    return out;
  };
  const total = (r) => r.nights.reduce((t, n) => t + n.moonFreeMinutes, 0);
  const pick = (rs) => rs.sort((a, b) => b.nights.length - a.nights.length || total(b) - total(a))[0] || null;
  const shape = (r) => r && {
    from: r.from, to: r.to, label: rangeLabel(r.from, r.to), nights: r.nights.length,
    minHours: round(Math.min(...r.nights.map((n) => n.moonFreeMinutes)) / 60, 1),
    maxHours: round(Math.max(...r.nights.map((n) => n.moonFreeMinutes)) / 60, 1)
  };
  const bestNight = nights.reduce((b, n) => (!b || n.moonFreeMinutes > b.moonFreeMinutes ? n : b), null);
  return {
    best: shape(pick(runs((n) => n.moonFreeMinutes >= 240))),
    bright: shape(pick(runs((n) => n.moonFreeMinutes < 60))),
    bestNight: bestNight ? { date: bestNight.date, label: shortDate(bestNight.date), hours: round(bestNight.moonFreeMinutes / 60, 1) } : null
  };
}

export function nightsAhead(fromYmd, count = 14) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const n = nightFor(addDaysYmd(fromYmd, i));
    out.push({ date: n.date, moonIllumination: n.moonIllumination, moonPhase: n.moonPhase, moonFreeMinutes: n.moonFreeMinutes, darkMinutes: n.darkMinutes, moonFreeFromIso: n.moonFreeFromIso, moonFreeToIso: n.moonFreeToIso });
  }
  return out;
}

async function settle(label, fn) {
  try { return { label, ok: true, value: await fn() }; }
  catch (error) { return { label, ok: false, error: String(error?.message || error) }; }
}

export async function buildMaunaKea(ymd, now = Date.now(), deps = {}) {
  const today = currentNightKey(now);
  const target = ymd || today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(target)) throw badRequest('Use YYYY-MM-DD');
  if (target < today) throw badRequest('That evening has already passed. Showing tonight instead.');
  if (target > addDaysYmd(today, 366)) throw badRequest('Pick a date within the next year');

  const night = nightFor(target);
  const mode = target === today ? 'tonight' : 'planned';
  const phase = mode === 'tonight' && night.sunsetIso && Date.parse(night.sunsetIso) <= now ? 'night' : 'before-sunset';
  const daysAhead = (Date.parse(`${target}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86400000;
  const inHorizon = daysAhead <= THRESHOLDS.forecastHorizonDays - 1;

  const getRoad = deps.road || (async () => parseMkwcRoad(await (await fetchWithTimeout(URLS.mkwcRoad)).text(), now));
  const getForecast = deps.forecast || (async () => parseMkwcForecast(await (await fetchWithTimeout(URLS.mkwcForecast)).text(), now));
  const getGfs = deps.gfs || fetchGfs;
  const jobs = [settle('mkwcRoad', getRoad), settle('mkwcForecast', getForecast)];
  if (inHorizon) jobs.push(settle('gfs', getGfs));
  const results = await Promise.all(jobs);
  const by = Object.fromEntries(results.map((r) => [r.label, r]));
  const road = by.mkwcRoad.ok ? by.mkwcRoad.value : null;
  const forecast = by.mkwcForecast.ok ? by.mkwcForecast.value : null;
  const rows = by.gfs?.ok ? by.gfs.value : null;

  let decision, judge = null;
  // Window of nights shown: for a far-off date, start a few nights early (but never in the past) so the choice is visible.
  const windowStart = inHorizon ? target : (addDaysYmd(target, -3) < today ? today : addDaysYmd(target, -3));
  const nights = nightsAhead(windowStart, 14);
  const planning = summarizeNights(nights);
  if (!inHorizon) {
    const reasons = [];
    if (planning.bright) reasons.push(planning.bright.maxHours < 0.5 ? `The moon is up most of the night ${planning.bright.label}, so the sky stays bright.` : `The moon is bright ${planning.bright.label}: at most ${planning.bright.maxHours} moon-free hours.`);
    if (planning.best) reasons.push(`${planning.best.label}: ${planning.best.minHours}${planning.best.maxHours !== planning.best.minHours ? ` to ${planning.best.maxHours}` : ''} moon-free hours a night.`);
    reasons.push('Cloud and wind cannot be forecast this far ahead. Come back within a week of your night for the weather call.');
    decision = {
      state: 'TOO_FAR', confidence: 'NONE', reasons,
      plan: 'Pick your night from the bars below, then check back inside the week.',
      headline: planning.best ? `Best nights for stars: ${planning.best.label}` : 'No dark-moon nights in this window'
    };
  } else {
    judge = judgeNight(night, rows);
    decision = decide({ night, judge, road: mode === 'tonight' ? road : null, forecast, mode, now });
  }

  const sources = [
    { id: 'mkwc-road', name: 'Maunakea Weather Center road message', ok: by.mkwcRoad.ok && road?.ok, asOf: road?.messageIso || null, note: road?.isDefault ? 'Quiet-season default: MKWC does not update this message April through November unless something unusual happens.' : (by.mkwcRoad.ok ? null : by.mkwcRoad.error) },
    { id: 'mkwc-forecast', name: 'Maunakea Weather Center forecast', ok: by.mkwcForecast.ok && forecast?.ok, asOf: forecast?.issuedIso || null, note: forecast && !forecast.fresh ? 'Older than 18 hours, so not used as a cross-check.' : (by.mkwcForecast.ok ? null : by.mkwcForecast.error) },
    { id: 'gfs', name: 'NOAA GFS model at the summit (via Open-Meteo)', ok: inHorizon ? Boolean(by.gfs?.ok) : null, asOf: rows ? new Date(rows[0].ms).toISOString() : null, note: inHorizon ? (by.gfs?.ok ? null : by.gfs?.error) : 'Beyond the model horizon.' },
    { id: 'astronomy', name: 'Sun and moon (computed)', ok: true, asOf: new Date(now).toISOString(), note: null }
  ];

  return {
    ok: true,
    tool: 'mauna-kea-tonight',
    updated: new Date(now).toISOString(),
    date: target, today, mode, phase, daysAhead,
    decision: { ...decision, label: decision.headline || LABEL[decision.state] },
    sunset: judge?.available ? judge.sunset : null,
    stars: judge?.available ? judge.stars : null,
    roadGate: {
      model: judge?.available ? { state: judge.road, why: judge.roadWhy } : null,
      official: mode === 'tonight' && road ? { status: road.status, open: road.open, closed: road.closed, fourWheelDrive: road.fourWheelDrive, messageIso: road.messageIso, isDefault: road.isDefault } : null,
      criteria: ['Any ice or snow on the road', 'Winds above 55 mph for more than 1 hour, or gusts above 65 mph', 'Visibility under 50 feet', 'Any other condition that makes the road unsafe']
    },
    weather: judge?.available ? judge.weather : null,
    astronomy: night,
    nights,
    planning,
    mkwc: forecast ? { issuedIso: forecast.issuedIso, ageHours: forecast.ageHours, fresh: forecast.fresh, warning: forecast.warning, warningActive: forecast.warningActive, cloudText: forecast.cloudText, summaryText: forecast.summaryText, seeingArcsec: forecast.seeingArcsec, precipitableWaterMm: forecast.precipitableWaterMm, signal: forecast.signal } : null,
    summitNow: mode === 'tonight' ? road?.summitNow || null : null,
    thresholds: THRESHOLDS,
    validated: false,
    validation: 'The sky thresholds are starting rules and have not been scored against labeled nights. The road criteria are MKWC’s own.',
    sources
  };
}
