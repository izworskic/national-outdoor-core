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


const MUD_CREEK='1-way controlled traffic at Mud Creek (Monterey Co) from 0630 hrs to 1200 hrs Monday thru Friday thru 11/13/26 - Due to emergency work';
const ROCKY_CREEK='1-way controlled traffic 15.7 mi south of Monterey /at Rocky Creek Bridge/ (Monterey Co) 24 hrs a day 7 days a week thru 0600 hrs on 11/30/26 - Due to construction';
test('weekday Mud Creek schedules appear Monday through Friday, but never Saturday or Sunday',()=>{
 const today='2026-10-19',notes=seg.geolocateHighwayNotices([MUD_CREEK],{today,checkedAt:NOW});
 assert.equal(notes.length,1);
 const [mud]=notes;
 assert.equal(mud.currentOnly,false);
 assert.deepEqual(mud.scheduleDays.map(w=>w.day),['2026-10-19','2026-10-20','2026-10-21','2026-10-22','2026-10-23']);
 assert.ok(mud.scheduleDays.every(w=>w.start==='06:30'&&w.end==='12:00'));
 for(const d of ['2026-10-19','2026-10-20','2026-10-21','2026-10-22','2026-10-23'])
  assert.equal(seg.noticeAppliesOnDay(mud,d,today),true,d+' should list weekday work');
 for(const d of ['2026-10-24','2026-10-25'])
  assert.equal(seg.noticeAppliesOnDay(mud,d,today),false,d+' must not extrapolate work');
 const route=routes()[3];
 const opts={today,feedAvailable:true,now:NOW};
 assert.equal(seg.projectRoute(route,core.BIGSUR_STOPS,[mud],{...opts,day:'2026-10-21'}).state,'CONTROLLED / WORK ZONES');
 assert.equal(seg.projectRoute(route,core.BIGSUR_STOPS,[mud],{...opts,day:'2026-10-25'}).state,'NO MATCHED PLANNED WORK');
 assert.equal(seg.projectRoute(routes()[0],core.BIGSUR_STOPS,[mud],{...opts,day:'2026-10-21'}).state,'NO MATCHED PLANNED WORK');
});
test('24-hour Rocky Creek control appears seven days including the weekend',()=>{
 const today='2026-10-19',[rocky]=seg.geolocateHighwayNotices([ROCKY_CREEK],{checkedAt:NOW,today});
 assert.equal(rocky.scheduleDays.length,7);
 assert.ok(rocky.scheduleDays.every(w=>w.label==='All day'));
 for(const date of seg.allowedDates(today))assert.equal(seg.noticeAppliesOnDay(rocky,date,today),true);
 assert.equal(seg.projectRoute(routes()[0],core.BIGSUR_STOPS,[rocky],{day:'2026-10-25',today,feedAvailable:true,now:NOW}).state,'CONTROLLED / WORK ZONES');
 assert.equal(seg.projectRoute(routes()[3],core.BIGSUR_STOPS,[rocky],{day:'2026-10-25',today,feedAvailable:true,now:NOW}).state,'NO MATCHED PLANNED WORK');
});
test('work ending at 6am is limited to that time on its final calendar day',()=>{
 const today='2026-11-28',[event]=seg.geolocateHighwayNotices([ROCKY_CREEK],{today,checkedAt:Date.parse('2026-11-28T12:00:00-08:00')});
 assert.deepEqual(event.scheduleDays.map(w=>w.day),['2026-11-28','2026-11-29','2026-11-30']);
 assert.equal(event.scheduleDays[2].end,'06:00');
 assert.match(event.scheduleDays[2].label,/6 am/);
 assert.equal(seg.noticeAppliesOnDay(event,'2026-12-01',today),false);
});
test('unknown or broken schedules do not become invented future work',()=>{
 const today='2026-10-19';
 const unparsed=seg.geolocateHighwayNotices(['1-way controlled traffic at Mud Creek (Monterey Co) - Due to repairs'],{checkedAt:NOW,today})[0];
 assert.equal(unparsed.currentOnly,true);
 assert.equal(unparsed.scheduleDays,null);
 assert.equal(seg.noticeAppliesOnDay(unparsed,'2026-10-20',today),false);
 const invalid=seg.parseHighwayWorkSchedule(MUD_CREEK.replace('11/13/26','11/33/26'),{today});
 assert.equal(invalid,null);
 const yesterday=seg.geolocateHighwayNotices([MUD_CREEK.replace('11/13/26','10/18/26')],{checkedAt:NOW,today});
 assert.equal(yesterday.length,0,'expired notice must not be shown as current');
});
test('overnight Thursday to Monday window crosses midnight without turning into all-day traffic control',()=>{
 const today='2026-10-22';
 const text='1-way controlled traffic at Mud Creek (Monterey Co) from 2000 hrs to 0500 hrs Thursday thru Monday thru 10/30/26 - Due to repairs';
 const [event]=seg.geolocateHighwayNotices([text],{today,checkedAt:Date.parse('2026-10-22T12:00:00-07:00')});
 assert.equal(event.scheduleDays.find(x=>x.day==='2026-10-22').start,'20:00');
 assert.ok(event.scheduleDays.some(x=>x.day==='2026-10-23'&&x.start==='00:00'&&x.end==='05:00'));
 assert.equal(event.scheduleDays.filter(x=>x.day==='2026-10-27').length,1,'Tuesday inherits Monday overnight work until 5am');
 assert.equal(event.scheduleDays.find(x=>x.day==='2026-10-27').end,'05:00');
});
test('calendar source logic and client route/day logic both use explicit recurring windows',()=>{
 const js=fs.readFileSync('public/assets/california-roads.js','utf8');
 assert.match(js,/Array\.isArray\(e\.scheduleDays\)/);
 assert.match(js,/w\.day===day/);
 assert.match(js,/evidenceStamp/);
 assert.match(js,/scheduleExpires/);
});
