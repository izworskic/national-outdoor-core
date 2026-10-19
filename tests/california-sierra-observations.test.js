const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
let spatial,core;
const NOW=Date.parse('2026-10-19T17:00:00-07:00');
test.before(async()=>{spatial=await import('../lib/california-sierra-observations.mjs');core=await import('../lib/california-roads.mjs');});
const epoch=x=>String(Date.parse(x)/1000);
const loc=(lat,lng,route='SR-108',county='Tuolumne')=>({
 beginLatitude:String(lat),beginLongitude:String(lng),beginRoute:route,beginCounty:county,
 beginLocationName:'Caltrans signed approach'
});
function row({route='SR-108',lat=38.325,lng=-119.640,full='Full',live=true,start='2026-10-19T16:00:00-07:00',
 end='2026-10-19T20:00:00-07:00',facility='Mainline',cancel=false}={}){
 const a=loc(lat,lng,route);
 const b={endLatitude:String(lat+.001),endLongitude:String(lng+.001),endRoute:route,endLocationName:'Past summit'};
 return {lcs:{index:'closure-'+route+lat,location:{begin:a,end:b,travelFlowDirection:'Both'},
 closure:{facility,typeOfClosure:full,typeOfWork:'Emergency highway repair',closureTimestamp:{closureStartEpoch:epoch(start),closureEndEpoch:epoch(end)},
 code1097:{isCode1097:String(live)},code1098:{isCode1098:'false'},code1022:{isCode1022:String(cancel)}}}};
}
function camera({route='SR-108',lat=38.33,lng=-119.63,host='cwwp2.dot.ca.gov',service=true}={}){
 return {cctv:{index:'camera-'+lat,location:{latitude:String(lat),longitude:String(lng),route,locationName:'Pass webcam'},
 inService:String(service),imageData:{static:{currentImageURL:'https://'+host+'/data/d10/cctv/image/sonorapass/sonorapass.jpg',currentImageUpdateFrequency:'5'}}}};
}
const P=()=>core.PASSES;
test('full active closure physically at Sonora summit must not spill onto Ebbetts or another highway',()=>{
 const result=spatial.readSierraWork({data:[row()]},P(),{now:NOW});
 assert.equal(result.sonora.length,1);
 assert.equal(result.sonora[0].live,true);assert.equal(result.sonora[0].area,'Pass vicinity');
 for(const id of ['ebbetts','monitor','carson','tioga','echo','donner'])assert.equal(result[id].length,0,id);
 assert.equal(spatial.summarizeSierraObservation(P()[0],result.sonora,[],{laneFeeds:3,cameraFeeds:3}).state,'FULL CLOSURE REPORTED NEAR PASS');
});
test('closed stretch distant on same SR-108 is not treated as Sonora Pass closure',()=>{
 const result=spatial.readSierraWork({data:[row({lat:37.9,lng:-120.43})]},P(),{now:NOW});
 assert.equal(result.sonora.length,0);
});
test('approach work on same route is scoped as approach, not summit gate',()=>{
 const result=spatial.readSierraWork({data:[row({lat:38.3,lng:-120.0,full:'Lane',live:true})]},P(),{now:NOW});
 assert.equal(result.sonora.length,1);
 assert.equal(result.sonora[0].area,'Approach corridor');
 assert.equal(spatial.summarizeSierraObservation(P()[0],result.sonora,[],{laneFeeds:3}).state,'ACTIVE ROADWORK NEAR PASS');
});
test('future approved full closure stays planned not currently active',()=>{
 const r=spatial.readSierraWork({data:[row({start:'2026-10-21T09:00:00-07:00',end:'2026-10-21T17:00:00-07:00',live:false})]},P(),{now:NOW});
 assert.equal(r.sonora[0].live,false);
 assert.equal(spatial.summarizeSierraObservation(P()[0],r.sonora,[],{laneFeeds:3}).state,'FULL CLOSURE SCHEDULED');
});
test('cancelled, ended, non-mainline and mismatched endpoint-route events are excluded',()=>{
 const cancel=row({cancel:true}),end=row({end:'2026-10-19T15:00:00-07:00'}),ramp=row({facility:'On-Ramp'}),bad=row();
 bad.lcs.location.end.endRoute='US-50';
 const r=spatial.readSierraWork({data:[cancel,end,ramp,bad]},P(),{now:NOW});
 assert.equal(r.sonora.length,0);
 assert.throws(()=>spatial.readSierraWork({},P(),{now:NOW}));
});
test('Caltrans image is a genuine HTTPS Caltrans CCTV still on same nearby route',()=>{
 const r=spatial.readSierraCameras({data:[camera()]},P());
 assert.equal(r.sonora.length,1);
 assert.match(r.sonora[0].imageUrl,/^https:\/\/cwwp2\.dot\.ca\.gov\/data\/d10\/cctv\/image\//);
 assert.equal(r.sonora[0].distanceKm<=10,true);
 assert.equal(r.ebbetts.length,0);
 assert.match(r.sonora[0].note,/not guarantee/);
});
test('camera image URL allowlist, camera service, route and radius are enforced',()=>{
 const data={data:[camera({host:'example.org'}),camera({service:false}),camera({route:'SR-4'}),camera({lat:37.5,lng:-119.7})]};
 assert.equal(spatial.readSierraCameras(data,P()).sonora.length,0);
 assert.throws(()=>spatial.readSierraCameras({},P()));
});
test('missing district coverage is explicitly not interpreted as no restrictions',()=>{
 const r=spatial.summarizeSierraObservation(P()[0],[],[],{laneFeeds:1,cameraFeeds:1});
 assert.equal(r.state,'LCS COVERAGE INCOMPLETE');
 assert.match(r.cameraNote,/unavailable/);
});
test('client provides clickable camera stills and map markers without fake green gate verdict',()=>{
 const js=fs.readFileSync('public/assets/california-roads.js','utf8');
 const css=fs.readFileSync('public/assets/california-roads.css','utf8');
 assert.match(js,/function sierraObservedMap/);
 assert.match(js,/marker\.bindPopup/);
 assert.match(js,/Open official camera still/);
 assert.match(js,/class="camera-card"/);
 assert.match(js,/Scheduled\/unconfirmed/);
 assert.match(js,/Caltrans QuickMap/);
 assert.match(css,/\.camera-gallery/);
});
