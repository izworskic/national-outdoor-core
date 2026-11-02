// Official NPS launch tables are the source of ramp access. Elevation is supporting
// evidence, never a substitute for the vessel-specific status published by NPS.
const POWELL_NAMES=[
  'Wahweap Main Launch Ramp','Wahweap Stateline Launch Ramp',
  'Wahweap Stateline Auxiliary Launch Ramp','Castle Rock Cut',
  'Antelope Point Public Launch Ramp','Antelope Point Business Ramp',
  'Halls Crossing Launch Ramp','UDOT Ferry','UDOT Launch Ramps',
  'Bullfrog North Launch Ramp','Bullfrog Main Launch Ramp',
  'Bullfrog Main Launch Ramp Spur','Bullfrog Primitive Launch Ramp',
  'Stanton Creek Primitive Area','Hite Launch Ramp','Rainbow Bridge National Monument'
];
const MEAD_NAMES=[
  'Callville Bay','Echo Bay','Hemenway Harbor','Temple Bar','South Cove',
  'Boulder Harbor','Government Wash','Las Vegas Bay','Overton Beach'
];
const STATUS='(Launch at your own risk|Visit at your own risk|Available|Closed|Open)';
const TRIPLE=new RegExp('^\\s*'+STATUS+'\\s+'+STATUS+'\\s+'+STATUS+'\\b','i');

function plain(value){
  return String(value||'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ')
    .replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ')
    .replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/\s+/g,' ').trim();
}
function isoDay(input){
  if(!input) return null;
  const d=new Date(input);
  return Number.isFinite(d.getTime())?d.toISOString().slice(0,10):null;
}
function ageDays(day,now=new Date()){
  if(!day) return null;
  const t=Date.parse(day+'T00:00:00Z');
  return Number.isFinite(t)?Math.max(0,Math.floor((now.getTime()-t)/86400000)):null;
}
function pageUpdated(text){
  const m=text.match(/\bLast updated:\s*([A-Za-z]+\s+\d{1,2},\s+\d{4})/i);
  return isoDay(m?.[1]||null);
}
function section(text,start,end){
  const i=text.toLowerCase().indexOf(start.toLowerCase());
  if(i<0) throw new Error('NPS launch-table heading missing: '+start);
  const j=text.toLowerCase().indexOf(end.toLowerCase(),i+start.length);
  if(j<0||j<=i) throw new Error('NPS launch-table end heading missing: '+end);
  return text.slice(i+start.length,j);
}
function vessel(token){
  const s=String(token||'').toLowerCase();
  if(s==='available'||s==='open') return 'OPEN';
  if(s==='closed') return 'CLOSED';
  if(s.includes('risk')) return 'AT YOUR OWN RISK';
  return 'VERIFY';
}
function parseRows(text,names,level){
  const found=names.map(name=>({name,at:text.toLowerCase().indexOf(name.toLowerCase())}))
    .filter(x=>x.at>=0).sort((a,b)=>a.at-b.at);
  const output=[];
  for(let i=0;i<found.length;i++){
    const item=found[i];
    const body=text.slice(item.at+item.name.length,found[i+1]?.at??text.length).trim();
    const status=body.match(TRIPLE);
    if(!status) continue; // Never turn free-form notes into a launch status.
    const remaining=body.slice(status[0].length).trim();
    const minMatch=remaining.match(/^(\d{1,2},\d{3}|\d{3,4})\s*(?:feet|ft)\b/i);
    const min=minMatch?Number(minMatch[1].replace(/,/g,'')):null;
    const note=(minMatch?remaining.slice(minMatch[0].length):remaining).trim().slice(0,450);
    const houseboats=vessel(status[1]),motorized=vessel(status[2]),nonMotorized=vessel(status[3]);
    const aboveThreshold=Number.isFinite(level)&&Number.isFinite(min)?level>=min:null;
    const conflict=motorized==='OPEN'&&aboveThreshold===false;
    output.push({
      name:item.name,houseboats,motorized,nonMotorized,min,minSafe:min,note,
      current:motorized+(note?' — '+note:''),
      aboveThreshold,aboveMin:aboveThreshold,thresholdConflict:conflict,
      motorizedCandidate:motorized==='OPEN'&&!conflict,
      motorizedRisk:motorized==='AT YOUR OWN RISK'
    });
  }
  return output;
}

