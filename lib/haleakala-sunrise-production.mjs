import * as core from './haleakala-sunrise.mjs';

const OBS_DECISION_WINDOW_HOURS=8;

function finite(v){return Number.isFinite(Number(v));}
function round(v,d=0){if(!finite(v)) return null;const m=10**d;return Math.round(Number(v)*m)/m;}

function leadHours(input,now){
  const t=Date.parse(input?.sunriseIso||'');
  if(!Number.isFinite(t)) return null;
  return (t-now)/3600000;
}

function stateHeadline(state){
  if(state==='FAVORABLE') return 'Evidence currently supports a useful summit sunrise view, but local cloud can still develop.';
  if(state==='CHANGING') return 'Conditions are moving or the sources disagree. Recheck before committing to the drive.';
  if(state==='UNFAVORABLE') return 'Current evidence argues against counting on a useful summit sunrise view.';
  return 'The evidence is not strong enough for a confident sunrise call.';
}

function stateAction(state){
  if(state==='FAVORABLE') return 'The weather case supports going if your reservation and access are in order.';
  if(state==='CHANGING') return 'Do not treat the current view as persistent. Recheck close to departure.';
  if(state==='UNFAVORABLE') return 'Do not plan around a clear summit sunrise unless the evidence materially improves.';
  return 'Keep the plan flexible; the tool is abstaining rather than inventing certainty.';
}

export function classifyHaleakalaEvidence(input,now=Date.now()){
  const full=core.classifyHaleakalaEvidence(input,now);
  const lead=leadHours(input,now);
  if(lead==null||lead<=OBS_DECISION_WINDOW_HOURS){
    return {...full,leadHours:lead,observationDecisionWindowHours:OBS_DECISION_WINDOW_HOURS,observationUsedForDecision:true};
  }

  const forecastOnly=core.classifyHaleakalaEvidence({...input,lco:null},now);
  const caution=`Current summit observations are ${round(lead,1)} hours before sunrise, outside the ${OBS_DECISION_WINDOW_HOURS}-hour decision window; they are shown as context but do not choose the sunrise state.`;
  return {
    ...forecastOnly,
    summit:full.summit,
    aboveCloud:full.aboveCloud,
    cautions:[...(forecastOnly.cautions||[]),caution],
    leadHours:round(lead,1),
    observationDecisionWindowHours:OBS_DECISION_WINDOW_HOURS,
    observationUsedForDecision:false
  };
}

function reconstructInput(payload){
  const p=payload?.forecastProfile;
  return {
    sunriseIso:payload?.astronomy?.sunriseIso||null,
    gfs:p?{row:{
      rh850:p.rh850,
      rh700:p.rh700,
      rh600:p.rh600,
      z700:p.geopotentialHeight700M
    }}:null,
    lco:payload?.summit?{
      humidity:payload.summit.humidity||null,
      temperature:payload.summit.temperature||null,
      pressure:payload.summit.pressure||null,
      boltwood:payload.summit.boltwood||null,
      wind:payload.summit.wind||null
    }:null,
    nws:payload?.nws?{
      hardStops:payload.nws.hardStops||[],
      nearSunrise:payload.nws.nearSunrise||null
    }:null,
    nps:payload?.access?{access:payload.access.access}:null
  };
}

function precipitationEvidence(payload){
  const p=payload?.nws?.nearSunrise?.precipitationProbability;
  const updated=payload?.nws?.forecastUpdatedAt;
  return {
    label:'Precipitation',
    value:p==null?'Probability unavailable':`${round(p)}% near sunrise`,
    type:'FORECAST',
    status:p==null?'Unknown':Number(p)>=50?'Meaningful precipitation risk':Number(p)>=20?'Some precipitation risk':'Low forecast probability',
    source:'National Weather Service',
    fresh:updated?'Forecast update timestamp available':'Update time unavailable'
  };
}

export async function buildHaleakalaSunrise(){
  const payload=await core.buildHaleakalaSunrise();
  const now=Date.parse(payload.updated)||Date.now();
  const decision=classifyHaleakalaEvidence(reconstructInput(payload),now);
  const state=decision.state;
  const headline=stateHeadline(state);
  const action=stateAction(state);
  const agreement=decision.disagreement?'DISAGREE':'NO MAJOR CONFLICT DETECTED';
  const facts=[
    payload.facts?.[0]||{label:'Next summit sunrise',value:payload.astronomy?.sunriseLabel||'Unavailable'},
    {label:'Summit moisture',value:decision.profile?.label||'Unknown'},
    {label:'Trend',value:decision.summit?.trend==='unknown'?'Unknown':decision.summit?.trend?decision.summit.trend[0].toUpperCase()+decision.summit.trend.slice(1):'Unknown'},
    payload.facts?.find(x=>x.label==='Wind')||{label:'Wind',value:payload.summary?.wind||'Unavailable'},
    {label:'Confidence',value:decision.confidence}
  ];
  return {
    ...payload,
    status:state,
    headline,
    facts,
    decision:{
      ...payload.decision,
      state,
      confidence:decision.confidence,
      headline,
      action,
      reasons:decision.reasons,
      cautions:decision.cautions,
      sourceAgreement:agreement,
      observationUsedForDecision:decision.observationUsedForDecision,
      observationDecisionWindowHours:OBS_DECISION_WINDOW_HOURS,
      leadHours:decision.leadHours
    },
    summary:{
      ...payload.summary,
      summitMoisture:decision.profile?.label||payload.summary?.summitMoisture||'Unknown',
      trend:decision.summit?.trend==='unknown'?'Unknown':decision.summit?.trend?decision.summit.trend[0].toUpperCase()+decision.summit.trend.slice(1):payload.summary?.trend||'Unknown',
      confidence:decision.confidence,
      precipitationProbability:payload?.nws?.nearSunrise?.precipitationProbability??null
    },
    evidence:[...(payload.evidence||[]),precipitationEvidence(payload)],
    sourceExcerpt:[...(decision.reasons||[]),...(decision.cautions||[])].join(' ')
  };
}

export const nextSunrise=core.nextSunrise;
export const profileSignal=core.profileSignal;
export const summitSignal=core.summitSignal;
export const inferAboveCloud=core.inferAboveCloud;
export const parseCameraTimestamp=core.parseCameraTimestamp;
export const summarizeSeries=core.summarizeSeries;
export {OBS_DECISION_WINDOW_HOURS};
