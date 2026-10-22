const test = require('node:test');
const assert = require('node:assert/strict');

const load = () => import('../lib/mauna-kea.mjs');

const ROAD_HTML = `<html><body><div>Current Conditions Temp 0.7 C RH 20 % Wind NNE 3 mph Road Open (4x4)</div>
<h2>Maunakea Road Conditions</h2><p>Road Status: Open (4-Wheel Drive Please) Comments Tuesday, October 20, 2026 - 04:33 a.m. Aloha, the road is open.</p></body></html>`;
const FORECAST_HTML = `<html><body>Maunakea Observatories Forecast 5 PM HST Tuesday 20 October (0300 UTC Wednesday 21 October) 2026
Warning(s) None Cloud Cover and Fog/Precipitation Forecast The summit will remain dry and stable, while patches of mid-level clouds may linger.
Summary of Key Meteorological Variables Summit temperatures will be near 5.5 C this afternoon. Seeing will be near 0.45-0.5 arcseconds, while precipitable water is expected to be in the 1.5-2 mm range for the first half of the night. Discussion A distinct inversion.</body></html>`;

test('astronomy: sunset and moon match an independent library (ephem) to within minutes', async () => {
  const m = await load();
  // ephem, observer 19.8207N 155.4681W, 4205 m, refraction off, sun center at -0.833 deg: sunset 2026-10-22T03:53:52Z
  const dipMinutes = (Date.parse(m.nightFor('2026-10-21').sunsetIso) - Date.parse('2026-10-22T03:53:52Z')) / 60000;
  assert.ok(dipMinutes > 6 && dipMinutes < 12, `summit sea-horizon sunset should be ~9 minutes after the flat-horizon sunset, got ${dipMinutes}`);
  // Reference values from ephem at fixed instants.
  const ms = Date.parse('2026-12-25T06:00:00Z');
  assert.ok(Math.abs(m.moonAltitude(ms) - 12.13) < 0.4);
  assert.ok(Math.abs(m.moonIllumination(ms) - 0.978) < 0.01);
  assert.ok(Math.abs(m.sunAltitude(Date.parse('2026-10-21T08:00:00Z')) - -58.23) < 0.1);
});

test('MKWC published sunset check: Oct 20 summit sunset is about 6:04 p.m. HST', async () => {
  const m = await load();
  const hstMin = (Date.parse(m.nightFor('2026-10-20').sunsetIso) - 10 * 3600000) % 86400000 / 60000;
  assert.ok(Math.abs(hstMin - (18 * 60 + 4)) <= 3, `got ${hstMin}`);
});

test('nightFor rejects impossible dates', async () => {
  const m = await load();
  assert.throws(() => m.nightFor('2026-02-31'), /calendar date/);
  assert.throws(() => m.nightFor('tomorrow'), /YYYY-MM-DD/);
});

test('Christmas week: full moon on Dec 24-25 leaves almost no moon-free dark; New Year week is dark', async () => {
  const m = await load();
  const xmas = m.nightFor('2026-12-25');
  const ny = m.nightFor('2027-01-01');
  assert.ok(xmas.moonIllumination > 0.85);
  assert.ok(xmas.moonFreeMinutes < 120);
  assert.ok(ny.moonFreeMinutes > 360);
});

test('parseMkwcRoad reads status, message time and header conditions', async () => {
  const m = await load();
  const r = m.parseMkwcRoad(ROAD_HTML, Date.parse('2026-10-21T12:00:00Z'));
  assert.equal(r.status, 'Open (4-Wheel Drive Please)');
  assert.equal(r.open, true);
  assert.equal(r.closed, false);
  assert.equal(r.fourWheelDrive, true);
  assert.equal(r.messageIso, '2026-10-20T14:33:00.000Z');
  assert.equal(r.summitNow.rh, 20);
  assert.equal(r.seasonalSilence, true);
});

test('quiet-season old "Open" is flagged as a default, not a fresh reading', async () => {
  const m = await load();
  const old = ROAD_HTML.replace('October 20, 2026', 'June 2, 2026');
  assert.equal(m.parseMkwcRoad(old, Date.parse('2026-10-21T12:00:00Z')).isDefault, true);
  assert.equal(m.parseMkwcRoad(ROAD_HTML, Date.parse('2026-10-21T12:00:00Z')).isDefault, false);
});

