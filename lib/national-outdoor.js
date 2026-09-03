function finite(value, min = -Infinity, max = Infinity) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

function ageMinutes(value, now = Date.now()) {
  const timestamp = Date.parse(value || "");
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, Math.round((now - timestamp) / 60000));
}

function freshness(value, staleAfterMinutes, now = Date.now()) {
  const age = ageMinutes(value, now);
  if (age == null) return { age_minutes: null, stale: null, status: "unknown" };
  return {
    age_minutes: age,
    stale: age > staleAfterMinutes,
    status: age > staleAfterMinutes ? "stale" : "current",
  };
}

function sourceMeta({ name, url, updatedAt = null, staleAfterMinutes = null, available = true, status = null }, now = Date.now()) {
  const state = staleAfterMinutes == null
    ? { age_minutes: ageMinutes(updatedAt, now), stale: null, status: status || (available ? "available" : "unavailable") }
    : freshness(updatedAt, staleAfterMinutes, now);
  return {
    source_name: name,
    source_url: url,
    source_updated_at: updatedAt,
    age_minutes: state.age_minutes,
    stale_after_minutes: staleAfterMinutes,
    source_status: available ? (status || state.status) : "unavailable",
    stale: available ? state.stale : null,
    available: Boolean(available),
  };
}

function percentileBand(value, stats = {}) {
  const current = finite(value);
  if (current == null) return { label: "Current flow unavailable", code: "unknown", confidence: "low" };
  const p10 = finite(stats.p10), p25 = finite(stats.p25), p50 = finite(stats.p50), p75 = finite(stats.p75), p90 = finite(stats.p90);
  if (p10 == null || p25 == null || p50 == null || p75 == null || p90 == null) {
    return { label: "Historical comparison unavailable", code: "unknown", confidence: "low" };
  }
  if (current < p10) return { label: "Very low for this date", code: "very-low", confidence: "high" };
  if (current < p25) return { label: "Low for this date", code: "low", confidence: "high" };
  if (current <= p75) return { label: "Within the usual middle range", code: "typical", confidence: "high" };
  if (current <= p90) return { label: "High for this date", code: "high", confidence: "high" };
  return { label: "Very high for this date", code: "very-high", confidence: "high" };
}

function nwpsCategory(stage, categories = {}) {
  const value = finite(stage);
  if (value == null) return "Unknown";
  const order = [
    ["major", "Major Flood"],
    ["moderate", "Moderate Flood"],
    ["minor", "Minor Flood"],
    ["action", "Action"],
  ];
  for (const [key, label] of order) {
    const threshold = finite(categories?.[key]?.stage);
    if (threshold != null && value >= threshold) return label;
  }
  return "Below Action Stage";
}

function forecastCrest(points = []) {
  return points
    .map((point) => ({
      valid_time: point?.validTime || point?.valid_time || null,
      stage: finite(point?.primary ?? point?.stage),
      flow: finite(point?.secondary ?? point?.flow),
    }))
    .filter((point) => point.stage != null && Date.parse(point.valid_time || ""))
    .reduce((crest, point) => !crest || point.stage > crest.stage ? point : crest, null);
}

function datePartsInZone(date = new Date(), timeZone = "UTC") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function localDateKey(date = new Date(), timeZone = "UTC") {
  const value = datePartsInZone(date, timeZone);
  return `${value.year}-${value.month}-${value.day}`;
}

function utcOffsetHours(date = new Date(), timeZone = "UTC") {
  const zone = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "longOffset",
  }).formatToParts(date).find((part) => part.type === "timeZoneName")?.value;
  const match = String(zone || "").match(/^GMT([+-])(\d{2}):?(\d{2})$/);
  if (!match) return 0;
  const offset = Number(match[2]) + Number(match[3]) / 60;
  return match[1] === "-" ? -offset : offset;
}

function bestCloudWindow(hours = [], windowSize = 3) {
  const valid = hours.filter((hour) => Number.isFinite(finite(hour?.cloud_percent)) && Date.parse(hour?.time || ""));
  if (!valid.length) return null;
  const size = Math.max(1, Math.min(windowSize, valid.length));
  let best = null;
  for (let i = 0; i <= valid.length - size; i += 1) {
    const slice = valid.slice(i, i + size);
    const average = slice.reduce((sum, hour) => sum + finite(hour.cloud_percent), 0) / slice.length;
    const candidate = {
      start_time: slice[0].time,
      end_time: new Date(Date.parse(slice.at(-1).time) + 3600000).toISOString(),
      average_cloud_percent: Math.round(average),
      hours: slice.length,
    };
    if (!best || candidate.average_cloud_percent < best.average_cloud_percent) best = candidate;
  }
  return best;
}

module.exports = {
  ageMinutes,
  bestCloudWindow,
  datePartsInZone,
  finite,
  forecastCrest,
  freshness,
  localDateKey,
  nwpsCategory,
  percentileBand,
  sourceMeta,
  utcOffsetHours,
};
