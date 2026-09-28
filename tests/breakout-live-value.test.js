const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const cp=require('node:child_process');

test('breakout decision pages ship the value-feedback telemetry layer',()=>{
  cp.execFileSync(process.execPath,['scripts/generate-breakout-live-pages.mjs']);
  cp.execFileSync(process.execPath,['scripts/inject-network-analytics.js']);
  const cfg=require('../config/breakout-live-pages.json');
  for(const id of Object.keys(cfg)){
    const html=fs.readFileSync(`public/national-tools/${id}/index.html`,'utf8');
    assert.match(html,/assets\/breakout-value\.js/);
  }
});

test('value telemetry measures decision resolution and source hops without storing personal data',()=>{
  const js=fs.readFileSync('public/assets/breakout-value.js','utf8');
  assert.match(js,/breakout_decision_feedback/);
  assert.match(js,/breakout_official_source_click/);
  assert.match(js,/breakout_workbench_change/);
  assert.match(js,/elapsed_ms/);
  assert.match(js,/I still needed the official source/);
  assert.match(js,/Still unclear/);
  assert.doesNotMatch(js,/email|phone|geolocation|latitude|longitude/i);
});
