// Caltrans CWWP2 source-specific spatial observations for Sierra crossing planning.
// Segment overlap is approximate and NEVER substitutes for gate/whole-route validation.
const BASE='https://cwwp2.dot.ca.gov/data/';
export const DISTRICTS=[3,9,10];
export const FEED_URLS={
 lane:DISTRICTS.map(d=>BASE+'d'+d+'/lcs/lcsStatusD'+String(d).padStart(2,'0')+'.json'),
 camera:DISTRICTS.map(d=>BASE+'d'+d+'/cctv/cctvStatusD'+String(d).padStart(2,'0')+'.json')
};
const NUM=n=>n!==null&&n!==undefined&&String(n).trim()!==''&&Number.isFinite(Number(n))?Number(n):null;
const truth=v=>v===true||String(v).toLowerCase()==='true';
const R=Math.PI/180;
function distance(a,b){
 const dLat=(a.lat-b.lat)*R,dLon=(a.lng-b.lng)*R;
 const x=Math.sin(dLat/2)**2+Math.cos(a.lat*R)*Math.cos(b.lat*R)*Math.sin(dLon/2)**2;
 return 12742*Math.asin(Math.min(1,Math.sqrt(x)));
}
function point(lat,lng){
 const a=NUM(lat),b=NUM(lng);
 return a!==null&&b!==null&&a>=35&&a<=42&&b>=-124&&b<=-117?{lat:a,lng:b}:null;
}
function segmentDistance(p,a,b){
 if(!a||!b)return distance(p,a||b);
 // Metric equirectangular local projection, safe for segments under 100 km.
 if(distance(a,b)>100)return Math.min(distance(p,a),distance(p,b));
 const scale=Math.cos(p.lat*R),ax=(a.lng-p.lng)*scale,ay=a.lat-p.lat,bx=(b.lng-p.lng)*scale,by=b.lat-p.lat;
 const dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,(-ax*dx-ay*dy)/(dx*dx+dy*dy||1)));
 return distance(p,{lat:p.lat+ay+t*dy,lng:p.lng+(ax+t*dx)/scale});
}
function safeCameraUrl(raw){
 try{
  const url=new URL(raw);
  return url.protocol==='https:'&&url.hostname==='cwwp2.dot.ca.gov'&&url.pathname.includes('/cctv/image/')&&/\.(?:jpe?g|png)$/i.test(url.pathname)?url.href:null;
 }catch{return null;}
}
function roadMatches(pass,raw){
 return String(raw||'').replace(/^(?:SR|US|I)[ -]?0*/i,'').trim()===String(pass.road);
}
export function readSierraWork(payload,passes,{now=Date.now()}={}){
 if(!Array.isArray(payload?.data))throw Error('Caltrans LCS payload missing data');
 const byPass=Object.fromEntries(passes.map(p=>[p.id,[]]));
 for(const item of payload.data){
  const v=item?.lcs,loc=v?.location,c=v?.closure,s=c?.closureTimestamp;
  if(!loc||!c||!s||!/^Mainline$/i.test(String(c.facility||''))||
    truth(c.code1022?.isCode1022)||truth(c.code1098?.isCode1098))continue;
  const start=NUM(s.closureStartEpoch),end=NUM(s.closureEndEpoch);
  if(start===null||end===null||end<start||end*1000<now-1800000||start*1000>now+7*86400000)continue;
  const a=point(loc.begin?.beginLatitude,loc.begin?.beginLongitude),b=point(loc.end?.endLatitude,loc.end?.endLongitude);
  if(!a&&!b)continue;
  const typ=String(c.typeOfClosure||''),type=/^full$/i.test(typ)?'full':/one-way|alternating/i.test(typ)?'controlled':'lane';
  for(const pass of passes){
   if(!roadMatches(pass,loc.begin?.beginRoute)||loc.end?.endRoute&&!roadMatches(pass,loc.end.endRoute))continue;
   const p={lat:pass.lat,lng:pass.lng},distanceKm=segmentDistance(p,a,b);
   if(distanceKm>45)continue;
   const live=truth(c.code1097?.isCode1097)&&start*1000<=now&&end*1000>=now;
   byPass[pass.id].push({
    id:String(v.index||c.closureID||'').slice(0,90),type,live,
    timing:live?'Reported active':'Scheduled or unconfirmed',
    area:distanceKm<=12?'Pass vicinity':'Approach corridor',
    distanceKm:Math.round(distanceKm),
    lat:a?.lat??b.lat,lng:a?.lng??b.lng,endLat:b?.lat??null,endLng:b?.lng??null,
    begin:String(loc.begin?.beginLocationName||loc.begin?.beginFreeFormDescription||loc.begin?.beginNearbyPlace||'Unspecified segment').slice(0,110),
    end:String(loc.end?.endLocationName||loc.end?.endFreeFormDescription||loc.end?.endNearbyPlace||'').slice(0,110),
    direction:String(loc.travelFlowDirection||'').slice(0,30),
    work:String(c.typeOfWork||'Highway work').slice(0,110),
    startEpoch:start,endEpoch:end,
    evidence:'Caltrans georeferenced mainline closure segment; distance to summit is approximate; does not prove gate status',
    source:'https://quickmap.dot.ca.gov/'
   });
  }
 }
 for(const p of passes)byPass[p.id].sort((a,b)=>{
  const score=x=>(x.live?100:0)+(x.type==='full'?30:0)+(x.area==='Pass vicinity'?12:0)-x.distanceKm/10;
  return score(b)-score(a);
 });
 return byPass;
}
export function readSierraCameras(payload,passes){
 if(!Array.isArray(payload?.data))throw Error('Caltrans CCTV payload missing data');
 const byPass=Object.fromEntries(passes.map(p=>[p.id,[]]));
 for(const item of payload.data){
  const c=item?.cctv,l=c?.location,img=c?.imageData;
  if(!c||!l||!truth(c.inService))continue;
  const imageUrl=safeCameraUrl(img?.static?.currentImageURL);
  if(!imageUrl)continue;
  const position=point(l.latitude,l.longitude);
  if(!position)continue;
  for(const pass of passes){
   if(!roadMatches(pass,l.route))continue;
   const dist=distance(position,{lat:pass.lat,lng:pass.lng});
   if(dist>75)continue;
   byPass[pass.id].push({
    id:String(c.index||l.locationName||'').slice(0,80),
    name:String(l.locationName||l.nearbyPlace||'Caltrans road camera').slice(0,120),
    route:String(l.route).slice(0,14),
    lat:position.lat,lng:position.lng,distanceKm:Math.round(dist),
    imageUrl,source:'https://cwwp2.dot.ca.gov/documentation/cctv/cctv.htm',
    updateMinutes:NUM(img.static?.currentImageUpdateFrequency),
    note:'Official camera still; Caltrans does not guarantee current frame age or uninterrupted availability.'
   });
  }
 }
 for(const pass of passes){
  byPass[pass.id].sort((a,b)=>a.distanceKm-b.distanceKm);
  byPass[pass.id]=byPass[pass.id].slice(0,3);
 }
 return byPass;
}
export function summarizeSierraObservation(pass,work=[],cameras=[],{laneFeeds=0,cameraFeeds=0}={}){
 const activeFull=work.filter(x=>x.live&&x.type==='full');
 const activeNear=activeFull.filter(x=>x.area==='Pass vicinity');
 const scheduledFull=work.filter(x=>!x.live&&x.type==='full');
 const workActive=work.filter(x=>x.live&&x.type!=='full');
 const state=activeNear.length?'FULL CLOSURE REPORTED NEAR PASS':
   activeFull.length?'FULL CLOSURE ON APPROACH':
   scheduledFull.length?'FULL CLOSURE SCHEDULED':
   workActive.length?'ACTIVE ROADWORK NEAR PASS':
   work.length?'ROADWORK SCHEDULED':
   laneFeeds===3?'NO MATCHING LCS WORK':'LCS COVERAGE INCOMPLETE';
 return {state,work:work.slice(0,8),cameras:cameras.slice(0,3),
  laneFeeds,cameraFeeds,
  explanation:state==='NO MATCHING LCS WORK'?'No matched lane-closure records near this summit; this is not an open-road or gate confirmation.':
   state==='LCS COVERAGE INCOMPLETE'?'One or more lane-closure feeds failed; absence of events cannot be interpreted as a clear route.':
   'Caltrans lane closure events refer to georeferenced mainline segments near or approaching the pass. Planned activity and current actual closures are separate.',
  cameraNote:cameraFeeds===3?'Camera availability varies; images may lag or be offline.':'One or more camera datasets unavailable; nearby cameras may be missing.',
  source:'https://cwwp2.dot.ca.gov/'};
}
