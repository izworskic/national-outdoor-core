const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
let seg,core;
test.before(async()=>{seg=await import('../lib/california-road-segments.mjs');core=await import('../lib/california-roads.mjs');});
const NOW=Date.parse('2026-10-19T13:00:00-07:00'),epoch=s=>Date.parse(s)/1000;
function lane({start='2026-10-19T10:00:00-07:00',end='2026-10-19T16:00:00-07:00',lat=35.947,lng=-121.50,type='Full',active=true,route='SR-1',county='Monterey'}={}){
 const timestamp={closureStartEpoch:String(epoch(start)),closureEndEpoch:String(epoch(end))};
 return {lcs:{index:'test-1',recordTimestamp:{recordEpoch:String(epoch('2026-10-19T12:55:00-07:00'))},
  location:{travelFlowDirection:'North / South',begin:{beginRoute:route,beginCounty:county,beginLatitude:String(lat),beginLongitude:String(lng),beginLocationName:'between Lucia and Gorda'},
    end:{endLatitude:String(lat+.002),endLongitude:String(lng+.001),endLocationName:'road barrier'}},
  closure:{facility:'Mainline',typeOfClosure:type,typeOfWork:'Emergency slide repair',estimatedDelay:'8',closureTimestamp:timestamp,
    code1097:{isCode1097:String(active)},code1098:{isCode1098:'false'},code1022:{isCode1022:'false'}}}};
}
const routes=()=>core.COAST_TRIPS;
test('source dates are Pacific-local and seven days long',()=>{
 assert.equal(seg.localDate(new Date('2026-10-20T05:30:00Z')),'2026-10-19');
 assert.deepEqual(seg.allowedDates('2026-10-19'),['2026-10-19','2026-10-20','2026-10-21','2026-10-22','2026-10-23','2026-10-24','2026-10-25']);
});
test('Monterey georeferenced full closure changes through trip but not northern Big Sur day trip',()=>{
 const ev=seg.parseLaneClosures({data:[lane()]},core.BIGSUR_STOPS,{now:NOW});assert.equal(ev.length,1);
 assert.equal(ev[0].type,'full');
 const opts={day:'2026-10-19',today:'2026-10-19',feedAvailable:true,now:NOW};
 const north=seg.projectRoute(routes()[0],core.BIGSUR_STOPS,ev,opts);
 const through=seg.projectRoute(routes()[2],core.BIGSUR_STOPS,ev,opts);
 assert.equal(north.state,'NO MATCHED PLANNED WORK');
 assert.equal(through.state,'FULL CLOSURE REPORTED');
 assert.ok(through.reachable.length<north.reachable.length+7);
 assert.ok(through.events[0].confidence.includes('endpoint'));
});
test('changing origin changes affected route when closure is south of Lucia',()=>{
 const ev=seg.parseLaneClosures({data:[lane()]},core.BIGSUR_STOPS,{now:NOW});
 const opts={day:'2026-10-19',today:'2026-10-19',feedAvailable:true,now:NOW};
 assert.equal(seg.projectRoute(routes()[0],core.BIGSUR_STOPS,ev,opts).state,'NO MATCHED PLANNED WORK');
 assert.equal(seg.projectRoute(routes()[3],core.BIGSUR_STOPS,ev,opts).state,'FULL CLOSURE REPORTED');
});
test('future scheduled work changes only the affected day, without claiming an active closure',()=>{
 const ev=seg.parseLaneClosures({data:[lane({start:'2026-10-21T07:00:00-07:00',end:'2026-10-21T19:00:00-07:00',active:false})]},core.BIGSUR_STOPS,{now:NOW});
 const trip=routes()[2],opts={today:'2026-10-19',feedAvailable:true,now:NOW};
 assert.equal(seg.projectRoute(trip,core.BIGSUR_STOPS,ev,{...opts,day:'2026-10-19'}).state,'NO MATCHED PLANNED WORK');
 assert.equal(seg.projectRoute(trip,core.BIGSUR_STOPS,ev,{...opts,day:'2026-10-21'}).state,'SCHEDULED FULL CLOSURE');
});
test('lane controls never imply a confirmed full closure',()=>{
 const ev=seg.parseLaneClosures({data:[lane({type:'One-way',active:true})]},core.BIGSUR_STOPS,{now:NOW});
 assert.equal(seg.projectRoute(routes()[2],core.BIGSUR_STOPS,ev,{today:'2026-10-19',day:'2026-10-19',feedAvailable:true,now:NOW}).state,'CONTROLLED / WORK ZONES');
});
test('missing feed, unrelated road, ramp closure, and off-coast coordinates fail conservatively',()=>{
 const data={data:[lane({route:'SR-101'}),lane({lat:37.1,lng:-122.1}),lane()]};
 data.data[2].lcs.closure.facility='On-Ramp';
 assert.equal(seg.parseLaneClosures(data,core.BIGSUR_STOPS,{now:NOW}).length,0);
 assert.equal(seg.projectRoute(routes()[2],core.BIGSUR_STOPS,[],{day:'2026-10-19',today:'2026-10-19',feedAvailable:false,now:NOW}).state,'VERIFY');
 assert.throws(()=>seg.parseLaneClosures({},core.BIGSUR_STOPS));
});
test('expired and cancelled lane records are not used for today',()=>{
 const old=lane({start:'2026-10-15T12:00:00-07:00',end:'2026-10-16T12:00:00-07:00'});
 const cancel=lane();cancel.lcs.closure.code1022.isCode1022='true';
 assert.equal(seg.parseLaneClosures({data:[old,cancel]},core.BIGSUR_STOPS,{now:NOW}).length,0);
});
test('chain-control parser preserves active R2 and rejects old R0 or stale controls',()=>{
 const x=(status,date,time,route='US-50')=>({cc:{inService:'true',location:{route,latitude:'38.8138',longitude:'-120.0306',locationName:'Echo Summit',county:'El Dorado'},
   statusData:{status,statusDescription:'Chains required',statusTimestamp:{statusDate:date,statusTime:time}}}});
 const events=seg.parseChainControl({data:[
  x('R-2','2026-10-19','12:30:00'),x('R-0','2026-10-19','12:30:00'),
  x('R-3','2026-10-18','12:30:00'),x('R-1','2026-10-19','12:30:00','US-395')
 ]},core.PASSES,{now:NOW});
 assert.equal(events.length,1);assert.equal(events[0].pass,'echo');assert.equal(events[0].status,'R-2');
});
test('generated interface exposes independent origin, destination, date, source and evidence controls',()=>{
 const html=fs.readFileSync('public/national-tools/big-sur-highway-1/index.html','utf8');
 const js=fs.readFileSync('public/assets/california-roads.js','utf8');
 for(const id of ['coastFrom','coastTo','travelDate','dayWindow','routeEvidence','reachableResult'])assert.ok(html.includes('id="'+id+'"'),id);
 assert.ok(js.includes("last?.events"),'uses actual location records');
 assert.ok(js.includes('coastPlan('),'evaluates all calendar days');
 assert.ok(js.includes('weatherFor('),'weather kept distinct');
});


