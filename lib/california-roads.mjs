import {FEED_URLS,readSierraWork,readSierraCameras,summarizeSierraObservation} from './california-sierra-observations.mjs';
import {GATE_SOURCES,parseNpsTioga,parseCaltransSeasonalPasses,classifyPassGate} from './california-pass-gates.mjs';
import {SOURCE,localDate,allowedDates,parseLaneClosures,projectAllRoutes,parseChainControl,geolocateHighwayNotices} from './california-road-segments.mjs';
// California road intelligence: official Caltrans wording, not a routing API.
// Do not convert a missing restriction notice into a verified open summit.
const UA='ChrisIzworskiCaliforniaRoads/1.0 (https://chrisizworski.com/national-tools/)';
const TIMEOUT=8500;
export const PASSES=[
  {id:'sonora',name:'Sonora Pass',road:108,roadLabel:'CA-108',lat:38.3278,lng:-119.6358,elevation:'9,624 ft',seasonal:true,from:'Sonora',to:'Bridgeport',character:'A narrow, steep alpine crossing. Best treated as a deliberate mountain drive, not a fast detour.'},
  {id:'ebbetts',name:'Ebbetts Pass',road:4,roadLabel:'CA-4',lat:38.5444,lng:-119.8085,elevation:'8,736 ft',seasonal:true,from:'Arnold',to:'Markleeville',character:'Very narrow alpine road with sharp curves; oversized vehicles and trailers require extra care.'},
  {id:'carson',name:'Carson Pass',road:88,roadLabel:'CA-88',lat:38.6936,lng:-119.9869,elevation:'8,574 ft',seasonal:false,from:'Jackson',to:'Minden',character:'Important year-round Sierra approach, but storms can bring chain controls and closures.'},
  {id:'monitor',name:'Monitor Pass',road:89,roadLabel:'CA-89',lat:38.6774,lng:-119.6204,elevation:'8,314 ft',seasonal:true,from:'Markleeville',to:'Topaz Lake',character:'Seasonal eastern Sierra link; confirm the exact pass gate, not only a statewide CA-89 report.'},
  {id:'tioga',name:'Tioga Pass / Yosemite',road:120,roadLabel:'CA-120',lat:37.9100,lng:-119.2580,elevation:'9,943 ft',seasonal:true,from:'Groveland',to:'Lee Vining',character:'Yosemite National Park controls the park crossing; Caltrans alone cannot confirm passage.'},
  {id:'echo',name:'Echo Summit / US 50',road:50,roadLabel:'US-50',lat:38.8138,lng:-120.0306,elevation:'7,382 ft',seasonal:false,from:'Placerville',to:'South Lake Tahoe',character:'Major winter corridor; current chain restrictions and short-lived controls matter more than historical dates.'},
  {id:'donner',name:'Donner Summit / I-80',road:80,roadLabel:'I-80',lat:39.3150,lng:-120.3220,elevation:'7,240 ft',seasonal:false,from:'Sacramento',to:'Truckee',character:'Major trans-Sierra freeway with separate westbound/eastbound truck and chain controls.'}
];
export const BIGSUR_STOPS=[
 {id:'carmel',name:'Carmel',lat:36.5552,lng:-121.9233,note:'Northern gateway; confirm the coastal route before leaving town.'},
 {id:'bixby',name:'Bixby Creek Bridge',lat:36.3714,lng:-121.9015,note:'Iconic viewpoint; parking and turnouts are not guaranteed.'},
 {id:'bigsur',name:'Big Sur Village',lat:36.2704,lng:-121.8079,note:'Services are limited; check fuel and dining hours independently.'},
 {id:'mcway',name:'McWay Falls area',lat:36.1580,lng:-121.6726,note:'Park and trail access can differ from highway access.'},
 {id:'lucia',name:'Lucia',lat:36.0214,lng:-121.5472,note:'A slide or fire restriction south of here can split the through-drive.'},
 {id:'gorda',name:'Gorda',lat:35.8753,lng:-121.4475,note:'Check the southern approach and seasonal services.'},
 {id:'ragged',name:'Ragged Point',lat:35.7829,lng:-121.3297,note:'Southern gateway to the dramatic cliff section.'},
 {id:'cambria',name:'Cambria',lat:35.5641,lng:-121.0808,note:'Southern base; US-101 is an alternate corridor, not a coast-hugging detour.'}
];
export const COAST_TRIPS=[
 {id:'north',name:'Carmel → Big Sur Village',stops:['carmel','bixby','bigsur'],explain:'Northern Big Sur day trip. A closure south of Big Sur Village may not prevent visiting Bixby Bridge and the village.'},
 {id:'falls',name:'Carmel → McWay Falls area',stops:['carmel','bixby','bigsur','mcway'],explain:'Check the southern approach to McWay Falls and the park trail separately from Highway 1 traffic.'},
 {id:'through',name:'Carmel → Cambria (entire coast)',stops:BIGSUR_STOPS.map(x=>x.id),explain:'A complete coast drive requires every segment. A single closure between villages defeats the through-drive; check Caltrans QuickMap.'},
 {id:'south',name:'Cambria → Big Sur Village',stops:['cambria','ragged','gorda','lucia','mcway','bigsur'],explain:'South-to-north: a slide near Lucia or Gorda can end the drive well before Big Sur Village.'}
];
function decode(text){
 return String(text||'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ')
  .replace(/<\/(?:p|div|h[1-6]|li|tr|section)>|<br\s*\/?>/gi,'\n')
  .replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&')
  .replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'")
  .replace(/[ \t]+/g,' ').replace(/\n[ \t]*/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
}
export function parseReport(input,road){
 const txt=decode(input), header=new RegExp('(?:^|\\n|\\s)(?:SR|US|I)\\s*'+road+'\\b','i');
 const match=header.exec(txt);
 if(!match)return {ok:false,road,reason:'Highway section not found',notes:[],reportedAt:null};
 const main=txt.slice(match.index+match[0].length);
 const tail=main.split(/\b(?:SR|US|I)\s+\d{1,3}\b/)[0].split(/\bBack to Top\b/i)[0];
 const date=(txt.match(/(?:latest\s+reported\s+as\s+of|reported\s+as\s+of)\s+([^\n.]+)/i)||[])[1]||null;
 const headings=[...tail.matchAll(/\[((?:IN THE|YOSEMITE|CAPITAL CITY|BUSINESS 80)[^\]]+)\]/gi)];
 const sections=headings.map((x,i)=>({name:x[1],text:tail.slice(x.index+x[0].length,headings[i+1]?.index??tail.length).trim()}));
 return {ok:true,road,reportedAt:date,sections,raw:tail.slice(0,4200)};
}
function lines(section){
 const raw=(section?.text||'').split(/\n+/).map(x=>x.trim()).filter(Boolean)
  .filter(x=>!(/^(?:back to top|conditions of use|privacy policy|accessibility|contact us|copyright|state of california|caltrans|\* \* \*)/i.test(x)));
 const out=[];
 const newNotice=/^(?:1-way|one-way|is closed|are closed|closed|no traffic restrictions|chains? |all (?:eastbound|westbound|northbound|southbound)|traffic |a high wind advisory|lane |motorists? |vehicles? |northbound |southbound |eastbound |westbound |road(?:way)? (?:is|closed))/i;
 for(const line of raw){
  if(!out.length||newNotice.test(line))out.push(line);
  else out[out.length-1]+=' '+line;
 }
 return out;
}
export function assessBigSur(report){
 if(!report.ok)return {state:'VERIFY',reason:report.reason||'Report unavailable',notes:[]};
 const area=report.sections.find(x=>/CENTRAL CALIFORNIA/i.test(x.name));
 if(!area)return {state:'VERIFY',reason:'Central California report section missing',notes:[]};
 const countyNotes=lines(area).filter(x=>/Monterey Co|Monterey County|Big Sur|Mud Creek|Rocky Creek|Regent|Lucia|Gorda|Pacific Valley|Ragged Point|Bixby|Esalen|Nepenthe/i.test(x));
 const closures=countyNotes.filter(x=>/\b(?:is closed|are closed|closed (?:from|between|at|to)|full (?:road|highway|overnight )?closure)\b/i.test(x));
 const controls=countyNotes.filter(x=>/\b(?:1-way|one-way|controlled traffic|lane closed|reduced to \d lane|delay|construction|emergency work)\b/i.test(x));
 const quiet=/No traffic restrictions are reported for this area/i.test(area.text);
 let state='VERIFY', reason='Caltrans has no specific statement confirming the entire Big Sur drive.';
 if(closures.length){state='CLOSURE REPORTED';reason='A Monterey/Big Sur closure appears in the official Highway 1 report. Verify its exact limits.';}
 else if(controls.length){state='WORK ZONES REPORTED';reason='No Big Sur full closure was identified in this report, but controlled traffic or work zones can delay your drive.';}
 else if(quiet){state='NO RESTRICTIONS REPORTED';reason='The Central California report lists no traffic restrictions. Short-notice incidents may not appear here.';}
 else if(countyNotes.length){state='VERIFY';reason='Caltrans has Monterey-area notes that need location-specific verification.';}
 return {state,reason,notes:countyNotes.slice(0,8),closures:closures.length,controls:controls.length,source:'Caltrans Highway 1 (Central California section)'};
}
export function assessPass(report,pass){
 if(!report.ok)return {state:'UNAVAILABLE',explanation:'Could not retrieve or identify this Caltrans highway report.',notes:[]};
 const section=report.sections.find(x=>pass.road===80?/NORTHERN CALIFORNIA AREA.*SIERRA NEVADA/i.test(x.name):pass.road===50?/SACRAMENTO VALLEY.*LAKE TAHOE BASIN/i.test(x.name):/CENTRAL CALIFORNIA/i.test(x.name));
 const entries=section?lines(section).filter(x=>!/For Yosemite/i.test(x)).slice(0,10):[];
 if(!entries.length)return {state:'VERIFY',explanation:'Relevant Sierra highway report section is missing or ambiguous.',notes:[]};
 const closure=entries.some(x=>/\b(?:is closed|are closed|closed (?:from|between|at|to)|roadway is shut)\b/i.test(x));
 const control=entries.some(x=>/\b(?:chains? (?:are )?required|chain control|1-way|one-way|controlled traffic|restriction|delay|traffic reduced)\b/i.test(x)&& !/no traffic restrictions are reported/i.test(x));
 const quiet=entries.every(x=>/no traffic restrictions are reported for this area/i.test(x));
 let state=closure?'CLOSURE REPORTED':control?'RESTRICTIONS REPORTED':quiet?'NO RESTRICTIONS REPORTED':'VERIFY';
 if(pass.id==='tioga'&&state==='NO RESTRICTIONS REPORTED')state='PARK CHECK REQUIRED';
 const explanation=pass.id==='tioga'?'Yosemite NPS independently controls the actual Tioga Road park crossing. A Caltrans Highway 120 report cannot verify the gate.':
   pass.seasonal?'Seasonal gate status is not established by the absence of Caltrans restrictions. Reconfirm the pass gate in QuickMap or by phone.':
   'Highway reports may not reflect a developing storm, incident, or chain control immediately.';
 return {state,explanation,notes:entries.slice(0,5)};
}
async function getRoad(road){
 const url='https://roads.dot.ca.gov/?roadnumber='+road;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),TIMEOUT);
 try {
  const r=await fetch(url,{signal:controller.signal,headers:{'User-Agent':UA,'Accept':'text/html'}});
  if(!r.ok)throw Error('Caltrans HTTP '+r.status);
  return parseReport(await r.text(),road);
 } finally {clearTimeout(timer);}
}
async function fetchCaltransJson(url){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),9500);
 try {
  const r=await fetch(url,{signal:controller.signal,headers:{'User-Agent':UA,'Accept':'application/json'}});
  if(!r.ok)throw Error('Caltrans structured feed HTTP '+r.status);
  const text=await r.text();
  if(text.length>8000000)throw Error('Structured feed too large');
  const d=JSON.parse(text);
  if(!Array.isArray(d?.data))throw Error('Structured feed has no data array');
  return d;
 }finally{clearTimeout(timer);}
}
async function coastForecast(){
 const ac=new AbortController(),timer=setTimeout(()=>ac.abort(),4500);
 const source='https://api.weather.gov/points/36.2704,-121.8079';
 try{
  const headers={'User-Agent':'ChrisIzworskiTravelDecision/1.0 (https://chrisizworski.com/)','Accept':'application/geo+json'};
  const first=await fetch(source,{headers,signal:ac.signal});
  if(!first.ok)throw Error('NWS forecast location HTTP '+first.status);
  const grid=(await first.json())?.properties?.forecast;
  if(typeof grid!=='string'||!grid.startsWith('https://api.weather.gov/'))throw Error('No NWS forecast grid');
  const second=await fetch(grid,{headers,signal:ac.signal});
  if(!second.ok)throw Error('NWS forecast HTTP '+second.status);
  const periods=(await second.json())?.properties?.periods;
  if(!Array.isArray(periods))throw Error('NWS forecast periods unavailable');
  return {available:true,source:grid,location:'Big Sur Village vicinity (regional forecast, not a road-closure forecast)',
    days:periods.slice(0,14).map(p=>({
      day:localDate(new Date(p.startTime)),name:p.name,summary:String(p.shortForecast||'').slice(0,160),
      temp:Number(p.temperature)||null,unit:p.temperatureUnit||'F',wind:String(p.windSpeed||'').slice(0,50),
      precipitationChance:Number.isFinite(Number(p.probabilityOfPrecipitation?.value))?Number(p.probabilityOfPrecipitation.value):null
    }))};
 }catch{return {available:false,location:'Big Sur Village vicinity',source:'https://forecast.weather.gov/',
   explanation:'NWS forecast unavailable. Do not assume favorable conditions.'};}
 finally{clearTimeout(timer);}
}

