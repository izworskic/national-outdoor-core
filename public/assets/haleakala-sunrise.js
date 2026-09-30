(() => {
  const root=document.querySelector('[data-tool-id="haleakala-sunrise"]');
  if(!root) return;
  const OWNER='https://national-outdoor-core.vercel.app';
  const $=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const stateClass=s=>s==='FAVORABLE'?'go':s==='UNFAVORABLE'?'stop':'verify';
  const fmtHst=iso=>iso?new Intl.DateTimeFormat('en-US',{timeZone:'Pacific/Honolulu',weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(iso)):'Unavailable';
  const status=$('#liveStatus'),headline=$('#liveHeadline'),facts=$('#liveFacts'),fresh=$('#liveFresh'),err=$('#liveError');
  const refresh=$('#refreshLive');
  const setText=(id,v)=>{const el=$(id);if(el)el.textContent=v??'—';};
  const event=(name,data={})=>{try{window.va?.('event',{name,data});window.gtag?.('event',name,data);}catch{}};

  function renderEvidence(rows=[]){
    const out=$('#haleEvidence'); if(!out) return;
    out.innerHTML=rows.map(r=>`<article class="evidence-row">
      <div class="evidence-copy"><span class="evidence-type">${esc(r.type)}</span><strong>${esc(r.label)}</strong><p>${esc(r.value)}</p></div>
      <div class="evidence-meta"><b>${esc(r.status)}</b><small>${esc(r.source)}</small><small>${esc(r.fresh)}</small></div>
    </article>`).join('') || '<p class="degraded">No evidence rows are available.</p>';
  }
  function renderSources(rows=[]){
    const out=$('#haleSources'); if(!out) return;
    out.innerHTML=rows.map(s=>`<li><strong>${esc(s.name)}</strong><span>${esc(s.role)}</span><em>${esc(s.status)}</em></li>`).join('');
  }
  function renderErrors(errors={}){
    const keys=Object.keys(errors);
    const out=$('#haleDegraded'); if(!out) return;
    if(!keys.length){out.hidden=true;return;}
    out.hidden=false;
    out.innerHTML=`<strong>Degraded inputs</strong><p>${esc(keys.map(k=>`${k}: ${errors[k]}`).join(' · '))}</p>`;
  }
  function render(d){
    const decision=d.decision||{};
    const state=decision.state||'UNCERTAIN';
    const card=$('.live-card');
    if(card) card.dataset.state=stateClass(state);
    status.textContent=state;
    headline.textContent=decision.headline||'The evidence engine is abstaining.';
    facts.innerHTML=[
      ['Sunrise',d.astronomy?.sunriseIso?fmtHst(d.astronomy.sunriseIso).replace(/^[A-Za-z]+,\s*/,''):'Unavailable'],
      ['Summit moisture',d.summary?.summitMoisture||'Unknown'],
      ['Trend',d.summary?.trend||'Unknown'],
      ['Wind',d.summary?.wind||'Unavailable'],
      ['Confidence',decision.confidence||'LOW']
    ].map(([label,value])=>`<div class="fact"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join('');
    const obs=d.freshness?.summitObservationMinutes;
    const img=d.freshness?.allSkyMinutes;
    fresh.textContent=`Updated ${fmtHst(d.updated)}${obs!=null?` · summit humidity ${obs} min old`:''}${img!=null?` · all-sky ${img} min old`:''}`;
    setText('#haleAction',decision.action);
    setText('#haleAgreement',decision.sourceAgreement==='DISAGREE'?'Sources disagree — confidence is constrained.':'No major source conflict detected.');
    const reasons=$('#haleReasons');
    if(reasons) reasons.innerHTML=(decision.reasons||[]).map(x=>`<li>${esc(x)}</li>`).join('');
    const cautions=$('#haleCautions');
    if(cautions) cautions.innerHTML=(decision.cautions||[]).map(x=>`<li>${esc(x)}</li>`).join('');
    renderEvidence(d.evidence||[]);
    const p=d.forecastProfile;
    const profile=$('#haleProfile');
    if(profile) profile.innerHTML=p?`
      <div><span>850 hPa</span><strong>${p.rh850??'—'}% RH</strong></div>
      <div><span>700 hPa · near summit</span><strong>${p.rh700??'—'}% RH</strong></div>
      <div><span>600 hPa</span><strong>${p.rh600??'—'}% RH</strong></div>
      <p>${esc(p.note||'')}</p>`:'<p class="degraded">Forecast profile unavailable.</p>';
    const above=d.experimental?.aboveCloud;
    setText('#haleAboveCloudState',above?.state||'INSUFFICIENT EVIDENCE');
    setText('#haleAboveCloudText',above?.label||'No above-cloud inference is available.');
    setText('#haleSunriseTime',fmtHst(d.astronomy?.sunriseIso));
    setText('#haleCivilTwilight',fmtHst(d.astronomy?.civilTwilightIso));
    setText('#haleAzimuth',d.astronomy?.azimuthDeg!=null?`${d.astronomy.azimuthDeg}°`:'Unavailable');
    setText('#haleTemperature',d.summary?.temperature||'Unavailable');
    const hazards=$('#haleHazards');
    if(hazards){
      const alerts=d.nws?.alerts||[];
      hazards.innerHTML=alerts.length?alerts.map(a=>`<li><strong>${esc(a.event)}</strong>${a.headline?` — ${esc(a.headline)}`:''}</li>`).join(''):'<li>No active NWS alert returned for the summit point.</li>';
    }
    setText('#haleAccess',d.access?.access||'VERIFY');
    setText('#haleReservation',d.access?.reservationRequired?`Required ${d.access?.reservationWindow||'3:00–7:00 a.m. HST'}`:'Verify official NPS rule');
    setText('#haleAvailability',d.access?.availability==='UNKNOWN'?'Not claimed — check Recreation.gov':d.access?.availability||'Not claimed — check Recreation.gov');
    const imagery=$('#haleImagery');
    if(imagery){
      const im=d.imagery||{};
      imagery.innerHTML=im.usableForDecision?`
        <img src="${esc(im.imageUrl)}" alt="Latest Las Cumbres Observatory all-sky image from Haleakalā" loading="lazy" decoding="async">
        <p><strong>Current visual corroboration.</strong> ${esc(im.note||'')}</p>
        <a href="${esc(im.pageUrl)}" target="_blank" rel="noopener">Open LCO all-sky archive →</a>`:
        `<div class="camera-unavailable"><strong>Not used in the verdict</strong><p>${esc(im.note||'Image freshness could not be verified.')}</p><a href="${esc(im.pageUrl||'https://lco.global/camera/ogg/allsky/')}" target="_blank" rel="noopener">Check the LCO all-sky camera →</a></div>`;
    }
    renderSources(d.sources||[]);
    renderErrors(d.errors||{});
    if(err){err.hidden=true;err.textContent='';}
    event('haleakala_decision_loaded',{state,confidence:decision.confidence||'LOW',source_agreement:decision.sourceAgreement||'UNKNOWN'});
  }

  async function load(){
    refresh.disabled=true;
    status.textContent='Checking evidence…';
    headline.textContent='Comparing summit observations, vertical moisture, hazards and access.';
    try{
      const res=await fetch(`${OWNER}/api/breakout-live?id=haleakala-sunrise`,{mode:'cors',headers:{Accept:'application/json'}});
      const d=await res.json();
      if(!res.ok||!d?.ok) throw new Error(d?.detail||d?.error||`HTTP ${res.status}`);
      render(d);
    }catch(e){
      $('.live-card')?.setAttribute('data-state','verify');
      status.textContent='UNCERTAIN';
      headline.textContent='Live evidence is unavailable. This page will not substitute a generic weather guess.';
      facts.innerHTML='';
      fresh.textContent='Use the official NPS, NWS and LCO links below before committing.';
      if(err){err.hidden=false;err.textContent=`Live evidence unavailable: ${e.message}`;}
      event('haleakala_decision_error',{message:String(e.message||e).slice(0,120)});
    }finally{refresh.disabled=false;}
  }
  refresh?.addEventListener('click',()=>{event('haleakala_refresh');load();});
  document.addEventListener('click',e=>{
    const a=e.target.closest('a'); if(!a) return;
    if(a.dataset.track) event(a.dataset.track,{href:a.href});
  });
  load();
})();
