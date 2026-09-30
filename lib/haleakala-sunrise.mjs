const LAT=20.7097;
const LON=-156.2533;
const SUMMIT_M=3055;
const TZ='Pacific/Honolulu';
const UA='ChrisIzworskiHaleakalaSunrise/1.0 (+https://chrisizworski.com/national-tools/haleakala-sunrise/)';
const TIMEOUT_MS=7000;

const URLS={
  npsConditions:'https://www.nps.gov/hale/planyourvisit/conditions.htm',
  npsSunrise:'https://www.nps.gov/hale/planyourvisit/sunrise.htm',
  recreation:'https://www.recreation.gov/ticket/facility/253731',
  lcoAllSky:'https://lco.global/camera/ogg/allsky/',
  lcoAllSkyImage:'https://lco.global/camera/ogg/allsky/lastsnap.jpg',
  lcoWeather:'https://weather-api.lco.global/query/',
  openMeteo:'https://api.open-meteo.com/v1/gfs',
  nwsPoint:`https://api.weather.gov/points/${LAT},${LON}`,
  nwsAlerts:`https://api.weather.gov/alerts/active?point=${LAT},${LON}`
};

function clamp(v,min,max){return Math.min(max,Math.max(min,v));}
function finite(v){return Number.isFinite(Number(v));}
function round(v,d=0){if(!finite(v)) return null; const m=10**d; return Math.round(Number(v)*m)/m;}
function cleanText(html=''){
  return String(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ')
    .replace(/<[^>]+>/g,' ')
    .replace(/&nbsp;/gi,' ')
    .replace(/&amp;/gi,'&')
    .replace(/&#39;|&apos;/gi,"'")
    .replace(/&quot;/gi,'"')
    .replace(/\s+/g,' ')
    .trim();
}
function ageMinutes(iso,now=Date.now()){
  const t=Date.parse(iso||'');
  return Number.isFinite(t)?Math.max(0,(now-t)/60000):null;
}
async function fetchTimeout(url,opts={}){
  const ctl=new AbortController();
  const timer=setTimeout(()=>ctl.abort(),TIMEOUT_MS);
  try{
    const res=await fetch(url,{...opts,signal:ctl.signal,headers:{'User-Agent':UA,'Accept':opts.accept||'*/*',...(opts.headers||{})}});
    if(!res.ok && !(opts.allowRedirect && res.status>=300&&res.status<400)) throw new Error(`${res.status} ${res.statusText}`);
    return res;
  }finally{clearTimeout(timer);}
}
async function json(url,opts={}){
  const res=await fetchTimeout(url,{...opts,accept:'application/json'});
  return res.json();
}
async function text(url,opts={}){
  const res=await fetchTimeout(url,{...opts,accept:'text/html'});
  return res.text();
}

function localDateParts(date=new Date(),timeZone=TZ){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  const o=Object.fromEntries(parts.map(x=>[x.type,x.value]));
  return {year:Number(o.year),month:Number(o.month),day:Number(o.day)};
}
function dayOfYearUTC(date){
  const start=Date.UTC(date.getUTCFullYear(),0,0);
  return Math.floor((Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate())-start)/86400000);
}
function solarDeclEq(date){
  const n=dayOfYearUTC(date);
  const gamma=2*Math.PI/365*(n-1);
  const eqtime=229.18*(0.000075+0.001868*Math.cos(gamma)-0.032077*Math.sin(gamma)-0.014615*Math.cos(2*gamma)-0.040849*Math.sin(2*gamma));
  const decl=0.006918-0.399912*Math.cos(gamma)+0.070257*Math.sin(gamma)-0.006758*Math.cos(2*gamma)+0.000907*Math.sin(2*gamma)-0.002697*Math.cos(3*gamma)+0.00148*Math.sin(3*gamma);
  return {eqtime,decl};
}
function solarEvent(date,lat,lon,zenithDeg=90.833){
  const {eqtime,decl}=solarDeclEq(date);
  const latR=lat*Math.PI/180, zen=zenithDeg*Math.PI/180;
  const cosH=(Math.cos(zen)/(Math.cos(latR)*Math.cos(decl)))-Math.tan(latR)*Math.tan(decl);
  if(cosH>1||cosH<-1) return null;
  const ha=Math.acos(clamp(cosH,-1,1));
  const mins=720-4*(lon+ha*180/Math.PI)-eqtime;
  const H=-ha;
  let az=(Math.atan2(Math.sin(H),Math.cos(H)*Math.sin(latR)-Math.tan(decl)*Math.cos(latR))*180/Math.PI+180)%360;
  if(az<0) az+=360;
  return {minutesUTC:mins,azimuth:az,declination:decl};
}
function isoFromUtcMinutes(date,minutes){
  const d=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate(),0,0,0));
  d.setUTCMinutes(Math.round(minutes));
  return d.toISOString();
}
function nextSunrise(now=new Date()){
  const local=localDateParts(now,TZ);
  for(let add=0;add<3;add++){
    const date=new Date(Date.UTC(local.year,local.month-1,local.day+add,12));
    const sunrise=solarEvent(date,LAT,LON,90.833);
    const civil=solarEvent(date,LAT,LON,96);
    if(!sunrise) continue;
    const iso=isoFromUtcMinutes(date,sunrise.minutesUTC);
    if(Date.parse(iso)>now.getTime()+10*60000){
      return {
        iso,
        civilTwilightIso:civil?isoFromUtcMinutes(date,civil.minutesUTC):null,
        azimuthDeg:round(sunrise.azimuth,1),
        label:new Intl.DateTimeFormat('en-US',{timeZone:TZ,weekday:'long',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(iso))
      };
    }
  }
  throw new Error('Unable to calculate the next Haleakala sunrise');
}

function nearestIndex(times,targetIso){
  const target=Date.parse(targetIso);
  let best=-1,bestDelta=Infinity;
  for(let i=0;i<(times||[]).length;i++){
    const raw=String(times[i]||'');
    const t=Date.parse(/[zZ]|[+-]\d\d:\d\d$/.test(raw)?raw:`${raw}Z`);
    const d=Math.abs(t-target);
    if(Number.isFinite(d)&&d<bestDelta){best=i;bestDelta=d;}
  }
  return best;
}
function gfsRow(hourly,index){
  const read=k=>Array.isArray(hourly?.[k])?hourly[k][index]:null;
  return {
    time:hourly?.time?.[index]||null,
    rh850:round(read('relative_humidity_850hPa')),
    rh700:round(read('relative_humidity_700hPa')),
    rh600:round(read('relative_humidity_600hPa')),
    z850:round(read('geopotential_height_850hPa')),
    z700:round(read('geopotential_height_700hPa')),
    z600:round(read('geopotential_height_600hPa')),
    t850:round(read('temperature_850hPa'),1),
    t700:round(read('temperature_700hPa'),1),
    t600:round(read('temperature_600hPa'),1),
    wind700:round(read('wind_speed_700hPa')),
    precipitation:round(read('precipitation'),2)
  };
}
async function fetchGfs(sunrise){
  const params=new URLSearchParams({
    latitude:String(LAT),
    longitude:String(LON),
    models:'gfs_seamless',
    hourly:[
      'relative_humidity_850hPa','relative_humidity_700hPa','relative_humidity_600hPa',
      'geopotential_height_850hPa','geopotential_height_700hPa','geopotential_height_600hPa',
      'temperature_850hPa','temperature_700hPa','temperature_600hPa',
      'wind_speed_700hPa','precipitation'
    ].join(','),
    wind_speed_unit:'mph',
    timezone:'UTC',
    forecast_days:'3'
  });
  const retrievedAt=new Date().toISOString();
  const payload=await json(`${URLS.openMeteo}?${params}`);
  const i=nearestIndex(payload?.hourly?.time,sunrise.iso);
  if(i<0) throw new Error('GFS profile did not include the sunrise hour');
  const row=gfsRow(payload.hourly,i);
  const prev=i>0?gfsRow(payload.hourly,i-1):null;
  const next=i+1<payload.hourly.time.length?gfsRow(payload.hourly,i+1):null;
  return {ok:true,retrievedAt,provider:'GFS via Open-Meteo',model:'GFS seamless',cycle:null,row,window:{prev,next}};
}

function parseLcoTimestamp(raw){
  const m=String(raw||'').match(/^(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if(!m) return null;
  return new Date(Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+m[6])).toISOString();
}
function summarizeSeries(rows=[]){
  const pts=rows.map(x=>({iso:parseLcoTimestamp(x.TimeStamp),value:Number(x.Value)})).filter(x=>x.iso&&Number.isFinite(x.value));
  if(!pts.length) return {current:null,observedAt:null,slopePerHour:null,points:0};
  const last=pts.at(-1);
  const cutoff=Date.parse(last.iso)-90*60000;
  const recent=pts.filter(p=>Date.parse(p.iso)>=cutoff);
  let slope=null;
  if(recent.length>=2){
    const first=recent[0], hours=(Date.parse(last.iso)-Date.parse(first.iso))/3600000;
    if(hours>=0.25) slope=(last.value-first.value)/hours;
  }
  return {current:round(last.value,1),observedAt:last.iso,slopePerHour:round(slope,1),points:recent.length};
}
async function lcoDatum(name,start,end){
  const p=new URLSearchParams({site:'ogg',datumname:name,start,end});
  const rows=await json(`${URLS.lcoWeather}?${p}`);
  if(!Array.isArray(rows)) throw new Error(`Unexpected LCO response for ${name}`);
  return summarizeSeries(rows);
}
async function fetchLco(now=new Date()){
  const end=now.toISOString(),start=new Date(now.getTime()-3*3600000).toISOString();
  const names={
    humidity:'Weather Humidity Value',
    temperature:'Weather Air Temperature Value',
    pressure:'Weather Barometric Pressure Value',
    boltwood:'Boltwood Sky Minus Ambient Temperature',
    wind:'Weather Wind Speed Value'
  };
  const entries=await Promise.allSettled(Object.entries(names).map(async ([key,name])=>[key,await lcoDatum(name,start,end)]));
  const data={};
  const errors=[];
  for(const r of entries){
    if(r.status==='fulfilled') data[r.value[0]]=r.value[1];
    else errors.push(String(r.reason?.message||r.reason));
  }
  const observedAt=[...Object.values(data)].map(x=>x?.observedAt).filter(Boolean).sort().at(-1)||null;
  if(!observedAt) throw new Error(`LCO summit observations unavailable${errors.length?`: ${errors[0]}`:''}`);
  return {ok:true,site:'OGG',elevationM:3055,retrievedAt:new Date().toISOString(),observedAt,...data,partial:errors.length>0,errors};
}

function parseWindMph(s=''){
  const nums=[...String(s).matchAll(/(\d+(?:\.\d+)?)\s*(?:to|-)?\s*(\d+(?:\.\d+)?)?\s*mph/gi)]
    .flatMap(m=>[m[1],m[2]]).filter(Boolean).map(Number);
  return nums.length?Math.max(...nums):null;
}
async function fetchNws(sunrise){
  const [point,alerts]=await Promise.all([json(URLS.nwsPoint),json(URLS.nwsAlerts)]);
  const hourlyUrl=point?.properties?.forecastHourly;
  if(!hourlyUrl) throw new Error('NWS point metadata did not include hourly forecast');
  const hourly=await json(hourlyUrl);
  const periods=hourly?.properties?.periods||[];
  const target=Date.parse(sunrise.iso);
  const near=periods
    .map(p=>({...p,_delta:Math.abs(Date.parse(p.startTime)-target)}))
    .sort((a,b)=>a._delta-b._delta)[0]||null;
  const active=(alerts?.features||[]).map(x=>x.properties||{}).map(a=>({
    event:a.event||'Weather alert',
    severity:a.severity||null,
    urgency:a.urgency||null,
    certainty:a.certainty||null,
    headline:a.headline||a.description?.slice(0,180)||null,
    ends:a.ends||a.expires||null
  }));
  const hardPattern=/high wind warning|winter storm warning|blizzard warning|ice storm warning|hurricane warning|tropical storm warning|extreme wind warning/i;
  const hardStops=active.filter(a=>hardPattern.test(a.event||''));
  return {
    ok:true,
    retrievedAt:new Date().toISOString(),
    forecastUpdatedAt:hourly?.properties?.updateTime||null,
    nearSunrise:near?{
      startTime:near.startTime,
      temperature:near.temperature,
      temperatureUnit:near.temperatureUnit,
      windSpeed:near.windSpeed,
      windDirection:near.windDirection,
      windMph:parseWindMph(near.windSpeed),
      precipitationProbability:near.probabilityOfPrecipitation?.value??null,
      shortForecast:near.shortForecast||null
    }:null,
    alerts:active,
    hardStops
  };
}

async function fetchNps(){
  const retrievedAt=new Date().toISOString();
  const [conditionsRes,sunriseRes]=await Promise.allSettled([text(URLS.npsConditions),text(URLS.npsSunrise)]);
  const conditions=conditionsRes.status==='fulfilled'?cleanText(conditionsRes.value):'';
  const sunrise=sunriseRes.status==='fulfilled'?cleanText(sunriseRes.value):'';
  let access='VERIFY';
  const summitChunk=(conditions.match(/Summit District.{0,700}/i)||[])[0]||'';
  if(/\bclosed\b/i.test(summitChunk)) access='CLOSED';
  else if(/\bopen\b|always open/i.test(summitChunk)) access='OPEN';
  const reservationRequired=/reservation.{0,120}3(?::00)?\s*(?:a\.?m\.?|am).{0,80}7(?::00)?\s*(?:a\.?m\.?|am)|3(?::00)?\s*(?:a\.?m\.?|am).{0,100}7(?::00)?\s*(?:a\.?m\.?|am).{0,120}reservation/i.test(`${conditions} ${sunrise}`);
  return {
    ok:Boolean(conditions||sunrise),
    retrievedAt,
    access,
    reservationRequired:reservationRequired||true,
    reservationWindow:'3:00–7:00 a.m. HST',
    availability:'UNKNOWN',
    releaseRule:'Up to 60 days ahead; a portion is released 2 days ahead at 7:00 a.m. HST.',
    sources:{conditions:URLS.npsConditions,sunrise:URLS.npsSunrise,recreation:URLS.recreation},
    partial:conditionsRes.status==='rejected'||sunriseRes.status==='rejected'
  };
}

function parseCameraTimestamp(location=''){
  const m=String(location).match(/\/(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})\.jpg/i);
  if(!m) return null;
  return new Date(Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+m[6])).toISOString();
}
async function fetchAllSky(now=Date.now()){
  const res=await fetchTimeout(URLS.lcoAllSkyImage,{method:'HEAD',redirect:'manual',allowRedirect:true});
  const location=res.headers.get('location')||'';
  const imageTimestamp=parseCameraTimestamp(location);
  const age=imageTimestamp?ageMinutes(imageTimestamp,now):null;
  return {
    ok:Boolean(location||res.ok),
    pageUrl:URLS.lcoAllSky,
    imageUrl:URLS.lcoAllSkyImage,
    imageTimestamp,
    ageMinutes:round(age),
    fresh:age!=null?age<=30:false,
    usableForDecision:age!=null?age<=30:false,
    note:age==null?'Image freshness could not be verified.':age<=30?'Latest all-sky image is recent.':'All-sky image is stale and is not used in the decision.'
  };
}

