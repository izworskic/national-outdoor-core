import { cleanHtml, solarMinutesUTC } from './breakout-live-engine.mjs';

const UA='ChrisIzworskiBreakoutLive/1.2 (+https://chrisizworski.com/national-tools/)';
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
  const tail=text.slice(i+label.length,i+label.length+120);
  const m=tail.match(/\b(OPEN|CLOSED)\b/i);
  return m ? m[1].toUpperCase() : 'VERIFY';
}

function around(text, needle, radius=700) {
  const i=text.toLowerCase().indexOf(needle.toLowerCase());
  return i<0 ? text.slice(0,radius*2) : text.slice(Math.max(0,i-radius),Math.min(text.length,i+radius));
}

function updatedLabel(text) {
  const m=text.match(/Road Status\s*-?\s*Updated\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})/i) || text.match(/Last updated:?\s*([A-Za-z]+\s+\d{1,2},\s+\d{4})/i);
  return m?.[1] || null;
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
    rawUpdated:null
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
  const updated=updatedLabel(text);
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
    rawUpdated:updated ? new Date(`${updated} 12:00:00 GMT-0700`).toISOString() : null
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
    ? 'NPS currently lists Tioga Road open. The live note below carries any current delay language before you commit to the cross-Sierra drive.'
    : tioga==='CLOSED'
      ? 'NPS currently lists Tioga Road closed. Do not use it as an east-west Sierra crossing.'
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
    rawUpdated:null
  });
}

async function yellowstoneRoute(id) {
  const url='https://www.nps.gov/yell/planyourvisit/parkroads.htm';
  const res=await fetchWithTimeout(url,'text/html');
  const text=cleanHtml(await res.text());
  const seasonal=/only road generally open year-round[^.]*\./i.exec(text)?.[0] || null;
  return sourceResult(id,{name:'National Park Service — Yellowstone live road map',url},{
    status:'CHECK EXACT ROUTE',
    headline:'Yellowstone road status is segment-specific. Use the official live road map for the entrance-to-destination route rather than treating the park as simply open or closed.',
    facts:[
      {label:'Decision unit',value:'Entrance → road segments → destination'},
      {label:'Park entrances',value:'5 — route can differ by entrance'},
      {label:'Live authority',value:'NPS road-status map'},
      {label:'Seasonal context',value:seasonal ? seasonal.slice(0,180) : 'Most park roads operate seasonally; current map controls.'}
    ],
    sourceExcerpt:around(text,'Yellowstone Road Status Map',900),
    rawUpdated:null
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
    sourceExcerpt:`${signal.text}${near?.temperature!=null?` · ${near.temperature}°${near.temperatureUnit||''}`:''}. NPS requires a sunrise vehicle reservation for entry from 3:00 a.m. to 7:00 a.m.; weather does not trigger refunds or exchanges.`,
    rawUpdated:hourly?.properties?.updateTime||null
  });
}

export async function buildReplacement(id) {
  if(id==='grand-canyon-access') return grandCanyon(id);
  if(id==='mount-rainier-road-status') return mountRainier(id);
  if(id==='tioga-road-status') return tiogaRoad(id);
  if(id==='yellowstone-road-status') return yellowstoneRoute(id);
  if(id==='haleakala-sunrise') return haleakala(id);
  return null;
}

export {statusAfter, weatherSignal};
