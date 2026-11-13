const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
let E, M;
test.before(async () => { E = await import('../lib/big-island-coast.mjs'); M = await import('../lib/kona-manta-night.mjs'); });
const morning = fs.readFileSync('tests/fixtures/hawaii/srf-2026-11-12-morning.txt', 'utf8');
const afternoon = fs.readFileSync('tests/fixtures/hawaii/srf-2026-11-12-afternoon.txt', 'utf8');
const amIssue = Date.parse('2026-11-12T18:48:00Z');
const pmIssue = Date.parse('2026-11-13T01:44:00Z');
const west = { zone: 'HIZ023', nwsFacing: 'West' };
const quiet = { alerts: async () => ({ features: [] }), swan: async () => null, wind: async () => null, sea: async () => null, wx: async () => null };
const srf = (text, issuedMs) => async () => ({ text, issuedMs, ageHours: 0 });

test('recorded morning table maps both daytime pairs, explicitly labeled as day context', () => {
  const out = E.nwsForCoastAtIssue(E.parseSrf(morning), west, amIssue);
  assert.deepEqual(out, {
    '2026-11-12': { lowFt: 3, highFt: 6, period: 'day' },
    '2026-11-13': { lowFt: 2, highFt: 5, period: 'day' }
  });
});
test('recorded afternoon table retains Friday daytime without treating Tonight as a beach day', () => {
  const blocks = E.parseSrf(afternoon);
  assert.deepEqual(blocks[0].periods, ['PM', 'AM', 'AM', 'PM']);
  const out = E.nwsForCoastAtIssue(blocks, west, pmIssue);
  assert.equal(out['2026-11-12'], undefined);
  assert.deepEqual(out['2026-11-13'], { lowFt: 3, highFt: 5, period: 'day' });
});
test('manta keeps the overnight pair on the HST evening date, not its UTC issue date', () => {
  const out = E.nwsForCoastAtIssue(E.parseSrf(afternoon), west, pmIssue, true);
  assert.deepEqual(out['2026-11-12'], { lowFt: 4, highFt: 6, period: 'night' });
  assert.deepEqual(out['2026-11-13'], { lowFt: 3, highFt: 5, period: 'day' });
});
test('each coast dates its own table rather than borrowing the first island header', () => {
  const blocks = E.parseSrf(afternoon);
  blocks[0].days = ['unrecognized', 'Thursday'];
  assert.equal(E.nwsForCoastAtIssue(blocks, west, pmIssue)['2026-11-13'].highFt, 5);
  assert.equal(E.nwsForCoastAtIssue(blocks, { zone: 'HIZ052', nwsFacing: 'East' }, pmIssue), null);
});
for (const mutate of [b => b.days[1] = 'Monday', b => b.periods[0] = 'AM', b => b.days[0] = 'Unknown']) {
  test('ambiguous day/period headers are rejected without shifting the surf values', () => {
    const blocks = E.parseSrf(afternoon); mutate(blocks[1]);
    assert.equal(E.nwsForCoastAtIssue(blocks, west, pmIssue, true), null);
  });
}
test('a missing or reversed half-period cannot silently lower the daily maximum', () => {
  for (const value of [null, [8, 3], [-1, 3], [1, NaN]]) {
    const blocks = E.parseSrf(afternoon); blocks[1].rows.West[3] = value;
    const out = E.nwsForCoastAtIssue(blocks, west, pmIssue, true);
    assert.equal(out['2026-11-13'], undefined);
    assert.equal(out['2026-11-12'].highFt, 6);
  }
});
test('a named first day must be today or tomorrow, including across year end', () => {
  const blocks = E.parseSrf(morning);
  blocks[1].days = ['Friday', 'Saturday'];
  assert.ok(E.nwsForCoastAtIssue(blocks, west, Date.parse('2026-12-31T23:00:00Z'))['2027-01-01']);
  blocks[1].days = ['Sunday', 'Monday'];
  assert.equal(E.nwsForCoastAtIssue(blocks, west, amIssue), null);
});
test('both engines recover the recorded afternoon NWS data and report actual use', async () => {
  const now = Date.parse('2026-11-13T04:00:00Z'); // 6 p.m. Nov 12 HST
  const deps = { ...quiet, srf: srf(afternoon, pmIssue) };
  const beach = await E.buildBeachDay(now, deps), manta = await M.buildMantaNight(now, deps);
  assert.equal(beach.primary, '2026-11-13');
  assert.equal(beach.days[0].coasts.find(c => c.id === 'kona').nws.highFt, 5);
  assert.equal(beach.sources[0].ok, true);
  assert.equal(manta.primary, '2026-11-12');
  assert.equal(manta.nights[0].sites[0].nws.highFt, 6);
  assert.equal(manta.nights[0].sites[0].nws.period, 'night');
  assert.equal(manta.sources[0].ok, true);
});
for (const issuedMs of [NaN, amIssue + 3600000, amIssue - 37 * 3600000]) {
  test('both engines reject invalid, future or stale issue time even if ageHours says zero', async () => {
    const deps = { ...quiet, srf: srf(morning, issuedMs) };
    const beach = await E.buildBeachDay(amIssue, deps), manta = await M.buildMantaNight(amIssue, deps);
    assert.equal(beach.sources[0].ok, false); assert.equal(manta.sources[0].ok, false);
    assert.ok(beach.days.every(d => d.coasts.every(c => c.nws === null)));
    assert.ok(manta.nights.every(n => n.sites.every(s => s.nws === null)));
    assert.ok(beach.sources[0].note);
  });
}
test('a fresh but unparseable bulletin is not reported as a usable source', async () => {
  const deps = { ...quiet, srf: srf('unrecognized bulletin', amIssue) };
  const beach = await E.buildBeachDay(amIssue, deps), manta = await M.buildMantaNight(amIssue, deps);
  for (const p of [beach, manta]) {
    assert.equal(p.sources[0].ok, false);
    assert.match(p.sources[0].note, /could be matched/);
    assert.equal(p.sources[0].asOf, '2026-11-12T18:48:00.000Z');
  }
});
