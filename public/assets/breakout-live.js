(() => {
  const root=document.querySelector('[data-tool-id]');
  if(!root) return;
  const OWNER='https://national-outdoor-core.vercel.app';
  const id=root.dataset.toolId;
  const $=s=>document.querySelector(s);
  const status=$('#liveStatus'), headline=$('#liveHeadline'), facts=$('#liveFacts'), fresh=$('#liveFresh'), excerpt=$('#sourceExcerpt'), source=$('#sourceLink'), ramps=$('#ramps'), err=$('#liveError');
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  const PLAYBOOKS={
    'zion-narrows-conditions':{
      label:'Route decision',
      title:'What this changes for a Narrows day',
      action(d){
        const s=String(d.status||'').toUpperCase();
        if(s.includes('DO NOT ENTER')||s.includes('BOTTOM-UP CLOSED')) return 'Do not build the day around entering the Narrows. Use the official NPS closure guidance and choose a dry-land alternative.';
        if(s.includes('TOP-DOWN CLOSED')) return 'Bottom-up may remain below its flow closure threshold, while top-down is not viable under the current flow rule. Treat the two routes as separate decisions.';
        if(s.includes('CHALLENGING')) return 'The route may be open by flow threshold, but the flow band is materially harder. Recheck flash-flood risk and water temperature before committing.';
        if(s.includes('BELOW CLOSURE')) return 'Flow is below the published closure thresholds. That is not an all-clear: flash-flood risk, water temperature and local NPS closures still decide the trip.';
        return 'The live inputs do not support a clean go/no-go. Open the official NPS guidance before entering the canyon.';
      },
      flips:['A Flash Flood Warning overrides the gauge reading.','A rising river can change route difficulty quickly.','Cold water and local closures can make a threshold-compliant day a poor choice.'],
      checks:['Choose bottom-up or top-down before interpreting the flow number.','Recheck the warning status close to trailhead time.','Use the official NPS page for any closure or permit change.']
    },
    'grand-canyon-access':{
      label:'Access decision',
      title:'Choose the rim before you choose the day',
      action(d){
        const s=String(d.status||'').toUpperCase();
        if(s.includes('RESTRICTIONS')) return 'At least one major access area is restricted. Pick the open rim or entrance first, then rebuild the route around that side of the canyon.';
        if(s.includes('MAJOR ROAD GATES OPEN')) return 'The major road gates reported by NPS are open. Your next decision is the specific scenic road, services and trail access—not a generic “park open” check.';
        return 'The source does not support one park-wide answer. Treat South Rim, Desert View and North Rim as separate access decisions.';
      },
      flips:['Flash flooding or weather can close a road after an earlier check.','North Rim services and trails can remain limited even when paved roads are open.','The drive between rims is long enough that the wrong entrance can consume most of a day.'],
      checks:['Confirm the exact rim and entrance you intend to use.','Check the specific scenic road or trailhead after the road-gate check.','Recheck NPS before a multi-hour cross-rim drive.']
    },
    'going-to-the-sun-road-status':{
      label:'Through-drive decision',
      title:'Do not confuse an open entrance with an open crossing',
      action(d){
        const s=String(d.status||'').toUpperCase();
        if(s==='OPEN') return 'The official page reads as open, but the useful question is through travel over Logan Pass. Confirm the current segment map before treating the road as a full west-to-east crossing.';
        if(s==='CLOSED') return 'Do not plan a cross-park drive. Build the day on one side of Glacier and use the official road map for the reachable section.';
        if(s==='PARTIAL') return 'Some sections appear open and others closed. Choose a side of the park rather than assuming through travel.';
        return 'The official source is not clean enough for an automatic through-drive answer. Use the current NPS segment status before leaving.';
      },
      flips:['Alpine weather, rockfall and maintenance can change the pass quickly.','Vehicle restrictions are a separate gate from road status.','Parking or shuttle logistics can still change the practical plan on an open-road day.'],
      checks:['Verify that Logan Pass is part of the open segment, not just lower road sections.','Check current vehicle restrictions.','Recheck immediately before a long cross-park drive.']
    },
    'haleakala-sunrise':{
      label:'Alarm-clock decision',
      title:'Is the early drive buying you a real sunrise window?',
      action(d){
        const s=String(d.status||'').toUpperCase();
        if(s.includes('STRONGER')) return 'The forecast signal is comparatively favorable. If you already have the required reservation, the early drive has a stronger weather case.';
        if(s.includes('MIXED')) return 'Cloud is the swing factor. Keep the reservation decision separate from the visibility decision and expect partial or changing views.';
        if(s.includes('CLOUD')||s.includes('WEATHER RISK')) return 'The forecast carries meaningful visibility risk. Decide whether the reservation and 3 a.m. departure are still worth it for you.';
        return 'The forecast is not complete enough to justify a confident sunrise verdict. Check the summit forecast and reservation status directly.';
      },
      flips:['Cloud can change rapidly at 10,000 feet.','High wind or near-freezing temperatures can materially change the experience.','A reservation allows entry; it does not guarantee visibility.'],
      checks:['Confirm the reservation before leaving.','Use the near-sunrise forecast, not a sea-level Maui forecast.','Recheck conditions before bed and again before departure.']
    },
    'yellowstone-road-status':{
      label:'Route-network decision',
      title:'Yellowstone is a road network, not one open/closed switch',
      action(d){
        const s=String(d.status||'').toUpperCase();
        if(s.includes('CHECK EXACT ROUTE')) return 'Choose your entrance and destination first, then verify every connecting segment on the official live map. This tool will not turn a segment network into a fake park-wide green light.';
        if(s==='CLOSED') return 'Do not assume your planned entrance-to-attraction route works. Open the segment map and rebuild around the roads that remain available.';
        if(s==='OPEN') return 'An “open” read is not enough for a park this large. Confirm the exact entrance-to-entrance segments before committing to a cross-park itinerary.';
        return 'Mixed or ambiguous road text should push you to the official segment map. This page should act as a trip-impact flag, not a false park-wide all-clear.';
      },
      flips:['Seasonal gates change the usable network.','Temporary closures and construction can isolate a destination without closing the park.','Outside-park roads can break an otherwise valid in-park route.'],
      checks:['Name the entrance and destination before checking road status.','Verify every segment on the official map.','Check the return route too; Yellowstone detours can be very long.']
    },
    'tioga-road-status':{
      label:'Cross-Sierra decision',
      title:'A Tioga closure changes the whole itinerary',
      action(d){
        const s=String(d.status||'').toUpperCase();
        if(s==='OPEN'||s.includes('TIOGA CROSSING OPEN')) return 'The current source supports an open crossing. Read the current delay note, check weather, then keep Tioga as the east-west route.';
        if(s==='CLOSED'||s.includes('TIOGA CROSSING CLOSED')) return 'Remove Tioga from the itinerary before you start driving. An east-west Yosemite trip now needs a different Sierra crossing or a same-side plan.';
        if(s==='PARTIAL') return 'Do not assume a full crossing. Open the official conditions page and verify the entire Tioga segment.';
        return 'The source does not support a clean crossing answer. Verify Tioga directly before committing to an east-west drive.';
      },
      flips:['Snow, rockfall, fire or construction can change access.','A technically open road can still carry material delays.','A closure can add hours depending on your origin and destination.'],
      checks:['Verify the entire Tioga crossing, not only Yosemite Valley access.','Read the live delay note before departure.','If closed, reroute before entering the park road system.']
    },
    'cadillac-mountain-sunrise':{
      label:'Sunrise decision',
      title:'Set the alarm only after weather and access agree',
      action(d){
        const s=String(d.status||'').toUpperCase();
        if(s.includes('STRONGER')) return 'The near-sunrise weather signal is favorable enough to support the early drive if your access requirement is satisfied.';
        if(s.includes('MIXED')) return 'Cloud is the swing factor. Keep expectations flexible and use the latest forecast before leaving Bar Harbor.';
        if(s.includes('CLOUD')||s.includes('WEATHER RISK')) return 'Visibility risk is meaningful. The value of the early drive is lower unless the broader sunrise experience is still worth it to you.';
        return 'The forecast is not strong enough for a confident sunrise call. Check NWS and the current Acadia access rule.';
      },
      flips:['Cloud and fog can erase the horizon while the rest of the park looks clear.','Wind can make the summit feel much colder than the valley.','Reservation-season access is a separate gate from weather.'],
      checks:['Use the mountain forecast rather than Bar Harbor alone.','Confirm the current reservation requirement.','Recheck shortly before departure.']
    },
    'mount-rainier-road-status':{
      label:'Approach decision',
      title:'Choose the park area only after its approach road works',
      action(d){
        const s=String(d.status||'').toUpperCase();
        if(s.includes('AREAS DIFFER')||s.includes('ACCESS RESTRICTIONS')) return 'Access differs by park area. Use the live rows above to choose Paradise, Sunrise, White River or Mowich before following GPS; do not treat one open approach as evidence that the others work.';
        if(s.includes('MAJOR AREAS REPORTED OPEN')) return 'Several major approaches are reported open. Still choose the exact visitor area or trailhead first because closures, parking and facilities remain area-specific.';
        if(s==='CLOSED') return 'Do not build the day around the affected approach. Choose another accessible park area or another day.';
        if(s==='OPEN') return 'The road source reads as open, but Rainier access is area-specific. Confirm the exact approach to Paradise, Sunrise or your trailhead.';
        return 'Use the area-by-area rows above and the official road map rather than a park-wide status.';
      },
      flips:['Snow, fire, construction and washouts can affect one side of the mountain only.','Seasonal gates can make one visitor area unreachable while another remains open.','Parking and trail access can fail even when the approach road is open.'],
      checks:['Name the visitor area or trailhead first.','Verify its exact approach road.','Recheck the return route if weather is deteriorating.']
    },
    'lake-mead-access':{
      label:'Launch decision',
      title:'The lake level matters only when it changes where you can launch',
      action(d){
        const south=(d.facts||[]).find(f=>/South Cove primitive/i.test(f.label||''))?.value||'';
        if(/threshold met/i.test(south)) return 'The South Cove primitive elevation threshold is met, but that does not establish current ramp condition. Use the NPS launch status to choose the actual launch site.';
        if(/not met/i.test(south)) return 'Do not rely on South Cove primitive access at this elevation. Shift the launch decision to currently operable NPS ramps.';
        return 'The water level alone is not enough to select a ramp. Use the current NPS launch status before towing to a site.';
      },
      flips:['Portable mat, construction or concession operations can change a ramp independent of elevation.','Wind and storms can make a technically open launch a poor on-water decision.','Low-water shore geometry can change faster than old ramp information.'],
      checks:['Choose the exact launch ramp, not just the lake.','Confirm NPS or concession status for that ramp.','Check wind/weather before leaving with the boat.']
    },
    'lake-powell-ramp-status':{
      label:'Ramp decision',
      title:'Turn today’s elevation into a short list of launch options',
      action(d){
        const rows=Array.isArray(d.ramps)?d.ramps:[];
        const open=rows.filter(r=>r.aboveThreshold===true && !/closed/i.test(r.current||''));
        const explicit=open.filter(r=>/open|operable|launch/i.test(r.current||''));
        const candidates=(explicit.length?explicit:open).slice(0,3).map(r=>r.name);
        if(candidates.length) return `Start your verification with ${candidates.join(', ')}. They are the strongest ramp candidates from the current elevation/threshold data, but the current NPS status text still controls.`;
        if(rows.length) return 'The current ramp table does not produce a clean motorized-launch candidate. Verify the NPS ramp table before towing to the lake.';
        return 'Ramp data is incomplete. Use the official NPS changing-lake-levels page before choosing a launch.';
      },
      flips:['A ramp can be above its minimum elevation and still be closed or limited.','Plate mats, vessel limits and construction can change the usable ramp.','A small lake-level change can matter near a threshold.'],
      checks:['Use current status and minimum elevation together.','Check vessel-size or surface limitations.','Verify again before towing to a distant ramp.']
    }
  };

  function renderDecisionBrief(d){
    const p=PLAYBOOKS[id];
    if(!p) return;
    let section=document.querySelector('.decision-brief');
    if(!section){
      section=document.createElement('section');
      section.className='decision-brief';
      document.querySelector('.live-card')?.insertAdjacentElement('afterend',section);
    }
    const action=p.action(d);
    section.innerHTML=`<div class="decision-brief-head"><div><p class="eyebrow">${esc(p.label)}</p><h2>${esc(p.title)}</h2></div><span class="decision-state">Decision support, not an all-clear</span></div><div class="decision-brief-grid"><article class="decision-action"><span>What this changes</span><strong>${esc(action)}</strong></article><article><span>What could flip it</span><ul>${p.flips.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></article><article><span>Before you commit</span><ol>${p.checks.map(x=>`<li>${esc(x)}</li>`).join('')}</ol></article></div>`;
  }

  function renderPowellPriority(d){
    if(id!=='lake-powell-ramp-status'||!ramps||!Array.isArray(d.ramps)) return;
    const state=r=>{
      const t=String(r.current||'').toLowerCase();
      if(t.includes('closed')||r.aboveThreshold===false) return 'closed';
      if(/open|operable|launch/.test(t)&&r.aboveThreshold!==false) return 'candidate';
      if(r.aboveThreshold===true) return 'verify';
      return 'verify';
    };
    const order={candidate:0,verify:1,closed:2};
    const rows=[...d.ramps].sort((a,b)=>order[state(a)]-order[state(b)]);
    ramps.innerHTML=`<div class="ramp-key"><span><i class="dot candidate"></i>candidate</span><span><i class="dot verify"></i>verify</span><span><i class="dot closed"></i>closed/below threshold</span></div>`+rows.map(x=>{
      const s=state(x);
      return `<div class="ramp ramp-${s}"><div><strong>${esc(x.name)}</strong><br><small>${esc(x.current)}</small></div><div><span class="ramp-state">${esc(s)}</span><br><strong>${x.min?esc(x.min+' ft'):'—'}</strong><br><small>${x.aboveThreshold===true?'above threshold':x.aboveThreshold===false?'below threshold':'current NPS status controls'}</small></div></div>`;
    }).join('');
  }

  function applyStatusTone(d){
    const card=document.querySelector('.live-card');
    if(!card) return;
    const s=String(d.status||'').toUpperCase();
    card.dataset.state = /CLOSED|DO NOT|RISK|RESTRICTION/.test(s) ? 'stop' : /VERIFY|PARTIAL|MIXED|GAP|UNAVAILABLE|AREAS DIFFER|CHECK EXACT ROUTE/.test(s) ? 'verify' : 'go';
  }

  async function load(){
    err.hidden=true; status.textContent='Checking live source…'; headline.textContent='This page will not invent a live answer if the source fails.'; facts.innerHTML='';
    try{
      const r=await fetch(`${OWNER}/api/breakout-live?id=${encodeURIComponent(id)}`,{cache:'no-store',mode:'cors'});
      const d=await r.json();
      if(!r.ok||!d.ok) throw new Error(d.detail||d.error||`HTTP ${r.status}`);
      status.textContent=d.status||'Live source checked';
      headline.textContent=d.headline||'Current source is responding.';
      facts.innerHTML=(d.facts||[]).map(f=>`<div class="fact"><span>${esc(f.label)}</span><strong>${esc(f.value)}</strong></div>`).join('');
      fresh.textContent=`Source check: ${new Date(d.updated).toLocaleString()}${d.rawUpdated?` · source observation ${new Date(d.rawUpdated).toLocaleString()}`:''}`;
      excerpt.textContent=d.sourceExcerpt||'No source excerpt returned.';
      source.href=d.source?.url||'#'; source.textContent=`Open ${d.source?.name||'official source'} →`;
      if(ramps && Array.isArray(d.ramps)) renderPowellPriority(d);
      applyStatusTone(d);
      renderDecisionBrief(d);
      window.va?.('event',{name:'breakout_live_loaded',data:{tool:id,status:String(d.status||'unknown').slice(0,80)}});
    }catch(e){
      status.textContent='LIVE SOURCE UNAVAILABLE';
      headline.textContent='No substitute status is being shown. Use the official source before making the trip decision.';
      excerpt.textContent='The live data request failed.';
      fresh.textContent='Last attempt: '+new Date().toLocaleString();
      err.hidden=false; err.textContent=`Live refresh failed: ${e.message}`;
      applyStatusTone({status:'UNAVAILABLE'});
      renderDecisionBrief({status:'UNAVAILABLE',facts:[],ramps:[]});
      window.va?.('event',{name:'breakout_live_failed',data:{tool:id}});
    }
  }
  $('#refreshLive')?.addEventListener('click',load);
  load();
})();