function profileSignal(gfs){
  const r=gfs?.row||{};
  if(!finite(r.rh700)) return {kind:'unknown',strength:'unknown',label:'Forecast profile unavailable'};
  const rh700=Number(r.rh700),rh600=finite(r.rh600)?Number(r.rh600):null;
  if(rh700<=15 && (rh600==null||rh600<=35)) return {kind:'dry',strength:'strong',label:'Very dry near summit level'};
  if(rh700<=20 && (rh600==null||rh600<=45)) return {kind:'dry',strength:'moderate',label:'Dry near summit level'};
  if(rh700<=30) return {kind:'dry',strength:'weak',label:'Relatively dry near summit level'};
  if(rh700>=85 && (rh600==null||rh600>=75)) return {kind:'moist',strength:'strong',label:'Very moist near and above summit level'};
  if(rh700>=70) return {kind:'moist',strength:'moderate',label:'Moist near summit level'};
  return {kind:'mixed',strength:'weak',label:'Moisture near threshold'};
}
function summitSignal(lco,now=Date.now()){
  const rh=lco?.humidity;
  const fresh=rh?.observedAt&&ageMinutes(rh.observedAt,now)<=45;
  if(!fresh||!finite(rh.current)) return {kind:'unknown',trend:'unknown',label:'Summit humidity unavailable or stale',fresh:false};
  const current=Number(rh.current),slope=finite(rh.slopePerHour)?Number(rh.slopePerHour):null;
  const rapid=slope!=null&&Math.abs(slope)>=10;
  const trend=rapid?(slope>0?'worsening':'improving'):(slope==null?'unknown':Math.abs(slope)<3?'stable':slope>0?'worsening':'improving');
  let kind='mixed';
  if(current>=90) kind='moist';
  else if(current<=55) kind='dry';
  return {kind,trend,rapid,label:`${round(current)}% RH${slope==null?'':` · ${slope>0?'+':''}${round(slope,1)} pts/hr`}`,fresh:true,current,slope};
}
function inferAboveCloud(gfs){
  const r=gfs?.row||{};
  if(!finite(r.rh850)||!finite(r.rh700)) return {state:'INSUFFICIENT EVIDENCE',label:'Insufficient profile evidence',experimental:true};
  if(Number(r.rh850)>=75 && Number(r.rh700)<=30){
    return {state:'LIKELY PRIMARILY BELOW SUMMIT',label:'Moisture is concentrated lower in the profile, but local summit cloud remains possible.',experimental:true};
  }
  if(Number(r.rh700)>=70) return {state:'CLOUD NEAR SUMMIT POSSIBLE',label:'The forecast profile carries substantial moisture near summit pressure level.',experimental:true};
  return {state:'SUMMIT CLOUD STILL POSSIBLE',label:'The profile does not support a strong above-cloud-layer inference.',experimental:true};
}
function confidenceFor({state,gfsSignal,summitSignal:g,hasGfs,hasSummit,disagreement,changing,hardStop}){
  if(hardStop) return 'HIGH';
  if(!hasGfs&&!hasSummit) return 'LOW';
  if(disagreement||changing) return hasGfs&&hasSummit?'MODERATE':'LOW';
  if(state==='FAVORABLE'&&gfsSignal.strength==='strong'&&hasSummit&&g.kind==='dry') return 'HIGH';
  if(state==='UNFAVORABLE'&&hasSummit&&g.kind==='moist'&&gfsSignal.kind==='moist') return 'HIGH';
  if(hasGfs&&hasSummit) return 'MODERATE';
  return 'LOW';
}
export function classifyHaleakalaEvidence(input,now=Date.now()){
  const gfs=input?.gfs||null,lco=input?.lco||null,nws=input?.nws||null,nps=input?.nps||null;
  const gs=profileSignal(gfs);
  const ss=summitSignal(lco,now);
  const hasGfs=gs.kind!=='unknown';
  const hasSummit=ss.fresh;
  const hardHazard=Boolean(nws?.hardStops?.length);
  const accessClosed=nps?.access==='CLOSED';
  const hardStop=hardHazard||accessClosed;
  const changing=Boolean(hasSummit&&ss.rapid);
  const disagreement=Boolean(hasGfs&&hasSummit&&((gs.kind==='dry'&&ss.kind==='moist')||(gs.kind==='moist'&&ss.kind==='dry')));
  let state='UNCERTAIN';
  const reasons=[];
  const cautions=[];
  if(hardStop){
    state='UNFAVORABLE';
    if(accessClosed) reasons.push('NPS access evidence indicates the summit route is closed or restricted.');
    if(hardHazard) reasons.push(`An active ${nws.hardStops[0].event} is a hard safety gate.`);
  }else if(hasSummit&&ss.kind==='moist'&&ss.trend!=='improving'){
    state='UNFAVORABLE';
    reasons.push('Current summit humidity is near saturation and is not improving.');
  }else if(changing||disagreement){
    state='CHANGING';
    if(changing) reasons.push(`Summit humidity is changing rapidly (${ss.label}).`);
    if(disagreement) reasons.push('Forecast-profile moisture and current summit humidity disagree.');
  }else if(gs.kind==='moist'&&gs.strength==='strong'){
    state='UNFAVORABLE';
    reasons.push('The forecast profile is very moist near and above summit level.');
  }else if(gs.kind==='dry'&&['strong','moderate'].includes(gs.strength)&&hasSummit&&ss.kind==='dry'){
    state='FAVORABLE';
    reasons.push('Forecast air near summit level is dry and current summit humidity is also dry.');
  }else{
    reasons.push('The available evidence does not clear the conservative threshold for a confident favorable or unfavorable call.');
  }
  if(!hasGfs) cautions.push('Forecast-profile evidence is missing.');
  if(!hasSummit) cautions.push('Fresh summit humidity evidence is missing.');
  if(nws?.nearSunrise?.shortForecast) cautions.push('Generic NWS cloud wording is shown for context but does not determine the summit-visibility state.');
  const confidence=confidenceFor({state,gfsSignal:gs,summitSignal:ss,hasGfs,hasSummit,disagreement,changing,hardStop});
  return {state,confidence,reasons,cautions,profile:gs,summit:ss,disagreement,changing,hardStop,aboveCloud:inferAboveCloud(gfs)};
}