test('live highway work near Rocky Creek affects a northern trip, while Mud Creek affects the southern approach',()=>{
 const notes=['1-way controlled traffic 15.7 mi south of Monterey /at Rocky Creek Bridge/ (Monterey Co) - Due to construction',
 '1-way controlled traffic at Mud Creek (Monterey Co) - Due to emergency work'];
 const events=seg.geolocateHighwayNotices(notes,{checkedAt:NOW});
 assert.equal(events.length,2);
 const args={day:'2026-10-19',today:'2026-10-19',feedAvailable:true,now:NOW};
 const north=seg.projectRoute(routes()[0],core.BIGSUR_STOPS,events,args);
 const south=seg.projectRoute(routes()[3],core.BIGSUR_STOPS,events,args);
 assert.equal(north.state,'CONTROLLED / WORK ZONES');
 assert.equal(south.state,'CONTROLLED / WORK ZONES');
 assert.equal(north.events.length,1);
 assert.match(north.events[0].beginPlace,/Rocky Creek/);
 assert.equal(south.events.length,1);
 assert.match(south.events[0].beginPlace,/Mud Creek/);
 const tomorrow=seg.projectRoute(routes()[0],core.BIGSUR_STOPS,events,{...args,day:'2026-10-20'});
 assert.equal(tomorrow.state,'NO MATCHED PLANNED WORK','today highway note must not become a forecast');
 assert.match(events[0].confidence,/approximate/);
});