async function fetchOfficialGatePage(url){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),6500);
 try{
  const response=await fetch(url,{headers:{'User-Agent':UA,'Accept':'text/html'},signal:controller.signal});
  if(!response.ok)throw Error('Official gate source unavailable');
  const html=await response.text();
  if(!html||html.length>1200000)throw Error('Official gate source malformed');
  return html;
 }finally{clearTimeout(timer);}
}
export async function getCaliforniaRoads(kind,{date}={}){
 if(kind==='coast'){
  const today=localDate(),dates=allowedDates(today),day=date||today;
  if(!dates.includes(day))throw Error('Choose a date within the next seven California-local days');
  const [roadResult,laneResult,weatherResult]=await Promise.allSettled([getRoad(1),fetchCaltransJson(SOURCE.lane5),coastForecast()]);
  const report=roadResult.status==='fulfilled'?roadResult.value:{ok:false,reason:'Highway report unavailable'};
  const assessment=assessBigSur(report);
  let events=[],laneFeedAvailable=false;
  if(laneResult.status==='fulfilled'){
   try{events=parseLaneClosures(laneResult.value,BIGSUR_STOPS);laneFeedAvailable=true;}catch{}
  }
  const currentNotices=geolocateHighwayNotices(assessment.notes,{checkedAt:Date.now()});
  const routes=projectAllRoutes(COAST_TRIPS,BIGSUR_STOPS,[...events,...currentNotices],{day,today,feedAvailable:laneFeedAvailable,reportState:assessment.state});
  return {ok:true,kind:'coast',checkedAt:new Date().toISOString(),reportedAt:report.reportedAt,
    ...assessment,stops:BIGSUR_STOPS,trips:COAST_TRIPS,routes,currentNotices,events:events.filter(e=>e.from<7&&e.to>0).slice(0,80),
    selectedDate:day,availableDates:dates,weather:weatherResult.status==='fulfilled'?weatherResult.value:{available:false},structured:{available:laneFeedAvailable,records:events.length,
      explanation:laneFeedAvailable?'Caltrans LCS reports approved work for the next seven days; incident/slide status must still be checked in the current highway report.':'Caltrans LCS unavailable; route-specific planned work cannot be verified.',
      source:SOURCE.lane5},
    links:{caltrans:'https://roads.dot.ca.gov/?roadnumber=1',quickmap:'https://quickmap.dot.ca.gov/',chp:'https://cad.chp.ca.gov/',phone:'1-800-427-7623'}};
 }
 if(kind==='sierra'){
  const unique=[...new Set(PASSES.map(x=>x.road))];
  const requests=[...unique.map(getRoad),...Object.values(SOURCE).filter(x=>/\/cc\//.test(x)).map(fetchCaltransJson),fetchOfficialGatePage(GATE_SOURCES.nps),fetchOfficialGatePage(GATE_SOURCES.caltrans),...FEED_URLS.lane.map(fetchCaltransJson),...FEED_URLS.camera.map(fetchCaltransJson)];
  const results=await Promise.allSettled(requests);
  const byRoad=Object.fromEntries(unique.map((id,i)=>[id,results[i].status==='fulfilled'?results[i].value:{ok:false,reason:'Source unavailable'}]));
  let chain=[],chainFeeds=0;
  for(const result of results.slice(unique.length,unique.length+3)){
   if(result.status!=='fulfilled')continue;
   try{chain.push(...parseChainControl(result.value,PASSES));chainFeeds++;}catch{}
  }
  let nps=null,seasonal={};
  const npsResult=results[unique.length+3],seasonalResult=results[unique.length+4];
  if(npsResult?.status==='fulfilled'){
   try{nps=parseNpsTioga(npsResult.value);}catch{}
  }
  if(seasonalResult?.status==='fulfilled'){
   try{seasonal=parseCaltransSeasonalPasses(seasonalResult.value);}catch{}
  }
  const observations={work:Object.fromEntries(PASSES.map(p=>[p.id,[]])),cameras:Object.fromEntries(PASSES.map(p=>[p.id,[]]))};
  let laneFeeds=0,cameraFeeds=0;
  for(let i=0;i<3;i++){
   const result=results[unique.length+5+i];
   if(result?.status==='fulfilled'){
    try{
     const found=readSierraWork(result.value,PASSES);
     for(const p of PASSES)observations.work[p.id].push(...found[p.id]);
     laneFeeds++;
    }catch{}
   }
  }
  for(let i=0;i<3;i++){
   const result=results[unique.length+8+i];
   if(result?.status==='fulfilled'){
    try{
     const found=readSierraCameras(result.value,PASSES);
     for(const p of PASSES)observations.cameras[p.id].push(...found[p.id]);
     cameraFeeds++;
    }catch{}
   }
  }
  const passes=PASSES.map(pass=>{
   const item=assessPass(byRoad[pass.road],pass);
   const gate=classifyPassGate(pass,item,{nps,seasonal:seasonal[pass.id]});
   const matched=chain.filter(c=>c.pass===pass.id);
   const near=observations.work[pass.id];
   const cams=observations.cameras[pass.id].sort((a,b)=>a.distanceKm-b.distanceKm).slice(0,3);
   const observation=summarizeSierraObservation(pass,near,cams,{laneFeeds,cameraFeeds});
   const crossingState=gate.state==='PASS CLOSURE REPORTED'||gate.state==='NPS REPORTS CLOSED'?'CLOSED REPORTED':
    observation.state==='FULL CLOSURE REPORTED NEAR PASS'?'FULL ROAD CLOSURE NEAR PASS':
    observation.state==='FULL CLOSURE ON APPROACH'?'APPROACH CLOSURE · VERIFY':
    matched.length?'CHAINS REPORTED · VERIFY':
    item.state==='CLOSURE REPORTED'?'HIGHWAY CLOSURE · LOCATE':
    gate.state==='NPS REPORTS OPEN'?'PARK REPORTS OPEN · VERIFY':
    gate.state==='REOPENED THIS SEASON · VERIFY GATE'?'REOPENED THIS SEASON · VERIFY':
    gate.state==='YEAR-ROUND ROUTE · CHECK RESTRICTIONS'?'YEAR-ROUND · VERIFY':'GATE UNVERIFIED';
   return {...pass,gate,crossingState,observation,report:{...item,
      chainControls:matched,
      chainNote:chainFeeds<3?'One or more Caltrans chain-control feeds unavailable. Verify in QuickMap.':
        matched.length?'Recent active chain-control signals reported near this pass; check route extent and vehicle rules.':
        'No fresh nearby active chain-control report detected. This does not verify no restrictions or an open pass.'},
      reportedAt:byRoad[pass.road]?.reportedAt||null,sourceUrl:'https://roads.dot.ca.gov/?roadnumber='+pass.road};
  });
  return {ok:true,kind:'sierra',checkedAt:new Date().toISOString(),passes,
   availableReports:results.slice(0,unique.length).filter(x=>x.status==='fulfilled').length,totalReports:unique.length,
   gateSources:{nps:nps?.state||'UNAVAILABLE',npsDate:nps?.reportedDate||null,caltransSeason:!!Object.keys(seasonal).length,npsUrl:GATE_SOURCES.nps,caltransUrl:GATE_SOURCES.caltrans},
   spatialFeeds:{laneFeeds,cameraFeeds,totalPerType:3,laneSources:FEED_URLS.lane,cameraSources:FEED_URLS.camera},
   chain:{availableFeeds:chainFeeds,totalFeeds:3,controls:chain,updated:new Date().toISOString(),
    sourceUrls:[SOURCE.chain3,SOURCE.chain9,SOURCE.chain10]},
   links:{quickmap:'https://quickmap.dot.ca.gov/',phone:'1-800-427-7623',tioga:'https://chrisizworski.com/national-tools/tioga-road-status/'}};
 }
 throw Error('Unsupported California road tool');
}
