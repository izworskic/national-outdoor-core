const UA = 'ChrisIzworskiBreakoutLive/1.0 (+https://chrisizworski.com/national-tools/)';
const TIMEOUT_MS = 6500;

const TOOLS = {
  'old-faithful-next-eruption': {
    kind: 'oldFaithful',
    source: 'https://www.geysertimes.org/api/v5/predictions_latest/2?iso=1',
    sourceName: 'GeyserTimes prediction feed',
    official: 'https://www.nps.gov/yell/planyourvisit/geyser-activity.htm'
  },
  'zion-narrows-conditions': {
    kind: 'zion',
    source: 'https://waterservices.usgs.gov/nwis/iv/?format=json&sites=09405500&parameterCd=00060,00010&siteStatus=all',
    alerts: 'https://api.weather.gov/alerts/active?point=37.2982,-112.9469',
    sourceName: 'USGS + National Weather Service',
    official: 'https://www.nps.gov/zion/planyourvisit/thenarrows.htm'
  },
  'going-to-the-sun-road-status': {
    kind: 'road',
    source: 'https://www.nps.gov/applications/glac/roadstatus/roadstatus.cfm',
    sourceName: 'National Park Service — Glacier',
    roadName: 'Going-to-the-Sun Road',
    official: 'https://www.nps.gov/glac/planyourvisit/directions.htm'
  },
  'yellowstone-road-status': {
    kind: 'road',
    source: 'https://www.nps.gov/yell/planyourvisit/parkroads.htm',
    sourceName: 'National Park Service — Yellowstone',
    roadName: 'Yellowstone park roads',
    official: 'https://www.nps.gov/yell/planyourvisit/parkroads.htm'
  },
  'trail-ridge-road-status': {
    kind: 'road',
    source: 'https://www.nps.gov/romo/planyourvisit/road_status.htm',
    sourceName: 'National Park Service — Rocky Mountain',
    roadName: 'Trail Ridge Road',
    official: 'https://www.nps.gov/romo/planyourvisit/road_status.htm'
  },
  'tioga-road-status': {
    kind: 'road',
    source: 'https://www.nps.gov/yose/planyourvisit/conditions.htm',
    sourceName: 'National Park Service — Yosemite',
    roadName: 'Tioga Road',
    official: 'https://www.nps.gov/yose/planyourvisit/conditions.htm'
  },
  'mount-rainier-road-status': {
    kind: 'road',
    source: 'https://www.nps.gov/mora/planyourvisit/road-status.htm',
    sourceName: 'National Park Service — Mount Rainier',
    roadName: 'Mount Rainier roads',
    official: 'https://www.nps.gov/mora/planyourvisit/road-status.htm'
  },
  'cadillac-mountain-sunrise': {
    kind: 'cadillac',
    point: 'https://api.weather.gov/points/44.352,-68.225',
    sourceName: 'National Weather Service + NPS Acadia',
    official: 'https://www.nps.gov/acad/planyourvisit/vehicle_reservations.htm'
  },
  'lake-mead-access': {
    kind: 'mead',
    source: 'https://www.usbr.gov/lc/region/g4000/riverops/HOVR_FB_LastSevenDays_Daily.html',
    conditions: 'https://www.nps.gov/lake/planyourvisit/conditions.htm?fullweb=1',
    sourceName: 'Bureau of Reclamation + NPS Lake Mead',
    official: 'https://www.nps.gov/lake/planyourvisit/conditions.htm'
  },
  'lake-powell-ramp-status': {
    kind: 'powell',
    source: 'https://www.nps.gov/glca/learn/changing-lake-levels.htm',
    sourceName: 'National Park Service — Glen Canyon / Bureau of Reclamation',
    official: 'https://www.nps.gov/glca/learn/changing-lake-levels.htm'
  }
};

