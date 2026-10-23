// Kīlauea Episode Watch: the USGS HVO daily update (status and forecast window), summit weather from Open-Meteo,
// and the 2026 episode record. Rules are published on the page and are unvalidated starting points.
import { fetchWithTimeout, hstYmd, hstHour, addDaysYmd } from './big-island-coast.mjs';
import { EPISODES, KNOWN_MISSES, LONG_RUN, stats, chanceInWindow } from './kilauea-history.mjs';

export const URLS = {
  list: 'https://volcanoes.usgs.gov/hans-public/api/volcano/getMonitoredVolcanoes',
  hvoPage: 'https://www.usgs.gov/volcanoes/kilauea/volcano-updates',
  openMeteo: 'https://api.open-meteo.com/v1/forecast',
  npsEruption: 'https://www.nps.gov/havo/planyourvisit/eruption-viewing.htm',
  npsAir: 'https://www.nps.gov/havo/learn/nature/air-quality-alerts.htm'
};
export const VNUM = '332010';
export const OVERLOOK = { name: 'Uēkahuna overlook', lat: 19.4194, lon: -155.2886, elevFt: 3700 };
export const THRESHOLDS = {
  soonDays: 3, lowCloudPoor: 80, lowCloudFair: 50, visPoorM: 1500, visFairM: 5000, rainPoorMm: 0.5, rainFairMm: 0.1,
  gasFromMin: 100, gasFromMax: 210, hoursAhead: 36, episodeLongHours: 10
};
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MRE = MONTHS.join('|');
const DAYRE = '(?:(?:Sun|Mon|Tues|Wednes|Thurs|Fri|Satur)day,? )?';