export function parsePowellRampTable(html,now=new Date()){
  const text=plain(html);
  const scope=section(text,'Lake Level Effects to Launch Ramps and Services','For more information on launch ramp improvement projects');
  const match=text.match(/Lake Powell Elevation\s*\((\d{1,2}\/\d{1,2}\/\d{4})\)\s*(3[4-7]\d{2}(?:\.\d+)?)\s*ft/i);
  const level=match?Number(match[2]):null,levelDay=isoDay(match?.[1]||null);
  const ramps=parseRows(scope,POWELL_NAMES,level);
  // Fail closed when the NPS table layout changes; partial rows cannot become a short list.
  if(ramps.length<12||!ramps.some(x=>x.name==='Wahweap Stateline Auxiliary Launch Ramp')||
     !ramps.some(x=>x.name==='Bullfrog North Launch Ramp')){
    throw new Error('NPS Lake Powell table incomplete or unrecognized');
  }
  return {level,levelDay,levelAgeDays:ageDays(levelDay,now),sourceDay:pageUpdated(text),ramps};
}

export function parseMeadRampTable(html,now=new Date()){
  const text=plain(html);
  const scope=section(text,'Lake Mead Launch Ramps and Services','Lake Mohave Current Water Level');
  const launches=parseRows(scope,MEAD_NAMES,null);
  if(launches.length<8||!launches.some(x=>x.name==='Hemenway Harbor')||
    !launches.some(x=>x.name==='South Cove')){
    throw new Error('NPS Lake Mead table incomplete or unrecognized');
  }
  const sourceDay=pageUpdated(text);
  return {launches,sourceDay,sourceAgeDays:ageDays(sourceDay,now)};
}

// Only parse the date-stamped, lake-specific US Bureau of Reclamation table.
// The last row can contain NaN during reporting rollover; take the last *valid* reading.
export function parseMeadElevation(html,now=new Date()){
  const text=plain(html);
  if(!/\bSITE NAME:\s*LAKE MEAD\b/i.test(text)||
     !/\bPARAMETER:\s*RESERVOIR WS ELEVATION\b/i.test(text)) return null;
  const rows=[...text.matchAll(/(\d{1,2}\/\d{1,2}\/\d{4})\s+\d{1,2}:\d{2}:\d{2}\s*[AP]M\s+(\d{3,4}(?:\.\d+)?|NaN)\b/gi)];
  const valid=rows.map(m=>({day:isoDay(m[1]),level:Number(m[2])}))
    .filter(x=>x.day&&Number.isFinite(x.level)&&x.level>=900&&x.level<=1300);
  if(!valid.length) return null;
  const latest=valid.at(-1);
  return {...latest,ageDays:ageDays(latest.day,now)};
}

export function combineMeadEvidence(npsHtml,usbrHtml,now=new Date()){
  const official=parseMeadRampTable(npsHtml,now);
  const elevation=usbrHtml?parseMeadElevation(usbrHtml,now):null;
  const level=elevation&&elevation.ageDays<=3?elevation.level:null;
  const launches=official.launches.map(row=>{
    const aboveMin=Number.isFinite(level)&&Number.isFinite(row.minSafe)?level>=row.minSafe:null;
    const thresholdConflict=row.motorized==='OPEN'&&aboveMin===false;
    return {...row,aboveMin,aboveThreshold:aboveMin,thresholdConflict,
      motorizedCandidate:row.motorized==='OPEN'&&!thresholdConflict,
      note:thresholdConflict?'VERIFY: NPS lists motorized OPEN but the measured elevation is below the published minimum. '+row.note:row.note
    };
  });
  return {...official,level,levelDay:level?elevation.day:null,levelAgeDays:level?elevation.ageDays:null,
    elevationAvailable:Boolean(level),launches};
}

export {ageDays};