function cleanHtml(html='') {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function excerpt(text, terms=[], radius=300) {
  const lower = text.toLowerCase();
  let idx = -1;
  for (const term of terms) {
    const hit = lower.indexOf(term.toLowerCase());
    if (hit >= 0 && (idx < 0 || hit < idx)) idx = hit;
  }
  if (idx < 0) return text.slice(0, radius * 2);
  return text.slice(Math.max(0, idx-radius), Math.min(text.length, idx+radius));
}

function classifyRoadText(text, roadName='road') {
  const focus = excerpt(text, [roadName, 'road status', 'current conditions'], 900);
  const t = focus.toLowerCase();
  const closed = [
    'closed to through travel','closed for the season','road is closed',
    'currently closed','closed to vehicles','is closed'
  ].some(x=>t.includes(x));
  const open = [
    'open to through travel','road is open','currently open','open for the season',
    'open to vehicles','fully open'
  ].some(x=>t.includes(x));
  let state = 'VERIFY';
  if (closed && !open) state = 'CLOSED';
  else if (open && !closed) state = 'OPEN';
  else if (open && closed) state = 'PARTIAL';
  return {state, excerpt: focus};
}

function classifyNarrows(flowCfs, hasFlashWarning=false) {
  if (hasFlashWarning) return {state:'CLOSED / DO NOT ENTER', band:'flash-flood warning', reason:'An active National Weather Service Flash Flood Warning overrides the flow reading.'};
  if (!Number.isFinite(flowCfs)) return {state:'VERIFY', band:'flow unavailable', reason:'The live USGS flow reading is unavailable.'};
  if (flowCfs > 150) return {state:'BOTTOM-UP CLOSED', band:'>150 cfs', reason:'NPS closes the bottom-up Narrows route when flow is above 150 cfs.'};
  if (flowCfs > 120) return {state:'BOTTOM-UP OPEN / TOP-DOWN CLOSED', band:'121–150 cfs', reason:'Bottom-up is below its 150 cfs closure threshold, but top-down permits close above 120 cfs.'};
  if (flowCfs >= 70) return {state:'OPEN, CHALLENGING FLOW', band:'70–120 cfs', reason:'NPS describes this flow band as more difficult; conditions can change quickly.'};
  return {state:'FLOW BELOW CLOSURE THRESHOLDS', band:'<70 cfs', reason:'The live flow is below NPS flow thresholds, but weather, flash-flood risk and local closures still control the decision.'};
}

function latestUsgs(json) {
  const out = {};
  const series = json?.value?.timeSeries || [];
  for (const s of series) {
    const code = s?.variable?.variableCode?.[0]?.value;
    const label = s?.variable?.variableDescription || code;
    const values = s?.values?.flatMap(v=>v.value||[]) || [];
    const last = values.filter(v=>v?.value != null && v.value !== '').at(-1);
    if (last) out[code] = {label, value:Number(last.value), at:last.dateTime};
  }
  return out;
}

function parseMead(text) {
  const clean = cleanHtml(text);
  const values = [...clean.matchAll(/\b(10[0-9]{2}\.\d{1,2})\b/g)].map(m=>Number(m[1])).filter(v=>v>900&&v<1300);
  return values.length ? values[values.length-1] : null;
}

const POWELL_RAMPS = [
  {name:'Wahweap Main', needle:'Wahweap Main Launch Ramp', min:3545},
  {name:'Wahweap Stateline', needle:'Wahweap Stateline Launch Ramp', min:3567},
  {name:'Wahweap Stateline Auxiliary', needle:'Wahweap Stateline Auxiliary Launch Ramp', min:3515},
  {name:'Castle Rock Cut', needle:'Castle Rock Cut', min:3583},
  {name:'Antelope Point Public', needle:'Antelope Point Public Launch Ramp', min:3588},
  {name:'Antelope Point Business', needle:'Antelope Point Business Ramp', min:3535},
  {name:'Halls Crossing', needle:'Halls Crossing Launch Ramp', min:3557},
  {name:'Bullfrog North', needle:'Bullfrog North Launch Ramp', min:3525},
  {name:'Bullfrog Main', needle:'Bullfrog Main Launch Ramp', min:3578},
  {name:'Bullfrog Main Spur', needle:'Bullfrog Main Launch Ramp Spur', min:3549},
  {name:'Bullfrog Primitive', needle:'Bullfrog Primitive Launch Ramp', min:null},
  {name:'Hite', needle:'Hite Launch Ramp', min:3650}
];

function liveRampText(clean, needle, nextNeedle) {
  const lower=clean.toLowerCase();
  const i=lower.indexOf(needle.toLowerCase());
  if(i<0) return 'Not found in current NPS table — verify official source';
  let j=nextNeedle ? lower.indexOf(nextNeedle.toLowerCase(), i + needle.length) : -1;
  if(j<0 || j-i>500) j=Math.min(clean.length,i+360);
  const row=clean.slice(i,j).replace(/\s+/g,' ').trim();
  return row.slice(needle.length).trim().slice(0,220) || 'See current NPS table';
}

function parsePowell(text) {
  const clean = cleanHtml(text);
  const levelMatch = clean.match(/Lake Powell Elevation[^0-9]*(?:\d{1,2}\/\d{1,2}\/\d{4})?[^0-9]*(3[4-7]\d{2}(?:\.\d+)?)\s*ft/i)
    || clean.match(/\b(3[4-7]\d{2}\.\d{1,2})\s*ft\b/);
  const level = levelMatch ? Number(levelMatch[1]) : null;
  const ramps = POWELL_RAMPS.map((r,idx)=>({
    name:r.name,
    min:r.min,
    current:liveRampText(clean,r.needle,POWELL_RAMPS[idx+1]?.needle),
    aboveThreshold:Number.isFinite(level)&&Number.isFinite(r.min) ? level>=r.min : null
  }));
  return {level, ramps};
}

function solarMinutesUTC(date, lat, lon) {
  const rad = Math.PI/180;
  const start = Date.UTC(date.getUTCFullYear(),0,0);
  const n = Math.floor((Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate())-start)/86400000);
  const lngHour = lon/15;
  const t = n + ((6-lngHour)/24);
  const M = 0.9856*t - 3.289;
  let L = M + 1.916*Math.sin(M*rad) + 0.020*Math.sin(2*M*rad) + 282.634;
  L = (L+360)%360;
  let RA = Math.atan(0.91764*Math.tan(L*rad))/rad;
  RA = (RA+360)%360;
  const Lquad = Math.floor(L/90)*90, RAquad=Math.floor(RA/90)*90;
  RA = (RA + Lquad - RAquad)/15;
  const sinDec = 0.39782*Math.sin(L*rad);
  const cosDec = Math.cos(Math.asin(sinDec));
  const cosH = (Math.cos(90.833*rad)-sinDec*Math.sin(lat*rad))/(cosDec*Math.cos(lat*rad));
  if (cosH>1 || cosH<-1) return null;
  const H = (360-Math.acos(cosH)/rad)/15;
  const T = H + RA - 0.06571*t - 6.622;
  let UT = (T-lngHour)%24; if(UT<0) UT+=24;
  return UT*60;
}

