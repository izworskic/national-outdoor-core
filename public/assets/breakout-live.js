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
      label:'Route decision',title:'What this changes for a Narrows day',
      action(d){const s=String(d.status||'').toUpperCase();if(s.includes('DO NOT ENTER')||s.includes('BOTTOM-UP CLOSED')) return 'Do not build the day around entering the Narrows. Choose a dry-land alternative and use the official NPS closure guidance.';if(s.includes('TOP-DOWN CLOSED')) return 'Bottom-up may remain below its flow closure threshold while top-down is not viable. Treat the two routes as separate decisions.';if(s.includes('CHALLENGING')) return 'The route may be open by flow threshold, but this flow band is materially harder. Recheck flash-flood risk and water temperature before committing.';if(s.includes('BELOW CLOSURE')) return 'Flow is below the published closure thresholds. That is not an all-clear: flood risk, water temperature and local closures still decide the trip.';return 'The live inputs do not support a clean go/no-go. Open the official NPS guidance before entering the canyon.';},
      flips:['A Flash Flood Warning overrides the gauge reading.','A rising river can change route difficulty quickly.','Cold water and local closures can make a threshold-compliant day a poor choice.'],
      checks:['Choose bottom-up or top-down before interpreting flow.','Recheck the warning status close to trailhead time.','Use the official NPS page for any closure or permit change.']
    },
    'grand-canyon-access':{
      label:'Access decision',title:'Choose the rim before you choose the day',
      action(d){const s=String(d.status||'').toUpperCase();if(s.includes('RESTRICTIONS')) return 'At least one major access area is restricted. Pick the open rim or entrance first, then rebuild the route around that side of the canyon.';if(s.includes('MAJOR ROAD GATES OPEN')) return 'The major road gates reported by NPS are open. Your next decision is the specific scenic road, services and trail access—not a generic “park open” check.';return 'The source does not support one park-wide answer. Treat South Rim, Desert View and North Rim as separate access decisions.';},
      flips:['Weather or flash flooding can close a road after an earlier check.','North Rim services and trails can remain limited even when paved roads are open.','The drive between rims is long enough that the wrong entrance can consume most of a day.'],
      checks:['Confirm the exact rim and entrance you intend to use.','Check the specific scenic road or trailhead next.','Recheck NPS before a multi-hour cross-rim drive.']
    },
    'going-to-the-sun-road-status':{
      label:'Through-drive decision',title:'Can you actually cross Glacier over Logan Pass?',
      action(d){const s=String(d.status||'').toUpperCase();if(s.includes('SOURCE READS OPEN')) return 'The live source supports the crossing, but verify the Logan Pass/alpine extent below before treating lower-road access as a full west-to-east drive.';if(s.includes('RESTRICTED')||s.includes('CLOSED')) return 'Do not plan the full crossing. Build the day on one side of Glacier until the alpine segment is confirmed open.';return 'The live road source is not clean enough for a confident full-crossing answer. Use the west/east extents below and the official status page.';},
      flips:['Alpine weather, rockfall and maintenance can change the pass quickly.','Vehicle size limits are a separate gate from road status.','Parking or service changes can still alter the practical plan on an open-road day.'],
      checks:['Confirm Logan Pass is inside the open vehicle segment.','Check the 21 ft / 8 ft alpine vehicle limit.','Recheck immediately before a long cross-park drive.']
    },
    'haleakala-sunrise':{
      label:'Alarm-clock decision',title:'Is the early drive buying you a real sunrise window?',
      action(d){const s=String(d.status||'').toUpperCase();if(s.includes('STRONGER')) return 'The forecast signal is comparatively favorable. If you have the required reservation, the early drive has a stronger weather case.';if(s.includes('MIXED')) return 'Cloud is the swing factor. Keep the reservation decision separate from the visibility decision and expect partial or changing views.';if(s.includes('CLOUD')||s.includes('WEATHER RISK')) return 'The forecast carries meaningful visibility risk. Decide whether the reservation and 3 a.m. departure are still worth it for you.';return 'The forecast is not complete enough to justify a confident sunrise verdict. Check the summit forecast and reservation status directly.';},
      flips:['Cloud can change rapidly at 10,000 feet.','High wind or near-freezing temperatures can materially change the experience.','A reservation allows entry; it does not guarantee visibility.'],
      checks:['Confirm the reservation before leaving.','Use the near-sunrise summit forecast, not a sea-level Maui forecast.','Recheck before bed and again before departure.']
    },
    'yellowstone-road-status':{
      label:'Route-network decision',title:'Yellowstone is a route problem, not a park-open problem',
      action(d){if(Array.isArray(d.routes)&&d.routes.length) return 'Choose the entrance-to-destination trip you actually plan to drive. The route workbench checks the projected seasonal windows and published delay notes, then leaves the final closure check with the live NPS segment map.';return 'Choose your entrance and destination first, then verify every connecting segment on the official live map.';},
      flips:['Temporary closures can invalidate a seasonally open route.','High passes close earlier than lower roads.','Construction and roads outside the park can add major delays.'],
      checks:['Select the closest route preset below.','Treat “seasonally available” as a planning signal, not a live all-clear.','Open the NPS live map immediately before departure.']
    },
    'tioga-road-status':{
      label:'Cross-Sierra decision',title:'A Tioga closure changes the whole itinerary',
      action(d){const s=String(d.status||'').toUpperCase();if(s.includes('OPEN')) return 'The current source supports an open crossing. Read the current road note, check weather, then keep Tioga as the east-west route.';if(s.includes('CLOSED')) return 'Remove Tioga from the itinerary before you start driving. An east-west Yosemite trip now needs another Sierra crossing or a same-side plan.';return 'The source does not support a clean crossing answer. Verify Tioga directly before committing to an east-west drive.';},
      flips:['Snow, rockfall, fire or construction can change access.','A technically open road can still carry material delays.','A closure can add hours depending on your origin and destination.'],
      checks:['Verify the entire Tioga crossing, not only Yosemite Valley access.','Read the live road note before departure.','If closed, reroute before entering the park road system.']
    },
    'cadillac-mountain-sunrise':{
      label:'Sunrise decision',title:'Set the alarm only after weather and access agree',
      action(d){const s=String(d.status||'').toUpperCase();if(s.includes('STRONGER')) return 'The near-sunrise weather signal is favorable enough to support the early drive if your access requirement is satisfied.';if(s.includes('MIXED')) return 'Cloud is the swing factor. Keep expectations flexible and use the latest forecast before leaving Bar Harbor.';if(s.includes('CLOUD')||s.includes('WEATHER RISK')) return 'Visibility risk is meaningful. The value of the early drive is lower unless the broader sunrise experience is still worth it to you.';return 'The forecast is not strong enough for a confident sunrise call. Check NWS and the current Acadia access rule.';},
      flips:['Cloud and fog can erase the horizon while the rest of the park looks clear.','Wind can make the summit feel much colder than the valley.','Reservation-season access is separate from weather.'],
      checks:['Use the mountain forecast rather than Bar Harbor alone.','Confirm the current reservation requirement.','Recheck shortly before departure.']
    },
    'mount-rainier-road-status':{
      label:'Approach decision',title:'Choose the park area only after its approach road works',
      action(d){const s=String(d.status||'').toUpperCase();if(s.includes('AREAS DIFFER')||s.includes('RESTRICTIONS')) return 'Access differs by park area. Use the live rows above to choose Paradise, Sunrise, White River or Mowich before following GPS.';if(s.includes('MAJOR AREAS REPORTED OPEN')) return 'Several major approaches are reported open. Still choose the exact visitor area or trailhead because closures, parking and facilities remain area-specific.';return 'Use the area-by-area rows above and the official road map rather than a park-wide status.';},
      flips:['Snow, fire, construction and washouts can affect one side of the mountain only.','Seasonal gates can make one visitor area unreachable while another remains open.','Parking and trail access can fail even when the approach road is open.'],
      checks:['Name the visitor area or trailhead first.','Verify its exact approach road.','Recheck the return route if weather is deteriorating.']
    },
    'lake-mead-access':{
      label:'Launch decision',title:'Choose the ramp, not just the lake',
      action(d){const rows=Array.isArray(d.launches)?d.launches:[];const candidates=rows.filter(x=>x.motorizedCandidate).map(x=>x.name);if(candidates.length) return `For a motorized launch, start with ${candidates.slice(0,3).join(', ')}. The workbench below separates current NPS ramp status from the elevation threshold so you do not tow to a closed concrete ramp.`;return 'The current data does not produce a clean motorized-launch candidate. Use the NPS launch table before towing.';},
      flips:['Portable mats, construction or concession operations can change a ramp independent of elevation.','Wind and storms can make an open launch a poor on-water decision.','A ramp can be open for small craft but unsuitable for your vessel or trailer.'],
      checks:['Choose motorized or non-motorized below.','Read the exact ramp note, not only the lake elevation.','Check wind/weather before leaving with the boat.']
    },
    'lake-powell-ramp-status':{
      label:'Ramp decision',title:'Turn today’s elevation into a short list of launch options',
      action(d){const rows=Array.isArray(d.ramps)?d.ramps:[];const open=rows.filter(r=>r.aboveThreshold===true&&!/closed/i.test(r.current||''));const explicit=open.filter(r=>/open|operable|launch/i.test(r.current||''));const candidates=(explicit.length?explicit:open).slice(0,3).map(r=>r.name);if(candidates.length) return `Start your verification with ${candidates.join(', ')}. They are the strongest ramp candidates from current elevation and threshold data, but the NPS status text still controls.`;if(rows.length) return 'The current ramp table does not produce a clean motorized-launch candidate. Verify the NPS ramp table before towing to the lake.';return 'Ramp data is incomplete. Use the official NPS changing-lake-levels page before choosing a launch.';},
      flips:['A ramp can be above its minimum elevation and still be closed or limited.','Plate mats, vessel limits and construction can change the usable ramp.','A small lake-level change can matter near a threshold.'],
      checks:['Use current status and minimum elevation together.','Check vessel-size or surface limitations.','Verify again before towing to a distant ramp.']
    }
  };

  function ensureSection(cls,after='.live-card'){
    let section=document.querySelector(`.${cls}`);
    if(!section){section=document.createElement('section');section.className=cls;document.querySelector(after)?.insertAdjacentElement('afterend',section);}
    return section;
  }

  function renderDecisionBrief(d){
    const p=PLAYBOOKS[id];if(!p) return;
    const section=ensureSection('decision-brief');
    const action=p.action(d);
    section.innerHTML=`<div class="decision-brief-head"><div><p class="eyebrow">${esc(p.label)}</p><h2>${esc(p.title)}</h2></div><span class="decision-state">Decision support, not an all-clear</span></div><div class="decision-brief-grid"><article class="decision-action"><span>What this changes</span><strong>${esc(action)}</strong></article><article><span>What could flip it</span><ul>${p.flips.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></article><article><span>Before you commit</span><ol>${p.checks.map(x=>`<li>${esc(x)}</li>`).join('')}</ol></article></div>`;
  }

  function renderYellowstoneRoutes(d){
    if(id!=='yellowstone-road-status'||!Array.isArray(d.routes)||!d.routes.length) return;
    const section=ensureSection('decision-workbench');
    section.innerHTML=`<div class="workbench-head"><div><p class="eyebrow">Route workbench</p><h2>Which Yellowstone drive are you actually making?</h2></div><span class="workbench-note">Seasonal screen + delay context</span></div><label class="route-picker"><span>Planned drive</span><select id="yellowstoneRoute">${d.routes.map(r=>`<option value="${esc(r.id)}">${esc(r.label)}</option>`).join('')}</select></label><div id="yellowstoneRouteResult"></div>`;
    const select=section.querySelector('#yellowstoneRoute'), out=section.querySelector('#yellowstoneRouteResult');
    const draw=()=>{
      const route=d.routes.find(r=>r.id===select.value)||d.routes[0];
      const cls=/OUTSIDE/.test(route.state)?'stop':/VERIFY/.test(route.state)?'verify':'go';
      out.innerHTML=`<div class="route-verdict route-${cls}"><span>Planning signal</span><strong>${esc(route.state)}</strong><p>Final closure authority remains the live NPS road-status map.</p></div><div class="segment-list">${route.segments.map(s=>`<div class="segment-row"><div><strong>${esc(s.name)}</strong><small>${esc(s.window)}</small></div><span class="segment-state">${esc(s.state)}</span></div>`).join('')}</div>${route.delays?.length?`<div class="delay-box"><strong>Published delay notes on this route</strong><ul>${route.delays.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`:'<div class="delay-box"><strong>No route-specific published delay note parsed.</strong><p>Unscheduled work and short-term closures can still occur.</p></div>'}`;
      window.va?.('event',{name:'breakout_route_selected',data:{tool:id,route:route.id,state:route.state}});
    };
    select.addEventListener('change',draw);draw();
  }

  function renderMeadLaunches(d){
    if(id!=='lake-mead-access'||!Array.isArray(d.launches)||!d.launches.length) return;
    const section=ensureSection('launch-workbench');
    section.innerHTML=`<div class="workbench-head"><div><p class="eyebrow">Launch workbench</p><h2>Where can your boat actually launch?</h2></div><div class="mode-toggle" role="group" aria-label="Vessel type"><button type="button" data-mode="motorized" class="active">Motorized</button><button type="button" data-mode="nonMotorized">Paddle / small craft</button></div></div><div id="meadLaunchResult"></div>`;
    const out=section.querySelector('#meadLaunchResult');let mode='motorized';
    const draw=()=>{
      const key=mode==='motorized'?'motorized':'nonMotorized';
      const rows=[...d.launches].sort((a,b)=>{
        const score=x=>(x[key]==='OPEN'?0:2)+(x.aboveMin===false?2:0)+(x.motorizedCandidate&&key==='motorized'?-1:0);
        return score(a)-score(b);
      });
      out.innerHTML=`<div class="launch-list">${rows.map(x=>{const open=x[key]==='OPEN'&&x.aboveMin!==false;const cls=open?'candidate':'closed';const threshold=x.minSafe?`${x.minSafe.toLocaleString()} ft min`:'No numeric threshold';return `<article class="launch-row launch-${cls}"><div><span class="launch-status">${esc(x[key])}</span><strong>${esc(x.name)}</strong><p>${esc(x.note||'See current NPS ramp note.')}</p></div><div><b>${esc(threshold)}</b><small>${x.aboveMin===true?'current level above minimum':x.aboveMin===false?'current level below minimum':'level comparison unavailable'}</small></div></article>`;}).join('')}</div><p class="workbench-foot">Open status and elevation are separate gates. Local mat, construction, trailer and weather conditions can still change the answer.</p>`;
      window.va?.('event',{name:'breakout_launch_mode',data:{tool:id,mode}});
    };
    section.querySelectorAll('[data-mode]').forEach(btn=>btn.addEventListener('click',()=>{mode=btn.dataset.mode;section.querySelectorAll('[data-mode]').forEach(x=>x.classList.toggle('active',x===btn));draw();}));draw();
  }

  function renderGlacierCrossing(d){
    if(id!=='going-to-the-sun-road-status'||!d.throughRoute) return;
    const section=ensureSection('crossing-workbench');
    const r=d.throughRoute;
    section.innerHTML=`<div class="workbench-head"><div><p class="eyebrow">Crossing check</p><h2>West side + Logan Pass + east side must all work</h2></div><span class="workbench-note">Full road ≈ 50 miles / 2 hours nonstop</span></div><div class="crossing-grid"><article><span>West-side source</span><p>${esc(r.west)}</p></article><article><span>Logan Pass / alpine source</span><p>${esc(r.logan)}</p></article><article><span>East-side source</span><p>${esc(r.east)}</p></article></div><div class="restriction-box"><strong>Vehicle gate</strong><p>${esc(r.restriction)}</p></div>`;
  }

  function renderPowellPriority(d){
    if(id!=='lake-powell-ramp-status'||!ramps||!Array.isArray(d.ramps)) return;
    const state=r=>{const t=String(r.current||'').toLowerCase();if(t.includes('closed')||r.aboveThreshold===false) return 'closed';if(/open|operable|launch/.test(t)&&r.aboveThreshold!==false) return 'candidate';if(r.aboveThreshold===true) return 'verify';return 'verify';};
    const order={candidate:0,verify:1,closed:2};
    const rows=[...d.ramps].sort((a,b)=>order[state(a)]-order[state(b)]);
    ramps.innerHTML=`<div class="ramp-key"><span><i class="dot candidate"></i>candidate</span><span><i class="dot verify"></i>verify</span><span><i class="dot closed"></i>closed/below threshold</span></div>`+rows.map(x=>{const s=state(x);return `<div class="ramp ramp-${s}"><div><strong>${esc(x.name)}</strong><br><small>${esc(x.current)}</small></div><div><span class="ramp-state">${esc(s)}</span><br><strong>${x.min?esc(x.min+' ft'):'—'}</strong><br><small>${x.aboveThreshold===true?'above threshold':x.aboveThreshold===false?'below threshold':'current NPS status controls'}</small></div></div>`;}).join('');
  }

  function applyStatusTone(d){
    const card=document.querySelector('.live-card');if(!card) return;
    const s=String(d.status||'').toUpperCase();
    card.dataset.state=/CLOSED|DO NOT|RISK|RESTRICTION|OUTSIDE/.test(s)?'stop':/VERIFY|PARTIAL|MIXED|GAP|UNAVAILABLE|AREAS DIFFER|CHECK|CHOOSE/.test(s)?'verify':'go';
  }

  async function load(){
    err.hidden=true;status.textContent='Checking live source…';headline.textContent='This page will not invent a live answer if the source fails.';facts.innerHTML='';
    try{
      const r=await fetch(`${OWNER}/api/breakout-live?id=${encodeURIComponent(id)}`,{cache:'no-store',mode:'cors'});
      const d=await r.json();
      if(!r.ok||!d.ok) throw new Error(d.detail||d.error||`HTTP ${r.status}`);
      status.textContent=d.status||'Live source checked';headline.textContent=d.headline||'Current source is responding.';
      facts.innerHTML=(d.facts||[]).map(f=>`<div class="fact"><span>${esc(f.label)}</span><strong>${esc(f.value)}</strong></div>`).join('');
      fresh.textContent=`Source check: ${new Date(d.updated).toLocaleString()}${d.rawUpdated?` · source observation ${new Date(d.rawUpdated).toLocaleString()}`:''}`;
      excerpt.textContent=d.sourceExcerpt||'No source excerpt returned.';source.href=d.source?.url||'#';source.textContent=`Open ${d.source?.name||'official source'} →`;
      if(ramps&&Array.isArray(d.ramps)) renderPowellPriority(d);
      applyStatusTone(d);renderGlacierCrossing(d);renderYellowstoneRoutes(d);renderMeadLaunches(d);renderDecisionBrief(d);
      window.va?.('event',{name:'breakout_live_loaded',data:{tool:id,status:String(d.status||'unknown').slice(0,80)}});
    }catch(e){
      status.textContent='LIVE SOURCE UNAVAILABLE';headline.textContent='No substitute status is being shown. Use the official source before making the trip decision.';excerpt.textContent='The live data request failed.';fresh.textContent='Last attempt: '+new Date().toLocaleString();err.hidden=false;err.textContent=`Live refresh failed: ${e.message}`;
      applyStatusTone({status:'UNAVAILABLE'});renderDecisionBrief({status:'UNAVAILABLE',facts:[],ramps:[]});window.va?.('event',{name:'breakout_live_failed',data:{tool:id}});
    }
  }
  $('#refreshLive')?.addEventListener('click',load);load();
})();
