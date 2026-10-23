const test = require('node:test');
const assert = require('node:assert/strict');

let E;
test.before(async () => { E = await import('../lib/big-island-coast.mjs'); });

const SRF = `
Surf Zone Forecast for Hawaii
National Weather Service Honolulu HI
825 AM HST Thu Oct 22 2026

HIZ052>054-231930-
Big Island Windward and Southeast-
825 AM HST Thu Oct 22 2026

__________________________________________________________________
                       Today                     Friday

Shores                  Surf                       Surf     
                     AM     PM                  AM     PM 
__________________________________________________________________

North Facing         1-3    1-3                 1-3    1-3 
East Facing          3-5    2-4                 2-4    2-4 
South Facing         1-3    1-3                 1-3    1-3 
                                                                  

.REST OF TODAY...
Weather.....................Mostly cloudy.

$$

HIZ023-026-051-231930-
Big Island Leeward-
825 AM HST Thu Oct 22 2026

__________________________________________________________________
                       Today                     Friday

Shores                  Surf                       Surf     
                     AM     PM                  AM     PM 
__________________________________________________________________

West Facing          1-3    1-3                 1-3    6-10 
South Facing         1-3    1-3                 1-3    1-3 

.REST OF TODAY...
Weather.....................Mostly sunny.

$$
`;
const ISSUED = Date.parse('2026-10-22T18:25:00Z'); // 8:25 am HST

test('expandUgc expands ranges and lists', () => {
  assert.deepEqual(E.expandUgc('HIZ052>054-231930-'), ['HIZ052', 'HIZ053', 'HIZ054']);
  assert.deepEqual(E.expandUgc('HIZ023-026-051-231930-'), ['HIZ023', 'HIZ026', 'HIZ051']);
});

test('parseSrf reads both Big Island blocks and the four columns', () => {
  const blocks = E.parseSrf(SRF);
  assert.equal(blocks.length, 2);
  const leeward = blocks.find((b) => b.zones.includes('HIZ026'));
  assert.deepEqual(leeward.days, ['Today', 'Friday']);
  assert.deepEqual(leeward.rows.West, [[1, 3], [1, 3], [1, 3], [6, 10]]);
  assert.equal(leeward.rows.North, undefined, 'the leeward block has no north row');
});

test('srfFirstDate: Today column is the issue date in HST, unknown headers are not guessed', () => {
  assert.equal(E.srfFirstDate(ISSUED, ['Today', 'Friday']), '2026-10-22');
  assert.equal(E.srfFirstDate(ISSUED, ['Tonight', 'Friday']), null);
  assert.equal(E.srfFirstDate(ISSUED, ['Weird', 'Friday']), null);
});

test('issue date uses HST, not UTC (3 am UTC is the previous HST evening)', () => {
  assert.equal(E.hstYmd(Date.parse('2026-10-23T03:00:00Z')), '2026-10-22');
});

test('nwsForCoast maps columns to dates and picks the right facing', () => {
  const blocks = E.parseSrf(SRF);
  const kohala = E.COASTS.find((c) => c.id === 'kohala');
  const n = E.nwsForCoast(blocks, kohala, '2026-10-22');
  assert.deepEqual(n['2026-10-22'], { lowFt: 1, highFt: 3 });
  assert.deepEqual(n['2026-10-23'], { lowFt: 1, highFt: 10 });
  const hilo = E.COASTS.find((c) => c.id === 'hilo');
  assert.deepEqual(E.nwsForCoast(blocks, hilo, '2026-10-22')['2026-10-22'], { lowFt: 2, highFt: 5 });
  assert.equal(E.nwsForCoast(blocks, kohala, null), null);
});

test('primaryDay rolls to tomorrow at 5 pm HST and never shows a finished day', () => {
  assert.equal(E.primaryDay(Date.parse('2026-10-22T20:00:00Z')), '2026-10-22'); // 10 am HST
  assert.equal(E.primaryDay(Date.parse('2026-10-23T03:30:00Z')), '2026-10-23'); // 5:30 pm HST
  assert.equal(E.primaryDay(Date.parse('2026-10-23T09:00:00Z')), '2026-10-23'); // 11 pm HST
  assert.equal(E.primaryDay(Date.parse('2026-10-23T11:00:00Z')), '2026-10-23'); // 1 am HST Oct 23
});

