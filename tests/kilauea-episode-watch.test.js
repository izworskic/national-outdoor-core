const test = require('node:test');
const assert = require('node:assert/strict');

let E, H;
test.before(async () => { E = await import('../lib/kilauea-episode-watch.mjs'); H = await import('../lib/kilauea-history.mjs'); });

const wrap = (summary) => `<center><b>HAWAIIAN VOLCANO OBSERVATORY DAILY UPDATE</b></center><b>KILAUEA</b> (VNUM #332010)<br/>Current Aviation Color Code: YELLOW<br/><span name="synopsis"><b>Summary:</b> ${summary}</span><br/><p><strong>Overview:</strong></p><p>More.</p>`;
const ISSUED = '2026-10-22T20:00:21Z';
const NOW = Date.parse('2026-10-23T00:00:00Z'); // 2 pm HST Oct 22

test('parses the real October 22 update: paused, episode 56 window Oct 29 to Nov 5', () => {
  const p = E.parseHvo(wrap("The Halema'uma'u eruption of Kīlauea is currently paused after episode 55 fountaining ended on October 17. Summit reinflation continues today and the preliminary forecast for episode 56 fountaining is between October 29 and November 5, 2026."), ISSUED, { alert_level: 'ADVISORY', color_code: 'YELLOW' });
  assert.equal(p.status, 'PAUSED');
  assert.deepEqual(p.window, { start: '2026-10-29', end: '2026-11-05' });
  assert.equal(p.lastEpisode, 55);
  assert.equal(p.alertLevel, 'ADVISORY');
});

test('parses other phrasings: dashes, a day-name range, shared month, "likely between"', () => {
  assert.deepEqual(E.parseHvo(wrap('The eruption is paused. The preliminary forecast window for episode 47 is May 12 – May 17, 2026.'), '2026-05-08T20:00:00Z').window, { start: '2026-05-12', end: '2026-05-17' });
  assert.deepEqual(E.parseHvo(wrap('The eruption is paused. Episode 48 will occur sometime between Sunday, May 24 and Wednesday, May 27.'), '2026-05-22T20:00:00Z').window, { start: '2026-05-24', end: '2026-05-27' });
  assert.deepEqual(E.parseHvo(wrap('Kīlauea volcano is not erupting. Another lava fountaining episode is likely between July 9 and 15.'), '2026-07-03T20:00:00Z').window, { start: '2026-07-09', end: '2026-07-15' });
});

test('a window that wraps the year is read into next year', () => {
  const p = E.parseHvo(wrap('The eruption is paused. Episode 60 is forecast between December 29 and January 4.'), '2026-12-26T20:00:00Z');
  assert.deepEqual(p.window, { start: '2026-12-29', end: '2027-01-04' });
});

test('status: precursor activity, fountaining now, and ended/paused are told apart', () => {
  assert.equal(E.parseHvo(wrap('Precursory overflows from the north vent continue for the third day.'), ISSUED).status, 'PRECURSOR');
  assert.equal(E.parseHvo(wrap('Episode 56 of the ongoing Halemaʻumaʻu eruption began at 3:19 AM HST and is currently fountaining from the north vent.'), ISSUED).status, 'ERUPTING');
  assert.equal(E.parseHvo(wrap('Episode 55 ended abruptly at 9:03 a.m. HST. The eruption is paused.'), ISSUED).status, 'PAUSED');
});

test('no window found means no invented window', () => {
  const p = E.parseHvo(wrap('The eruption is paused. Reinflation indicates another episode is likely but more data are needed to determine the forecast.'), ISSUED);
  assert.equal(p.window, null);
});

test('call: before the window is WAIT, near it is SOON, inside is SOON, after is OVERDUE', () => {
  const mk = (w, now) => E.decide({ hvo: { status: 'PAUSED', window: w, alertLevel: 'ADVISORY' }, cond: null, now: Date.parse(now) }).state;
  const W = { start: '2026-10-29', end: '2026-11-05' };
  assert.equal(mk(W, '2026-10-22T20:00:00Z'), 'WAIT');
  assert.equal(mk(W, '2026-10-26T20:00:00Z'), 'SOON');
  assert.equal(mk(W, '2026-10-31T20:00:00Z'), 'SOON');
  assert.equal(mk(W, '2026-11-07T20:00:00Z'), 'OVERDUE');
  assert.equal(mk(null, '2026-10-22T20:00:00Z'), 'NO_WINDOW');
});

test('call: fountaining is GO, and with no HVO data the answer is NO_DATA, never a guess', () => {
  assert.equal(E.decide({ hvo: { status: 'ERUPTING', window: null }, cond: null, now: NOW }).state, 'GO');
  assert.equal(E.decide({ hvo: null, cond: null, now: NOW }).state, 'NO_DATA');
});

