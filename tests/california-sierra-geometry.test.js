const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
let geometry,core;
test.before(async()=>{
 geometry=await import('../lib/california-sierra-geometry.mjs');
 core=await import('../lib/california-roads.mjs');
});
const passes=()=>core.PASSES.map(p=>({...p,crossingState:p.id==='carson'?'CLOSED REPORTED':'GATE UNVERIFIED'}));
const line=(p)=>[
 [p.lng-.032,p.lat+.001],[p.lng-.016,p.lat-.005],[p.lng,p.lat],[p.lng+.016,p.lat+.005],[p.lng+.03,p.lat+.006]
];
const collection=(p)=>({type:'FeatureCollection',features:[
 {type:'Feature',properties:{Route:p.road,AlignCode:'Right',County:'MNO'},geometry:{type:'LineString',coordinates:line(p)}},
 {type:'Feature',properties:{Route:999,AlignCode:'Right'},geometry:{type:'LineString',coordinates:line(p)}},
 {type:'Feature',properties:{Route:p.road,AlignCode:'Left'},geometry:{type:'LineString',coordinates:line(p)}}
]});
test('Caltrans query requests official SHN right alignment within the pass envelope, not routing demo',()=>{
 const p=passes()[0],u=geometry.geometryQuery(p);
 assert.match(u,/gisdata\.dot\.ca\.gov\/arcgis\/rest\/services\/CHhighway\/SHN_Lines\/FeatureServer\/0/);
 assert.ok(decodeURIComponent(u).includes("Route=108 AND AlignCode='Right'"));
 assert.match(u,/maxAllowableOffset=0\.001/);
 assert.match(u,/f=geojson/);
 assert.doesNotMatch(u,/router\.project-osrm\.org/);
});
test('correct numbered state highway returns real coordinate trace while filtering wrong roads and alignments',()=>{
 const p=passes()[0],result=geometry.validateRoadGeometry(collection(p),p);
 assert.equal(result.ok,true);assert.equal(result.available,true);
 assert.equal(result.segmentCount,1);
 assert.deepEqual(result.segments[0][2],[p.lng,p.lat]);
 assert.match(result.accuracy,/not a live drivable path/);
});
test('missing summit coordinates, absent segments, wrong route and malicious geometries do not draw line',()=>{
 const p=passes()[0];
 const missing=geometry.validateRoadGeometry({type:'FeatureCollection',features:[]},p);
 assert.equal(missing.available,false);
 const wrong=collection(p);
 wrong.features[0].properties.Route=88;
 assert.equal(geometry.validateRoadGeometry(wrong,p).available,false);
 const bad=collection(p);
 bad.features[0].geometry.coordinates=[[Infinity,38.3],[-119.6,38.3]];
 assert.equal(geometry.validateRoadGeometry(bad,p).available,false);
 assert.throws(()=>geometry.validateRoadGeometry({},p));
});
test('getSierraHighwayGeometry fetches only known SHN URL and fails closed on source error',async()=>{
 const p=passes()[0];
 const result=await geometry.getSierraHighwayGeometry(p,{fetchImpl:async (url)=>({
  ok:true,text:async()=>JSON.stringify(collection(p))})});
 assert.equal(result.ok,true);
 await assert.rejects(()=>geometry.getSierraHighwayGeometry(p,{fetchImpl:async()=>({ok:false,status:503})}));
});
test('alternative choices are geographical candidates, never safe or ranked by invented travel time',()=>{
 const p=passes(),choices=geometry.crossingChoices(p[0],p);
 assert.ok(choices.length>=3);
 const carson=choices.find(x=>x.id==='carson');
 assert.match(carson.category,/CLOSURE REPORTED/);
 assert.match(carson.explanation,/Do not attempt/);
 assert.ok(choices.every(x=>!('driveMinutes'in x)&&!('score'in x)));
 assert.ok(choices.every(x=>x.explanation.includes('verification')||x.explanation.includes('updated road status')));
});
test('client routes draw official geometry only after verified API success and provide first-party nav handoff',()=>{
 const js=fs.readFileSync('public/assets/california-roads.js','utf8');
 const api=fs.readFileSync('api/california-roads.js','utf8');
 for(const fragment of ['function drawPassHighway','geometryCache','officialRoadLine','sierraRoadLineStatus','fitBounds(bounds.pad(.17)','function directionsUrl','google.com/maps/dir/?api=1','Inspect this crossing','No straight-line substitute'])assert.ok(js.includes(fragment),fragment);
 assert.ok(api.includes("['coast','sierra','geometry']"));
 assert.ok(api.includes("s-maxage=86400"));
 assert.ok(api.includes('getSierraHighwayGeometry'));
});
