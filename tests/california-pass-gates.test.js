const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
let gates,core;
const NOW=Date.parse('2026-10-19T16:00:00-07:00');
test.before(async()=>{gates=await import('../lib/california-pass-gates.mjs');core=await import('../lib/california-roads.mjs');});
const NPS_OPEN='<html><h2>Road Status</h2><p>Yosemite Valley Roads Open</p><p>Tioga Road (continuation of Highway 120 through the park)</p><p>Expect 10-minute delays in Tuolumne Meadows</p><p>No overnight parking along the road</p><b>Open</b><p>Glacier Point Road</p><b>Closed</b><footer>Last updated: October 16, 2026</footer></html>';
const SEASONS='<html><h2>Ebbetts Pass (State Route 4) in Alpine County</h2><p>Caltrans officially reopened Ebbetts Pass (State Route 4) for the season on Wednesday, May 6, 2026.</p><h2>Monitor Pass (State Route 89) in Alpine County</h2><p>Caltrans officially reopened Monitor Pass (State Route 89) for the season on Thursday, March 5, 2026.</p><h2>Sonora Pass (State Route 108) in Tuolumne County</h2><p>Caltrans officially reopened Sonora Pass (State Route 108) for the season on Thursday, April 30, 2026.</p></html>';
const pass=id=>core.PASSES.find(x=>x.id===id);
test('NPS row isolation: Tioga open cannot be overwritten by Glacier Point closed',()=>{
 const n=gates.parseNpsTioga(NPS_OPEN,{now:NOW});
 assert.equal(n.state,'OPEN');assert.equal(n.reportedDate,'2026-10-16');
 const result=gates.classifyPassGate(pass('tioga'),{state:'PARK CHECK REQUIRED',notes:[]},{nps:n});
 assert.equal(result.state,'NPS REPORTS OPEN');
 assert.match(result.confidence,/not instant traffic conditions/);
});
test('NPS explicit closure, missing row, stale status and transient inability fail conservatively',()=>{
 const closed=gates.parseNpsTioga(NPS_OPEN.replace('<b>Open</b><p>Glacier Point','<b>Closed</b><p>Glacier Point'),{now:NOW});
 assert.equal(closed.state,'CLOSED');
 assert.equal(gates.classifyPassGate(pass('tioga'),{notes:[]},{nps:closed}).state,'NPS REPORTS CLOSED');
 assert.equal(gates.parseNpsTioga('<html>Yosemite Valley Roads Open</html>',{now:NOW}).state,'UNAVAILABLE');
 const stale=gates.parseNpsTioga(NPS_OPEN.replace('October 16, 2026','September 10, 2026'),{now:NOW});
 assert.equal(stale.state,'STALE');
 assert.equal(gates.classifyPassGate(pass('tioga'),{notes:[]},{nps:stale}).state,'PARK STATUS UNVERIFIED');
});
test('seasonal reopening announcements are evidence of earlier opening, never current gate guarantee',()=>{
 const seasons=gates.parseCaltransSeasonalPasses(SEASONS,{now:NOW});
 for(const id of ['ebbetts','monitor','sonora']){
  assert.equal(seasons[id].state,'SEASONAL REOPENING ANNOUNCED');
  const item=gates.classifyPassGate(pass(id),{state:'NO RESTRICTIONS REPORTED',notes:['No traffic restrictions are reported for this area.']},{seasonal:seasons[id]});
  assert.equal(item.state,'REOPENED THIS SEASON · VERIFY GATE');
  assert.match(item.explanation,/not live gate telemetry/);
 }
 const nextWinter=gates.parseCaltransSeasonalPasses(SEASONS,{now:Date.parse('2027-02-12T12:00:00Z')});
 assert.equal(nextWinter.sonora.state,'NOT VERIFIED');
});
test('pass-specific Caltrans closure wins over old reopening but unrelated highway issues do not close a summit',()=>{
 const season=gates.parseCaltransSeasonalPasses(SEASONS,{now:NOW}).sonora;
 const actual=gates.classifyPassGate(pass('sonora'),{notes:['SR 108 is closed from Kennedy Meadows to Leavitt Falls due to snow']},{seasonal:season});
 assert.equal(actual.state,'PASS CLOSURE REPORTED');
 const unrelated=gates.classifyPassGate(pass('sonora'),{state:'CLOSURE REPORTED',notes:['SR 108 is closed at downtown Sonora for an event']},{seasonal:season});
 assert.equal(unrelated.state,'REOPENED THIS SEASON · VERIFY GATE');
});
test('monitor SR-89 closure in different part of statewide route is not labeled a closed gate',()=>{
 const season=gates.parseCaltransSeasonalPasses(SEASONS,{now:NOW}).monitor;
 const item=gates.classifyPassGate(pass('monitor'),{state:'CLOSURE REPORTED',notes:['SR-89 is closed at Alpine / El Dorado County line north of Carson Pass']},{seasonal:season});
 assert.notEqual(item.state,'PASS CLOSURE REPORTED');
});
test('year-round crossings are not automatically declared open and maps render source-specific verdicts',()=>{
 for(const id of ['carson','echo','donner']){
  const gate=gates.classifyPassGate(pass(id),{state:'NO RESTRICTIONS REPORTED',notes:[]});
  assert.match(gate.state,/YEAR-ROUND ROUTE/);
 }
 const js=fs.readFileSync('public/assets/california-roads.js','utf8');
 assert.match(js,/gate\.sourceUpdated/);
 assert.match(js,/p\.crossingState/);
 assert.match(js,/Separate Caltrans highway report/);
});
