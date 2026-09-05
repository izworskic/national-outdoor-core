"use strict";

function finite(value, min = -Infinity, max = Infinity) {
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function round(value, digits = 0) {
  const n = finite(value);
  if (n == null) return null;
  const p = 10 ** digits;
  return Math.round(n * p) / p;
}

function interpolate(points, value) {
  const n = finite(value);
  if (n == null || !Array.isArray(points) || !points.length) return null;
  const sorted = [...points].sort((a, b) => a[0] - b[0]);
  if (n <= sorted[0][0]) return sorted[0][1];
  if (n >= sorted.at(-1)[0]) return sorted.at(-1)[1];
  for (let i = 1; i < sorted.length; i += 1) {
    const [x1, y1] = sorted[i - 1];
    const [x2, y2] = sorted[i];
    if (n <= x2) {
      const t = (n - x1) / (x2 - x1 || 1);
      return y1 + t * (y2 - y1);
    }
  }
  return sorted.at(-1)[1];
}

function seasonalRatio(flow, seasonal = {}) {
  const q = finite(flow, 0);
  const median = finite(seasonal.p50, 0.000001);
  return q == null || median == null ? null : q / median;
}

function flowSpectacle(flow, seasonal = {}) {
  const q = finite(flow, 0);
  if (q == null) return { score: 50, ratio: null, band: "unknown" };
  const ratio = seasonalRatio(q, seasonal);
  let score;
  if (ratio == null) {
    score = 55;
  } else {
    score = interpolate([
      [0.10, 12], [0.25, 22], [0.50, 36], [0.75, 46], [1.00, 56],
      [1.25, 64], [1.50, 72], [2.00, 82], [3.00, 91], [5.00, 97], [8.00, 100],
    ], ratio);
  }

  const p75 = finite(seasonal.p75, 0);
  const p90 = finite(seasonal.p90, 0);
  if (p90 != null && q >= p90) score += 4;
  else if (p75 != null && q >= p75) score += 2;

  let band = "typical";
  if (ratio != null) {
    if (ratio < 0.4) band = "very-low";
    else if (ratio < 0.75) band = "low";
    else if (ratio < 1.35) band = "typical";
    else if (ratio < 2.25) band = "high";
    else band = "very-high";
  }
  return { score: clamp(score), ratio: round(ratio, 2), band };
}

function trendAdjustment(percent24h) {
  const p = finite(percent24h, -1000, 1000);
  if (p == null) return 0;
  return interpolate([[-80, -8], [-30, -5], [-10, -2], [0, 0], [10, 2], [30, 5], [80, 8], [200, 10]], p);
}

function rainAdjustment(qpfInches) {
  const q = finite(qpfInches, 0, 30);
  if (q == null) return 0;
  return interpolate([[0, 0], [0.1, 1], [0.25, 2], [0.5, 4], [1, 7], [2, 10], [4, 12]], q);
}

function scoreForFlow({ flow, seasonal, trendPercent24h = null, rainInches = null, forecast = false }) {
  const base = flowSpectacle(flow, seasonal);
  const trend = trendAdjustment(trendPercent24h);
  const rain = forecast ? rainAdjustment(rainInches) : 0;
  return {
    score: Math.round(clamp(base.score + trend + rain)),
    ratio_to_seasonal_median: base.ratio,
    seasonal_band: base.band,
    trend_adjustment: round(trend, 1),
    rain_adjustment: round(rain, 1),
  };
}

function scoreLabel(score) {
  const n = finite(score, 0, 100) ?? 0;
  if (n >= 92) return "Exceptional";
  if (n >= 80) return "Excellent";
  if (n >= 68) return "Very good";
  if (n >= 55) return "Good";
  if (n >= 40) return "Fair";
  if (n >= 25) return "Low flow";
  return "Very low flow";
}

function confidence({ hasReach = false, hasNwm = false, hasGauge = false, hasSeasonal = false, hasPrecip = false, gaugeRelation = null, regulatedFlow = false }) {
  let value = 0;
  if (hasReach) value += 0.20;
  if (hasNwm) value += 0.28;
  if (hasGauge) value += gaugeRelation === "upstream-mainstem" ? 0.22 : 0.16;
  if (hasSeasonal) value += 0.20;
  if (hasPrecip) value += 0.10;
  if (regulatedFlow) value -= 0.10;
  value = clamp(value * 100) / 100;
  return {
    value: round(value, 2),
    label: value >= 0.78 ? "High" : value >= 0.56 ? "Moderate" : "Low",
  };
}

function highWaterCaution({ currentFlow, seasonal = {}, nwmPeak72h = null }) {
  const p90 = finite(seasonal.p90, 0);
  const current = finite(currentFlow, 0);
  const peak = finite(nwmPeak72h, 0);
  const ratio = seasonalRatio(Math.max(current || 0, peak || 0), seasonal);
  if ((p90 != null && Math.max(current || 0, peak || 0) >= p90 * 1.75) || (ratio != null && ratio >= 4)) {
    return {
      level: "elevated",
      message: "Very high water may make viewpoints, crossings, trails or river edges hazardous. Check local closures and warnings before visiting.",
    };
  }
  return {
    level: "normal",
    message: "The spectacle score describes water volume, not trail, access or river-edge safety. Check local conditions before visiting.",
  };
}

function pickFlow(values = [], horizonHours = 24) {
  const now = Date.now();
  const limit = now + horizonHours * 3600000;
  const points = values
    .map((point) => ({ time: point.time || point.valid_time || point.validTime || null, flow: finite(point.flow ?? point.value, 0) }))
    .filter((point) => point.flow != null && Date.parse(point.time || "") >= now - 3 * 3600000 && Date.parse(point.time || "") <= limit)
    .sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
  if (!points.length) return null;
  const peak = points.reduce((best, point) => !best || point.flow > best.flow ? point : best, null);
  const end = points.at(-1);
  return { peak_flow: peak.flow, peak_time: peak.time, end_flow: end.flow, end_time: end.time };
}

function reasons(input = {}) {
  const out = [];
  const ratio = finite(input.ratio_to_seasonal_median, 0);
  if (ratio != null) {
    if (ratio >= 2.5) out.push(`Flow is about ${round(ratio, 1)}× the seasonal median.`);
    else if (ratio >= 1.35) out.push("Flow is running above the seasonal norm.");
    else if (ratio < 0.6) out.push("Flow is running well below the seasonal norm.");
    else out.push("Flow is near the usual range for this time of year.");
  }
  const trend = finite(input.trend_percent_24h, -1000, 1000);
  if (trend != null) {
    if (trend >= 15) out.push(`The connected gauge is rising (${Math.round(trend)}% over about 24 hours).`);
    else if (trend <= -15) out.push(`The connected gauge is falling (${Math.round(Math.abs(trend))}% over about 24 hours).`);
    else out.push("The connected gauge is roughly steady.");
  }
  const future = finite(input.nwm_peak_72h_cfs, 0);
  const current = finite(input.current_flow_cfs, 0);
  if (future != null && current != null && current > 0) {
    const change = future / current;
    if (change >= 1.35) out.push("The National Water Model projects a meaningful rise within three days.");
    else if (change <= 0.75) out.push("Modeled flow is expected to ease over the next three days.");
  }
  const qpf = finite(input.qpf_72h_in, 0);
  if (qpf != null && qpf >= 0.5) out.push(`${round(qpf, 2)} in of forecast precipitation adds upside to future flow.`);
  return out.slice(0, 4);
}

function buildWaterfallWindow(input = {}) {
  const seasonal = input.seasonal || {};
  const currentFlow = finite(input.current_flow_cfs, 0) ?? finite(input.nwm_current_cfs, 0);
  const nwm24 = finite(input.nwm_peak_24h_cfs, 0) ?? currentFlow;
  const nwm72 = finite(input.nwm_peak_72h_cfs, 0) ?? nwm24;
  const trend = finite(input.trend_percent_24h, -1000, 1000);

  const now = scoreForFlow({ flow: currentFlow, seasonal, trendPercent24h: trend });
  const next24 = scoreForFlow({ flow: nwm24, seasonal, trendPercent24h: trend, rainInches: finite(input.qpf_24h_in, 0), forecast: true });
  const next72 = scoreForFlow({ flow: nwm72, seasonal, trendPercent24h: null, rainInches: finite(input.qpf_72h_in, 0), forecast: true });
  const conf = confidence({
    hasReach: Boolean(input.has_reach),
    hasNwm: Boolean(input.has_nwm),
    hasGauge: Boolean(input.has_gauge),
    hasSeasonal: Boolean(input.has_seasonal),
    hasPrecip: Boolean(input.has_precip),
    gaugeRelation: input.gauge_relation,
    regulatedFlow: Boolean(input.regulated_flow),
  });
  const caution = highWaterCaution({ currentFlow, seasonal, nwmPeak72h: nwm72 });

  const result = {
    now: { ...now, label: scoreLabel(now.score), flow_cfs: round(currentFlow, 1) },
    next_24h: { ...next24, label: scoreLabel(next24.score), peak_flow_cfs: round(nwm24, 1), peak_time: input.nwm_peak_24h_time || null },
    next_3d: { ...next72, label: scoreLabel(next72.score), peak_flow_cfs: round(nwm72, 1), peak_time: input.nwm_peak_72h_time || null },
    confidence: conf,
    caution,
  };
  if (input.regulated_flow) {
    result.caution = {
      ...result.caution,
      regulation: "An upstream dam or reservoir was detected. Release operations can make model-to-waterfall flow less representative than on a free-flowing stream.",
    };
  }
  result.reasons = reasons({
    ratio_to_seasonal_median: result.now.ratio_to_seasonal_median,
    trend_percent_24h: trend,
    nwm_peak_72h_cfs: nwm72,
    current_flow_cfs: currentFlow,
    qpf_72h_in: input.qpf_72h_in,
  });
  return result;
}

module.exports = {
  buildWaterfallWindow,
  confidence,
  flowSpectacle,
  highWaterCaution,
  pickFlow,
  scoreForFlow,
  scoreLabel,
  seasonalRatio,
};