test('parseSwanCsv and modelDay take the daytime peak and a percentile', () => {
  const lines = ['time,latitude[unit="degrees_north"],longitude[unit="degrees_east"],vertCoord[unit="meters"],shgt[unit="meters"],mper[unit="second"],pdir[unit="degrees"]'];
  for (let h = 18; h < 24; h++) lines.push(`2026-10-22T${h}:00:00Z,19.99,-155.83,0.0,${h === 21 ? 0.9 : 0.3},${h === 21 ? 14 : 9},300`);
  for (let h = 0; h < 4; h++) lines.push(`2026-10-23T0${h}:00:00Z,19.99,-155.83,0.0,0.3,9,300`);
  const rows = E.parseSwanCsv(lines.join('\n'));
  assert.equal(rows.length, 10);
  const m = E.modelDay('kohala', rows, '2026-10-22');
  assert.equal(m.peakM, 0.9);
  assert.equal(m.periodS, 14);
  assert.ok(m.percentile >= 0 && m.percentile <= 100);
  assert.equal(E.modelDay('kohala', rows.slice(0, 3), '2026-10-22'), null, 'a mostly missing day gives no reading');
});

test('percentileOf is monotonic in height', () => {
  const a = E.percentileOf('kohala', 0.05), b = E.percentileOf('kohala', 0.6), c = E.percentileOf('kohala', 4);
  assert.ok(a <= b && b <= c);
  assert.equal(E.percentileOf('nowhere', 1), null);
});

test('decide: an active High Surf Advisory is ROUGH whatever the sources say', () => {
  const d = E.decide({ alerts: [{ event: 'High Surf Advisory', severe: true }], nws: { lowFt: 1, highFt: 2 }, model: { peakM: 0.2, percentile: 10, maxPeriodS: 8, periodS: 8 } });
  assert.equal(d.state, 'ROUGH');
});

test('decide: the worst agreeing signal sets the call and confidence is capped', () => {
  const calm = E.decide({ nws: { lowFt: 1, highFt: 3 }, model: { peakM: 0.1, percentile: 30, maxPeriodS: 8, periodS: 8 } });
  assert.equal(calm.state, 'CALM'); assert.equal(calm.confidence, 'MODERATE');
  const mod = E.decide({ nws: { lowFt: 3, highFt: 5 }, model: { peakM: 0.2, percentile: 40, maxPeriodS: 8, periodS: 8 } });
  assert.equal(mod.state, 'MODERATE');
  const rough = E.decide({ nws: { lowFt: 6, highFt: 10 }, model: { peakM: 1.2, percentile: 95, maxPeriodS: 12, periodS: 12 } });
  assert.equal(rough.state, 'ROUGH');
});

test('decide: two steps apart is CHECK with LOW confidence', () => {
  const d = E.decide({ nws: { lowFt: 1, highFt: 2 }, model: { peakM: 1.5, percentile: 97, maxPeriodS: 10, periodS: 10 } });
  assert.equal(d.state, 'CHECK'); assert.equal(d.confidence, 'LOW');
});

test('decide: long-period swell and onshore chop lift a calm day to moderate', () => {
  const swell = E.decide({ nws: { lowFt: 1, highFt: 3 }, model: { peakM: 0.3, percentile: 65, maxPeriodS: 15, periodS: 15 } });
  assert.equal(swell.state, 'MODERATE');
  assert.ok(swell.reasons.some((r) => /Long-period/.test(r)));
  const chop = E.decide({ nws: { lowFt: 1, highFt: 3 }, model: { peakM: 0.1, percentile: 20, maxPeriodS: 8, periodS: 8 }, wind: { onshoreMph: 18, mph: 18, fromDeg: 270 } });
  assert.equal(chop.state, 'MODERATE');
  const calmWind = E.decide({ nws: { lowFt: 1, highFt: 3 }, model: { peakM: 0.1, percentile: 20, maxPeriodS: 8, periodS: 8 }, wind: { onshoreMph: -12, mph: 12, fromDeg: 90 } });
  assert.equal(calmWind.state, 'CALM', 'offshore wind does not downgrade');
});

