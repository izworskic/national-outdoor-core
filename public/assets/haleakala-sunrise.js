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
  const fmtClock=iso=>iso?new Intl.DateTimeFormat('en-US',{timeZone:'Pacific/Honolulu',hour:'numeric',minute:'2-digit'}).format(new Date(iso)).replace(' AM',' a.m.').replace(' PM',' p.m.')+' HST':'Unavailable';
  const PLAIN={FAVORABLE:'Good odds of a clear summit sunrise',CHANGING:'Could go either way',UNFAVORABLE:'Poor odds. Plan for cloud, fog or rain',UNCERTAIN:'Not enough evidence to call it'};
  const COMPASS=['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  const compass=deg=>Number.isFinite(Number(deg))?COMPASS[Math.round(((Number(deg)%360)+360)%360/22.5)%16]:'';
  function windChillF(t,mph){
    if(!Number.isFinite(t)||!Number.isFinite(mph)||t>50||mph<3) return null;
    const v=Math.pow(mph,0.16);
    return Math.round(35.74+0.6215*t-35.75*v+0.4275*t*v);
  }
  const rhWord=v=>v==null?'No data':v<=30?'Dry':v>=70?'Moist, cloud likely':'Some moisture';
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
  function crossSection(p){
    const Y=ft=>Math.round(268-ft/15000*236);
    const levels=[
      {ft:14000,rh:p.rh600,name:'Above the summit'},
      {ft:10000,rh:p.rh700,name:'Summit level'},
      {ft:5000,rh:p.rh850,name:'Below the summit'}
    ];
    const puffs=levels.map(l=>{
      const rh=Number(l.rh);
      const op=Number.isFinite(rh)?(0.1+0.7*Math.min(100,Math.max(0,rh))/100).toFixed(2):'0.05';
      let g='';
      for(let i=0;i<7;i++) g+=`<ellipse cx="${34+i*66}" cy="${Y(l.ft)+(i%2?4:-3)}" rx="36" ry="10" fill="#6f8796" opacity="${op}"/>`;
      return g;
    }).join('');
    const labels=levels.map(l=>{
      const rh=Number(l.rh),y=Y(l.ft);
      const has=Number.isFinite(rh);
      return `<line x1="0" y1="${y}" x2="478" y2="${y}" stroke="#8aa093" stroke-dasharray="3 5"/>
      <text x="492" y="${y-6}" class="xs-name">${esc(l.name)} · about ${l.ft.toLocaleString('en-US')} ft</text>
      <text x="492" y="${y+12}" class="xs-val">${has?Math.round(rh)+'% humidity · '+esc(rhWord(rh)):'No data'}</text>`;
    }).join('');
    return `<figure class="xs-figure"><svg viewBox="0 0 760 300" role="img" aria-label="Illustrative cross-section of Haleakalā showing forecast humidity at about 5,000, 10,000 and 14,000 feet compared with the 10,023-foot summit" class="xs-svg">
      <rect x="0" y="0" width="760" height="268" fill="#eef4f2"/>
      <rect x="0" y="268" width="478" height="32" fill="#bcd3df"/>
      <path d="M0,268 L70,238 Q150,190 205,140 L222,112 L246,118 L262,111 L278,140 Q330,190 410,238 L478,268 Z" fill="#6b5b4e"/>
      ${puffs}${labels}
      <text x="239" y="98" text-anchor="middle" class="xs-summit">Summit 10,023 ft</text>
    </svg>
    <figcaption class="xs-cap">Illustrative cross-section, not to scale. Darker puffs mean more forecast humidity at that height. ${esc(p.note||'')}</figcaption></figure>`;
  }
  function renderPlace(d){
    const decision=d.decision||{};
    const state=decision.state||'UNCERTAIN';
    setText('#livePlain',PLAIN[state]||PLAIN.UNCERTAIN);
    document.querySelectorAll('#haleScenarios article').forEach(a=>a.classList.toggle('active',a.dataset.state===state));
    // feel
    const n=d.nws?.nearSunrise;
    setText('#haleWind',n?.windSpeed?`${n.windSpeed}${n.windDirection?' from the '+n.windDirection:''}`:'Unavailable');
    const t=n?.temperature!=null?Number(n.temperature):null;
    const wc=windChillF(t,n?.windMph);
    setText('#haleFeelsLike',wc!=null?`${wc}°F`:(t!=null?`${t}°${n?.temperatureUnit||'F'}`:'Unavailable'));
    const pp=d.summary?.precipitationProbability;
    setText('#haleRain',pp==null?'Unavailable':`${Math.round(pp)}%`);
    // recheck
    const rc=$('#haleRecheck');
    if(rc){
      const hrs=decision.observationDecisionWindowHours,sr=Date.parse(d.astronomy?.sunriseIso||'');
      if(Number.isFinite(sr)&&hrs){
        const start=new Date(sr-hrs*3600000).toISOString();
        rc.textContent=decision.observationUsedForDecision===false
          ?`Live summit readings start counting toward this call at ${fmtClock(start)}. Check again then, and once more before you leave.`
          :'Live summit readings are now part of this call. Check once more right before you leave.';
      }else rc.textContent='';
    }
  }
  function render(d){
    renderPlace(d);
    const decision=d.decision||{};
    const state=decision.state||'UNCERTAIN';
    const card=$('.live-card');
    if(card) card.dataset.state=stateClass(state);
    status.textContent=state;
    headline.textContent=decision.headline||'The evidence engine is abstaining.';
    facts.innerHTML=[
      ['Sunrise',d.astronomy?.sunriseIso?fmtHst(d.astronomy.sunriseIso).replace(/^[A-Za-z]+,\s*/,''):'Unavailable'],
      ['Air at the summit',d.summary?.summitMoisture||'Unknown'],
      ['Humidity trend',d.summary?.trend||'Unknown'],
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
    if(profile) profile.innerHTML=p?crossSection(p):'<p class="degraded">Forecast moisture profile unavailable.</p>';
    const above=d.experimental?.aboveCloud;
    setText('#haleAboveCloudState',above?.state||'INSUFFICIENT EVIDENCE');
    setText('#haleAboveCloudText',above?.label||'No above-cloud inference is available.');
    setText('#haleSunriseTime',fmtClock(d.astronomy?.sunriseIso));
    setText('#haleCivilTwilight',fmtClock(d.astronomy?.civilTwilightIso));
    setText('#haleAzimuth',d.astronomy?.azimuthDeg!=null?`${d.astronomy.azimuthDeg}° (${compass(d.astronomy.azimuthDeg)})`:'unavailable');
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
      setText('#livePlain','Live evidence is unavailable right now');
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