function isoAtUtcMinutes(date, mins) {
  const d = new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate(),0,0,0));
  d.setUTCMinutes(Math.round(mins));
  return d.toISOString();
}

async function fetchWithTimeout(url, opts={}) {
  const ctl = new AbortController();
  const timer = setTimeout(()=>ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url,{...opts,signal:ctl.signal,headers:{'User-Agent':UA,'Accept':opts.accept||'*/*',...(opts.headers||{})}});
    if(!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res;
  } finally { clearTimeout(timer); }
}

async function oldFaithful(cfg) {
  const res = await fetchWithTimeout(cfg.source,{accept:'application/json'});
  const data = await res.json();
  const rows = Array.isArray(data) ? data : (data?.predictions || data?.data || data?.results || []);
  const row = rows[0] || null;
  if(!row) throw new Error('Prediction feed returned no Old Faithful prediction');
  const predicted = row.prediction || row.prediction_time || row.time || row.datetime || row.date || null;
  const min = row.windowOpen || row.min || row.window_min || row.early || null;
  const max = row.windowClose || row.max || row.window_max || row.late || null;
  return {
    status: predicted ? 'NEXT PREDICTION AVAILABLE' : 'PREDICTION FEED AVAILABLE',
    headline: predicted ? `Next predicted eruption: ${predicted}` : 'Live prediction feed is responding.',
    facts:[
      {label:'Prediction',value:String(predicted || 'See source')},
      {label:'Window',value:min&&max?`${min} – ${max}`:'Prediction source window'},
      {label:'Model',value:row.method || 'Observed geyser intervals'}
    ],
    sourceExcerpt:'Contains information from GeyserTimes, made available under the Open Database License. Use NPS Yellowstone guidance as the official park check.',
    rawUpdated: row.timestamp || row.updated || row.updated_at || null
  };
}