test('decide: a single source gives LOW confidence and says so; no sources gives NO_DATA', () => {
  const one = E.decide({ model: { peakM: 0.1, percentile: 20, maxPeriodS: 8, periodS: 8 } });
  assert.equal(one.state, 'CALM'); assert.equal(one.confidence, 'LOW');
  assert.ok(one.reasons.some((r) => /No NWS forecast/.test(r)));
  assert.equal(E.decide({}).state, 'NO_DATA');
});

test('alertsForCoast matches the coast zone and the day, ignores other zones and other days', () => {
  const kohala = E.COASTS.find((c) => c.id === 'kohala');
  const feat = (zone, event, onset, ends) => ({ properties: { event, headline: event, onset, ends, geocode: { UGC: [zone] } } });
  const fs = [
    feat('HIZ026', 'High Surf Advisory', '2026-10-23T06:00:00Z', '2026-10-24T18:00:00Z'),
    feat('HIZ051', 'High Surf Warning', '2026-10-22T00:00:00Z', '2026-10-30T00:00:00Z'),
    feat('HIZ026', 'Red Flag Warning', '2026-10-22T00:00:00Z', '2026-10-30T00:00:00Z')
  ];
  assert.equal(E.alertsForCoast(fs, kohala, '2026-10-22').length, 0, 'starts after that day');
  assert.equal(E.alertsForCoast(fs, kohala, '2026-10-23').length, 1);
  assert.equal(E.alertsForCoast(fs, kohala, '2026-10-23')[0].severe, true);
});

test('windDay: onshore component is positive when the wind blows toward the shore', () => {
  const kohala = E.COASTS.find((c) => c.id === 'kohala'); // faces 265, so wind FROM 265 is onshore
  const rows = [];
  for (let h = 18; h < 24; h++) rows.push({ ms: Date.parse(`2026-10-22T${h}:00:00Z`), mph: 20, dir: 265 });
  for (let h = 0; h < 4; h++) rows.push({ ms: Date.parse(`2026-10-23T0${h}:00:00Z`), mph: 20, dir: 265 });
  assert.equal(E.windDay(kohala, rows, '2026-10-22').onshoreMph, 20);
  const off = rows.map((r) => ({ ...r, dir: 85 }));
  assert.ok(E.windDay(kohala, off, '2026-10-22').onshoreMph < 0);
});

test('buildBeachDay: all sources down returns NO_DATA for every coast, not a crash', async () => {
  const boom = () => Promise.reject(new Error('down'));
  const p = await E.buildBeachDay(Date.parse('2026-10-22T20:00:00Z'), { srf: boom, alerts: boom, swan: boom, wind: boom });
  assert.equal(p.ok, true);
  assert.equal(p.days.length, 4);
  assert.ok(p.days[0].coasts.every((c) => c.decision.state === 'NO_DATA'));
  assert.match(p.days[0].headline, /No source/);
  assert.equal(p.validated, false);
});

test('buildBeachDay: end to end with fixtures ranks the calm coast first and dates the NWS columns', async () => {
  const swanFor = (hs, per) => {
    const rows = [];
    for (let h = 0; h < 24 * 5; h++) rows.push({ ms: Date.parse('2026-10-22T10:00:00Z') + h * 3600000, hs, per, dir: 280 });
    return rows;
  };
  const p = await E.buildBeachDay(ISSUED + 3600000, {
    srf: async () => ({ text: SRF, issuedMs: ISSUED, ageHours: 1 }),
    alerts: async () => ({ features: [] }),
    swan: async (c) => swanFor(c.id === 'hilo' ? 2.0 : 0.1, 9),
    wind: async () => Array.from({ length: 120 }, (_, h) => ({ ms: Date.parse('2026-10-22T10:00:00Z') + h * 3600000, mph: 5, dir: 90 }))
  });
  const today = p.days[0];
  assert.equal(today.date, '2026-10-22');
  assert.equal(today.nwsCovered, true);
  assert.notEqual(today.coasts[0].id, 'hilo');
  const hilo = today.coasts.find((c) => c.id === 'hilo');
  assert.ok(['ROUGH', 'CHECK'].includes(hilo.decision.state));
  const tomorrowKohala = p.days[1].coasts.find((c) => c.id === 'kohala');
  assert.equal(tomorrowKohala.nws.highFt, 10, 'the Friday column lands on Oct 23');
  assert.equal(p.days[3].nwsCovered, false, 'day four is model only');
});

