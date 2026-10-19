(()=>{'use strict';
 const root=document.querySelector('[data-california-road]');if(!root)return;
 const kind=root.dataset.californiaRoad,$=id=>document.getElementById(id);
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let map=null,markers={},routeLine=null,userPin=null,last=null,selectedPass='sonora';
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
  if(kind==='sierra'){selectedPass=id;updateSierraDetail();}
 }
 function link(url,label){return '<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+esc(label)+' ↗</a>';}
 function setSummary(title,body,state,meta){
  $('liveState').textContent=title;$('liveState').dataset.tone=tone(state);
  $('liveHeadline').textContent=body;$('liveFresh').textContent=meta;
 }
 function drawCoast(){
  const tripId=$('tripPicker').value, trip=last?.trips?.find(t=>t.id===tripId),stops=last?.stops||[];
  if(!trip)return;
  const active=trip.stops.map(k=>stops.find(x=>x.id===k)).filter(Boolean);
  const state=last.state||'VERIFY';
  const problematic=state==='CLOSURE REPORTED',works=state==='WORK ZONES REPORTED';
  const title=problematic?'A reported closure could interrupt this trip':works?'The drive may work, but expect road controls':state==='NO RESTRICTIONS REPORTED'?'No restrictions reported—not an all-clear':'This itinerary needs direct verification';
  const body=(trip.explain||'')+' '+(problematic?'Caltrans reports a closure in the Big Sur / Monterey section. Confirm its specific endpoints before departing.':works?'Caltrans lists controlled traffic or construction in Monterey County; delays and new incidents remain possible.':last.reason||'Verify QuickMap.');
  const v=$('routeVerdict');v.className='verdict '+(problematic?'bad':works?'warn':'');
  v.innerHTML='<h3>'+esc(title)+'</h3><p>'+esc(body)+'</p>';
  $('stopList').innerHTML=active.map((p,i)=>'<button class="stop" type="button" data-place="'+esc(p.id)+'"><span class="step">'+(i+1)+'</span><span><strong>'+esc(p.name)+'</strong><small>'+esc(p.note)+'</small></span></button>').join('');
  $('stopList').querySelectorAll('[data-place]').forEach(button=>button.addEventListener('click',()=>focus(button.dataset.place)));
  if(map){if(routeLine)routeLine.remove();routeLine=L.polyline(active.map(x=>[x.lat,x.lng]),{weight:4,opacity:.7,color:'#247373',dashArray:'7 6'}).addTo(map);
    map.fitBounds(L.latLngBounds(active.map(x=>[x.lat,x.lng])).pad(.13));}
  $('routeType').textContent='Selected drive: '+trip.name;
  window.va?.('event',{name:'california_road_plan_selected',data:{tool:kind,route:tripId,state}});
 }
 function renderCoast(d){
  setSummary(d.state,d.reason,d.state,'Caltrans report: '+(d.reportedAt||'timestamp not parsed')+' · Retrieved: '+date(d.checkedAt));
  $('workNotes').innerHTML=d.notes?.length?d.notes.map(t=>'<article>'+esc(t)+'</article>').join(''):
   '<article>Caltrans did not report a Big Sur work item in the selected section. This does not establish that the entire road is open.</article>';
  const picker=$('tripPicker');const lastOption=picker.value;
  picker.innerHTML=(d.trips||[]).map(t=>'<option value="'+esc(t.id)+'">'+esc(t.name)+'</option>').join('');
  if(d.trips.some(x=>x.id===lastOption))picker.value=lastOption;
  pointsMap(d.stops||[]);drawCoast();
 }
 function updateSierraDetail(){
  const p=last?.passes?.find(x=>x.id===selectedPass);if(!p)return;
  const report=p.report||{},t=tone(report.state||'VERIFY');
  $('passDetail').className='detail';
  $('passDetail').innerHTML='<h3>'+esc(p.name)+' · '+esc(p.roadLabel)+'</h3><p><strong>'+esc(report.state||'VERIFY')+'</strong> · '+esc(p.elevation)+' · '+(p.seasonal?'Seasonal mountain pass':'Major winter highway')+'</p>'+
   '<p>'+esc(report.explanation||'Official data incomplete.')+'</p>'+
   '<p>'+esc(p.character)+'</p>'+
   '<p><strong>Caltrans source timestamp:</strong> '+esc(p.reportedAt||'Unavailable')+'</p>'+
   '<div class="notes">'+(report.notes?.length?report.notes.map(x=>'<article>'+esc(x)+'</article>').join(''):'<article>No highway note available for this source.</article>')+'</div>'+
   '<div class="source-links">'+link(p.sourceUrl,'Caltrans '+p.roadLabel)+
   (p.id==='tioga'?link('https://chrisizworski.com/national-tools/tioga-road-status/','NPS Tioga gate planner'):'')+'</div>';
  document.querySelectorAll('[data-place]').forEach(x=>x.classList.toggle('active',x.dataset.place===p.id));
 }
 function renderSierra(d){
  const closed=d.passes.filter(x=>x.report.state==='CLOSURE REPORTED').length;
  const uncertain=d.passes.filter(x=>['VERIFY','UNAVAILABLE','PARK CHECK REQUIRED'].includes(x.report.state)).length;
  const headline=closed?'Closures appear in one or more Caltrans highway reports':uncertain?'Crossings require source-specific confirmation':'No confirmed complete pass route from a report alone';
  setSummary(headline,'Choose a pass below. Caltrans road notices, seasonal summit gates and park access are separate questions.',closed?'CLOSURE REPORTED':'VERIFY',
   d.availableReports+' of '+d.totalReports+' Caltrans highway feeds loaded · Retrieved: '+date(d.checkedAt));
  const list=$('passList');
  list.innerHTML=d.passes.map(p=>'<button type="button" class="pass" data-place="'+esc(p.id)+'"><span><strong>'+esc(p.name)+'</strong><small>'+esc(p.roadLabel)+' · '+esc(p.from)+' → '+esc(p.to)+'</small></span><em class="status-mini">'+esc(p.report.state)+'</em></button>').join('');
  list.querySelectorAll('[data-place]').forEach(x=>x.addEventListener('click',()=>focus(x.dataset.place)));
  pointsMap(d.passes.map(p=>({...p,note:p.character})));if(!d.passes.some(x=>x.id===selectedPass))selectedPass=d.passes[0]?.id;
  updateSierraDetail();
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
 $('tripPicker')?.addEventListener('change',()=>{if(last)drawCoast();});
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