async function zion(cfg) {
  const [usgsRes, alertRes] = await Promise.all([
    fetchWithTimeout(cfg.source,{accept:'application/json'}),
    fetchWithTimeout(cfg.alerts,{accept:'application/geo+json'}).catch(()=>null)
  ]);
  const data = await usgsRes.json();
  const u = latestUsgs(data);
  const flow = u['00060']?.value;
  const tempC = u['00010']?.value;
  let alerts=[];
  if(alertRes) { const a=await alertRes.json(); alerts=(a.features||[]).map(f=>f.properties||{}); }
  const flash = alerts.find(a=>/flash flood warning/i.test(a.event||''));
  const decision = classifyNarrows(flow,!!flash);
  return {
    status:decision.state,
    headline:decision.reason,
    facts:[
      {label:'Virgin River flow',value:Number.isFinite(flow)?`${flow.toFixed(0)} cfs`:'Unavailable'},
      {label:'Water temp',value:Number.isFinite(tempC)?`${tempC.toFixed(1)} °C / ${(tempC*9/5+32).toFixed(0)} °F`:'Unavailable'},
      {label:'Flash Flood Warning',value:flash?'ACTIVE':'None returned for park point'}
    ],
    sourceExcerpt:`USGS station 09405500. NPS thresholds: bottom-up closes above 150 cfs; top-down closes above 120 cfs. ${flash?flash.headline||flash.event:''}`,
    rawUpdated:u['00060']?.at || null
  };
}

async function road(cfg) {
  const res=await fetchWithTimeout(cfg.source,{accept:'text/html'});
  const text=cleanHtml(await res.text());
  const c=classifyRoadText(text,cfg.roadName);
  const labels={OPEN:'Official page reads as open',CLOSED:'Official page reads as closed',PARTIAL:'Mixed open/closed status',VERIFY:'Open official status before driving'};
  return {
    status:c.state,
    headline:labels[c.state],
    facts:[
      {label:'Road / system',value:cfg.roadName},
      {label:'Source',value:cfg.sourceName},
      {label:'Live classification',value:c.state}
    ],
    sourceExcerpt:c.excerpt,
    rawUpdated:null
  };
}

async function cadillac(cfg) {
  const point=await (await fetchWithTimeout(cfg.point,{accept:'application/geo+json'})).json();
  const hourlyUrl=point?.properties?.forecastHourly;
  if(!hourlyUrl) throw new Error('NWS did not return an hourly forecast endpoint');
  const hourly=await (await fetchWithTimeout(hourlyUrl,{accept:'application/geo+json'})).json();
  const periods=hourly?.properties?.periods || [];
  const now=new Date();
  const tomorrow=new Date(now.getTime()+24*3600000);
  const sr=solarMinutesUTC(tomorrow,44.352,-68.225);
  const sunriseIso=sr==null?null:isoAtUtcMinutes(tomorrow,sr);
  const sunriseMs=sunriseIso?Date.parse(sunriseIso):NaN;
  const near=periods.filter(p=>Math.abs(Date.parse(p.startTime)-sunriseMs)<=2*3600000);
  const cloudish=near.map(p=>({short:p.shortForecast||'',wind:p.windSpeed||'',temp:p.temperature,unit:p.temperatureUnit}));
  const clearScore=near.length ? near.reduce((s,p)=>s + (/sunny|clear|mostly clear/i.test(p.shortForecast||'')?2:/partly/i.test(p.shortForecast||'')?1:0),0)/near.length : 0;
  const state=clearScore>=1.5?'STRONGER SUNRISE WINDOW':clearScore>=0.7?'MIXED CLOUD SIGNAL':'CLOUD RISK';
  return {
    status:state,
    headline:'Use the sunrise time, cloud signal and reservation window together.',
    facts:[
      {label:'Sunrise',value:sunriseIso?new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(sunriseIso)):'Unavailable'},
      {label:'NWS near sunrise',value:cloudish[0]?.short || 'Forecast unavailable'},
      {label:'Reservation',value:'Required in-season; check NPS/Recreation.gov'}
    ],
    sourceExcerpt:cloudish.map(x=>`${x.short}, ${x.wind}, ${x.temp??'—'}°${x.unit||''}`).join(' • '),
    rawUpdated:hourly?.properties?.updateTime || null
  };
}