test('a closed road message parses as closed', async () => {
  const m = await load();
  const r = m.parseMkwcRoad(ROAD_HTML.replace('Open (4-Wheel Drive Please)', 'Closed - snow and ice'), Date.parse('2026-12-20T12:00:00Z'));
  assert.equal(r.closed, true);
  assert.equal(r.open, false);
});

test('parseMkwcForecast reads issue time, text, seeing and precipitable water', async () => {
  const m = await load();
  const f = m.parseMkwcForecast(FORECAST_HTML, Date.parse('2026-10-21T08:00:00Z'));
  assert.equal(f.issuedIso, '2026-10-21T03:00:00.000Z');
  assert.equal(f.fresh, true);
  assert.equal(f.warningActive, false);
  assert.deepEqual(f.seeingArcsec, [0.45, 0.5]);
  assert.deepEqual(f.precipitableWaterMm, [1.5, 2]);
  assert.equal(f.signal, 'clear');
  const stale = m.parseMkwcForecast(FORECAST_HTML, Date.parse('2026-10-23T08:00:00Z'));
  assert.equal(stale.fresh, false);
});

test('forecastSignal reads fog and precipitation, and ignores negations', async () => {
  const m = await load();
  assert.equal(m.forecastSignal('Fog and precipitation are likely at the summit tonight.'), 'wet');
  assert.equal(m.forecastSignal('The summit will remain dry and stable.'), 'clear');
  assert.equal(m.forecastSignal('Dry and stable, with no fog expected.'), 'clear');
  assert.equal(m.forecastSignal(null), 'unknown');
});

function rows(over = {}, hours = 30, startIso = '2026-10-21T00:00:00Z') {
  const t0 = Date.parse(startIso);
  return Array.from({ length: hours }, (_, i) => ({
    ms: t0 + i * 3600000, rh600: 15, rh700: 40, temp600: 1, temp2m: 2, wind600: 8, wind10: 4, gust: 6, low: 0, mid: 0, high: 10, precip: 0, freezingM: 4800, ...over
  }));
}

test('judgeNight: dry calm night is GO / GO', async () => {
  const m = await load();
  const j = m.judgeNight(m.nightFor('2026-10-21'), rows());
  assert.equal(j.road, 'OPEN');
  assert.equal(j.sunset.call, 'GO');
  assert.equal(j.stars.call, 'GO');
});

test('judgeNight: saturated summit is NO_GO for both halves', async () => {
  const m = await load();
  const j = m.judgeNight(m.nightFor('2026-10-21'), rows({ rh600: 96, rh700: 97, mid: 90 }));
  assert.equal(j.sunset.call, 'NO_GO');
  assert.equal(j.stars.call, 'NO_GO');
});

test('judgeNight: 60 mph wind puts the road at risk and overrides clear air', async () => {
  const m = await load();
  const j = m.judgeNight(m.nightFor('2026-10-21'), rows({ wind600: 62 }));
  assert.equal(j.road, 'AT_RISK');
  assert.equal(j.sunset.call, 'NO_GO');
  assert.equal(j.stars.call, 'NO_GO');
});

test('judgeNight: precipitation with a low freezing level means snow risk', async () => {
  const m = await load();
  const j = m.judgeNight(m.nightFor('2026-12-20'), rows({ precip: 0.4, freezingM: 3900, rh600: 95 }, 30, '2026-12-21T00:00:00Z'));
  assert.equal(j.road, 'AT_RISK');
});

test('judgeNight: dry summit with a low cloud deck is flagged as an above-the-clouds sunset', async () => {
  const m = await load();
  const j = m.judgeNight(m.nightFor('2026-10-21'), rows({ low: 85 }));
  assert.equal(j.sunset.call, 'GO');
  assert.equal(j.sunset.seaOfClouds, true);
});

test('judgeNight: no model rows near sunset reports unavailable', async () => {
  const m = await load();
  assert.equal(m.judgeNight(m.nightFor('2026-10-21'), []).available, false);
});

test('decide: an official closed road overrides everything', async () => {
  const m = await load();
  const night = m.nightFor('2026-12-20');
  const d = m.decide({ night, judge: m.judgeNight(night, rows({}, 30, '2026-12-21T00:00:00Z')), road: { closed: true, status: 'Closed - ice' }, forecast: null, mode: 'tonight' });
  assert.equal(d.state, 'NO_GO');
});

