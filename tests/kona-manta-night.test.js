const test = require('node:test');
const assert = require('node:assert/strict');

let E;
test.before(async () => { E = await import('../lib/kona-manta-night.mjs'); });

const SRF = `
HIZ023-026-051-231930-
Big Island Leeward-
825 AM HST Thu Oct 22 2026

__________________________________________________________________
                       Today                     Friday

Shores                  Surf                       Surf     
                     AM     PM                  AM     PM 
__________________________________________________________________

West Facing          1-3    1-3                 2-4    6-9 
South Facing         1-3    1-3                 1-3    1-3 

.REST OF TODAY...
Weather.....................Mostly sunny.

$$
`;
const ISSUED = Date.parse('2026-10-22T18:25:00Z');
const hours = (ymd, h0, h1, f) => { const out = []; const mid = Date.parse(`${ymd}T00:00:00Z`) + 10 * 3600000; for (let h = h0; h < h1; h++) out.push({ ms: mid + h * 3600000, ...f(h) }); return out; };

test('evening window is 6 to 9 p.m. HST and rolls to tomorrow at 9 p.m., never a finished night', () => {
  const [a, b] = E.eveningWindow('2026-10-22');
  assert.equal(new Date(a).toISOString(), '2026-10-23T04:00:00.000Z');
  assert.equal(new Date(b).toISOString(), '2026-10-23T07:00:00.000Z');
  assert.equal(E.primaryNight(Date.parse('2026-10-23T05:00:00Z')), '2026-10-22'); // 7 pm HST
  assert.equal(E.primaryNight(Date.parse('2026-10-23T07:30:00Z')), '2026-10-23'); // 9:30 pm HST
  assert.equal(E.primaryNight(Date.parse('2026-10-22T20:00:00Z')), '2026-10-22'); // 10 am HST
});

test('percentile is monotonic and unknown sites return null', () => {
  const a = E.percentileOf('manta-village', 0.02), b = E.percentileOf('manta-village', 0.5), c = E.percentileOf('manta-village', 5);
  assert.ok(a <= b && b <= c);
  assert.equal(E.percentileOf('nowhere', 1), null);
});

test('seaNight takes the window peak, and a mostly missing window gives no reading', () => {
  const rows = hours('2026-10-22', 18, 21, (h) => ({ hs: h === 19 ? 1.2 : 0.3, per: h === 19 ? 15 : 8, dir: 300 }));
  const s = E.seaNight('garden-eel-cove', rows, '2026-10-22');
  assert.equal(s.peakM, 1.2); assert.equal(s.periodS, 15); assert.equal(s.maxPeriodS, 15);
  assert.equal(E.seaNight('garden-eel-cove', rows.slice(0, 1), '2026-10-22'), null);
  // hours outside the window are ignored
  const wide = hours('2026-10-22', 10, 17, () => ({ hs: 5, per: 10, dir: 300 }));
  assert.equal(E.seaNight('garden-eel-cove', wide, '2026-10-22'), null);
});

test('weatherNight: onshore wind component, window rain, and prior-24h runoff', () => {
  const site = E.SITES[0]; // faces 260
  const rows = [
    ...hours('2026-10-21', 18, 24, () => ({ mph: 5, dir: 90, mm: 2 })), // 6 h x 2 mm before the window
    ...hours('2026-10-22', 0, 18, () => ({ mph: 5, dir: 90, mm: 0.5 })),
    ...hours('2026-10-22', 18, 21, () => ({ mph: 20, dir: 260, mm: 0.2 }))
  ];
  const w = E.weatherNight(site, rows, '2026-10-22');
  assert.equal(w.wind.onshoreMph, 20);
  assert.equal(w.rainWindowMm, 0.6);
  assert.ok(w.rainPrior24Mm >= 12, `runoff sum ${w.rainPrior24Mm}`);
  const off = E.weatherNight(site, hours('2026-10-22', 18, 21, () => ({ mph: 20, dir: 80, mm: 0 })), '2026-10-22');
  assert.ok(off.wind.onshoreMph < 0);
});

