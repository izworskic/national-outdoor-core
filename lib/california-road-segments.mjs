// Caltrans CWWP2 location-based decision helpers. All unknowns remain unknown.
// Official LCS is approved/scheduled activity; a plan does not prove a restriction is active.
export const COAST_DAYS=7;
const RAD=Math.PI/180, EARTH=6371;
const finite=n=>n!==null&&n!==undefined&&String(n).trim()!==''&&Number.isFinite(Number(n))?Number(n):null;
const isTrue=v=>v===true||String(v).toLowerCase()==='true';
export function localDate(now=new Date()){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const field=k=>parts.find(x=>x.type===k)?.value;
 return [field('year'),field('month'),field('day')].join('-');
}
export function allowedDates(today=localDate()){
 const days=[];
 for(let i=0;i<COAST_DAYS;i++) days.push(new Date(Date.parse(today+'T12:00:00Z')+i*86400000).toISOString().slice(0,10));
 return days;
}
export const SOURCE={
 lane5:'https://cwwp2.dot.ca.gov/data/d5/lcs/lcsStatusD05.json',
 chain3:'https://cwwp2.dot.ca.gov/data/d3/cc/ccStatusD03.json',
 chain9:'https://cwwp2.dot.ca.gov/data/d9/cc/ccStatusD09.json',
 chain10:'https://cwwp2.dot.ca.gov/data/d10/cc/ccStatusD10.json'
};
function geoKm(lat1,lon1,lat2,lon2){
 const dLat=(lat2-lat1)*RAD,dLon=(lon2-lon1)*RAD;
 const h=Math.sin(dLat/2)**2+Math.cos(lat1*RAD)*Math.cos(lat2*RAD)*Math.sin(dLon/2)**2;
 return 2*EARTH*Math.asin(Math.min(1,Math.sqrt(h)));
}
export function locateOnCoast(lat,lon,stops){
 if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat<35.44||lat>36.67||lon< -122.2||lon> -120.88)return null;
 const n=stops.length;if(n<2)return null;
 let best=null;
 for(let i=0;i<n-1;i++){
  const a=stops[i],b=stops[i+1], mid=(a.lat+b.lat)/2;
  const x=Math.cos(mid*RAD),dx=(b.lng-a.lng)*x,dy=b.lat-a.lat;
  const t=Math.max(0,Math.min(1,((lon-a.lng)*x*dx+(lat-a.lat)*dy)/(dx*dx+dy*dy||1)));
  const projectedLat=a.lat+t*dy,projectedLon=a.lng+t*(b.lng-a.lng);
  const distanceKm=geoKm(lat,lon,projectedLat,projectedLon);
  if(!best||distanceKm<best.distanceKm)best={edge:i,fraction:t,position:i+t,distanceKm};
 }
 return best&&best.distanceKm<=12?best:null; // schematic centerline, not surveyed road geometry
}
export function parseLaneClosures(payload,stops,{now=Date.now()}={}){
 if(!Array.isArray(payload?.data))throw Error('CWWP2 Lane Closure schema missing');
 const out=[];
 for(const wrapper of payload.data){
  const x=wrapper?.lcs,loc=x?.location,c=x?.closure,begin=loc?.begin,end=loc?.end,stamp=c?.closureTimestamp;
  if(!x||!loc||!c||!begin||!stamp)continue;
  if(!/^SR[- ]?0?1$/i.test(String(begin.beginRoute||'')))continue;
  if(!/Monterey|San Luis Obispo/i.test(String(begin.beginCounty||'')))continue;
  if(c?.code1022&&isTrue(c.code1022.isCode1022)||c?.code1098&&isTrue(c.code1098.isCode1098))continue;
  if(!/^(mainline)$/i.test(String(c.facility||'').trim()))continue;
  const a=locateOnCoast(finite(begin.beginLatitude),finite(begin.beginLongitude),stops);
  const b=locateOnCoast(finite(end?.endLatitude),finite(end?.endLongitude),stops);
  if(!a&&!b)continue;
  const start=Number(stamp.closureStartEpoch),finish=Number(stamp.closureEndEpoch);
  if(!Number.isFinite(start)||start<1e9||!Number.isFinite(finish)||finish<start)continue;
  if(finish*1000<now-86400000||start*1000>now+COAST_DAYS*86400000)continue;
  const type=String(c.typeOfClosure||'').trim();
  const typeGroup=/^full$/i.test(type)?'full':/one-way|alternating/i.test(type)?'controlled':'lane';
  const startPos=Math.min(a?.position??b.position,b?.position??a.position);
  const endPos=Math.max(a?.position??b.position,b?.position??a.position);
  const confidence=a&&b?'two Caltrans endpoints':'one georeferenced endpoint';
  const delay=finite(c.estimatedDelay);
  out.push({id:String(x.index||c.closureID||'').slice(0,96),type:typeGroup,typeLabel:type||'Lane',
   startEpoch:start,endEpoch:finish,active:isTrue(c?.code1097?.isCode1097),from:Math.max(0,startPos-.1),to:Math.min(stops.length-1,endPos+.1),
   lat:a?Number(begin.beginLatitude):Number(end?.endLatitude),lng:a?Number(begin.beginLongitude):Number(end?.endLongitude),
   position:(startPos+endPos)/2,confidence,beginPlace:String(begin.beginLocationName||begin.beginFreeFormDescription||begin.beginNearbyPlace||'').slice(0,100),
   endPlace:String(end?.endLocationName||end?.endFreeFormDescription||end?.endNearbyPlace||'').slice(0,100),
   work:String(c.typeOfWork||'').slice(0,90),direction:String(loc.travelFlowDirection||'').slice(0,40),
   delayMinutes:delay!==null&&delay>=0&&delay<=120?delay:null,source:SOURCE.lane5,
   recordEpoch:finite(x?.recordTimestamp?.recordEpoch)});
 }
 return out.sort((a,b)=>a.startEpoch-b.startEpoch).slice(0,130);
}
function routeIndices(trip,stops){
 const ids=Array.isArray(trip?.stops)?trip.stops:[];
 const from=stops.findIndex(s=>s.id===ids[0]),to=stops.findIndex(s=>s.id===ids[ids.length-1]);
 return from>=0&&to>=0&&from!==to?{from,to,min:Math.min(from,to),max:Math.max(from,to),step:Math.sign(to-from)}:null;
}
export function projectRoute(trip,stops,events,{day=localDate(),today=localDate(),feedAvailable=false,reportState='VERIFY',now=Date.now()}={}){
 const ix=routeIndices(trip,stops);
 if(!ix)return {state:'VERIFY',reason:'Route endpoints are missing.',events:[],reachable:[]};
 const inRoute=events.filter(e=>e.from < ix.max && e.to > ix.min &&
   localDate(new Date(e.startEpoch*1000))<=day && localDate(new Date(e.endEpoch*1000))>=day);
 const full=inRoute.filter(e=>e.type==='full'),working=inRoute.filter(e=>e.type!=='full');
 const activeFull=day===today&&full.some(e=>e.active&&now>=e.startEpoch*1000&&now<=e.endEpoch*1000);
 let state= !feedAvailable?'VERIFY':activeFull?'FULL CLOSURE REPORTED':full.length?'SCHEDULED FULL CLOSURE':working.length?'CONTROLLED / WORK ZONES':'NO MATCHED PLANNED WORK';
 if(!feedAvailable&&/CLOSURE REPORTED/i.test(reportState))state='VERIFY';
 const first=full.length?full.reduce((prev,e)=> (ix.step>0?e.from<prev.from:e.to>prev.to)?e:prev):null;
 const reachable=[];
 for(let i=ix.from;ix.step>0?i<=ix.to:i>=ix.to;i+=ix.step){
  if(first&&(ix.step>0?i>first.from:i<first.to))break;
  reachable.push(stops[i].id);
 }
 const reason=state==='VERIFY'?'Official lane-closure feed is unavailable. This is not a route-wide all-clear.':
  state==='FULL CLOSURE REPORTED'?'A georeferenced Caltrans record reports an active full mainline closure on your selected corridor. Confirm endpoints in QuickMap.':
  state==='SCHEDULED FULL CLOSURE'?'A Caltrans-approved full mainline closure is scheduled for this travel day. It may not yet be active.':
  state==='CONTROLLED / WORK ZONES'?'The selected drive overlaps Caltrans lane or one-way work; passage and delays need checking.':
  'No approved lane closures matched this selected corridor and day. That does NOT establish the road is open; consult current Caltrans highway restrictions.';
 return {state,reason,events:inRoute.slice(0,20),reachable:reachable.slice(0,9),affectedEdges:inRoute.map(e=>({from:e.from,to:e.to,type:e.type,active:e.active,id:e.id})),date:day,from:stops[ix.from].name,to:stops[ix.to].name};
}
export function projectAllRoutes(trips,stops,events,opts){
 return Object.fromEntries(trips.map(t=>[t.id,projectRoute(t,stops,events,opts)]));
}
export function parseChainControl(payload,passes,{now=Date.now()}={}){
 if(!Array.isArray(payload?.data))throw Error('CWWP2 chain schema missing');
 const out=[];
 for(const row of payload.data){
  const c=row?.cc,l=c?.location,s=c?.statusData,code=String(s?.status||'').toUpperCase();
  if(!c||!l||!s||!isTrue(c.inService)||!code||code==='R-0')continue;
  const date=s.statusTimestamp?.statusDate,time=s.statusTimestamp?.statusTime;
  const winter=date&&/-(?:11|12|01|02)-/.test(date);
  const timestamp=date&&time?Date.parse(date+'T'+time+(winter?'-08:00':'-07:00')):NaN; // fail conservatively near DST transition
  if(!Number.isFinite(timestamp)||now-timestamp>3*3600000||timestamp-now>3600000)continue;
  const route=String(l.route||'').replace(/^(?:SR-|US-|I-)/,'');
  const lat=finite(l.latitude),lng=finite(l.longitude);
  if(lat===null||lng===null)continue;
  for(const pass of passes){
   if(String(pass.road)!==route)continue;
   const dist=geoKm(pass.lat,pass.lng,lat,lng);
   if(dist>70)continue;
   out.push({pass:pass.id,status:code,description:String(s.statusDescription||'Chain controls indicated').slice(0,180),
     name:String(l.locationName||l.nearbyPlace||pass.name).slice(0,120),lat,lng,distanceKm:Math.round(dist),
     observedAt:date+' '+time+' Pacific local',route:l.route});
  }
 }
 return out.slice(0,60);
}
