import { cleanHtml, solarMinutesUTC, classifyRoadText } from './breakout-live-engine.mjs';

const UA='ChrisIzworskiBreakoutLive/1.3 (+https://chrisizworski.com/national-tools/)';
const TIMEOUT_MS=6500;

async function fetchWithTimeout(url, accept='*/*') {
  const ctl=new AbortController();
  const timer=setTimeout(()=>ctl.abort(),TIMEOUT_MS);
  try {
    const res=await fetch(url,{signal:ctl.signal,headers:{'User-Agent':UA,'Accept':accept}});
    if(!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res;
  } finally { clearTimeout(timer); }
}

function sourceResult(id, source, payload) {
  return {ok:true,id,updated:new Date().toISOString(),source,...payload};
}

function statusAfter(text, label) {
  const i=text.toLowerCase().indexOf(label.toLowerCase());
  if(i<0) return 'VERIFY';
  const tail=text.slice(i+label.length,i+label.length+140);
  const m=tail.match(/\b(OPEN|CLOSED)\b/i);
  return m ? m[1].toUpperCase() : 'VERIFY';
}

function around(text, needle, radius=700) {
  const i=text.toLowerCase().indexOf(needle.toLowerCase());
  return i<0 ? text.slice(0,radius*2) : text.slice(Math.max(0,i-radius),Math.min(text.length,i+radius));
}

function aroundAny(text, needles=[], radius=260) {
  const lower=text.toLowerCase();
  for(const needle of needles){
    const i=lower.indexOf(String(needle).toLowerCase());
    if(i>=0) return text.slice(Math.max(0,i-radius),Math.min(text.length,i+radius)).trim();
  }
  return '';
}

function updatedLabel(text) {
  const m=text.match(/Road Status\s*-?\s*Updated\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})/i) || text.match(/Last updated:?\s*([A-Za-z]+\s+\d{1,2},\s+\d{4})/i);
  return m?.[1] || null;
}

