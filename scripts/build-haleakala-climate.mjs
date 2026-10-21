#!/usr/bin/env node
// Builds lib/haleakala-climate.json: for each calendar month, how often summit humidity within 30 minutes
// of sunrise was dry (<=55%), moist (>=85%) or in between, from the LCO OGG weather archive.
// Humidity is a proxy for a clear summit, validated by eye on only 19 mornings. Re-run to refresh.
import fs from 'node:fs';
import { sunriseOnHstDate } from '../lib/haleakala-sunrise.mjs';
const DRY = 55, MOIST = 85, WINDOW_MIN = 30, MIN_POINTS = 2;
const START = [2023, 1], END = new Date();
const ym = [];
for (let y = START[0], m = START[1]; new Date(Date.UTC(y, m - 1, 1)) <= END; m === 12 ? (y++, m = 1) : m++) ym.push([y, m]);
const iso = (d) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');
const rows = [];
for (const [y, m] of ym) {
  const s = new Date(Date.UTC(y, m - 1, 1)), e = new Date(Date.UTC(y, m, 1));
  const u = `https://weather-api.lco.global/query?${new URLSearchParams({ site: 'ogg', datumname: 'Weather Humidity Value', start: iso(s), end: iso(e) })}`;
  let r; for (let k = 0; k < 4 && !r; k++) { try { r = await (await fetch(u)).json(); } catch { await new Promise((z) => setTimeout(z, 2000)); } }
  for (const x of r || []) { const t = Date.parse(x.TimeStamp.replace(/\//g, '-').replace(' ', 'T') + 'Z'); if (Number.isFinite(t) && Number.isFinite(+x.Value)) rows.push([t, +x.Value]); }
  console.error(`${y}-${String(m).padStart(2, '0')} ${r?.length ?? 'FAILED'}`);
}
rows.sort((a, b) => a[0] - b[0]);
const byDay = new Map();
for (const [t, v] of rows) {
  const day = new Date(t - 10 * 3600000).toISOString().slice(0, 10); // HST calendar day of the reading
  let sr; try { sr = Date.parse(sunriseOnHstDate(day).iso); } catch { continue; }
  if (Math.abs(t - sr) <= WINDOW_MIN * 60000) { if (!byDay.has(day)) byDay.set(day, []); byDay.get(day).push(v); }
}
const months = {}; let first = null, last = null;
for (const [day, vs] of byDay) {
  if (vs.length < MIN_POINTS) continue;
  const rh = vs.reduce((a, b) => a + b, 0) / vs.length, mo = Number(day.slice(5, 7));
  const b = (months[mo] ||= { days: 0, dry: 0, mid: 0, moist: 0 });
  b.days++; rh <= DRY ? b.dry++ : rh >= MOIST ? b.moist++ : b.mid++;
  if (!first || day < first) first = day; if (!last || day > last) last = day;
}
// Mornings with no usable reading. In the Oct 2026 validation set the sensor was silent on 2 of the 3
// worst mornings, so missing days are reported and not counted either way.
for (let t = Date.parse(`${first}T12:00:00Z`); t <= Date.parse(`${last}T12:00:00Z`); t += 864e5) {
  const mo = new Date(t).getUTCMonth() + 1; (months[mo].possible ||= 0); months[mo].possible++;
}
for (const b of Object.values(months)) {
  b.noData = b.possible - b.days;
  b.dryPct = Math.round(100 * b.dry / b.days); b.moistPct = Math.round(100 * b.moist / b.days); b.midPct = 100 - b.dryPct - b.moistPct;
}
const out = { generated: new Date().toISOString().slice(0, 10), years: `${first.slice(0, 4)}–${last.slice(0, 4)}`, first, last,
  method: `Mean LCO OGG summit humidity within ${WINDOW_MIN} minutes of sunrise. Dry <= ${DRY}%, moist >= ${MOIST}%. Days with fewer than ${MIN_POINTS} readings skipped.`, months };
fs.writeFileSync(new URL('../lib/haleakala-climate.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify(Object.fromEntries(Object.entries(months).map(([k, v]) => [k, `${v.days}d dry${v.dryPct} mid${v.midPct} moist${v.moistPct}`])), null, 1));
