(() => {
  const root=document.querySelector('[data-tool-id="haleakala-sunrise"]');
  if(!root) return;
  const OWNER='https://national-outdoor-core.vercel.app';
  const $=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const stateClass=s=>s==='FAVORABLE'?'go':s==='UNFAVORABLE'?'stop':'verify';
  const DATE_RE=/^\d{4}-\d{2}-\d{2}$/;
  const fmtHst=iso=>iso?new Intl.DateTimeFormat('en-US',{timeZone:'Pacific/Honolulu',weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(iso)):'Unavailable';
  const status=$('#liveStatus'),headline=$('#liveHeadline'),facts=$('#liveFacts'),fresh=$('#liveFresh'),err=$('#liveError');
  const refresh=$('#refreshLive');
  const setText=(id,v)=>{const el=$(id);if(el)el.textContent=v??'—';};
  const fmtClock=iso=>iso?new Intl.DateTimeFormat('en-US',{timeZone:'Pacific/Honolulu',hour:'numeric',minute:'2-digit'}).format(new Date(iso)).replace(' AM',' a.m.').replace(' PM',' p.m.')+' HST':'Unavailable';
  const PLAIN={FAVORABLE:'Good odds of a clear summit sunrise',CHANGING:'Could go either way',UNFAVORABLE:'Poor odds. Plan for cloud, fog or rain',UNCERTAIN:'Not enough evidence to call it',TOO_FAR:'Too early for a weather call'};
  const LEAN={clearer:'Leaning clearer at the summit','slightly-clearer':'Leaning slightly clearer','toss-up':'No lean either way',cloudier:'Leaning cloudy or foggy',unknown:'No forecast for this morning yet'};
  const COMPASS=['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  const compass=deg=>Number.isFinite(Number(deg))?COMPASS[Math.round(((Number(deg)%360)+360)%360/22.5)%16]:'';
  function windChillF(t,mph){
    if(!Number.isFinite(t)||!Number.isFinite(mph)||t>50||mph<3) return null;
    const v=Math.pow(mph,0.16);
    return Math.round(35.74+0.6215*t-35.75*v+0.4275*t*v);
  }
  const rhWord=v=>v==null?'No data':v<=30?'Dry':v>=70?'Moist, cloud likely':'Some moisture';
  const event=(name,data={})=>{try{window.va?.('event',{name,data});window.gtag?.('event',name,data);}catch{}};


  const fmtLocal=iso=>new Intl.DateTimeFormat(undefined,{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(iso));
  const ymdHst=d=>new Intl.DateTimeFormat('en-CA',{timeZone:'Pacific/Honolulu'}).format(d);
  const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const wrap=$('#hs-morning-wrap'),sel=$('#hs-morning'),dateIn=$('#hs-date');
  let chosen='';
  function plusDays(ymd,n){const [y,m,d]=ymd.split('-').map(Number);return new Date(Date.UTC(y,m-1,d+n,12)).toISOString().slice(0,10);}
  function labelYmd(ymd){const [y,m,d]=ymd.split('-').map(Number);return new Intl.DateTimeFormat('en-US',{timeZone:'UTC',weekday:'short',month:'short',day:'numeric'}).format(new Date(Date.UTC(y,m-1,d,12)));}
  function buildPicker(defaultYmd){
    if(!sel) return;
    const today=ymdHst(new Date());
    let html='<option value="">Next sunrise</option>';
    for(let i=0;i<7;i++){const v=plusDays(today,i);if(v===defaultYmd) continue;html+=`<option value="${v}">${esc(labelYmd(v))}</option>`;}
    html+='<option value="__other">Another date…</option>';
    sel.innerHTML=html;
    if(dateIn){dateIn.min=today;dateIn.max=plusDays(today,365);}
    if(chosen&&DATE_RE.test(chosen)){
      if([...sel.options].some(o=>o.value===chosen)) sel.value=chosen;
      else{sel.value='__other';if(dateIn){dateIn.hidden=false;dateIn.value=chosen;}}
    }
  }
  function setChosen(v,fromUser){
    chosen=v&&DATE_RE.test(v)?v:'';
    try{history.replaceState(null,'',chosen?`#date=${chosen}`:location.pathname+location.search);}catch{}
    if(fromUser) event('haleakala_morning_picked',{mode:chosen?'date':'next',days_ahead:chosen?Math.round((Date.parse(chosen)-Date.now())/864e5):0});
    load();
  }
  sel?.addEventListener('change',()=>{
    if(sel.value==='__other'){if(dateIn){dateIn.hidden=false;dateIn.focus();}return;}
    if(dateIn) dateIn.hidden=true;
    setChosen(sel.value,true);
  });
  dateIn?.addEventListener('change',()=>{if(dateIn.value) setChosen(dateIn.value,true);});

  function renderRelease(r,planned){
    const st=$('#hs-release-status'),a=$('#hs-release-60'),b=$('#hs-release-2');
    if(!st) return;
    if(!r){st.textContent='Release schedule unavailable. Check the NPS sunrise page.';return;}
    const both=x=>`${esc(x.label)}<small>Your time: ${esc(fmtLocal(x.iso))}</small>`;
    a.innerHTML=both(r.sixtyDay);b.innerHTML=both(r.twoDay);
    const when=labelYmd(r.date);
    const msg={
      'sixty-day-not-open':`The main release for ${when} opens in ${Math.max(1,r.sixtyDay.daysAway)} day${r.sixtyDay.daysAway===1?'':'s'}. Be on Recreation.gov at that time.`,
      'sixty-day-open':`The main release for ${when} has already happened. Check Recreation.gov for what is left; a portion is also released two days ahead.`,
      'two-day-open':`The two-day release for ${when} is out. Check Recreation.gov now.`,
      'past':'This sunrise has passed.'
    }[r.status]||'';
    st.textContent=msg;
  }
  function renderClimate(c){
    const sec=$('#hs-climate'); if(!sec) return;
    if(!c){sec.hidden=true;return;}
    sec.hidden=false;
    setText('#hs-climate-month',MONTHS[c.month-1]);
    const bar=$('#hs-climate-bar');
    bar.setAttribute('aria-label',`${c.dryPct}% dry, ${c.midPct}% in between, ${c.moistPct}% moist`);
    bar.innerHTML=`<span class="cb-dry" style="flex:${c.dryPct}">${c.dryPct>=8?c.dryPct+'%':''}</span><span class="cb-mid" style="flex:${c.midPct}">${c.midPct>=8?c.midPct+'%':''}</span><span class="cb-moist" style="flex:${c.moistPct}">${c.moistPct>=8?c.moistPct+'%':''}</span>`;
    setText('#hs-climate-legend',`Dry (clear summit likely): ${c.dryPct}% · In between: ${c.midPct}% · Moist (fog or cloud likely): ${c.moistPct}%`);
    setText('#hs-climate-note',`Humidity at the summit within 30 minutes of sunrise, ${c.days} mornings in ${MONTHS[c.month-1]}, ${c.years}. This is a proxy for a clear summit, not a count of clear skies. ${c.noData?`${c.noData} of ${c.possible} mornings had no sensor reading and are left out. The sensor can go quiet in bad weather (it did on two foggy mornings we checked), so treat the moist share as a minimum.`:''}`);
  }

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
    const planned=d.mode==='planned';
    document.body.dataset.mode=planned?'planned':'live';
    setText('#livePlain',state==='OUTLOOK'?(LEAN[decision.outlook?.lean]||PLAIN.UNCERTAIN):(PLAIN[state]||PLAIN.UNCERTAIN));
    setText('#liveEyebrow',planned&&d.date?`Sunrise on ${labelYmd(d.date)}`:'Next summit sunrise');
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
    if(rc&&planned) rc.textContent='';
    else if(rc){
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
    status.textContent=state==='OUTLOOK'?'OUTLOOK':state==='TOO_FAR'?'TOO EARLY':state;
    headline.textContent=decision.headline||'The evidence engine is abstaining.';
    const rows=d.mode==='planned'
      ?[['Sunrise',d.astronomy?.sunriseIso?fmtHst(d.astronomy.sunriseIso).replace(/^[A-Za-z]+,\s*/,''):'Unavailable'],
        ...(d.decision?.outlook?[['Air at the summit',d.summary?.summitMoisture||'Unknown'],['Wind',d.summary?.wind||'Unavailable'],['Forecast temperature',d.summary?.temperature||'Unavailable']]:[]),
        ['Confidence',decision.confidence==='NONE'?'None this far out':decision.confidence||'LOW']]
      :[['Sunrise',d.astronomy?.sunriseIso?fmtHst(d.astronomy.sunriseIso).replace(/^[A-Za-z]+,\s*/,''):'Unavailable'],
        ['Air at the summit',d.summary?.summitMoisture||'Unknown'],
        ['Humidity trend',d.summary?.trend||'Unknown'],
        ['Wind',d.summary?.wind||'Unavailable'],
        ['Confidence',decision.confidence||'LOW']];
    facts.innerHTML=rows.map(([label,value])=>`<div class="fact"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join('');
    const obs=d.freshness?.summitObservationMinutes;
    const img=d.freshness?.allSkyMinutes;
    fresh.textContent=`Updated ${fmtHst(d.updated)}${obs!=null?` · summit humidity ${obs} min old`:''}${img!=null?` · all-sky ${img} min old`:''}`;
    setText('#haleAction',decision.action);
    const ag=$('#haleAgreement');
    if(ag){ag.hidden=d.mode==='planned';ag.textContent=decision.sourceAgreement==='DISAGREE'?'Sources disagree — confidence is constrained.':'No major source conflict detected.';}
    const reasons=$('#haleReasons');
    if(reasons) reasons.innerHTML=(decision.reasons||[]).map(x=>`<li>${esc(x)}</li>`).join('');
    const cautions=$('#haleCautions');
    if(cautions) cautions.innerHTML=(decision.cautions||[]).map(x=>`<li>${esc(x)}</li>`).join('');
    renderEvidence(d.evidence||[]);
    renderRelease(d.reservation,d.mode==='planned');
    renderClimate(d.climate);
    if(d.mode!=='planned') buildPicker(d.date);
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
      const res=await fetch(`${OWNER}/api/breakout-live?id=haleakala-sunrise${chosen?`&date=${chosen}`:''}`,{mode:'cors',headers:{Accept:'application/json'}});
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
  try{const m=location.hash.match(/date=(\d{4}-\d{2}-\d{2})/);if(m) chosen=m[1];}catch{}
  buildPicker('');
  load();
})();