async function mead(cfg) {
  const [rampRes, usbrRes]=await Promise.all([
    fetchWithTimeout(cfg.conditions,{accept:'text/html'}),
    fetchWithTimeout(cfg.source,{accept:'text/html'})
  ]);
  const nps=cleanHtml(await rampRes.text());
  const usbr=await usbrRes.text();
  const level=parseMead(usbr);
  const south=Number.isFinite(level) ? (level>=1035?'South Cove primitive threshold met':'South Cove primitive threshold not met') : 'South Cove threshold unknown';
  const openHints=['Hemenway','Callville Bay','Willow Beach'].filter(n=>nps.toLowerCase().includes(n.toLowerCase()));
  return {
    status:Number.isFinite(level)?'CURRENT LEVEL FOUND':'VERIFY CURRENT LEVEL',
    headline:Number.isFinite(level)?`Lake Mead is about ${level.toFixed(2)} ft in the current USBR report.`:'Could not parse a current USBR elevation.',
    facts:[
      {label:'Lake elevation',value:Number.isFinite(level)?`${level.toFixed(2)} ft`:'Unavailable'},
      {label:'South Cove primitive',value:south},
      {label:'NPS launch source',value:openHints.length?'Current conditions page responding':'Check official conditions'}
    ],
    sourceExcerpt:excerpt(nps,['Where Can I Launch','Launch Ramps','Changing Lake Levels'],600),
    rawUpdated:null
  };
}

async function powell(cfg) {
  const res=await fetchWithTimeout(cfg.source,{accept:'text/html'});
  const html=await res.text();
  const p=parsePowell(html);
  const motorized=p.ramps.filter(r=>/\bAvailable\b|\bOpen\b|Launch at your own risk/i.test(r.current) && !/^Not found/i.test(r.current));
  return {
    status:Number.isFinite(p.level)?'CURRENT RAMP TABLE FOUND':'VERIFY CURRENT LEVEL',
    headline:Number.isFinite(p.level)?`Lake Powell is ${p.level.toFixed(2)} ft on the current NPS page.`:'NPS ramp page is available, but the elevation could not be parsed.',
    facts:[
      {label:'Lake elevation',value:Number.isFinite(p.level)?`${p.level.toFixed(2)} ft`:'Unavailable'},
      {label:'Best current motorized leads',value:motorized.slice(0,3).map(r=>r.name).join(', ')||'See NPS table'},
      {label:'Threshold check',value:'Current NPS status controls'}
    ],
    ramps:p.ramps,
    sourceExcerpt:excerpt(cleanHtml(html),['Lake Powell Current Water Level','Wahweap Stateline Auxiliary','Bullfrog North'],1000),
    rawUpdated:null
  };
}

async function build(id) {
  const cfg=TOOLS[id];
  if(!cfg) { const e=new Error('Unknown tool id'); e.statusCode=404; throw e; }
  let payload;
  if(cfg.kind==='oldFaithful') payload=await oldFaithful(cfg);
  else if(cfg.kind==='zion') payload=await zion(cfg);
  else if(cfg.kind==='road') payload=await road(cfg);
  else if(cfg.kind==='cadillac') payload=await cadillac(cfg);
  else if(cfg.kind==='mead') payload=await mead(cfg);
  else if(cfg.kind==='powell') payload=await powell(cfg);
  else throw new Error('Unsupported tool kind');
  return {ok:true,id,updated:new Date().toISOString(),source:{name:cfg.sourceName,url:cfg.official},...payload};
}

export {TOOLS, cleanHtml, classifyRoadText, classifyNarrows, latestUsgs, parseMead, parsePowell, solarMinutesUTC, build};

export default async function handler(req,res) {
  res.setHeader('X-Robots-Tag','noindex, nofollow');
  res.setHeader('Cache-Control','public, s-maxage=180, stale-while-revalidate=900');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  try {
    const id=(req.query?.id || new URL(req.url,'https://example.test').searchParams.get('id') || '').trim();
    const payload=await build(id);
    res.statusCode=200; res.end(JSON.stringify(payload));
  } catch(err) {
    const status=err.statusCode||502;
    res.statusCode=status;
    res.end(JSON.stringify({ok:false,error:'Live source unavailable',detail:String(err?.message||err),updated:new Date().toISOString()}));
  }
}