const plain = (html) => String(html || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#0?39;|&rsquo;/g, "'").replace(/\s+/g, ' ').trim();

/** Read one HVO daily update. Returns structure plus HVO's own summary words, which the page always shows. */
export function parseHvo(noticeHtml, issuedIso, alert = {}) {
  const text = plain(noticeHtml);
  const sm = /Summary:\s*(.*?)\s*(?:Overview:|Summit Observations:|$)/.exec(text);
  const body = text.replace(/^.*?Aviation Color Code:\s*\w+\s*/i, '');
  const summary = (sm ? sm[1] : body.slice(0, 500)).replace(/(?<=\d)(st|nd|rd|th)\b/g, '').trim();
  const s = summary.toLowerCase();
  let status = 'UNKNOWN';
  if (/precursory|overflow/.test(s) && !/ended/.test(s.split('precursory')[0] || '')) status = 'PRECURSOR';
  if (/\bpaused\b|not erupting/.test(s) && !/precursory (activity|overflow|lava)/.test(s)) status = 'PAUSED';
  if (status === 'UNKNOWN' && /(episode \d+[^.]{0,80}(began|is (currently )?(occurring|fountaining)|continues|ongoing)|lava fountaining (is )?(occurring|underway|continues))/.test(s) && !/\bended\b|has ended/.test(s)) status = 'ERUPTING';
  if (status === 'UNKNOWN' && /\berupting\b/.test(s)) status = 'ERUPTING';
  const issued = Date.parse(issuedIso);
  const year = Number.isFinite(issued) ? Number(hstYmd(issued).slice(0, 4)) : new Date().getUTCFullYear();
  const today = Number.isFinite(issued) ? hstYmd(issued) : hstYmd(Date.now());
  let window = null;
  const re = new RegExp(`(?:between|from|window[^.]{0,40}?\\bis|window[^.]{0,30}?:)\\s*(?:today,? )?${DAYRE}(${MRE}) (\\d{1,2})\\s*(?:and|to|-|–|through)\\s*(?:${DAYRE}(${MRE}) (\\d{1,2})|(\\d{1,2})\\b(?! ?[ap]\\.?m))`, 'i');
  const w = re.exec(summary);
  if (w) {
    const ma = MONTHS.findIndex((m) => m.toLowerCase() === w[1].toLowerCase()) + 1, da = Number(w[2]);
    const mb = w[3] ? MONTHS.findIndex((m) => m.toLowerCase() === w[3].toLowerCase()) + 1 : ma, db = Number(w[4] || w[5]);
    const ymd = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    let y = year;
    let a = ymd(y, ma, da);
    if (a < addDaysYmd(today, -3)) { y += 1; a = ymd(y, ma, da); }
    let b = ymd(y, mb, db);
    if (b < a) b = ymd(y + 1, mb, db);
    window = { start: a, end: b };
  }
  const lastEnded = /episode (\d+)[^.]{0,40}?\bended\b/i.exec(summary) || /after episode (\d+)/i.exec(summary);
  return {
    status, summary, window, lastEpisode: lastEnded ? Number(lastEnded[1]) : null,
    alertLevel: alert.alert_level || null, colorCode: alert.color_code || null, issued: issuedIso || null
  };
}

export async function fetchHvo() {
  const list = await (await fetchWithTimeout(URLS.list, 15000, {}, false)).json();
  const k = (Array.isArray(list) ? list : []).find((v) => v.vnum === VNUM);
  if (!k?.notice_data) throw new Error('HVO has no current Kīlauea notice');
  const n = await (await fetchWithTimeout(k.notice_data, 15000, {}, false)).json();
  const issued = k.sent_utc ? `${k.sent_utc.replace(' ', 'T')}Z` : null;
  return { ...parseHvo(n.notice_html, issued, k), noticeUrl: k.notice_url || URLS.hvoPage };
}

export async function fetchSummitWeather() {
  const q = `latitude=${OVERLOOK.lat}&longitude=${OVERLOOK.lon}&hourly=cloud_cover_low,precipitation,visibility,wind_speed_10m,wind_direction_10m&wind_speed_unit=mph&forecast_days=3&timezone=GMT`;
  let res;
  try { res = await fetchWithTimeout(`${URLS.openMeteo}?${q}`, 8000); } catch { res = await fetchWithTimeout(`${URLS.openMeteo}?${q}`, 8000); }
  const h = (await res.json())?.hourly;
  if (!h?.time) throw new Error('Open-Meteo returned no hourly data');
  return h.time.map((t, i) => ({ ms: Date.parse(`${t}:00Z`), lowCloud: h.cloud_cover_low?.[i], mm: h.precipitation?.[i], visM: h.visibility?.[i], mph: h.wind_speed_10m?.[i], dir: h.wind_direction_10m?.[i] })).filter((r) => Number.isFinite(r.ms));
}

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
export function hourRating(r) {
  const T = THRESHOLDS;
  if ((finite(r.lowCloud) && r.lowCloud >= T.lowCloudPoor) || (finite(r.visM) && r.visM < T.visPoorM) || (finite(r.mm) && r.mm >= T.rainPoorMm)) return 'POOR';
  if ((finite(r.lowCloud) && r.lowCloud >= T.lowCloudFair) || (finite(r.mm) && r.mm >= T.rainFairMm) || (finite(r.visM) && r.visM < T.visFairM)) return 'FAIR';
  return 'GOOD';
}
export const gasToward = (dir) => finite(dir) && dir >= THRESHOLDS.gasFromMin && dir <= THRESHOLDS.gasFromMax;

export function conditions(rows, now = Date.now()) {
  const from = Math.floor(now / 3600000) * 3600000;
  const hours = rows.filter((r) => r.ms >= from && r.ms < from + THRESHOLDS.hoursAhead * 3600000).map((r) => ({
    ms: r.ms, hstHour: hstHour(r.ms), rating: hourRating(r), lowCloud: finite(r.lowCloud) ? Math.round(r.lowCloud) : null,
    mm: finite(r.mm) ? Math.round(r.mm * 10) / 10 : null, visKm: finite(r.visM) ? Math.round(r.visM / 100) / 10 : null,
    mph: finite(r.mph) ? Math.round(r.mph) : null, dir: finite(r.dir) ? Math.round(r.dir) : null, gas: gasToward(r.dir)
  }));
  if (!hours.length) return null;
  const good = hours.filter((h) => h.rating === 'GOOD').length;
  const nextGood = hours.find((h) => h.rating === 'GOOD') || null;
  return { place: OVERLOOK.name, hours, goodHours: good, nowRating: hours[0].rating, nowGas: hours[0].gas, nextGoodMs: nextGood ? nextGood.ms : null };
}

const LABEL = { GO: 'Fountaining now', SOON: 'Watch closely', WAIT: 'Not yet', OVERDUE: 'Past the window', NO_WINDOW: 'No window yet', NO_DATA: 'No data' };
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000);
const fmtDay = (ymd) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' }).format(new Date(`${ymd}T12:00:00Z`));

