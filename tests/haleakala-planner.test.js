const test = require('node:test');
const assert = require('node:assert/strict');

const load = () => import('../lib/haleakala-planner.mjs');
const core = () => import('../lib/haleakala-sunrise-production.mjs');

test('reservation release: Dec 25 opens Oct 26 7:00 a.m. HST (60 days) and Dec 23 (2 days)', async () => {
  const { reservationRelease } = await load();
  const r = reservationRelease('2026-12-25', Date.parse('2026-10-21T11:00:00Z'));
  assert.equal(r.sixtyDay.iso, '2026-10-26T17:00:00.000Z');
  assert.equal(r.twoDay.iso, '2026-12-23T17:00:00.000Z');
  assert.equal(r.status, 'sixty-day-not-open');
  assert.equal(r.sixtyDay.daysAway, 6);
});

test('reservation release status moves through its phases', async () => {
  const { reservationRelease } = await load();
  const d = '2026-12-25';
  assert.equal(reservationRelease(d, Date.parse('2026-10-27T00:00:00Z')).status, 'sixty-day-open');
  assert.equal(reservationRelease(d, Date.parse('2026-12-23T18:00:00Z')).status, 'two-day-open');
  assert.equal(reservationRelease(d, Date.parse('2026-12-25T20:00:00Z')).status, 'past');
});

test('release dates cross month and year boundaries correctly', async () => {
  const { reservationRelease } = await load();
  assert.equal(reservationRelease('2027-01-01', 0).sixtyDay.iso, '2026-11-02T17:00:00.000Z');
  assert.equal(reservationRelease('2027-03-01', 0).twoDay.iso, '2027-02-27T17:00:00.000Z');
});

test('outlook never says FAVORABLE and always labels itself low-confidence and unvalidated', async () => {
  const { outlookFor } = await load();
  const dry = outlookFor({ row: { rh700: 10, rh600: 20 } }, 40);
  assert.equal(dry.lean, 'clearer'); assert.equal(dry.confidence, 'LOW'); assert.equal(dry.validated, false);
  assert.doesNotMatch(JSON.stringify(dry), /FAVORABLE/);
  assert.equal(outlookFor({ row: { rh700: 90, rh600: 80 } }, 40).lean, 'cloudier');
  assert.equal(outlookFor({ row: { rh700: 50, rh600: 50 } }, 40).lean, 'toss-up');
  assert.equal(outlookFor(null, 40).lean, 'unknown');
  assert.equal(outlookFor({ row: { rh700: 10, rh600: 20 } }, 10).tier, 'near');
  assert.equal(outlookFor({ row: { rh700: 10, rh600: 20 } }, 120).tier, 'far');
});

test('a date beyond the forecast horizon returns TOO_FAR with reservation and climate, no weather call', async () => {
  const { buildHaleakalaMorning } = await load();
  const now = Date.parse('2026-10-21T12:00:00Z');
  const p = await buildHaleakalaMorning('2026-12-25', now);
  assert.equal(p.decision.state, 'TOO_FAR');
  assert.equal(p.outlook, null);
  assert.equal(p.reservation.sixtyDay.iso, '2026-10-26T17:00:00.000Z');
  assert.equal(p.astronomy.sunriseLabel.includes('Dec 25'), true);
});

test('past dates and bad dates are rejected', async () => {
  const { buildHaleakalaMorning } = await load();
  const now = Date.parse('2026-10-21T12:00:00Z');
  await assert.rejects(buildHaleakalaMorning('2026-10-01', now), /already happened/);
  await assert.rejects(buildHaleakalaMorning('2026-02-30', now), /calendar date/);
  await assert.rejects(buildHaleakalaMorning('2028-01-01', now), /within the next year/);
});

test('climate base rate: every month present, shares add to 100, missing days disclosed', async () => {
  const { climateForMonth } = await load();
  for (let m = 1; m <= 12; m++) {
    const c = climateForMonth(m);
    assert.ok(c, `month ${m}`);
    assert.equal(c.dryPct + c.midPct + c.moistPct, 100);
    assert.ok(c.days >= 30, `month ${m} has too little data`);
    assert.ok(Number.isInteger(c.noData) && c.noData >= 0);
    assert.equal(c.proxy, true);
  }
});

test('summit humidity at 85% or more now reads as moist; 82% does not', async () => {
  const { summitSignal } = await core();
  const at = (rh) => summitSignal({ humidity: { current: rh, slopePerHour: 0, observedAt: '2026-10-01T16:00:00Z' } }, Date.parse('2026-10-01T16:10:00Z')).kind;
  assert.equal(at(86.4), 'moist'); assert.equal(at(85), 'moist'); assert.equal(at(81.7), 'mixed'); assert.equal(at(54), 'dry');
});

test('weakly dry forecast plus a dry fresh summit now supports FAVORABLE at MODERATE confidence', async () => {
  const { classifyHaleakalaEvidence } = await core();
  const now = Date.parse('2026-10-21T11:15:00Z');
  const r = classifyHaleakalaEvidence({
    sunriseIso: '2026-10-21T16:22:00Z',
    gfs: { row: { rh850: 94, rh700: 21, rh600: 10 } },
    lco: { humidity: { current: 14.6, slopePerHour: 1, observedAt: '2026-10-21T11:10:00Z' } }
  }, now);
  assert.equal(r.state, 'FAVORABLE');
  assert.equal(r.confidence, 'MODERATE');
});

test('ground-truth set: no clear morning is called moist and every wet one that has a reading is', async () => {
  const gt = require('../benchmarks/haleakala/ground-truth.json');
  const { summitSignal } = await core();
  for (const d of gt.days.filter((x) => x.rh != null)) {
    const k = summitSignal({ humidity: { current: d.rh, slopePerHour: 0, observedAt: '2026-10-01T16:00:00Z' } }, Date.parse('2026-10-01T16:10:00Z')).kind;
    if (d.label === 'clear') assert.notEqual(k, 'moist', d.date); else assert.equal(k, 'moist', d.date);
  }
});
