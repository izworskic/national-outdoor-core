#!/usr/bin/env node
/**
 * Public production contract for Lake Mead only.
 * Rejects live ramp availability from stale NPS tables or thresholds alone.
 * Uses read-only public APIs and does not touch the Lake Powell implementation.
 */
const urls=[
  'https://national-outdoor-core.vercel.app/api/breakout-live?id=lake-mead-access',
  'https://chrisizworski.com/api/breakout-live?id=lake-mead-access'
];
const problems=[];
const results=[];
const sleep=(ms)=>new Promise(done=>setTimeout(done,ms));

async function get(url){
  let error;
  for(let attempt=1;attempt<=2;attempt++){
    try {
      const r=await fetch(url,{headers:{'Accept':'application/json','Cache-Control':'no-cache'},redirect:'follow',signal:AbortSignal.timeout(18000)});
      if(!r.ok)throw Error('HTTP '+r.status+' '+r.url);
      const contentType=r.headers.get('content-type')||'';
      if(!contentType.includes('json'))throw Error('Non-JSON response: '+contentType);
      return await r.json();
    }catch(e){error=e;if(attempt<2)await sleep(3000);}
  }
  throw error;
}
function verify(d,label){
  if(d?.ok!==true)throw Error('Live NPS/USBR retrieval failed: '+JSON.stringify({error:d?.error,detail:d?.detail,updated:d?.updated}));
  if(d.id!=='lake-mead-access')throw Error('Wrong tool id');
  if(!String(d.source?.url||'').startsWith('https://www.nps.gov/lake/'))throw Error('NPS source missing');
  if(!Array.isArray(d.launches)||d.launches.length<8)throw Error('Unrecognized or incomplete NPS vessel table');
  if(!d.sourcePublishedDate||!Number.isFinite(d.sourceAgeDays))throw Error('Unverified NPS source publication date');
  const now=Date.now();
  const published=Date.parse(d.sourcePublishedDate.slice(0,10)+'T00:00:00Z');
  if(!Number.isFinite(published)||published>now+86400000)throw Error('Invalid future publication date');
  if(d.sourceAgeDays<0)throw Error('Invalid negative source age');

  const stale=d.sourceAgeDays>14;
  let candidates=0,blocked=0;
  for(const row of d.launches){
    const name=String(row.name||'');
    if(!name)throw Error('Unnamed ramp');
    if(row.motorizedCandidate){
      candidates++;
      if(stale||row.motorized!=='OPEN'||row.aboveMin!==true||row.thresholdConflict){
        throw Error('Unsafe motorizedCandidate '+name+' (sourceAgeDays '+d.sourceAgeDays+', status '+row.motorized+', aboveMin '+row.aboveMin+')');
      }
    }
    if(row.motorized==='CLOSED'&&row.motorizedCandidate)throw Error('NPS closure overridden: '+name);
    if(row.motorized==='OPEN'&&row.aboveMin===false&&!row.thresholdConflict)throw Error('Elevation conflict not disclosed: '+name);
    if(row.motorized==='CLOSED')blocked++;
  }
  if(stale&&candidates!==0)throw Error('Stale source established '+candidates+' launch candidates');
  if(stale&&!/VERIFY|UNCONFIRMED|UNAVAILABLE/i.test(d.status||''))throw Error('Stale source did not get a VERIFY verdict: '+d.status);
  const gov=d.launches.find(x=>x.name==='Government Wash');
  if(!gov||gov.motorized!=='CLOSED'||gov.nonMotorized!=='CLOSED')throw Error('Government Wash concrete ramp status missing');

  const result={endpoint:label,status:d.status,sourcePublishedDate:d.sourcePublishedDate,
    sourceAgeDays:d.sourceAgeDays,stale,candidates,closedRampRows:blocked,
    sourceUrl:d.source.url,verified:'unsafe present-day availability blocked'};
  console.log(JSON.stringify(result));
  return result;
}
for(const url of urls){
  try{const d=await get(url);results.push(verify(d,new URL(url).hostname));}
  catch(e){problems.push({endpoint:url,error:String(e?.message||e)});}
}
console.log(JSON.stringify({timestamp:new Date().toISOString(),passed:problems.length===0,results,problems}));
if(problems.length)process.exitCode=1;