export function decide({ hvo, cond, now = Date.now() }) {
  const reasons = [];
  if (!hvo) return { state: 'NO_DATA', label: LABEL.NO_DATA, headline: 'The USGS update could not be read right now.', plain: 'Check the USGS Hawaiian Volcano Observatory page directly.', reasons: ['No HVO update was available.'] };
  const today = hstYmd(now);
  const w = hvo.window;
  const poor = cond && cond.nowRating === 'POOR';
  let state, headline;
  if (hvo.status === 'ERUPTING') {
    state = 'GO';
    headline = 'HVO reports lava fountaining at the summit now.';
    reasons.push(`Episodes in 2026 lasted ${THRESHOLDS.episodeLongHours - 4} to ${THRESHOLDS.episodeLongHours} hours, so there may be little time. Check the park webcams before you drive.`);
  } else if (hvo.status === 'PRECURSOR') {
    state = 'SOON';
    headline = 'Precursor activity is under way: fountaining can start within a day or two.';
    reasons.push('HVO describes overflows or spattering that have come before fountaining.');
  } else if (hvo.status === 'PAUSED' || hvo.status === 'UNKNOWN') {
    if (!w) { state = 'NO_WINDOW'; headline = 'HVO has not published a forecast window for the next episode.'; reasons.push('No date range was found in the latest update.'); }
    else if (today > w.end) { state = 'OVERDUE'; headline = `HVO's window (${fmtDay(w.start)} to ${fmtDay(w.end)}) has passed without fountaining.`; reasons.push('HVO windows have been missed before, by days and once by weeks. A new window usually follows.'); }
    else if (today >= w.start) { state = 'SOON'; headline = `Today is inside HVO's forecast window (${fmtDay(w.start)} to ${fmtDay(w.end)}).`; reasons.push('The episode can start any hour of any day in the window.'); }
    else {
      const d = daysBetween(today, w.start);
      state = d <= THRESHOLDS.soonDays ? 'SOON' : 'WAIT';
      headline = d <= THRESHOLDS.soonDays ? `HVO's window opens in ${d} day${d === 1 ? '' : 's'} (${fmtDay(w.start)} to ${fmtDay(w.end)}).` : `Not yet: HVO expects the next episode ${fmtDay(w.start)} to ${fmtDay(w.end)}.`;
      reasons.push(`The window opens ${d} days from now.`);
    }
  } else { state = 'NO_WINDOW'; headline = 'The status could not be read from the HVO update.'; }
  if (hvo.alertLevel) reasons.push(`USGS alert level: ${hvo.alertLevel}${hvo.colorCode ? `, aviation color code ${hvo.colorCode}` : ''}.`);
  if (cond) {
    if (poor) reasons.push('Summit weather now looks poor for seeing anything: low cloud, rain or fog.');
    if (cond.nowGas) reasons.push('Wind is from the south or southeast, which can carry volcanic gas toward the Uēkahuna and Kīlauea Overlook side. Check the park air quality page.');
    reasons.push(`${cond.goodHours} of the next ${cond.hours.length} hours look clear at the summit.`);
  }
  const plainBy = {
    GO: 'Fountaining is the whole show and it ends within hours. If you are far away, check a webcam first.',
    SOON: 'There is no start time, only a range. Keep your day flexible and watch the HVO update.',
    WAIT: 'Nothing is expected yet. Come back when the window is a few days away.',
    OVERDUE: 'The next episode is still expected, but HVO has no current date for it.',
    NO_WINDOW: 'Check back after the next HVO update.',
    NO_DATA: 'Check the USGS page.'
  };
  return { state, label: LABEL[state], headline, plain: plainBy[state], reasons };
}

export async function buildEpisodeWatch(now = Date.now(), deps = {}) {
  const errors = {};
  const [hvo, wx] = await Promise.all([
    (deps.hvo || fetchHvo)().catch((e) => { errors.hvo = String(e.message || e); return null; }),
    (deps.wx || fetchSummitWeather)().catch((e) => { errors.weather = String(e.message || e); return null; })
  ]);
  const cond = wx ? conditions(wx, now) : null;
  const call = decide({ hvo, cond, now });
  const st = stats();
  const historyStale = Boolean(hvo && hvo.lastEpisode && hvo.lastEpisode > EPISODES[EPISODES.length - 1].n);
  const lastEndMs = st.lastEnd;
  return {
    ok: true, updated: new Date(now).toISOString(), today: hstYmd(now),
    hvo, call, conditions: cond, errors,
    history: { episodes: EPISODES, stats: st, knownMisses: KNOWN_MISSES, longRun: LONG_RUN, historyStale, daysSinceLast: historyStale ? null : Math.round(((now - lastEndMs) / 86400000) * 10) / 10, chance: { 3: chanceInWindow(3), 7: chanceInWindow(7), 10: chanceInWindow(10), 14: chanceInWindow(14) } },
    thresholds: THRESHOLDS,
    sources: [
      { name: 'USGS Hawaiian Volcano Observatory daily update (HANS)', ok: Boolean(hvo), asOf: hvo?.issued || null },
      { name: `Open-Meteo GFS at ${OVERLOOK.name}`, ok: Boolean(wx), note: wx ? 'Hourly cloud, rain, visibility, wind' : undefined },
      { name: 'HVO episode record, Jan to Oct 2026 (parsed from HANS notices)', ok: true, note: `${EPISODES.length} episodes with timed starts and ends` }
    ]
  };
}