test('decide: model says clear but the MKWC forecaster expects fog -> CHECK, not GO', async () => {
  const m = await load();
  const now = Date.parse('2026-10-21T08:00:00Z');
  const night = m.nightFor('2026-10-21');
  const forecast = m.parseMkwcForecast(FORECAST_HTML.replace('The summit will remain dry and stable, while patches of mid-level clouds may linger.', 'Fog and precipitation are likely at the summit.'), now);
  const d = m.decide({ night, judge: m.judgeNight(night, rows()), road: { open: true }, forecast, mode: 'tonight', now });
  assert.equal(d.state, 'CHECK');
  assert.equal(d.confidence, 'LOW');
});

test('decide: agreement with MKWC earns MODERATE, never HIGH (rules are unvalidated)', async () => {
  const m = await load();
  const now = Date.parse('2026-10-21T08:00:00Z');
  const night = m.nightFor('2026-10-21');
  const forecast = m.parseMkwcForecast(FORECAST_HTML, now);
  const d = m.decide({ night, judge: m.judgeNight(night, rows()), road: { open: true }, forecast, mode: 'tonight', now });
  assert.equal(d.state, 'GO');
  assert.equal(d.confidence, 'MODERATE');
  assert.equal(d.crossCheck, 'agree');
});

test('decide: planned nights are always LOW confidence', async () => {
  const m = await load();
  const night = m.nightFor('2026-10-24');
  const d = m.decide({ night, judge: m.judgeNight(night, rows({}, 60, '2026-10-24T00:00:00Z')), road: null, forecast: null, mode: 'planned' });
  assert.equal(d.confidence, 'LOW');
});

test('moonNote classifies dark, partial and moonlit nights', async () => {
  const m = await load();
  assert.equal(m.moonNote({ moonFreeMinutes: 400, moonIllumination: 0.2 }).level, 'DARK');
  assert.equal(m.moonNote({ moonFreeMinutes: 120, moonIllumination: 0.8 }).level, 'PARTIAL');
  assert.equal(m.moonNote({ moonFreeMinutes: 0, moonIllumination: 0.98 }).level, 'MOONLIT');
});

test('buildMaunaKea: beyond the model horizon returns TOO_FAR with exact astronomy', async () => {
  const m = await load();
  const now = Date.parse('2026-10-21T12:00:00Z');
  const p = await m.buildMaunaKea('2026-12-27', now, { road: async () => null, forecast: async () => null, gfs: async () => { throw new Error('should not be called'); } });
  assert.equal(p.decision.state, 'TOO_FAR');
  assert.equal(p.nights.length, 14);
  assert.ok(p.astronomy.sunsetIso);
});

test('buildMaunaKea: all sources down still returns astronomy and an UNCERTAIN call, not a crash', async () => {
  const m = await load();
  const now = Date.parse('2026-10-21T12:00:00Z');
  const boom = async () => { throw new Error('down'); };
  const p = await m.buildMaunaKea(undefined, now, { road: boom, forecast: boom, gfs: boom });
  assert.equal(p.decision.state, 'UNCERTAIN');
  assert.equal(p.sources.find((s) => s.id === 'gfs').ok, false);
  assert.ok(p.astronomy.sunsetIso);
});

test('buildMaunaKea: rejects past dates and bad formats with status 400', async () => {
  const m = await load();
  const now = Date.parse('2026-10-21T12:00:00Z');
  await assert.rejects(() => m.buildMaunaKea('2026-10-01', now, {}), (e) => e.status === 400);
  await assert.rejects(() => m.buildMaunaKea('10/21/2026', now, {}), (e) => e.status === 400);
});

