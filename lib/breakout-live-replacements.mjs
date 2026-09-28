import { cleanHtml, solarMinutesUTC } from './breakout-live-engine.mjs';

const UA='ChrisIzworskiBreakoutLive/1.1 (+https://chrisizworski.com/national-tools/)';
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
  const escaped=label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const re=new RegExp(`${escaped}[^A-Z]{0,30}(OPEN|CLOSED)\\b`,'i');
  const m=text.match(re);
  return m ? m[1].toUpperCase() : 'VERIFY';
}

function around(text, needle, radius=700) {
  const i=text.toLowerCase().indexOf(needle.toLowerCase());
  return i<0 ? text.slice(0,radius*2) : text.slice(Math.max(0,i-radius),Math.min(text.length,i+radius));
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
  if(id==='haleakala-sunrise') return haleakala(id);
  return null;
}

export {statusAfter, weatherSignal};
