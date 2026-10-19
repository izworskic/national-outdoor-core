// Official Caltrans State Highway Network (SHN) roadway-centerline reference.
// Not a connected navigable routing graph. Does NOT prove that gates or bridges are open.
export const SHN_SOURCE='https://gisdata.dot.ca.gov/arcgis/rest/services/CHhighway/SHN_Lines/FeatureServer/0';
const MAX_GEO_POINTS=5500;
export const ALTERNATIVE_PASS_IDS={
 sonora:['carson','ebbetts','tioga','echo'],ebbetts:['carson','sonora','monitor','echo'],
 carson:['echo','donner','ebbetts','sonora'],monitor:['carson','sonora','ebbetts','echo'],
 tioga:['sonora','carson','echo','donner'],echo:['donner','carson','sonora','ebbetts'],
 donner:['echo','carson','sonora','ebbetts']
};
export function findPass(passes,id){
 return Array.isArray(passes)?passes.find(x=>x.id===id):null;
}
export function geometryQuery(pass){
 if(!pass||!Number.isInteger(pass.road)||!Number.isFinite(pass.lat)||!Number.isFinite(pass.lng))throw Error('Pass not supported');
 const marginLat=.36,marginLng=.53;
 const bounds=[pass.lng-marginLng,pass.lat-marginLat,pass.lng+marginLng,pass.lat+marginLat].map(v=>v.toFixed(5)).join(',');
 const params=[
  ['where',"Route="+pass.road+" AND AlignCode='Right'"],
  ['geometry',bounds],['geometryType','esriGeometryEnvelope'],['inSR','4326'],
  ['spatialRel','esriSpatialRelIntersects'],['outFields','Route,AlignCode,County'],
  ['returnGeometry','true'],['outSR','4326'],['maxAllowableOffset','0.001'],
  ['resultRecordCount','100'],['f','geojson']
 ];
 return SHN_SOURCE+'/query?'+params.map(([k,v])=>k+'='+encodeURIComponent(v)).join('&');
}
function validPoint(p){
 return Array.isArray(p)&&p.length>=2&&p.length<=4&&Number.isFinite(p[0])&&Number.isFinite(p[1])&&
  p[0]>=-124.6&&p[0]<=-113.5&&p[1]>=32&&p[1]<=42.5;
}
function withinPass(p,pass){return Math.abs(p[0]-pass.lng)<=.6&&Math.abs(p[1]-pass.lat)<=.43;}
function summitDistanceKm(p,pass){
 const rad=Math.PI/180,dl=(p[1]-pass.lat)*rad,dg=(p[0]-pass.lng)*rad;
 const a=Math.sin(dl/2)**2+Math.cos(pass.lat*rad)*Math.cos(p[1]*rad)*Math.sin(dg/2)**2;
 return 12742*Math.asin(Math.min(1,Math.sqrt(a)));
}
export function validateRoadGeometry(data,pass){
 if(data?.type!=='FeatureCollection'||!Array.isArray(data.features))throw Error('Official Caltrans SHN geometry unavailable');
 const segments=[],seen=new Set();let coordsCount=0,hasNearby=false;
 for(const feature of data.features){
  const props=feature?.properties||{},geo=feature?.geometry;
  if(Number(props.Route)!==pass.road||props.AlignCode!=='Right'||!geo)continue;
  const chunks=geo.type==='LineString'?[geo.coordinates]:geo.type==='MultiLineString'?geo.coordinates:[];
  if(!Array.isArray(chunks))continue;
  for(const coords of chunks){
   if(!Array.isArray(coords)||coords.length<2||coords.length>2500||!coords.every(validPoint))continue;
   coordsCount+=coords.length;
   if(coordsCount>MAX_GEO_POINTS)throw Error('Caltrans SHN geometry exceeds safe rendering limit');
   if(!coords.some(x=>withinPass(x,pass)))continue;
   const converted=coords.map(c=>[+c[0].toFixed(5),+c[1].toFixed(5)]);
   const key=converted[0].join(',')+':'+converted.at(-1).join(',');
   if(seen.has(key))continue;
   seen.add(key);
   segments.push(converted);
   if(coords.some(x=>summitDistanceKm(x,pass)<12))hasNearby=true;
  }
 }
 // A segment crossing the summit vicinity is mandatory, to avoid showing unrelated roads.
 if(!hasNearby||segments.length===0)return{ok:false,available:false,reason:'Caltrans SHN geometry does not confirm the selected highway centerline at this pass.',segments:[],source:SHN_SOURCE};
 return{ok:true,available:true,segments:segments.slice(0,35),segmentCount:segments.length,
  source:SHN_SOURCE,sourceYear:2025,accuracy:'Caltrans SHN state-highway reference, not a live drivable path; geometry may contain physical gaps or duplicate alignments',
  label:pass.roadLabel||String(pass.road)};
}
export async function getSierraHighwayGeometry(pass,{fetchImpl=fetch}={}){
 const url=geometryQuery(pass),ac=new AbortController();
 const timer=setTimeout(()=>ac.abort(),8000);
 try{
  const response=await fetchImpl(url,{signal:ac.signal,headers:{'User-Agent':'ChrisIzworskiSierraPlanner/1.0 (https://chrisizworski.com/)','Accept':'application/geo+json'}});
  if(!response.ok)throw Error('Caltrans geometry query HTTP '+response.status);
  const raw=await response.text();
  if(raw.length>1200000)throw Error('Caltrans geometry response too large');
  return validateRoadGeometry(JSON.parse(raw),pass);
 }finally{clearTimeout(timer);}
}
export function crossingChoices(selected,passes){
 const ids=ALTERNATIVE_PASS_IDS[selected.id]||[];
 return ids.map(id=>findPass(passes,id)).filter(Boolean).map(p=>{
  const s=String(p.crossingState||'GATE UNVERIFIED');
  const closure=/CLOSED REPORTED|FULL ROAD CLOSURE NEAR PASS/i.test(s);
  return{id:p.id,name:p.name,roadLabel:p.roadLabel,from:p.from,to:p.to,
   crossingState:s,category:closure?'CLOSURE REPORTED · DO NOT ASSUME PASSABLE':'UNVERIFIED CROSSING OPTION',
   explanation:closure?'An official closure is reported. Do not attempt this crossing without checking authoritative updated road status.':
   'A geographic alternative only. Gate status, incident closures, winter controls, vehicle limits and total detour distance require separate verification.'};
 });
}