test('alertsForSite: Kona zone and evening window only', () => {
  const f = (zone, event, onset, ends) => ({ properties: { event, onset, ends, geocode: { UGC: [zone] } } });
  const fs = [f('HIZ023', 'High Surf Advisory', '2026-10-23T08:00:00Z', '2026-10-24T18:00:00Z'), f('HIZ053', 'High Surf Warning', '2026-10-22T00:00:00Z', '2026-10-30T00:00:00Z'), f('HIZ023', 'Red Flag Warning', '2026-10-22T00:00:00Z', '2026-10-30T00:00:00Z')];
  assert.equal(E.alertsForSite(fs, '2026-10-22').length, 0, 'the advisory starts after the 6-9 pm window of Oct 22 HST');
  const d23 = E.alertsForSite(fs, '2026-10-23');
  assert.equal(d23.length, 1); assert.equal(d23[0].severe, true);
});

test('decide: advisory is ROUGH; calm everything is GOOD; capped confidence', () => {
  assert.equal(E.decide({ alerts: [{ event: 'High Surf Advisory', severe: true }] }).state, 'ROUGH');
  const good = E.decide({ nws: { lowFt: 1, highFt: 3 }, sea: { peakM: 0.1, percentile: 20, maxPeriodS: 8, periodS: 8 }, weather: { wind: { onshoreMph: 3 }, rainWindowMm: 0, rainPrior24Mm: 0 } });
  assert.equal(good.state, 'GOOD'); assert.equal(good.confidence, 'MODERATE');
});

test('decide: wind, rain, runoff and long swell each lift a calm night', () => {
  const base = { nws: { lowFt: 1, highFt: 3 }, sea: { peakM: 0.1, percentile: 20, maxPeriodS: 8, periodS: 8 } };
  assert.equal(E.decide({ ...base, weather: { wind: { onshoreMph: 18 }, rainWindowMm: 0, rainPrior24Mm: 0 } }).state, 'WATCH');
  assert.equal(E.decide({ ...base, weather: { wind: { onshoreMph: 30 }, rainWindowMm: 0, rainPrior24Mm: 0 } }).state, 'ROUGH');
  assert.equal(E.decide({ ...base, weather: { wind: { onshoreMph: 2 }, rainWindowMm: 1, rainPrior24Mm: 0 } }).state, 'WATCH');
  assert.equal(E.decide({ ...base, weather: { wind: { onshoreMph: 2 }, rainWindowMm: 6, rainPrior24Mm: 0 } }).state, 'ROUGH');
  const runoff = E.decide({ ...base, weather: { wind: { onshoreMph: 2 }, rainWindowMm: 0, rainPrior24Mm: 14 } });
  assert.equal(runoff.state, 'WATCH'); assert.ok(runoff.reasons.some((r) => /runoff/.test(r)));
  const swell = E.decide({ nws: { lowFt: 1, highFt: 3 }, sea: { peakM: 0.5, percentile: 65, maxPeriodS: 15, periodS: 15 } });
  assert.equal(swell.state, 'WATCH');
  assert.equal(E.decide({ ...base, weather: { wind: { onshoreMph: -12 }, rainWindowMm: 0, rainPrior24Mm: 0 } }).state, 'GOOD', 'offshore wind does not downgrade');
});

test('decide: forecast and model two steps apart is CHECK; one source is LOW confidence; nothing is NO_DATA', () => {
  const d = E.decide({ nws: { lowFt: 1, highFt: 2 }, sea: { peakM: 1.5, percentile: 97, maxPeriodS: 10, periodS: 10 } });
  assert.equal(d.state, 'CHECK'); assert.equal(d.confidence, 'LOW');
  const one = E.decide({ sea: { peakM: 0.1, percentile: 20, maxPeriodS: 8, periodS: 8 } });
  assert.equal(one.state, 'GOOD'); assert.equal(one.confidence, 'LOW');
  assert.equal(E.decide({}).state, 'NO_DATA');
});

