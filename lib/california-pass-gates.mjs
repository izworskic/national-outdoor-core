// A past seasonal reopening and a highway-wide no-restrictions notice cannot verify an open summit.
export const GATE_SOURCES={
 nps:'https://www.nps.gov/yose/planyourvisit/conditions.htm',
 caltrans:'https://dot.ca.gov/caltrans-near-me/district-10/district-10-popular-links/mountain-passes',
 quickmap:'https://quickmap.dot.ca.gov/'
};
export function flattenOfficialPage(source){
 return String(source||'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ')
  .replace(/<\/(?:tr|td|th|div|p|li|section|article|h[1-6])>|<br\s*\/?>/gi,'\n')
  .replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/gi,' ')
  .replace(/&amp;/gi,'&').replace(/&quot;/gi,'"')
  .replace(/&#39;|&apos;/gi,"'").replace(/\s+/g,' ').trim();
}
export function parseNpsTioga(html,{now=Date.now()}={}){
 const source=GATE_SOURCES.nps,text=flattenOfficialPage(html);
 const snippets=[...text.matchAll(/Tioga Road\s*\(continuation of Highway 120 through the park\)([\s\S]{0,1100}?)Glacier Point Road/gi)];
 if(!snippets.length)return {state:'UNAVAILABLE',source,reason:'Tioga Road status row not identified on NPS conditions page.'};
 const snippet=snippets.at(-1)[1].trim();
 const status=snippet.match(/\b(Open|Closed)\s*$/i);
 const stamp=text.match(/Last updated:\s*([A-Z][a-z]+ \d{1,2}, 20\d{2})/i);
 const parsed=stamp?new Date(stamp[1]):null,reportedDate=parsed&&Number.isFinite(parsed.getTime())?parsed.toISOString().slice(0,10):null;
 const daysOld=reportedDate?Math.floor((Date.parse(new Date(now).toISOString().slice(0,10))-Date.parse(reportedDate))/86400000):null;
 const state=!status?'UNAVAILABLE':daysOld!==null&&(daysOld<0||daysOld>21)?'STALE':status[1].toUpperCase();
 return {state,reportedStatus:status?.[1]?.toUpperCase()||null,source,reportedDate,daysOld,
  scope:'NPS planned and long-term Tioga Road status only; does not rule out an unannounced closure',
  reason:state==='OPEN'?'NPS lists Tioga Road open for planned/long-term status; call the park to check urgent changes.':
   state==='CLOSED'?'NPS lists Tioga Road closed for planned/long-term status.':
   state==='STALE'?'NPS page appears more than 21 days old; status must be verified directly.':'The NPS status row was not readable.'};
}
const HEADINGS=[
 {id:'ebbetts',pattern:/Ebbetts Pass\s*\(State Route 4\)\s*in Alpine County/gi},
 {id:'monitor',pattern:/Monitor Pass\s*\(State Route 89\)\s*in Alpine County/gi},
 {id:'sonora',pattern:/Sonora Pass\s*\(State Route 108\)\s*in Tuolumne County/gi}
];
export function parseCaltransSeasonalPasses(html,{now=Date.now()}={}){
 const text=flattenOfficialPage(html),source=GATE_SOURCES.caltrans;
 const headings=HEADINGS.map(h=>({id:h.id,index:[...text.matchAll(h.pattern)].at(-1)?.index??-1})).filter(h=>h.index>=0).sort((a,b)=>a.index-b.index);
 const passes={};
 for(let i=0;i<headings.length;i++){
  const h=headings[i],segment=text.slice(h.index,headings[i+1]?.index??Math.min(text.length,h.index+2300));
  const dm=segment.match(/\b(?:officially )?reopened\b[\s\S]{0,250}?\b(?:on\s+(?:(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+)?)([A-Z][a-z]+ \d{1,2}, 20\d{2})/i);
  const parsed=dm?new Date(dm[1]):null,validDate=parsed&&Number.isFinite(parsed.getTime())?parsed.toISOString().slice(0,10):null;
  const evidence=!!validDate&&Number(validDate.slice(0,4))===new Date(now).getUTCFullYear()&&parsed.getTime()<=now;
  passes[h.id]={state:evidence?'SEASONAL REOPENING ANNOUNCED':'NOT VERIFIED',reopenedDate:evidence?validDate:null,
   source,description:evidence?'Caltrans documents a reopening earlier this season; storm closures remain possible. This is not live gate telemetry.':
    'A current-season reopening date could not be verified from this page.'};
 }
 return passes;
}
const PASS_GATES={
 sonora:[/Sonora Pass/i,/Kennedy Meadows/i,/Leavitt Falls/i,/Sno-?Park/i,/Marine Corps Training/i],
 ebbetts:[/Ebbetts Pass/i,/Lake Alpine/i,/Raymond Meadows/i,/SR[-\s]?4\s*\/\s*89/i],
 monitor:[/Monitor Pass/i,/SR[-\s]?4\s*\/\s*89/i,/US[-\s]?395/i]
};
export function classifyPassGate(pass,roadReport,{nps=null,seasonal=null}={}){
 const notices=Array.isArray(roadReport?.notes)?roadReport.notes:[];
 const keys=PASS_GATES[pass.id];
 const closed=keys?notices.filter(line=>/\b(?:is closed|are closed|closed from|closed between|road is shut|roadway is shut)\b/i.test(line)&&keys.some(re=>re.test(line))):[];
 if(closed.length)return {state:'PASS CLOSURE REPORTED',confidence:'Caltrans report names this pass or a known pass-gate landmark',
  explanation:'A current Caltrans report references a closure at the pass or approach gate. Confirm precise limits in QuickMap.',
  evidence:closed.slice(0,3),source:pass.sourceUrl,seasonal:seasonal||null};
 if(pass.id==='tioga'){
  const n=nps||{state:'UNAVAILABLE',source:GATE_SOURCES.nps};
  return {state:n.state==='CLOSED'?'NPS REPORTS CLOSED':n.state==='OPEN'?'NPS REPORTS OPEN':'PARK STATUS UNVERIFIED',
   confidence:'NPS planned/long-term park status; not instant traffic conditions',
   explanation:n.reason||'Park gate status must be checked with Yosemite NPS.',
   evidence:n.reportedDate?[ 'NPS conditions page last updated '+n.reportedDate ]:[],
   source:GATE_SOURCES.nps,sourceUpdated:n.reportedDate||null,seasonal:null};
 }
 if(pass.seasonal){
  const s=seasonal||{state:'NOT VERIFIED',source:GATE_SOURCES.caltrans};
  return {state:s.state==='SEASONAL REOPENING ANNOUNCED'?'REOPENED THIS SEASON · VERIFY GATE':'SEASONAL GATE UNVERIFIED',
   confidence:'Caltrans seasonal announcement, not live gate telemetry',
   explanation:s.description||'No verified live gate information. Check QuickMap or Caltrans by phone.',
   evidence:s.reopenedDate?['Official reopening announced '+s.reopenedDate]:[],
   source:s.source||GATE_SOURCES.caltrans,sourceUpdated:s.reopenedDate||null,seasonal:s};
 }
 return {state:'YEAR-ROUND ROUTE · CHECK RESTRICTIONS',
  confidence:'No routine seasonal gate; highway-wide Caltrans notes do not prove this exact summit is clear',
  explanation:'Ordinarily maintained year-round, but temporary closures and chain controls can interrupt the crossing.',
  evidence:[],source:pass.sourceUrl,seasonal:null};
}