test('API handler: always sends Vary: Origin and an allow-origin, and 400s a bad date', async () => {
  const handler = require('../api/mauna-kea.js');
  const headers = {};
  const res = { statusCode: 0, body: '', setHeader: (k, v) => { headers[k.toLowerCase()] = v; }, end(b) { this.body = b; } };
  await handler({ method: 'GET', headers: {}, url: '/api/mauna-kea?date=nope', query: { date: 'nope' } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(headers.vary, 'Origin');
  assert.equal(headers['access-control-allow-origin'], 'https://chrisizworski.com');
});

function hourly(startIso, hours) {
  const t0 = Date.parse(startIso);
  return Array.from({ length: hours }, (_, i) => ({ ms: t0 + i * 3600000, rh600: 15, rh700: 40, temp600: 1, temp2m: 2, wind600: 8, wind10: 4, gust: 6, low: 0, mid: 0, high: 10, precip: 0, freezingM: 4800 }));
}

test('currentNightKey: "tonight" changes at dawn, not at midnight', async () => {
  const m = await load();
  const k = (iso) => m.currentNightKey(Date.parse(iso));
  assert.equal(k('2026-10-22T13:00:00Z'), '2026-10-21'); // 3 a.m. HST: the night that began yesterday evening is still under way
  assert.equal(k('2026-10-22T16:30:00Z'), '2026-10-21'); // 6:30 a.m. HST, minutes after sunrise
  assert.equal(k('2026-10-22T20:00:00Z'), '2026-10-22'); // 10 a.m. HST: that night is over, next evening is tonight
  assert.equal(k('2026-10-23T01:00:00Z'), '2026-10-22'); // 3 p.m. HST
  assert.equal(k('2026-10-23T05:00:00Z'), '2026-10-22'); // 7 p.m. HST, after sunset
});

test('buildMaunaKea at 3 a.m. HST reports the night under way, not tomorrow evening', async () => {
  const m = await load();
  const now = Date.parse('2026-10-22T13:00:00Z');
  const p = await m.buildMaunaKea(undefined, now, { road: async () => null, forecast: async () => null, gfs: async () => hourly('2026-10-22T00:00:00Z', 24 * 9) });
  assert.equal(p.date, '2026-10-21');
  assert.equal(p.today, '2026-10-21');
  assert.equal(p.mode, 'tonight');
  assert.equal(p.phase, 'night');
  // and an evening that is already over is rejected, not shown
  await assert.rejects(() => m.buildMaunaKea('2026-10-20', now, {}), (e) => e.status === 400 && /already passed/.test(e.message));
});

test('the last selectable evening (six days out) is covered by the model, not reported as missing data', async () => {
  const m = await load();
  const now = Date.parse('2026-10-22T20:00:00Z'); // 10 a.m. HST Oct 22: tonight is Oct 22
  const six = '2026-10-28';
  const p = await m.buildMaunaKea(six, now, { road: async () => null, forecast: async () => null, gfs: async () => hourly('2026-10-22T00:00:00Z', 24 * 9) });
  assert.notEqual(p.decision.state, 'UNCERTAIN');
  assert.notEqual(p.decision.state, 'TOO_FAR');
  assert.ok(p.sunset && p.stars);
  const seven = await m.buildMaunaKea('2026-10-29', now, { road: async () => null, forecast: async () => null, gfs: async () => { throw new Error('not called'); } });
  assert.equal(seven.decision.state, 'TOO_FAR');
});

test('the model request asks for enough days to cover the last selectable evening', async () => {
  const m = await load();
  let url = '';
  const orig = global.fetch;
  global.fetch = async (u) => { url = String(u); return { ok: true, json: async () => ({ hourly: { time: ['2026-10-22T00:00'], relative_humidity_600hPa: [10] } }) }; };
  try { await m.fetchGfs(); } finally { global.fetch = orig; }
  assert.match(url, /forecast_days=9/);
});

test('summarizeNights finds the dark run and the moonlit run', async () => {
  const m = await load();
  const mk = (d, mins) => ({ date: d, moonFreeMinutes: mins, moonIllumination: 0.5 });
  const s = m.summarizeNights([mk('2026-12-23', 20), mk('2026-12-24', 0), mk('2026-12-25', 30), mk('2026-12-26', 120), mk('2026-12-27', 300), mk('2026-12-28', 360), mk('2026-12-29', 420), mk('2026-12-30', 100)]);
  assert.equal(s.best.from, '2026-12-27');
  assert.equal(s.best.to, '2026-12-29');
  assert.equal(s.best.label, 'Dec 27 to Dec 29');
  assert.equal(s.bright.from, '2026-12-23');
  assert.equal(s.bright.to, '2026-12-25');
  assert.equal(s.bestNight.date, '2026-12-29');
  assert.equal(m.summarizeNights([mk('2026-12-24', 0), mk('2026-12-25', 10)]).best, null);
});

test('a far-off date leads with the best nights for stars, not an error', async () => {
  const m = await load();
  const now = Date.parse('2026-10-22T20:00:00Z');
  const p = await m.buildMaunaKea('2026-12-27', now, { road: async () => null, forecast: async () => null, gfs: async () => { throw new Error('not called'); } });
  assert.equal(p.decision.state, 'TOO_FAR');
  assert.match(p.decision.label, /^Best nights for stars: /);
  assert.ok(p.planning.best);
  assert.ok(p.nights[0].date >= '2026-10-22', 'the window never starts in the past');
  assert.ok(p.nights.some((n) => n.date === '2026-12-27'), 'the picked night is inside the window');
});