test('buildMantaNight with every source down returns NO_DATA, not a crash', async () => {
  const boom = () => Promise.reject(new Error('down'));
  const p = await E.buildMantaNight(Date.parse('2026-10-22T20:00:00Z'), { srf: boom, alerts: boom, sea: boom, wx: boom });
  assert.equal(p.ok, true); assert.equal(p.nights.length, 4);
  assert.ok(p.nights[0].sites.every((s) => s.decision.state === 'NO_DATA'));
  assert.match(p.headline, /No source/);
  assert.equal(p.validated, false);
});

test('buildMantaNight end to end: picks the calmest night, ranks sites, maps NWS columns to dates', async () => {
  const sea = (site) => {
    const rows = [];
    for (const ymd of ['2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25']) rows.push(...hours(ymd, 17, 22, () => ({ hs: ymd === '2026-10-24' ? 0.05 : 0.5, per: 9, dir: 290 })));
    return rows;
  };
  const wx = () => {
    const rows = [];
    for (const ymd of ['2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25']) rows.push(...hours(ymd, 0, 24, () => ({ mph: 4, dir: 90, mm: 0 })));
    return rows;
  };
  const p = await E.buildMantaNight(ISSUED + 3600000, {
    srf: async () => ({ text: SRF, issuedMs: ISSUED, ageHours: 1 }),
    alerts: async () => ({ features: [] }), sea, wx
  });
  assert.equal(p.nights[0].date, '2026-10-22');
  assert.equal(p.nights[1].sites[0].nws.highFt, 9, 'Friday column lands on Oct 23');
  assert.equal(p.nights[2].nwsCovered, false);
  assert.match(p.headline, /Oct 24|Saturday/);
  assert.ok(p.nights.every((n) => n.sites.length === 2));
});

test('buildMantaNight: a stale NWS forecast is not used', async () => {
  const p = await E.buildMantaNight(ISSUED + 40 * 3600000, { srf: async () => ({ text: SRF, issuedMs: ISSUED, ageHours: 40 }), alerts: async () => ({ features: [] }), sea: async () => { throw new Error('x'); }, wx: async () => { throw new Error('x'); } });
  assert.ok(p.nights[0].sites.every((s) => s.nws == null));
  assert.equal(p.sources[0].ok, false);
});

test('API handler: CORS, Vary, JSON, 204 on OPTIONS', async () => {
  const handler = require('../api/kona-manta-ray-night.js');
  const headers = {}; const res = { setHeader: (k, v) => { headers[k] = v; }, end: (b) => { res.body = b; }, statusCode: 0 };
  const orig = global.fetch; global.fetch = async () => { throw new Error('offline'); };
  try { await handler({ headers: {}, method: 'GET', url: '/api/kona-manta-ray-night' }, res); } finally { global.fetch = orig; }
  assert.equal(headers.Vary, 'Origin');
  assert.equal(headers['Access-Control-Allow-Origin'], 'https://chrisizworski.com');
  assert.match(headers['Content-Type'], /json/);
  JSON.parse(res.body);
  const opt = { setHeader() {}, end() {}, statusCode: 0 };
  await handler({ headers: { origin: 'https://www.chrisizworski.com' }, method: 'OPTIONS', url: '/' }, opt);
  assert.equal(opt.statusCode, 204);
});

test('a rare-for-this-site but still small sea is not called moderate or rough (absolute floors)', () => {
  const small = E.decide({ nws: { lowFt: 1, highFt: 3 }, sea: { peakM: 0.3, percentile: 95, maxPeriodS: 8, periodS: 8 } });
  assert.equal(small.state, 'GOOD');
  assert.equal(E.decide({ sea: { peakM: 0.5, percentile: 80, maxPeriodS: 8, periodS: 8 } }).state, 'WATCH');
  assert.equal(E.decide({ sea: { peakM: 0.9, percentile: 95, maxPeriodS: 8, periodS: 8 } }).state, 'ROUGH');
  assert.equal(E.decide({ sea: { peakM: 0.3, percentile: 80, maxPeriodS: 16, periodS: 16 } }).state, 'GOOD', 'long-period nudge also needs a real height');
});
