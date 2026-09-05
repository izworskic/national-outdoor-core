"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const api=require("../api/national-waterfall-window")._test;

test("NLDI comid parser accepts modern property names",()=>{
  assert.equal(api.nldiComid({features:[{properties:{nhdplus_comid:123456}}]}),"123456");
  assert.equal(api.nldiComid({features:[{properties:{comid:"789"}}]}),"789");
});

test("seasonal stats use a same-season window and compute ordered quantiles",()=>{
  const rows=[];
  for(let year=2018;year<=2026;year++) for(let day=1;day<=20;day++) rows.push({time:`${year}-09-${String(day).padStart(2,"0")}`,value:100+(year-2018)*10+day});
  const stats=api.seasonalStats(rows,new Date("2026-09-10T12:00:00Z"));
  assert.ok(stats.sample_days>100);
  assert.ok(stats.p25<stats.p50 && stats.p50<stats.p75 && stats.p75<stats.p90);
});

test("local seasonal scaling is bounded",()=>{
  const stats={p25:25,p50:50,p75:75,p90:100,sample_days:100,window_days:43};
  const scaled=api.scaleSeasonal(stats,100,50);
  assert.equal(scaled.p50,100);
  assert.equal(scaled.scale_factor,2);
});

test("NWS QPF interval values are overlap-weighted",()=>{
  const now=Date.parse("2026-09-05T12:00:00Z");
  const values=[
    {validTime:"2026-09-05T12:00:00Z/PT6H",value:25.4},
    {validTime:"2026-09-05T18:00:00Z/PT6H",value:25.4},
    {validTime:"2026-09-07T12:00:00Z/PT6H",value:50.8},
  ];
  assert.equal(api.qpfSum(values,24,now),2);
  assert.equal(api.qpfSum(values,72,now),4);
});

test("NWM parser handles NWPS camel-case response",()=>{
  const points=api.extractNwmSeries({shortRange:{series:{data:[{validTime:"2026-09-05T12:00:00Z",flow:123}]}}});
  assert.deepEqual(points,[{time:"2026-09-05T12:00:00Z",flow:123}]);
});
