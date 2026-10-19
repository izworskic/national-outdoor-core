(()=>{'use strict';
 const root=document.querySelector('[data-california-road]');if(!root)return;
 const kind=root.dataset.californiaRoad,$=id=>document.getElementById(id);
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let map=null,markers={},routeLine=null,userPin=null,sierraOverlay=null,officialRoadLine=null,roadRequestId=0,caltransAttribution=false,last=null,selectedPass='sonora';
 const geometryCache={};
 const tone=s=>/CLOSURE REPORTED|CLOSED|UNAVAILABLE/.test(s)?'bad':/RESTRICTIONS|WORK|VERIFY|PARK CHECK|UNKNOWN/.test(s)?'warn':'calm';
 const date=d=>d?new Date(d).toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short'}):'Not available';
 function mapInit(){
  if(!window.L){$('mapFallback').hidden=false;return;}
  map=L.map('californiaMap',{scrollWheelZoom:false,attributionControl:true}).setView(kind==='coast'?[36.07,-121.54]:[38.55,-120.1],kind==='coast'?9:7);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
   {attribution:'&copy; OpenStreetMap contributors &copy; CARTO',maxZoom:18,subdomains:'abcd'}).addTo(map);
 }
 function pointsMap(points){
  if(!map)return;
  Object.values(markers).forEach(p=>p.remove());markers={};
  points.forEach(p=>{
   const marker=L.circleMarker([p.lat,p.lng],{radius:8,weight:2,color:'#fff',fillColor:kind==='coast'?'#166a70':'#246a48',fillOpacity:.98}).addTo(map);
   marker.bindPopup('<strong>'+esc(p.name)+'</strong><p>'+esc(p.note||p.character||'')+'</p>');
   marker.on('click',()=>focus(p.id,false));
   markers[p.id]=marker;
  });
  const bounds=L.latLngBounds(points.map(p=>[p.lat,p.lng]));
  if(bounds.isValid())map.fitBounds(bounds.pad(.10));
 }
 function focus(id,pan=true){
  const marker=markers[id];if(marker&&map){if(pan)map.panTo(marker.getLatLng());marker.openPopup();}
  document.querySelectorAll('[data-place]').forEach(el=>el.classList.toggle('active',el.dataset.place===id));
  if(kind==='sierra'){selectedPass=id;updateSierraDetail();drawPassHighway(id,{fit:pan});}
 }
 function link(url,label){return '<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+esc(label)+' ↗</a>';}
 function setSummary(title,body,state,meta){
  $('liveState').textContent=title;$('liveState').dataset.tone=tone(state);
  $('liveHeadline').textContent=body;$('liveFresh').textContent=meta;
 }
 const pacificDay=e=>{
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(e*1000));
  return ['year','month','day'].map(k=>parts.find(x=>x.type===k)?.value).join('-');
 };
 const shortDay=day=>new Date(day+'T12:00:00Z').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',timeZone:'UTC'});
 function coastPlan(day=$('travelDate').value){
  const stops=last?.stops||[],from=stops.findIndex(p=>p.id===$('coastFrom').value),to=stops.findIndex(p=>p.id===$('coastTo').value);
  if(from<0||to<0||from===to)return {state:'VERIFY',reason:'Choose two different coastal destinations.',events:[],reachable:[],selected:[]};
  const step=from<to?1:-1,min=Math.min(from,to),max=Math.max(from,to);
  const selected=[];for(let i=from;step>0?i<=to:i>=to;i+=step)selected.push(stops[i]);
  const today=last?.availableDates?.[0];
  const relevant=[...(last?.events||[]),...(last?.currentNotices||[])].filter(e=>e.from<max&&e.to>min&&(
   Array.isArray(e.scheduleDays)?e.scheduleDays.some(w=>w.day===day):
   e.currentOnly?day===today:pacificDay(e.startEpoch)<=day&&pacificDay(e.endEpoch)>=day));
  const full=relevant.filter(e=>e.type==='full'),works=relevant.filter(e=>e.type!=='full');
  const active=full.some(e=>day===today&&e.active&&(
   Array.isArray(e.scheduleDays)?e.scheduleDays.some(w=>w.day===day&&new Date().toLocaleTimeString('en-GB',{timeZone:'America/Los_Angeles',hour:'2-digit',minute:'2-digit',hour12:false})>=w.start&&new Date().toLocaleTimeString('en-GB',{timeZone:'America/Los_Angeles',hour:'2-digit',minute:'2-digit',hour12:false})<w.end):
   Date.now()>=e.startEpoch*1000&&Date.now()<=e.endEpoch*1000));
  const state=!last?.structured?.available?'VERIFY':active?'REPORTED FULL CLOSURE':full.length?'PLANNED FULL CLOSURE':works.length?'CONTROLLED WORK':'NO MATCHED PLANNED WORK';
  const blockage=full.sort((a,b)=>step>0?a.from-b.from:b.to-a.to)[0];
  const reachable=[];for(let i=from;step>0?i<=to:i>=to;i+=step){
    if(blockage&&(step>0?i>blockage.from:i<blockage.to))break;
    reachable.push(stops[i]);
  }
  return {state,relevant,full,works,selected,reachable,from,to,step,day,blockage};
 }
 function weatherFor(day){
  const weather=last?.weather;
  if(!weather?.available)return 'NWS forecast unavailable; weather risk unverified.';
  const periods=(weather.days||[]).filter(x=>x.day===day);
  if(!periods.length)return 'No NWS daily forecast period available for this date.';
  const wet=periods.some(p=>/rain|storm|shower|snow|flood/i.test(p.summary||'')||p.precipitationChance>=55);
  return (wet?'NWS weather caution: ':'NWS regional forecast: ')+periods.map(p=>p.name+': '+p.summary).join('; ')+
    '. This is a regional weather signal, not a highway closure observation.';
 }
 function drawCoast(){
  if(!last)return;
  const d=last,plan=coastPlan(),v=$('routeVerdict');
  if(!plan.selected.length){v.innerHTML='<h3>Select a valid route</h3><p>Origin and destination must be different.</p>';return;}
  const known=/REPORTED FULL CLOSURE|PLANNED FULL CLOSURE/.test(plan.state);
  const title=plan.state==='REPORTED FULL CLOSURE'?'Active full closure reported on this selected corridor':
    plan.state==='PLANNED FULL CLOSURE'?'A full closure is scheduled for this selected travel day':
    plan.state==='CONTROLLED WORK'?'Published work hours affect this selected coastal drive':
    plan.state==='VERIFY'?'Planned-work feed unavailable: verify before driving':
    'No matching approved work—not a confirmed open route';
  const details=plan.state==='VERIFY'?'Caltrans planned-work feed is unavailable. No trip-wide conclusion is possible.':
    known?'A georeferenced Caltrans mainline closure overlaps the selected section. Its exact roadway limits and live activation must be verified in QuickMap.':
    plan.state==='CONTROLLED WORK'?'Caltrans reports work or one-way traffic controls along this route during published hours on the selected day. These are schedule-based cautions, not proof work is underway at your arrival time.':
    'No published work window matched this route and date. This does not establish that Highway 1 is open; rockslides, incidents and emergency controls may occur without notice.';
  const locatedReport=plan.relevant.some(e=>e.sourceKind==='current-highway-report');
  const currentSource=d.state==='CLOSURE REPORTED'?' The separate Caltrans highway report lists a closure; verify its exact limits before driving.':
    d.state==='WORK ZONES REPORTED'&&!locatedReport?' Separately, Caltrans reports Monterey-area work that might be outside this route or hours.':'';
  v.className='verdict '+(known?'bad':plan.state==='CONTROLLED WORK'||plan.state==='VERIFY'?'warn':'calm');
  v.innerHTML='<h3>'+esc(title)+'</h3><p>'+esc(details+currentSource)+'</p><p class="fine">'+esc(weatherFor(plan.day))+'</p>';
  $('routeType').textContent='Selected: '+plan.selected[0].name+' → '+plan.selected[plan.selected.length-1].name+
   ' · '+shortDay(plan.day)+' · planned work checked separately from live highway restrictions.';
  $('routeEvidence').innerHTML=plan.relevant.length?plan.relevant.slice(0,8).map(e=>{
    const t=e.type==='full'?'Full mainline':e.type==='controlled'?'Alternating/one-way':'Lane work';
    const current=e.sourceKind==='current-highway-report';
    const hours=(e.scheduleDays||[]).filter(w=>w.day===plan.day).map(w=>w.label).join(', ');
    const evidenceStamp=current?
      (hours?'Caltrans highway report recurring schedule: '+hours+' Pacific'+(e.scheduleExpires?' · listed through '+e.scheduleExpires.day:''):
        'Current Caltrans Highway 1 notice; no verified future schedule'):
      new Date(e.startEpoch*1000).toLocaleString('en-US',{timeZone:'America/Los_Angeles'})+' → '+new Date(e.endEpoch*1000).toLocaleString('en-US',{timeZone:'America/Los_Angeles'})+' Pacific';
    return '<article><strong>'+esc(t)+' · '+esc(e.beginPlace||'Unspecified location')+'</strong>'+
      '<small>'+esc(evidenceStamp)+
      ' · '+esc(e.confidence)+' · '+esc(e.direction)+'</small><p class="note-copy">'+esc(e.work||'Scheduled Caltrans work')+
      (e.delayMinutes!==null?' · Reported delay estimate: '+esc(e.delayMinutes)+' min':'')+'</p></article>';
  }).join(''):'<article>No published work window is matched to this route and day. Current conditions and unplanned closures still require checking.</article>';
  $('reachableResult').innerHTML=known?
    '<strong>Potential same-side visit</strong><p>Before the reported closure, the following stops may remain reachable from your selected starting end: '+
      esc(plan.reachable.map(p=>p.name).join(' → ')||'No intermediate stop confirmed')+
      '. This is schematic only: verify road gates before driving. If the coast through-drive is blocked, consider returning to US-101 via established highways—not unverified inland shortcuts.</p>':
    '<strong>Before departure</strong><p>Check Caltrans QuickMap and the latest Highway 1 report for rockslides, incidents, temporary gates, closures and direction-specific traffic controls. The map line is schematic, not navigation.</p>';
  $('stopList').innerHTML=plan.selected.map((p,i)=>'<button class="stop" type="button" data-place="'+esc(p.id)+'"><span class="step">'+(i+1)+'</span><span><strong>'+esc(p.name)+'</strong><small>'+esc(p.note)+'</small></span></button>').join('');
  $('stopList').querySelectorAll('[data-place]').forEach(button=>button.addEventListener('click',()=>focus(button.dataset.place)));
  if(map){
    if(routeLine)routeLine.remove();
    const group=L.layerGroup().addTo(map);routeLine=group;
    for(let i=0;i<plan.selected.length-1;i++){
      const a=plan.selected[i],b=plan.selected[i+1];
      const ia=d.stops.findIndex(x=>x.id===a.id),ib=d.stops.findIndex(x=>x.id===b.id);
      const blocked=plan.relevant.some(e=>e.type==='full'&&e.from<Math.max(ia,ib)&&e.to>Math.min(ia,ib));
      const controlled=plan.relevant.some(e=>e.type!=='full'&&e.from<Math.max(ia,ib)&&e.to>Math.min(ia,ib));
      L.polyline([[a.lat,a.lng],[b.lat,b.lng]],{weight:6,opacity:.85,color:blocked?'#a23a37':controlled?'#aa761c':'#247373',dashArray:'6 5'}).addTo(group);
    }
    map.fitBounds(L.latLngBounds(plan.selected.map(x=>[x.lat,x.lng])).pad(.14));
  }
  $('dayWindow').innerHTML=(d.availableDates||[]).map(day=>{
   const p=coastPlan(day),color=p.state==='REPORTED FULL CLOSURE'||p.state==='PLANNED FULL CLOSURE'?'danger':p.state==='CONTROLLED WORK'?'work':'unknown';
   const windowLabels=[...new Set(p.relevant.flatMap(e=>(e.scheduleDays||[]).filter(w=>w.day===day).map(w=>w.label)))];
   const label=p.state==='PLANNED FULL CLOSURE'?'Planned full closure':p.state==='REPORTED FULL CLOSURE'?'Closure reported':
    p.state==='CONTROLLED WORK'?(windowLabels.length===1?windowLabels[0]+' work':p.works.length+' work controls'):'No work matched · verify';
   return '<button class="road-day '+(day===plan.day?'active ':'')+color+'" type="button" data-day="'+esc(day)+'" aria-label="'+esc(shortDay(day)+' · '+label)+'"><strong>'+esc(shortDay(day))+'</strong><small>'+esc(label)+'</small></button>';
  }).join('');
  $('dayWindow').querySelectorAll('[data-day]').forEach(btn=>btn.addEventListener('click',()=>{$('travelDate').value=btn.dataset.day;drawCoast();}));
  window.va?.('event',{name:'california_road_plan_selected',data:{tool:'coast',from:plan.selected[0].id,to:plan.selected.at(-1).id,day:plan.day,state:plan.state}});
 }
 function renderCoast(d){
  last=d;
  setSummary(d.state,d.reason,d.state,'Caltrans current highway report: '+(d.reportedAt||'unavailable')+
   ' · LCS: '+(d.structured?.available?'available':'unavailable')+' · Retrieved: '+date(d.checkedAt));
  $('workNotes').innerHTML=d.notes?.length?d.notes.map(t=>'<article>'+esc(t)+'</article>').join(''):
   '<article>No Monterey-area Highway 1 notice was parsed. This is not proof that all road sections are open.</article>';
  const picker=$('tripPicker'),oldPreset=picker.value;
  picker.innerHTML=(d.trips||[]).map(t=>'<option value="'+esc(t.id)+'">'+esc(t.name)+'</option>').join('')+
   '<option value="custom">Custom start and destination</option>';
  if(d.trips.some(x=>x.id===oldPreset))picker.value=oldPreset;
  const from=$('coastFrom'),to=$('coastTo'),had=from.options.length>0,
        priorFrom=from.value,priorTo=to.value,priorDay=$('travelDate').value;
  const options=d.stops.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+'</option>').join('');
  from.innerHTML=options;to.innerHTML=options;
  if(had&&d.stops.some(p=>p.id===priorFrom))from.value=priorFrom;
  if(had&&d.stops.some(p=>p.id===priorTo))to.value=priorTo;
  if(!had){const initial=d.trips.find(t=>t.id===picker.value)||d.trips[0];from.value=initial.stops[0];to.value=initial.stops.at(-1);}
  const days=$('travelDate');
  days.innerHTML=(d.availableDates||[]).map(x=>'<option value="'+esc(x)+'">'+esc(shortDay(x))+'</option>').join('');
  if((d.availableDates||[]).includes(priorDay))days.value=priorDay;
  pointsMap(d.stops||[]);drawCoast();
 }
 function sierraObservedMap(pass){
  if(!map||!window.L)return;
  if(sierraOverlay)sierraOverlay.remove();
  sierraOverlay=L.layerGroup().addTo(map);
  const obs=pass.observation||{};
  (obs.work||[]).forEach((w,i)=>{
   const marker=L.circleMarker([w.lat,w.lng],{radius:7,color:'#fff',weight:2,
    fillColor:w.type==='full'?'#ac342f':'#b47b18',fillOpacity:.94}).addTo(sierraOverlay);
   marker.bindPopup('<strong>'+esc(w.live?'Reported active':'Planned / unconfirmed')+' '+esc(w.type)+' roadwork</strong>'+
    '<p>'+esc(w.begin)+(w.end?' → '+esc(w.end):'')+' · '+esc(w.area)+
    ' · about '+esc(w.distanceKm)+' km from '+esc(pass.name)+'. Approximate location; does not prove gate status.</p>'+
    '<p>'+esc(w.work)+'</p>'+link(w.source,'Caltrans QuickMap'));
  });
  (obs.cameras||[]).forEach(c=>{
   const marker=L.circleMarker([c.lat,c.lng],{radius:7,color:'#fff',weight:2,
    fillColor:'#2454a7',fillOpacity:.96}).addTo(sierraOverlay);
   marker.bindPopup('<strong>'+esc(c.name)+'</strong><p>Caltrans camera still · '+esc(c.distanceKm)+
    ' km from '+esc(pass.name)+'. Image freshness not guaranteed.</p>'+
    link(c.imageUrl,'Open official camera still'));
  });
 }
 const crossingOptions={
  sonora:['carson','ebbetts','tioga','echo'],ebbetts:['carson','sonora','monitor','echo'],
  carson:['echo','donner','ebbetts','sonora'],monitor:['carson','sonora','ebbetts','echo'],
  tioga:['sonora','carson','echo','donner'],echo:['donner','carson','sonora','ebbetts'],
  donner:['echo','carson','sonora','ebbetts']
 };
 function directionsUrl(p){
  const origin=p.from+(p.from==='Minden'||p.from==='Topaz Lake'?', NV':', CA');
  const dest=p.to+(p.to==='Minden'||p.to==='Topaz Lake'?', NV':', CA');
  return 'https://www.google.com/maps/dir/?api=1&origin='+encodeURIComponent(origin)+
   '&destination='+encodeURIComponent(dest)+'&travelmode=driving&waypoints='+
   encodeURIComponent(p.lat+','+p.lng);
 }
 function crossingAlternatives(p){
  const possibilities=(crossingOptions[p.id]||[]).map(id=>last?.passes?.find(x=>x.id===id)).filter(Boolean);
  return '<section class="crossing-options"><h4>Other crossings to investigate</h4>'+
   '<p class="fine">These are geographic candidates, not safe or confirmed-open detours. They may require very long drives, seasonal gates or chains. Check the entire route before departure.</p>'+
   '<div class="crossing-choice-list">'+possibilities.map(x=>{
    const status=String(x.crossingState||'GATE UNVERIFIED');
    const closed=/CLOSED REPORTED|FULL ROAD CLOSURE NEAR PASS/i.test(status);
    return '<article class="crossing-choice"><strong>'+esc(x.name)+' · '+esc(x.roadLabel)+'</strong>'+
      '<p class="fine">'+esc(status)+(closed?' · Closure reported; do not assume passage.':' · Full-route travel not verified.')+'</p>'+
      '<div class="source-links"><button type="button" class="button crossing-inspect" data-compare-pass="'+esc(x.id)+'">Inspect this crossing</button>'+
      link(directionsUrl(x),'Preview in Google Maps')+'</div></article>';
   }).join('')+'</div></section>';
 }
 async function drawPassHighway(id,{fit=false}={}){
  if(kind!=='sierra')return;
  const token=++roadRequestId;
  if(officialRoadLine){officialRoadLine.remove();officialRoadLine=null;}
  const status=$('sierraRoadLineStatus');
  if(status)status.textContent='Loading Caltrans State Highway Network reference geometry…';
  try{
   let d=geometryCache[id];
   if(!d){
    const response=await fetch('/api/california-roads?kind=geometry&pass='+encodeURIComponent(id),{cache:'default'});
    if(!response.ok)throw Error('Caltrans highway geometry temporarily unavailable');
    d=await response.json();
    if(!d.ok||!d.available||!Array.isArray(d.segments))throw Error(d.reason||'Caltrans centerline not identified');
    geometryCache[id]=d;
   }
   if(token!==roadRequestId||id!==selectedPass)return;
   const lines=[];
   for(const points of d.segments){
    if(!Array.isArray(points)||points.length<2||points.length>2500)continue;
    const coords=points.map(x=>[x[1],x[0]]).filter(x=>Number.isFinite(x[0])&&Number.isFinite(x[1]));
    if(coords.length>=2)lines.push(coords);
   }
   if(!lines.length)throw Error('No usable Caltrans centerline coordinates');
   if(map&&window.L){
    officialRoadLine=L.layerGroup().addTo(map);
    lines.forEach(points=>L.polyline(points,{color:'#175aa0',weight:5,opacity:.83,interactive:false}).addTo(officialRoadLine));
    if(!caltransAttribution&&map.attributionControl){
      map.attributionControl.addAttribution('Highway reference: &copy; Caltrans');
      caltransAttribution=true;
    }
    if(fit){
     const bounds=L.latLngBounds(lines.flat());
     if(bounds.isValid())map.fitBounds(bounds.pad(.17),{animate:false,maxZoom:10});
    }
   }
   const note=$('sierraRoadLineStatus');
   if(note)note.textContent='Official Caltrans state-highway geometry shown in blue ('+d.segmentCount+
    ' reference segments; '+d.sourceYear+' baseline). It is NOT a connected, confirmed drivable route and can contain gaps. Road closures and actual driving directions must be verified separately.';
  }catch(e){
   if(token!==roadRequestId||id!==selectedPass)return;
   const note=$('sierraRoadLineStatus');
   if(note)note.textContent='Caltrans highway centerline is unavailable for this pass. No straight-line substitute is displayed. Use the official highway report and directions link.';
  }
 }
 function updateSierraDetail(){
  const p=last?.passes?.find(x=>x.id===selectedPass);if(!p)return;
  const report=p.report||{},gate=p.gate||{state:'GATE UNVERIFIED',evidence:[]},obs=p.observation||{};
  const gateNotes=(gate.evidence||[]).map(x=>'<article>'+esc(x)+'</article>').join('');
  $('passDetail').className='detail';
  $('passDetail').innerHTML='<h3>'+esc(p.name)+' · '+esc(p.roadLabel)+'</h3>'+
   '<p><strong>Crossing verdict: '+esc(p.crossingState||'GATE UNVERIFIED')+'</strong> · '+esc(p.elevation)+
   ' · '+(p.seasonal?'Seasonal mountain pass':'Major year-round corridor')+'</p>'+
   '<p><strong>Gate evidence:</strong> '+esc(gate.state)+' — '+esc(gate.explanation||'The gate status cannot currently be established.')+'</p>'+
   '<section class="highway-reference"><h4>Real highway geometry and route directions</h4><p id="sierraRoadLineStatus" class="fine" aria-live="polite">Checking official Caltrans roadway centerline…</p>'+link(directionsUrl(p),'Preview crossing in Google Maps')+'<p class="fine">Google Maps provides actual directions and navigation; its proposed route does not certify the seasonal gate, chain controls or current road opening. Blue map lines represent the Caltrans highway centerline, not navigable turn instructions.</p></section>'+
   '<p class="fine">'+esc(gate.confidence||'Official gate source unavailable')+(gate.sourceUpdated?' · Source date: '+esc(gate.sourceUpdated):'')+'</p>'+
   (gateNotes?'<div class="notes">'+gateNotes+'</div>':'')+
   '<section class="spatial-evidence" aria-label="Geolocated Caltrans conditions"><h4>Mapped work near this crossing</h4>'+
   '<p><strong>'+esc(obs.state||'NOT VERIFIED')+'</strong> · '+esc(obs.explanation||'Georeferenced evidence unavailable.')+'</p>'+
   '<p class="fine">'+esc((obs.laneFeeds??0)+' of 3 Caltrans regional lane-closure datasets loaded. Scheduled work is not an active closure.')+'</p>'+
   '<div class="notes">'+((obs.work||[]).length?(obs.work||[]).map(w=>
     '<article><strong>'+esc(w.live?'Reported active ':'Scheduled/unconfirmed ')+esc(w.type)+' · '+esc(w.area)+'</strong>'+
     '<small>'+esc(w.begin)+(w.end?' → '+esc(w.end):'')+' · approx. '+esc(w.distanceKm)+' km from the pass'+
      ' · '+esc(new Date(w.startEpoch*1000).toLocaleString('en-US',{timeZone:'America/Los_Angeles',dateStyle:'short',timeStyle:'short'}))+
      '–'+esc(new Date(w.endEpoch*1000).toLocaleString('en-US',{timeZone:'America/Los_Angeles',dateStyle:'short',timeStyle:'short'}))+' Pacific</small>'+
     '<p>'+esc(w.work)+' · '+esc(w.direction)+'</p>'+link(w.source,'Verify in Caltrans QuickMap')+'</article>').join(''):
     '<article>No Caltrans lane work was matched near this pass. This does not verify an open gate or an unrestricted approach.</article>')+'</div>'+
   '<h4>Roadside camera views</h4><p class="fine">'+esc(obs.cameraNote||'Availability is not verified.')+
   ' Still frames are from official Caltrans cameras, not predictions of driving conditions.</p>'+
   '<div class="camera-gallery">'+((obs.cameras||[]).length?(obs.cameras||[]).map(c=>
      '<a class="camera-card" href="'+esc(c.imageUrl)+'" target="_blank" rel="noopener noreferrer">'+
      '<img loading="lazy" decoding="async" alt="Official Caltrans road camera: '+esc(c.name)+'" src="'+esc(c.imageUrl)+'">'+
      '<strong>'+esc(c.name)+'</strong><small>'+esc(c.route)+' · approximately '+esc(c.distanceKm)+
      ' km from pass · Open still image ↗</small></a>').join(''):
      '<p>Caltrans has no accessible in-service camera still on this route within the configured search area. Check QuickMap instead.</p>')+
    '</div></section>'+
   '<p><strong>Separate Caltrans highway report:</strong> '+esc(report.state||'UNAVAILABLE')+
   '. '+esc(report.explanation||'Official data incomplete.')+'</p>'+
   '<p><strong>Separate chain-control check:</strong> '+esc(report.chainNote||'Coverage unavailable')+'</p>'+
   '<p>'+esc(p.character)+'</p>'+
   '<p class="fine"><strong>Highway report timestamp:</strong> '+esc(p.reportedAt||'Unavailable')+'</p>'+
   '<div class="notes">'+(report.chainControls?.length?report.chainControls.map(c=>
    '<article><strong>'+esc(c.status)+' · '+esc(c.name)+'</strong><small>'+
     esc(c.description)+' · '+esc(c.observedAt)+' · approx. '+esc(c.distanceKm)+' km from the pass</small></article>').join(''):'')+
    (report.notes?.length?report.notes.map(x=>'<article>'+esc(x)+'</article>').join(''):'<article>No other highway notice available.</article>')+'</div>'+
   crossingAlternatives(p)+
   '<div class="source-links">'+link(gate.source||p.sourceUrl,gate.state.startsWith('NPS')?'NPS Tioga Road status':'Official pass gate evidence')+
   link(p.sourceUrl,'Caltrans '+p.roadLabel)+link('https://quickmap.dot.ca.gov/','Caltrans QuickMap')+
   (p.id==='tioga'?link('https://chrisizworski.com/national-tools/tioga-road-status/','Dedicated Tioga planner'):'')+'</div>';
  sierraObservedMap(p);
  $('passDetail').querySelectorAll('[data-compare-pass]').forEach(button=>button.addEventListener('click',()=>focus(button.dataset.comparePass)));
  document.querySelectorAll('[data-place]').forEach(x=>x.classList.toggle('active',x.dataset.place===p.id));
 }
 function renderSierra(d){
  const closed=d.passes.filter(p=>p.crossingState==='CLOSED REPORTED').length;
  const headline=closed?'One or more crossings have an official closure report':'Compare actual gate and road evidence for each Sierra crossing';
  setSummary(headline,'Select a mountain pass. A Caltrans report without restrictions does not establish an open seasonal gate. NPS park status, seasonal reopening, road closures, and chain controls are separate evidence.',
   closed?'CLOSURE REPORTED':'VERIFY',d.availableReports+' of '+d.totalReports+
    ' highway feeds · NPS: '+(d.gateSources?.nps||'unavailable')+
    ' · Caltrans season: '+(d.gateSources?.caltransSeason?'loaded':'unavailable')+
    ' · Retrieved: '+date(d.checkedAt));
  $('chainSummary').textContent=(d.spatialFeeds?.laneFeeds??0)+' of 3 spatial work feeds and '+(d.spatialFeeds?.cameraFeeds??0)+' of 3 camera feeds loaded. '+(d.chain?.availableFeeds??0)+' of '+(d.chain?.totalFeeds??3)+
   ' Caltrans chain-control datasets loaded. Old R-0 signs and missing chain-control records never confirm a clear road.';
  const list=$('passList');
  list.innerHTML=d.passes.map(p=>'<button type="button" class="pass" data-place="'+esc(p.id)+
   '"><span><strong>'+esc(p.name)+'</strong><small>'+esc(p.roadLabel)+' · '+
   esc(p.from)+' → '+esc(p.to)+'</small></span><em class="status-mini">'+
   esc(p.crossingState||'GATE UNVERIFIED')+'</em></button>').join('');
  list.querySelectorAll('[data-place]').forEach(x=>x.addEventListener('click',()=>focus(x.dataset.place)));
  pointsMap(d.passes.map(p=>({...p,note:p.character})));
  if(!d.passes.some(x=>x.id===selectedPass))selectedPass=d.passes[0]?.id;
  updateSierraDetail();
  drawPassHighway(selectedPass,{fit:false});
 }
 async function load(){
  $('loadError').hidden=true;
  $('liveState').textContent='Checking official road reports…';$('liveFresh').textContent='Connecting to Caltrans.';
  try{
   const r=await fetch('/api/california-roads?kind='+kind,{cache:'no-store'});
   const d=await r.json();if(!r.ok||!d.ok)throw Error(d.error||'Source request failed');
   last=d;kind==='coast'?renderCoast(d):renderSierra(d);
  }catch(e){
   last=null;setSummary('SOURCE UNAVAILABLE','Do not infer a road is open. Open Caltrans QuickMap and the official highway report before driving.','UNAVAILABLE','Last attempt: '+date(new Date().toISOString()));
   $('loadError').hidden=false;$('loadError').textContent='Current road reports could not be verified: '+e.message;
   if(kind==='coast'){$('routeVerdict').innerHTML='<h3>Choose a route only after verifying the official closure map</h3><p>No cached or seasonal guess is being used.</p>';$('stopList').innerHTML='';}
   else{$('passDetail').innerHTML='<h3>Live report unavailable</h3><p>Use the Caltrans Highway Conditions links before making a crossing decision.</p>';}
  }
 }
 $('refreshReports')?.addEventListener('click',load);
 $('tripPicker')?.addEventListener('change',()=>{
  if(!last)return;
  const preset=last.trips.find(x=>x.id===$('tripPicker').value);
  if(preset){$('coastFrom').value=preset.stops[0];$('coastTo').value=preset.stops.at(-1);}
  drawCoast();
 });
 for(const id of ['coastFrom','coastTo']){
  $(id)?.addEventListener('change',()=>{
   if(!last)return;
   $('tripPicker').value='custom';
   drawCoast();
  });
 }
 $('travelDate')?.addEventListener('change',()=>{if(last)drawCoast();});
 $('myLocation')?.addEventListener('click',()=>{
  if(!navigator.geolocation){$('locationNote').textContent='Browser location is unavailable.';return;}
  $('locationNote').textContent='Requesting your position…';
  navigator.geolocation.getCurrentPosition(pos=>{
   const coord=[pos.coords.latitude,pos.coords.longitude];
   if(map){if(userPin)userPin.remove();userPin=L.circleMarker(coord,{radius:7,color:'#fff',weight:2,fillColor:'#224daa',fillOpacity:1}).addTo(map).bindPopup('Your approximate location');map.setView(coord,9);userPin.openPopup();}
   $('locationNote').textContent='Location shown on the map; not stored by this tool.';
  },()=>{$('locationNote').textContent='Location permission denied or unavailable; use the map without it.';},{timeout:9000,maximumAge:120000});
 });
 mapInit();load();
})();