function evidenceRows(data,decision,now=Date.now()){
  const rows=[];
  const r=data.gfs?.row;
  rows.push({
    label:'Summit-level moisture',
    value:finite(r?.rh700)?`RH700 ${round(r.rh700)}% · RH600 ${finite(r.rh600)?`${round(r.rh600)}%`:'—'}`:'Unavailable',
    type:'FORECAST',
    status:decision.profile.label,
    source:'GFS pressure profile via Open-Meteo',
    fresh:data.gfs?.retrievedAt?`${round(ageMinutes(data.gfs.retrievedAt,now))} min since retrieval`:'Unavailable'
  });
  rows.push({
    label:'Summit humidity',
    value:decision.summit.fresh?decision.summit.label:'Unavailable or stale',
    type:'MEASURED',
    status:decision.summit.trend==='worsening'?'Worsening':decision.summit.trend==='improving'?'Improving':decision.summit.trend==='stable'?'Stable':'Unknown',
    source:'Las Cumbres Observatory OGG',
    fresh:data.lco?.humidity?.observedAt?`${round(ageMinutes(data.lco.humidity.observedAt,now))} min old`:'Unavailable'
  });
  rows.push({
    label:'Near-sunrise wind',
    value:data.nws?.nearSunrise?.windSpeed||'Unavailable',
    type:'FORECAST',
    status:data.nws?.hardStops?.length?'Active warning':'Check comfort and safety',
    source:'National Weather Service',
    fresh:data.nws?.forecastUpdatedAt?`${round(ageMinutes(data.nws.forecastUpdatedAt,now))} min since forecast update`:'Update time unavailable'
  });
  rows.push({
    label:'Access',
    value:data.nps?.access||'VERIFY',
    type:'MEASURED',
    status:data.nps?.access==='OPEN'?'NPS page reads open':data.nps?.access==='CLOSED'?'Closed/restricted':'Verify official page',
    source:'National Park Service',
    fresh:data.nps?.retrievedAt?`${round(ageMinutes(data.nps.retrievedAt,now))} min since check`:'Unavailable'
  });
  return rows;
}
function headlineFor(decision){
  if(decision.state==='FAVORABLE') return 'Evidence currently supports a useful summit sunrise view, but local cloud can still develop.';
  if(decision.state==='CHANGING') return 'Conditions are moving or the sources disagree. Recheck before committing to the drive.';
  if(decision.state==='UNFAVORABLE') return 'Current evidence argues against counting on a useful summit sunrise view.';
  return 'The evidence is not strong enough for a confident sunrise call.';
}
function actionFor(decision){
  if(decision.state==='FAVORABLE') return 'The weather case supports going if your reservation and access are in order.';
  if(decision.state==='CHANGING') return 'Do not treat the current view as persistent. Recheck close to departure.';
  if(decision.state==='UNFAVORABLE') return 'Do not plan around a clear summit sunrise unless the evidence materially improves.';
  return 'Keep the plan flexible; the tool is abstaining rather than inventing certainty.';
}
function formatTemp(nws){
  const n=nws?.nearSunrise;
  return n?.temperature!=null?`${n.temperature}°${n.temperatureUnit||'F'}`:'Unavailable';
}
async function settled(name,promise){
  try{return [name,await promise,null];}
  catch(error){return [name,null,String(error?.message||error)];}
}
export async function buildHaleakalaSunrise(){
  const started=new Date();
  const sunrise=nextSunrise(started);
  const results=await Promise.all([
    settled('gfs',fetchGfs(sunrise)),
    settled('lco',fetchLco(started)),
    settled('nws',fetchNws(sunrise)),
    settled('nps',fetchNps()),
    settled('allSky',fetchAllSky(started.getTime()))
  ]);
  const data={},errors={};
  for(const [name,value,error] of results){if(value)data[name]=value;if(error)errors[name]=error;}
  const decision=classifyHaleakalaEvidence(data,started.getTime());
  const sourceAgreement=decision.disagreement?'DISAGREE':'NO MAJOR CONFLICT DETECTED';
  const updated=new Date().toISOString();
  const legacyFacts=[
    {label:'Next summit sunrise',value:sunrise.label},
    {label:'Summit moisture',value:decision.profile.label},
    {label:'Trend',value:decision.summit.trend==='unknown'?'Unknown':decision.summit.trend[0].toUpperCase()+decision.summit.trend.slice(1)},
    {label:'Confidence',value:decision.confidence}
  ];
  return {
    ok:true,
    id:'haleakala-sunrise',
    updated,
    status:decision.state,
    headline:headlineFor(decision),
    facts:legacyFacts,
    source:{name:'Haleakalā evidence engine',url:URLS.npsConditions},
    sourceExcerpt:[...decision.reasons,...decision.cautions].join(' '),
    decision:{
      state:decision.state,
      confidence:decision.confidence,
      headline:headlineFor(decision),
      action:actionFor(decision),
      reasons:decision.reasons,
      cautions:decision.cautions,
      sourceAgreement
    },
    astronomy:{
      sunriseIso:sunrise.iso,
      sunriseLabel:sunrise.label,
      civilTwilightIso:sunrise.civilTwilightIso,
      azimuthDeg:sunrise.azimuthDeg
    },
    summary:{
      summitMoisture:decision.profile.label,
      trend:decision.summit.trend==='unknown'?'Unknown':decision.summit.trend[0].toUpperCase()+decision.summit.trend.slice(1),
      wind:data.nws?.nearSunrise?.windSpeed||'Unavailable',
      temperature:formatTemp(data.nws),
      confidence:decision.confidence
    },
    evidence:evidenceRows(data,decision,started.getTime()),
    experimental:{aboveCloud:decision.aboveCloud},
    forecastProfile:data.gfs?{
      source:data.gfs.provider,
      model:data.gfs.model,
      targetTime:data.gfs.row.time,
      rh850:data.gfs.row.rh850,
      rh700:data.gfs.row.rh700,
      rh600:data.gfs.row.rh600,
      geopotentialHeight700M:data.gfs.row.z700,
      note:'RH700 dry-side thresholds are informed by exploratory historical validation. They are not probabilities.'
    }:null,
    summit:data.lco?{
      source:'Las Cumbres Observatory OGG',
      elevationM:SUMMIT_M,
      observedAt:data.lco.observedAt,
      humidity:data.lco.humidity||null,
      temperature:data.lco.temperature||null,
      pressure:data.lco.pressure||null,
      boltwood:data.lco.boltwood||null,
      wind:data.lco.wind||null,
      note:'Boltwood is supporting evidence only and never determines the state by itself.'
    }:null,
    nws:data.nws?{
      nearSunrise:data.nws.nearSunrise,
      alerts:data.nws.alerts,
      hardStops:data.nws.hardStops,
      forecastUpdatedAt:data.nws.forecastUpdatedAt
    }:null,
    access:data.nps||{
      access:'VERIFY',
      reservationRequired:true,
      reservationWindow:'3:00–7:00 a.m. HST',
      availability:'UNKNOWN',
      sources:{conditions:URLS.npsConditions,sunrise:URLS.npsSunrise,recreation:URLS.recreation}
    },
    imagery:data.allSky||{
      ok:false,pageUrl:URLS.lcoAllSky,imageUrl:URLS.lcoAllSkyImage,fresh:false,usableForDecision:false,
      note:'All-sky image status could not be verified.'
    },
    freshness:{
      summitObservationMinutes:data.lco?.humidity?.observedAt?round(ageMinutes(data.lco.humidity.observedAt,started.getTime())):null,
      nwsForecastMinutes:data.nws?.forecastUpdatedAt?round(ageMinutes(data.nws.forecastUpdatedAt,started.getTime())):null,
      allSkyMinutes:data.allSky?.ageMinutes??null,
      builtAt:new Date().toISOString()
    },
    errors,
    sources:[
      {name:'GFS pressure-level forecast',url:'https://open-meteo.com/en/docs/gfs-api',role:'forecast vertical moisture',status:data.gfs?'available':'unavailable'},
      {name:'Las Cumbres Observatory OGG weather',url:'https://developers.lco.global/',role:'measured summit conditions and trend',status:data.lco?'available':'unavailable'},
      {name:'LCO OGG all-sky',url:URLS.lcoAllSky,role:'visual corroboration only when fresh',status:data.allSky?.usableForDecision?'fresh':data.allSky?'stale/unverified':'unavailable'},
      {name:'National Weather Service',url:'https://www.weather.gov/hfo/',role:'hazards, wind, temperature and precipitation context',status:data.nws?'available':'unavailable'},
      {name:'National Park Service',url:URLS.npsConditions,role:'access and reservation rules',status:data.nps?'available':'unavailable'}
    ]
  };
}
export {nextSunrise,profileSignal,summitSignal,inferAboveCloud,parseCameraTimestamp,summarizeSeries};
