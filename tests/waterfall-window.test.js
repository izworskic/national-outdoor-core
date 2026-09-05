"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildWaterfallWindow,
  confidence,
  flowSpectacle,
  highWaterCaution,
  scoreLabel,
} = require("../lib/waterfall-window");

const seasonal = { p25: 50, p50: 100, p75: 180, p90: 300 };

test("spectacle rises materially with flow relative to seasonal median", () => {
  const low = flowSpectacle(30, seasonal);
  const normal = flowSpectacle(100, seasonal);
  const high = flowSpectacle(350, seasonal);
  assert.ok(low.score < normal.score);
  assert.ok(normal.score < high.score);
  assert.equal(high.band, "very-high");
});

test("forecast rain and rising flow can improve the future score without changing now score", () => {
  const result = buildWaterfallWindow({
    current_flow_cfs: 90,
    nwm_peak_24h_cfs: 170,
    nwm_peak_72h_cfs: 260,
    trend_percent_24h: 22,
    qpf_24h_in: 0.55,
    qpf_72h_in: 1.2,
    seasonal,
    has_reach: true,
    has_nwm: true,
    has_gauge: true,
    has_seasonal: true,
    has_precip: true,
    gauge_relation: "upstream-mainstem",
  });
  assert.ok(result.next_24h.score > result.now.score);
  assert.ok(result.next_3d.score >= result.next_24h.score);
  assert.equal(result.confidence.label, "High");
});

test("confidence explicitly drops when observation or history signals are missing", () => {
  assert.equal(confidence({ hasReach: true, hasNwm: true }).label, "Low");
  assert.equal(confidence({ hasReach: true, hasNwm: true, hasGauge: true, hasSeasonal: false, hasPrecip: true, gaugeRelation: "upstream-mainstem" }).label, "Low");
  assert.equal(confidence({ hasReach: true, hasNwm: true, hasGauge: true, hasSeasonal: true, hasPrecip: true, gaugeRelation: "upstream-mainstem" }).label, "High");
});

test("spectacle score is withheld when no seasonal baseline exists", () => {
  const result = buildWaterfallWindow({
    current_flow_cfs: 150, nwm_peak_24h_cfs: 180, nwm_peak_72h_cfs: 220,
    has_reach: true, has_nwm: true, has_gauge: false, has_seasonal: false, has_precip: true,
    qpf_24h_in: 0.5, qpf_72h_in: 1.0, seasonal: {},
  });
  assert.equal(result.now.score, null);
  assert.equal(result.next_24h.score, null);
  assert.equal(result.next_3d.score, null);
  assert.equal(result.now.label, "Limited evidence");
  assert.equal(result.confidence.label, "Low");
});

test("very high water produces a safety caution separate from spectacle", () => {
  const caution = highWaterCaution({ currentFlow: 700, seasonal, nwmPeak72h: 900 });
  assert.equal(caution.level, "elevated");
  assert.match(caution.message, /hazardous/i);
});

test("labels are monotonic and editorially useful", () => {
  assert.equal(scoreLabel(95), "Exceptional");
  assert.equal(scoreLabel(83), "Excellent");
  assert.equal(scoreLabel(45), "Fair");
  assert.equal(scoreLabel(15), "Very low flow");
});

test("upstream regulation reduces confidence and is disclosed", () => {
  const open = buildWaterfallWindow({
    current_flow_cfs: 100, nwm_peak_24h_cfs: 120, nwm_peak_72h_cfs: 140, seasonal,
    has_reach: true, has_nwm: true, has_gauge: true, has_seasonal: true, has_precip: true,
    gauge_relation: "upstream-mainstem", regulated_flow: false,
  });
  const regulated = buildWaterfallWindow({
    current_flow_cfs: 100, nwm_peak_24h_cfs: 120, nwm_peak_72h_cfs: 140, seasonal,
    has_reach: true, has_nwm: true, has_gauge: true, has_seasonal: true, has_precip: true,
    gauge_relation: "upstream-mainstem", regulated_flow: true,
  });
  assert.ok(regulated.confidence.value < open.confidence.value);
  assert.match(regulated.caution.regulation, /dam|reservoir/i);
});
