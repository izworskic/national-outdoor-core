// Version 1: exact hourly model samples. No inferred swimming verdicts or interpolation.
const HOUR = 3600000;
const number = v => typeof v === 'number' && Number.isFinite(v);
const positive = v => number(v) && v >= 0 ? v : null;
const direction = v => number(v) && v >= 0 && v <= 360 ? v % 360 : null;
function uniqueRows(rows) {
  const map = new Map();
  for (const row of rows || []) {
    if (!number(row.ms) || row.ms % HOUR !== 0) continue;
    // Repeated timestamps are ambiguous, including repeated copies. Do not choose a winner.
    map.set(row.ms, map.has(row.ms) ? null : row);
  }
  return map;
}
export function alertAt(alert, time) {
  const from = Date.parse(alert.onsetIso), to = Date.parse(alert.endsIso);
  // Unknown/reversed bounds cannot be presented as a definite quiet interval.
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return 'unknown';
  return time >= from && time < to ? 'active' : 'inactive';
}
export function hourlyForCoast(coast, waveRows, windRows, alerts, alertsKnown, ymd) {
  const waves = uniqueRows(waveRows), winds = uniqueRows(windRows);
  const midnight = Date.parse(ymd + 'T00:00:00-10:00');
  return Array.from({ length: 9 }, (_, i) => {
    const hour = i + 8, ms = midnight + hour * HOUR;
    const wave = waves.get(ms), wind = winds.get(ms);
    const waveM = positive(wave?.hs), windMph = positive(wind?.mph);
    const windFromDeg = direction(wind?.dir);
    return {
      time: new Date(ms).toISOString(), hstHour: hour,
      waveM, periodS: waveM !== null ? positive(wave?.per) : null,
      waveFromDeg: waveM !== null ? direction(wave?.dir) : null,
      windMph, windFromDeg,
      onshoreMph: windMph !== null && windFromDeg !== null ? Math.round(windMph * Math.cos((windFromDeg - coast.faces) * Math.PI / 180) * 10) / 10 : null,
      alertsKnown: Boolean(alertsKnown),
      alerts: (alerts || []).filter(a => alertAt(a, ms) !== 'inactive').map(a => ({ event: a.event, timing: alertAt(a, ms) }))
    };
  });
}
