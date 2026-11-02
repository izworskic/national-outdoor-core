export function normalizeMeadPayload(payload){
  if(!payload||!Array.isArray(payload.launches)) return payload;
  const launches=payload.launches.map(row=>{
    const thresholdConflict=row.motorized==='OPEN'&&row.aboveMin===false;
    return {
      ...row,thresholdConflict,motorizedCandidate:row.motorized==='OPEN'&&row.aboveMin===true&&!thresholdConflict,
      // A measured elevation below NPS's minimum is an unresolved conflict,
      // not permission to call a ramp open and not proof NPS has closed it.
      note:thresholdConflict&&!/^VERIFY:/i.test(row.note||'')
        ? 'VERIFY: NPS lists motorized OPEN but the measured level is below the published minimum. '+(row.note||'')
        : row.note
    };
  });
  const candidates=launches.filter(x=>x.motorizedCandidate);
  const conflicts=launches.filter(x=>x.thresholdConflict);
  const facts=(payload.facts||[]).map(f=>
    f.label==='Motorized candidates'?{...f,value:candidates.length?String(candidates.length):'Verify'}:
    f.label==='Start with'?{...f,value:candidates.slice(0,3).map(x=>x.name).join(' · ')||'NPS launch table'}:f
  );
  const warning=conflicts.length&& !/threshold conflict/i.test(payload.headline||'')
    ? ' '+conflicts.length+' NPS OPEN / measured elevation threshold conflict(s) require verification.':'';
  return {...payload,launches,facts,headline:(payload.headline||'')+warning};
}

export function normalizeReplacementPayload(id,payload){
  if(id==='lake-mead-access') return normalizeMeadPayload(payload);
  return payload;
}