test('buildBeachDay: a stale forecast (over 36 h) is not used', async () => {
  const p = await E.buildBeachDay(ISSUED + 40 * 3600000, {
    srf: async () => ({ text: SRF, issuedMs: ISSUED, ageHours: 40 }),
    alerts: async () => ({ features: [] }),
    swan: async () => { throw new Error('x'); },
    wind: async () => { throw new Error('x'); }
  });
  assert.ok(p.days[0].coasts.every((c) => c.nws == null));
  assert.equal(p.sources[0].ok, false);
});

test('API handler sets CORS, Vary and cache headers and returns 502 JSON when the engine fails', async () => {
  const handler = require('../api/big-island-beach-day.js');
  const headers = {};
  const res = { setHeader: (k, v) => { headers[k] = v; }, end: (b) => { res.body = b; }, statusCode: 0 };
  const orig = global.fetch;
  global.fetch = async () => { throw new Error('offline'); };
  try { await handler({ headers: {}, method: 'GET', url: '/api/big-island-beach-day' }, res); } finally { global.fetch = orig; }
  assert.equal(headers.Vary, 'Origin');
  assert.equal(headers['Access-Control-Allow-Origin'], 'https://chrisizworski.com');
  assert.match(headers['Content-Type'], /json/);
  assert.ok([200, 502].includes(res.statusCode));
  JSON.parse(res.body);
  const opt = { setHeader() {}, end() {}, statusCode: 0 };
  await handler({ headers: { origin: 'https://www.chrisizworski.com' }, method: 'OPTIONS', url: '/' }, opt);
  assert.equal(opt.statusCode, 204);
});

test('fetchSwan retries a stalled 503 and sends no custom User-Agent (the host rejects one)', async () => {
  const coast = E.COASTS[0];
  const seen = [];
  const orig = global.fetch;
  const csv = 'time,latitude[unit="degrees_north"],longitude[unit="degrees_east"],vertCoord[unit="meters"],shgt[unit="meters"],mper[unit="second"],pdir[unit="degrees"]\n2026-10-23T18:00:00Z,19.99,-155.83,0.0,0.5,10,300\n';
  global.fetch = async (url, opts) => {
    seen.push(opts.headers);
    return seen.length === 1 ? { ok: false, status: 503 } : { ok: true, status: 200, text: async () => csv };
  };
  try {
    const rows = await E.fetchSwan(coast, Date.parse('2026-10-23T18:00:00Z'), Date.parse('2026-10-24T04:00:00Z'));
    assert.equal(rows.length, 1);
    assert.equal(seen.length, 2, 'one retry after the 503');
    assert.ok(seen.every((h) => !('User-Agent' in h)), 'no custom User-Agent to the wave host');
  } finally { global.fetch = orig; }
});

test('payload carries each coast\'s own record for the percentile ruler', async () => {
  const p = await E.buildBeachDay(Date.parse('2026-10-22T20:00:00Z'), { srf: () => Promise.reject(new Error('x')), alerts: () => Promise.reject(new Error('x')), swan: () => Promise.reject(new Error('x')), wind: () => Promise.reject(new Error('x')) });
  for (const c of p.days[0].coasts) {
    assert.ok(c.record && c.record.p50 <= c.record.p70 && c.record.p70 <= c.record.p90 && c.record.p90 <= c.record.p99, c.id);
  }
});