test('hour rating: fog, rain and clear are told apart; gas flag follows south and southeast wind', () => {
  assert.equal(E.hourRating({ lowCloud: 95, mm: 0, visM: 20000 }), 'POOR');
  assert.equal(E.hourRating({ lowCloud: 10, mm: 1, visM: 20000 }), 'POOR');
  assert.equal(E.hourRating({ lowCloud: 60, mm: 0, visM: 20000 }), 'FAIR');
  assert.equal(E.hourRating({ lowCloud: 10, mm: 0, visM: 24000 }), 'GOOD');
  assert.equal(E.gasToward(150), true);
  assert.equal(E.gasToward(60), false);
});

test('buildEpisodeWatch degrades: weather down still gives the HVO answer; both down gives NO_DATA', async () => {
  const hvo = { status: 'PAUSED', summary: 'x', window: { start: '2026-10-29', end: '2026-11-05' }, lastEpisode: 55, alertLevel: 'ADVISORY', issued: ISSUED };
  const a = await E.buildEpisodeWatch(NOW, { hvo: async () => hvo, wx: async () => { throw new Error('down'); } });
  assert.equal(a.call.state, 'WAIT'); assert.ok(a.errors.weather); assert.equal(a.conditions, null);
  const b = await E.buildEpisodeWatch(NOW, { hvo: async () => { throw new Error('down'); }, wx: async () => { throw new Error('down'); } });
  assert.equal(b.call.state, 'NO_DATA');
});

test('history: 16 timed episodes, ends after starts, intervals match the dates', () => {
  assert.equal(H.EPISODES.length, 16);
  for (const e of H.EPISODES) assert.ok(Date.parse(e.end) > Date.parse(e.start), `ep ${e.n}`);
  const s = H.stats();
  assert.equal(s.intervals.length, 15);
  const e54 = s.intervals.find((i) => i.to === 55);
  assert.equal(e54.days, 52.7); // Aug 25 10:30 to Oct 17 03:19 HST
  assert.ok(s.maxDurationHours <= 10 && s.minDurationHours >= 5);
  assert.equal(s.startHour.reduce((a, b) => a + b, 0), 16);
});

test('chance of an episode start grows with the length of the window and stays between 0 and 1', () => {
  const a = H.chanceInWindow(3).share, b = H.chanceInWindow(7).share, c = H.chanceInWindow(14).share;
  assert.ok(a > 0 && a < b && b < c && c <= 1);
  assert.ok(H.chanceInWindow(1).share < a);
});

test('payload carries the record and flags stale history when HVO is past episode 55', async () => {
  const hvo = { status: 'PAUSED', summary: 'x', window: null, lastEpisode: 56, issued: ISSUED };
  const p = await E.buildEpisodeWatch(NOW, { hvo: async () => hvo, wx: async () => [] });
  assert.equal(p.history.historyStale, true);
  assert.equal(p.history.daysSinceLast, null);
  assert.equal(p.history.knownMisses.length, 2);
});

test('the browser bundle is current and runs with a fake fetch, with no Node-only code', async () => {
  const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
  const B = await import('../scripts/build-kilauea-client.mjs');
  const onDisk = fs.readFileSync(path.join(__dirname, '../public/assets/kilauea-engine.js'), 'utf8');
  assert.equal(onDisk, B.bundle(), 'run: node scripts/build-kilauea-client.mjs');
  const notice = wrap("The Halema'uma'u eruption of Kīlauea is currently paused after episode 55 fountaining ended on October 17. The preliminary forecast for episode 56 fountaining is between October 29 and November 5, 2026.");
  const hours = Array.from({ length: 72 }, (_, i) => new Date(Date.UTC(2026, 9, 23, 0) + i * 3600000).toISOString().slice(0, 16));
  const calls = [];
  const fakeFetch = async (url, opts) => {
    calls.push({ url, headers: opts && opts.headers });
    const json = /getMonitoredVolcanoes/.test(url) ? [{ vnum: '332010', sent_utc: '2026-10-22 20:00:21', alert_level: 'ADVISORY', color_code: 'YELLOW', notice_data: 'https://volcanoes.usgs.gov/n', notice_url: 'https://u' }]
      : /volcanoes\.usgs\.gov\/n/.test(url) ? { notice_html: notice }
      : { hourly: { time: hours, cloud_cover_low: hours.map(() => 10), precipitation: hours.map(() => 0), visibility: hours.map(() => 24000), wind_speed_10m: hours.map(() => 8), wind_direction_10m: hours.map(() => 60) } };
    return { ok: true, json: async () => json };
  };
  const win = {};
  const ctx = vm.createContext({ window: win, fetch: fakeFetch, AbortController, URL, Date, Math, Number, JSON, Array, String, RegExp, Promise, setTimeout, clearTimeout, Intl });
  vm.runInContext(onDisk, ctx);
  const p = await win.KilaueaEngine.buildEpisodeWatch(Date.parse('2026-10-23T12:00:00Z'));
  assert.equal(p.call.state, 'WAIT');
  assert.equal(p.hvo.window.start, '2026-10-29');
  assert.equal(p.conditions.goodHours, p.conditions.hours.length);
  assert.ok(calls.length >= 3 && calls.every((c) => !c.headers), 'no custom headers, so no CORS preflight');
});