function dateFromLabel(label) {
  if(!label) return null;
  const d=new Date(`${label} 12:00:00 GMT`);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

async function grandCanyon(id) {
  const url='https://www.nps.gov/grca/planyourvisit/weather-condition.htm';
  const res=await fetchWithTimeout(url,'text/html');
  const text=cleanHtml(await res.text());
  const south=statusAfter(text,'South Entrance Road');
  const desert=statusAfter(text,'Desert View Drive');
  const north=statusAfter(text,'North Rim Roads');
  const scenic=statusAfter(text,'Scenic roads to Cape Royal and Point Imperial');
  const statuses=[south,desert,north];
  const known=statuses.filter(x=>x!=='VERIFY');
  let status='VERIFY CURRENT ACCESS';
  if(known.length===3 && known.every(x=>x==='OPEN')) status='MAJOR ROAD GATES OPEN';
  else if(known.some(x=>x==='CLOSED')) status='ACCESS RESTRICTIONS';
  else if(known.length) status='PARTIAL STATUS FOUND';
  const headline=status==='MAJOR ROAD GATES OPEN'
    ? 'The current NPS page reports South Entrance, Desert View Drive and North Rim roads open.'
    : status==='ACCESS RESTRICTIONS'
      ? 'At least one major Grand Canyon road/access area is currently reported closed.'
      : 'The official page is available, but not every major access heading produced a simple open/closed state.';
  return sourceResult(id,{name:'National Park Service — Grand Canyon',url},{
    status,headline,
    facts:[
      {label:'South Entrance Road',value:south},
      {label:'Desert View Drive',value:desert},
      {label:'North Rim Roads',value:north},
      {label:'North Rim scenic roads',value:scenic}
    ],
    sourceExcerpt:around(text,'Park Road Conditions and Closures',1100),
    rawUpdated:dateFromLabel(updatedLabel(text))
  });
}

async function mountRainier(id) {
  const url='https://www.nps.gov/mora/planyourvisit/road-status.htm';
  const res=await fetchWithTimeout(url,'text/html');
  const text=cleanHtml(await res.text());
  const paradise=statusAfter(text,'Longmire to Paradise');
  const sunrise=statusAfter(text,'Sunrise Road');
  const whiteRiver=statusAfter(text,'White River Road to Campground');
  const mowich=statusAfter(text,'Mowich Lake Road');
  const cayuse=statusAfter(text,'South Entrance to Cayuse Pass');
  const known=[paradise,sunrise,whiteRiver,mowich].filter(x=>x!=='VERIFY');
  const closed=known.filter(x=>x==='CLOSED').length;
  const open=known.filter(x=>x==='OPEN').length;
  const status=closed&&open?'AREAS DIFFER':closed?'ACCESS RESTRICTIONS':open>=3?'MAJOR AREAS REPORTED OPEN':'VERIFY AREA ACCESS';
  const headline=`Paradise ${paradise}; Sunrise ${sunrise}; White River ${whiteRiver}; Mowich ${mowich}. Choose the park area before following GPS.`;
  return sourceResult(id,{name:'National Park Service — Mount Rainier road status',url},{
    status,headline,
    facts:[
      {label:'Longmire → Paradise',value:paradise},
      {label:'Sunrise Road',value:sunrise},
      {label:'White River campground',value:whiteRiver},
      {label:'Mowich Lake Road',value:mowich},
      {label:'South Entrance → Cayuse Pass',value:cayuse}
    ],
    sourceExcerpt:around(text,'Nisqually Entrance to Longmire',1350),
    rawUpdated:dateFromLabel(updatedLabel(text))
  });
}

async function tiogaRoad(id) {
  const url='https://www.nps.gov/yose/planyourvisit/conditions.htm';
  const res=await fetchWithTimeout(url,'text/html');
  const text=cleanHtml(await res.text());
  const tioga=statusAfter(text,'Tioga Road');
  const glacier=statusAfter(text,'Glacier Point Road');
  const bigOak=statusAfter(text,'Big Oak Flat Road');
  const focus=around(text,'Tioga Road',420);
  const delay=(focus.match(/(?:expect|delay)[^.]{0,180}(?:delay|minutes?)[^.]*\.?/i)||[])[0] || 'No specific Tioga delay parsed; check the official current-conditions note.';
  const status=tioga==='OPEN'?'TIOGA CROSSING OPEN':tioga==='CLOSED'?'TIOGA CROSSING CLOSED':'VERIFY TIOGA CROSSING';
  const headline=tioga==='OPEN'
    ? 'NPS currently lists Tioga Road open. Read the current road note before committing to the cross-Sierra drive.'
    : tioga==='CLOSED'
      ? 'NPS currently lists Tioga Road closed. Remove it as an east-west Sierra crossing before you start driving.'
      : 'The current NPS page did not yield a clean Tioga open/closed state; verify before a cross-Sierra drive.';
  return sourceResult(id,{name:'National Park Service — Yosemite current conditions',url},{
    status,headline,
    facts:[
      {label:'Tioga Road / Hwy 120',value:tioga},
      {label:'Current Tioga note',value:delay.slice(0,190)},
      {label:'Big Oak Flat Road',value:bigOak},
      {label:'Glacier Point Road',value:glacier}
    ],
    sourceExcerpt:focus,
    rawUpdated:dateFromLabel(updatedLabel(text))
  });
}

function parseGlacierThroughStatus(text) {
  const t=String(text||'');
  const explicitOpen=/entire\s+(?:50-mile\s+)?(?:length\s+of\s+)?(?:the\s+)?Going-to-the-Sun Road[^.]{0,140}\bopen\b|Going-to-the-Sun Road[^.]{0,140}\bfully open\b/i.test(t);
  const alpineClosure=/\bclosed?\b[^.]{0,180}(?:Avalanche|Logan Pass|Jackson Glacier Overlook)|(?:Avalanche|Logan Pass|Jackson Glacier Overlook)[^.]{0,180}\bclosed?\b/i.test(t);
  const generic=classifyRoadText(t,'Going-to-the-Sun Road').state;
  if(alpineClosure) return 'ALPINE CROSSING RESTRICTED';
  if(explicitOpen || generic==='OPEN') return 'THROUGH-DRIVE SOURCE READS OPEN';
  if(generic==='CLOSED') return 'THROUGH DRIVE CLOSED';
  if(generic==='PARTIAL') return 'PARTIAL — CHECK ROAD EXTENTS';
  return 'VERIFY THROUGH DRIVE';
}

async function glacierThrough(id) {
  const roadUrl='https://www.nps.gov/applications/glac/roadstatus/roadstatus.cfm';
  const infoUrl='https://www.nps.gov/glac/planyourvisit/directions.htm';
  const [roadRes,infoRes]=await Promise.all([
    fetchWithTimeout(roadUrl,'text/html'),
    fetchWithTimeout(infoUrl,'text/html')
  ]);
  const roadText=cleanHtml(await roadRes.text());
  const infoText=cleanHtml(await infoRes.text());
  const status=parseGlacierThroughStatus(roadText);
  const west=aroundAny(roadText,['West Entrance','Apgar','Avalanche Creek','The Loop'],240);
  const east=aroundAny(roadText,['St. Mary','Jackson Glacier Overlook','Rising Sun','Siyeh Bend'],240);
  const logan=aroundAny(roadText,['Logan Pass'],260);
  const restriction=(around(infoText,'Specific Vehicle Size Limits',310).match(/Vehicles[^.]+\.[^.]+\./i)||[])[0] || 'Vehicles over 21 ft long or 8 ft wide are prohibited between Avalanche Creek and Rising Sun.';
  const headline=status==='THROUGH-DRIVE SOURCE READS OPEN'
    ? 'The live Glacier road source reads as open for the Going-to-the-Sun Road. Confirm the Logan Pass/alpine segment below before treating it as a full 50-mile crossing.'
    : status==='ALPINE CROSSING RESTRICTED'||status==='THROUGH DRIVE CLOSED'
      ? 'The current road source contains an alpine closure/restriction signal. Do not plan a full west-to-east crossing until the official road status confirms Logan Pass access.'
      : 'The current source does not support a clean full-crossing answer. Use the west/east road extents and official status before committing.';
  return sourceResult(id,{name:'National Park Service — Glacier current road status',url:roadUrl},{
    status,headline,
    facts:[
      {label:'Full road',value:'50 miles · about 2 hours without stops'},
      {label:'Logan Pass',value:logan ? logan.slice(0,180) : 'Verify current alpine access'},
      {label:'Vehicle restriction',value:'Max 21 ft long / 8 ft wide on alpine restricted segment'},
      {label:'Current source',value:'Road-status page checked live'}
    ],
    throughRoute:{
      west:west ? west.slice(0,320) : 'West-side extent not parsed — verify official road status.',
      east:east ? east.slice(0,320) : 'East-side extent not parsed — verify official road status.',
      logan:logan ? logan.slice(0,320) : 'Logan Pass status not parsed — verify official road status.',
      restriction:restriction.slice(0,340)
    },
    sourceExcerpt:aroundAny(roadText,['Going-to-the-Sun Road','Logan Pass'],900),
    rawUpdated:dateFromLabel(updatedLabel(roadText))
  });
}

function parseMeadLaunchTable(text, level=null) {
  const cleaned=String(text||'').replace(/\s+/g,' ').trim();
  const names=['Callville Bay','Echo Bay','Hemenway Harbor','Temple Bar','South Cove','Boulder Harbor','Government Wash','Las Vegas Bay','Overton Beach'];
  const rows=[];
  for(let idx=0;idx<names.length;idx++){
    const name=names[idx];
    const lower=cleaned.toLowerCase();
    const start=lower.indexOf(name.toLowerCase());
    if(start<0) continue;
    let end=cleaned.length;
    for(let j=idx+1;j<names.length;j++){
      const hit=lower.indexOf(names[j].toLowerCase(),start+name.length);
      if(hit>=0){end=hit;break;}
    }
    const raw=cleaned.slice(start+name.length,end).trim();
    const m=raw.match(/^(Open|Closed)\s+(Open|Closed)\s+(Open|Closed)\s+(?:(\d[\d,]*)\s*feet)?\s*(.*)$/i);
    if(!m) continue;
    const min=m[4]?Number(m[4].replaceAll(',','')):null;
    const motorized=m[2].toUpperCase();
    const nonMotorized=m[3].toUpperCase();
    rows.push({
      name,
      houseboats:m[1].toUpperCase(),
      motorized,
      nonMotorized,
      minSafe:min,
      note:(m[5]||'').trim().slice(0,260),
      aboveMin:Number.isFinite(level)&&Number.isFinite(min)?level>=min:null,
      motorizedCandidate:motorized==='OPEN' && (!Number.isFinite(level)||!Number.isFinite(min)||level>=min)
    });
  }
  return rows;
}

async function lakeMead(id) {
  const npsUrl='https://www.nps.gov/lake/planyourvisit/changing-lake-levels.htm';
  const levelUrl='https://www.usbr.gov/lc/region/g4000/riverops/HOVR_FB_LastSevenDays_Daily.html';
  const [npsRes,levelRes]=await Promise.all([
    fetchWithTimeout(npsUrl,'text/html'),
    fetchWithTimeout(levelUrl,'text/html')
  ]);
  const npsText=cleanHtml(await npsRes.text());
  const levelText=cleanHtml(await levelRes.text());
  const values=[...levelText.matchAll(/\b(10[0-9]{2}\.\d{1,2})\b/g)].map(m=>Number(m[1])).filter(v=>v>900&&v<1300);
  const level=values.length?values.at(-1):null;
  const launches=parseMeadLaunchTable(npsText,level);
  const candidates=launches.filter(x=>x.motorizedCandidate);
  const names=candidates.map(x=>x.name);
  const status=candidates.length?'MOTORIZED LAUNCH OPTIONS FOUND':'VERIFY LAUNCH OPTIONS';
  const headline=candidates.length
    ? `Current NPS launch guidance identifies ${names.join(', ')} as motorized options at the present lake-level check. Ramp notes still control before towing.`
    : 'The current NPS table did not produce a clean motorized-launch candidate at the parsed lake level. Verify the launch table before towing.';
  return sourceResult(id,{name:'National Park Service — Lake Mead launch table',url:npsUrl},{
    status,headline,
    facts:[
      {label:'Lake Mead elevation',value:Number.isFinite(level)?`${level.toFixed(2)} ft`:'Live USBR level unavailable'},
      {label:'Motorized candidates',value:candidates.length?String(candidates.length):'Verify'},
      {label:'Start with',value:names.slice(0,3).join(' · ')||'Current NPS launch table'},
      {label:'NPS table updated',value:updatedLabel(npsText)||'See official source'}
    ],
    launches,
    sourceExcerpt:around(npsText,'Lake Mead Launch Ramps and Services',1100),
    rawUpdated:dateFromLabel(updatedLabel(npsText))
  });
}

const YELLOWSTONE_ROUTES=[
  {id:'west-old-faithful',label:'West Entrance → Old Faithful',segments:['West Entrance to Madison','Madison to Old Faithful'],delayTags:['Old Faithful','Parkwide']},
  {id:'west-canyon',label:'West Entrance → Canyon Village',segments:['West Entrance to Madison','Madison to Norris','Norris to Canyon Village'],delayTags:['Parkwide']},
  {id:'north-canyon',label:'North Entrance → Canyon Village',segments:['North Entrance to Mammoth Hot Springs','Mammoth Hot Springs to Norris','Norris to Canyon Village'],delayTags:['Mammoth Hot Springs','Parkwide']},
  {id:'south-old-faithful',label:'South Entrance → Old Faithful',segments:['South Entrance to West Thumb','West Thumb to Old Faithful'],delayTags:['Old Faithful','Parkwide']},
  {id:'north-northeast',label:'North Entrance → Northeast Entrance',segments:['North Entrance to Northeast Entrance'],delayTags:['Northeast Entrance','Parkwide']}
];

function monthNumber(name){
  return ['january','february','march','april','may','june','july','august','september','october','november','december'].indexOf(String(name).toLowerCase());
}

function segmentScheduledState(text,label,now=new Date()) {
  if(label==='North Entrance to Mammoth Hot Springs'){
    return /only road generally open year-round[^.]*North Entrance[^.]*Northeast Entrance/i.test(text)
      ? {state:'YEAR-ROUND',window:'North Entrance corridor is generally open year-round'}
      : {state:'VERIFY',window:'Verify live map'};
  }
  const lower=text.toLowerCase();
  const i=lower.indexOf(label.toLowerCase());
  if(i<0) return {state:'VERIFY',window:'Segment not found in current NPS seasonal text'};
  const pre=text.slice(Math.max(0,i-520),i);
  if(/Open year-round:\s*[^:]*$/i.test(pre)) return {state:'YEAR-ROUND',window:'Open year-round (weather can still close it)'};
  const matches=[...pre.matchAll(/Open\s+([A-Za-z]+)\s+(\d{1,2})\s*-\s*([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})\s*:/gi)];
  const m=matches.at(-1);
  if(!m) return {state:'VERIFY',window:'Projected seasonal window not parsed'};
  const start=new Date(Date.UTC(Number(m[5]),monthNumber(m[1]),Number(m[2]),0,0,0));
  const end=new Date(Date.UTC(Number(m[5]),monthNumber(m[3]),Number(m[4]),23,59,59));
  const t=now.getTime();
  return {
    state:t>=start.getTime()&&t<=end.getTime()?'SCHEDULED OPEN':'OUTSIDE PROJECTED SEASON',
    window:`${m[1]} ${m[2]} – ${m[3]} ${m[4]}, ${m[5]}`
  };
}

function delayFor(text,tag) {
  const section=text.toLowerCase().indexOf('anticipated traffic delays');
  const hay=section>=0?text.slice(section):text;
  const i=hay.toLowerCase().indexOf(tag.toLowerCase());
  if(i<0) return null;
  const focus=hay.slice(i,i+520);
  const m=focus.match(/Access:\s*([^.]*(?:delay|closure)[^.]*\.)/i);
  return m?.[1]?.trim() || null;
}

function buildYellowstoneRoutes(text,now=new Date()) {
  return YELLOWSTONE_ROUTES.map(route=>{
    const segments=route.segments.map(name=>({name,...segmentScheduledState(text,name,now)}));
    const blocked=segments.some(x=>x.state==='OUTSIDE PROJECTED SEASON');
    const unknown=segments.some(x=>x.state==='VERIFY');
    const state=blocked?'OUTSIDE PROJECTED SEASON':unknown?'VERIFY LIVE MAP':'SEASONALLY AVAILABLE — VERIFY LIVE MAP';
    const delays=[...new Set(route.delayTags.map(tag=>delayFor(text,tag)).filter(Boolean))];
    return {...route,segments,state,delays};
  });
}

async function yellowstoneRoute(id) {
  const url='https://www.nps.gov/yell/planyourvisit/parkroads.htm';
  const res=await fetchWithTimeout(url,'text/html');
  const text=cleanHtml(await res.text());
  const routes=buildYellowstoneRoutes(text,new Date());
  const updated=updatedLabel(text);
  return sourceResult(id,{name:'National Park Service — Yellowstone live road map',url},{
    status:'CHOOSE YOUR ROUTE',
    headline:'Pick an entrance-to-destination route below. The tool checks its projected seasonal road windows and current published delay notes, then sends you to the live NPS segment map for the final closure check.',
    facts:[
      {label:'Decision unit',value:'Entrance → segments → destination'},
      {label:'Route presets',value:String(routes.length)},
      {label:'Live authority',value:'NPS road-status map'},
      {label:'NPS page updated',value:updated||'See official source'}
    ],
    routes,
    sourceExcerpt:around(text,'Yellowstone Road Status Map',1100),
    rawUpdated:dateFromLabel(updated)
  });
}

function localDateParts(timeZone, date=new Date()) {
  const p=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  const o=Object.fromEntries(p.map(x=>[x.type,x.value]));
  return {year:Number(o.year),month:Number(o.month),day:Number(o.day)};
}

function utcDateFromParts(p, addDays=0) {
  return new Date(Date.UTC(p.year,p.month-1,p.day+addDays,12));
}

function isoAtUtcMinutes(date, mins) {
  const d=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate(),0,0,0));
  d.setUTCMinutes(Math.round(mins));
  return d.toISOString();
}

