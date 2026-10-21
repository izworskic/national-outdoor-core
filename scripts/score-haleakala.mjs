#!/usr/bin/env node
// Value function for the Haleakala sunrise tool. Score = persona-weighted sum of capability scores (0..1) x 100.
// Capability checks are static and reproducible: they read the generated page and client script.
// first-screen-px = top of the verdict on a 390x844 phone with the network ad slot excluded (the hub injects a ~390px ad above it).
// Usage: node scripts/score-haleakala.mjs [--label baseline] [--live-ok 1] [--first-screen-px N] [--write]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { summitSignal } from '../lib/haleakala-sunrise-production.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1] ?? true); };
const page = fs.readFileSync(path.join(root, 'public/national-tools/haleakala-sunrise/index.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'public/assets/haleakala-sunrise.js'), 'utf8');
const all = page + '\n' + js;
const has = (re) => re.test(all);

// ---- accuracy against labeled mornings (summit-humidity rule only; GFS history not available) ----
const gt = JSON.parse(fs.readFileSync(path.join(root, 'benchmarks/haleakala/ground-truth.json'), 'utf8'));
function accuracy() {
  let pts = 0, wrong = 0, abstain = 0;
  for (const d of gt.days) {
    const clear = d.label === 'clear';
    let call = 'abstain';
    if (d.rh != null) {
      const s = summitSignal({ humidity: { current: d.rh, slopePerHour: 0, observedAt: '2026-10-01T16:00:00Z' } }, Date.parse('2026-10-01T16:15:00Z'));
      if (s.kind === 'dry') call = 'clear'; else if (s.kind === 'moist') call = 'notclear';
    }
    if (call === 'abstain') { pts += 0.5; abstain++; }
    else if ((call === 'clear') === clear) pts += 1; else wrong++;
  }
  return { score: pts / gt.days.length, wrong, abstain, n: gt.days.length };
}

// ---- capabilities: 0..1 ----
const acc = accuracy();
const cap = {
  live_data_healthy: Number(arg('live-ok', 1)),               // 0 before PR #29
  decision_accuracy: acc.score,
  honest_degraded: has(/UNCERTAIN/) && has(/abstain/i) ? 1 : 0,
  pick_morning: has(/id="hs-morning"/) ? 1 : 0,
  outlook_lead_honesty: has(/Leaning clearer at the summit/) && has(/no lean either way/i) ? 1 : 0,
  reservation_rules: (has(/60 days ahead/) ? 0.5 : 0) + (has(/one sunrise reservation per 3-day period/) ? 0.5 : 0),
  reservation_calendar: has(/id="hs-release"/) ? 1 : 0,       // exact release date/time for a chosen morning
  fallback_if_cloudy: has(/id="hs-fallback"/) ? 1 : (has(/Leleiwi/) ? 0.4 : 0),
  gear_and_body: has(/Dress for winter/) && has(/Expect thin air/) ? 1 : 0,
  morning_timeline: has(/Summit entry window opens/) ? 1 : 0,
  logistics_arrival: (has(/parking/i) ? 0.5 : 0) + (has(/30 minutes/) ? 0.5 : 0),
  base_rate_for_month: has(/id="hs-climate"/) ? 1 : 0,
  verdict_first_screen: Math.max(0, Math.min(1, (844 - Number(arg('first-screen-px', 900))) / 844 * 2)) // verdict card top within upper half of a 390x844 phone = 1
};

const personas = {
  trip_planner_months_out:   { w: .22, c: { pick_morning: 2, outlook_lead_honesty: 1, reservation_calendar: 3, reservation_rules: 1, base_rate_for_month: 3, fallback_if_cloudy: 1, gear_and_body: 1 } },
  tomorrow_decider:          { w: .20, c: { live_data_healthy: 2, decision_accuracy: 2, outlook_lead_honesty: 2, pick_morning: 2, fallback_if_cloudy: 1, honest_degraded: 1 } },
  one_am_go_no_go:           { w: .20, c: { live_data_healthy: 3, decision_accuracy: 3, honest_degraded: 1, verdict_first_screen: 2, fallback_if_cloudy: 2, morning_timeline: 1 } },
  no_reservation_visitor:    { w: .12, c: { reservation_rules: 2, reservation_calendar: 3, fallback_if_cloudy: 2, logistics_arrival: 1 } },
  family_or_older_visitor:   { w: .13, c: { gear_and_body: 3, logistics_arrival: 2, morning_timeline: 2, fallback_if_cloudy: 1 } },
  photographer:              { w: .13, c: { decision_accuracy: 2, live_data_healthy: 2, morning_timeline: 1, outlook_lead_honesty: 1, pick_morning: 1 } }
};

const out = { label: arg('label', 'run'), at: new Date().toISOString(), accuracy: acc, capabilities: cap, personas: {}, overall: 0 };
for (const [name, p] of Object.entries(personas)) {
  const tw = Object.values(p.c).reduce((a, b) => a + b, 0);
  const s = Object.entries(p.c).reduce((a, [k, w]) => a + w * cap[k], 0) / tw;
  out.personas[name] = Math.round(s * 1000) / 10;
  out.overall += p.w * s;
}
out.overall = Math.round(out.overall * 1000) / 10;
console.log(JSON.stringify(out, null, 2));
if (process.argv.includes('--write')) fs.writeFileSync(path.join(root, `benchmarks/haleakala/score-${out.label}.json`), JSON.stringify(out, null, 2) + '\n');
