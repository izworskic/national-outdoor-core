export function normalizeMeadPayload(payload){
  if(!payload || !Array.isArray(payload.launches)) return payload;
  const launches=payload.launches.map(row=>{
    const thresholdConflict=row.motorized==='OPEN' && row.aboveMin===false;
    return {
      ...row,
      thresholdConflict,
      motorizedCandidate:row.motorized==='OPEN',
      // Current NPS open/closed status controls. A parsed elevation below a published
      // minimum is surfaced as a conflict to verify, not silently converted to CLOSED.
      aboveMin:thresholdConflict ? null : row.aboveMin,
      note:thresholdConflict
        ? `VERIFY: NPS currently lists motorized access OPEN, while the parsed lake level is below the published minimum. ${row.note||''}`.trim()
        : row.note
    };
  });
  const candidates=launches.filter(x=>x.motorizedCandidate);
  const conflicts=launches.filter(x=>x.thresholdConflict);
  const names=candidates.map(x=>x.name);
  const facts=(payload.facts||[]).map(f=>{
    if(f.label==='Motorized candidates') return {...f,value:candidates.length?String(candidates.length):'Verify'};
    if(f.label==='Start with') return {...f,value:names.slice(0,3).join(' · ')||'Current NPS launch table'};
    return f;
  });
  return {
    ...payload,
    status:candidates.length?'MOTORIZED LAUNCH OPTIONS FOUND':'VERIFY LAUNCH OPTIONS',
    headline:candidates.length
      ? `Current NPS guidance lists ${names.join(', ')} for motorized launching. ${conflicts.length?`${conflicts.length} published elevation threshold conflict${conflicts.length===1?'':'s'} need verification; NPS current status controls.`:'Check each ramp note before towing.'}`
      : 'The current NPS table does not list a motorized launch as open. Verify the official launch table before towing.',
    facts,
    launches
  };
}

export function normalizeReplacementPayload(id,payload){
  if(id==='lake-mead-access') return normalizeMeadPayload(payload);
  return payload;
}