function weatherSignal(periods) {
  if(!periods.length) return {status:'FORECAST GAP',text:'NWS hourly periods were not available near sunrise.'};
  const joined=periods.map(p=>p.shortForecast||'').join(' · ');
  const bad=/overcast|rain|showers|thunder|fog|mostly cloudy/i.test(joined);
  const mixed=/partly|scattered|isolated|cloud/i.test(joined);
  if(!bad && !mixed) return {status:'STRONGER SUNRISE WINDOW',text:joined};
  if(!bad && mixed) return {status:'MIXED CLOUD SIGNAL',text:joined};
  return {status:'CLOUD / WEATHER RISK',text:joined};
}

async function haleakala(id) {
  const lat=20.7097, lon=-156.2533, timeZone='Pacific/Honolulu';
  const pointUrl=`https://api.weather.gov/points/${lat},${lon}`;
  const point=await (await fetchWithTimeout(pointUrl,'application/geo+json')).json();
  const hourlyUrl=point?.properties?.forecastHourly;
  if(!hourlyUrl) throw new Error('NWS did not return an hourly forecast endpoint for Haleakala summit');
  const hourly=await (await fetchWithTimeout(hourlyUrl,'application/geo+json')).json();
  const local=localDateParts(timeZone);
  let day=utcDateFromParts(local,0);
  let mins=solarMinutesUTC(day,lat,lon);
  if(!Number.isFinite(mins)) throw new Error('Could not calculate Haleakala sunrise');
  let sunriseIso=isoAtUtcMinutes(day,mins);
  if(Date.parse(sunriseIso) < Date.now()+15*60*1000) {
    day=utcDateFromParts(local,1);
    mins=solarMinutesUTC(day,lat,lon);
    sunriseIso=isoAtUtcMinutes(day,mins);
  }
  const sunriseMs=Date.parse(sunriseIso);
  const periods=(hourly?.properties?.periods||[]).filter(p=>Math.abs(Date.parse(p.startTime)-sunriseMs)<=2*3600000);
  const signal=weatherSignal(periods);
  const near=periods[0];
  const sunriseLabel=new Intl.DateTimeFormat('en-US',{timeZone,weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(sunriseIso));
  return sourceResult(id,{name:'National Weather Service + NPS Haleakala',url:'https://www.nps.gov/hale/planyourvisit/sunrise.htm'},{
    status:signal.status,
    headline:'Pair the summit weather signal with the required 3–7 a.m. vehicle reservation before committing to the drive.',
    facts:[
      {label:'Next summit sunrise',value:sunriseLabel},
      {label:'NWS near sunrise',value:near?.shortForecast||'Forecast unavailable'},
      {label:'Wind',value:near?.windSpeed||'See NWS forecast'},
      {label:'Vehicle reservation',value:'Required 3:00–7:00 a.m. HST year-round'}
    ],
    sourceExcerpt:`${signal.text}${near?.temperature!=null?` · ${near.temperature}°${near.temperatureUnit||''}`:''}. NPS requires a sunrise vehicle reservation for entry from 3:00 a.m. to 7:00 a.m.; weather does not guarantee visibility.`,
    rawUpdated:hourly?.properties?.updateTime||null
  });
}

export async function buildReplacement(id) {
  if(id==='grand-canyon-access') return grandCanyon(id);
  if(id==='mount-rainier-road-status') return mountRainier(id);
  if(id==='tioga-road-status') return tiogaRoad(id);
  if(id==='going-to-the-sun-road-status') return glacierThrough(id);
  if(id==='lake-mead-access') return lakeMead(id);
  if(id==='yellowstone-road-status') return yellowstoneRoute(id);
  if(id==='haleakala-sunrise') return haleakala(id);
  return null;
}

export {statusAfter, weatherSignal, parseGlacierThroughStatus, parseMeadLaunchTable, segmentScheduledState, buildYellowstoneRoutes};
