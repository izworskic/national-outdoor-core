/* Linked coast charts. Exact forecast samples; no hourly safety score. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  else root.CoastHourly=api;
})(typeof window==='object'?window:globalThis,function(){
  const ORDER=['kohala','north-kona','kona','south','puna','hilo'];
  const METRICS={wave:{label:'Model waves',unit:'ft',color:'#146479'},wind:{label:'Wind speed',unit:'mph',color:'#694291'}};
  const finite=v=>typeof v==='number'&&Number.isFinite(v);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const hourLabel=h=>(h===12?12:h>12?h-12:h)+' '+(h<12?'a.m.':'p.m.');
  const dateLabel=d=>new Intl.DateTimeFormat('en-US',{timeZone:'UTC',weekday:'short',month:'short',day:'numeric'}).format(new Date(d+'T12:00:00Z'));
  const show=(v,u)=>finite(v)?v.toFixed(u==='ft'?1:0)+' '+u:'No sample';
  const value=(p,m)=>m==='wind'?(finite(p?.windMph)&&p.windMph>=0?p.windMph:null):(finite(p?.waveM)&&p.waveM>=0?p.waveM*3.28084:null);
  function points(c,date){
    return Array.from({length:9},(_,i)=>{
      const hour=8+i,ms=Date.parse(date+'T00:00:00-10:00')+hour*3600000;
      const found=(c.hourly||[]).filter(p=>p.hstHour===hour&&Date.parse(p.time)===ms);
      return found.length===1?found[0]:{hstHour:hour,time:new Date(ms).toISOString(),alertsKnown:false,alerts:[]};
    });
  }
  function domain(cs,date,metric){
    const max=Math.max(0,...cs.flatMap(c=>points(c,date).map(p=>value(p,metric)||0)));
    const step=metric==='wind'?5:max>8?2:.5;
    return Math.max(step*2,Math.ceil(max/step)*step);
  }
  function alertText(p){
    if(p?.alerts?.length) return p.alerts.map(a=>a.event+(a.timing==='unknown'?' (timing unconfirmed)':'')).join('; ');
    return p?.alertsKnown===true?'No matching alert':'Alert feed unavailable';
  }
  function svg(c,date,metric,hour,top,width){
    const W=Math.max(200,Math.round(width||350)),H=118,L=35,R=14,T=12,B=27;
    const x=h=>L+(h-8)/8*(W-L-R),y=v=>T+(1-v/top)*(H-T-B);
    const ps=points(c,date),m=METRICS[metric];
    let s='<svg viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'" role="img" aria-label="'+esc(c.name)+': '+m.label.toLowerCase()+', 8 a.m. to 4 p.m. HST. Values appear below and in the data table.">';
    const midnight=Date.parse(date+'T00:00:00-10:00');
    for(const alert of c.alerts||[]){
      const from=Date.parse(alert.onsetIso),to=Date.parse(alert.endsIso);
      const known=Number.isFinite(from)&&Number.isFinite(to)&&to>from;
      const start=known?Math.max(8,(from-midnight)/3600000):8;
      const end=known?Math.min(16,(to-midnight)/3600000):16;
      if(end<=start)continue;
      s+='<rect class="hourly-alert-band" x="'+x(start)+'" y="'+T+'" width="'+(x(end)-x(start))+'" height="'+(H-T-B)+'" fill="'+(known?'#f5dddd':'none')+'" stroke="'+(known?'none':'#a84444')+'" stroke-dasharray="3 3"><title>'+esc(alert.event)+(known?'':' (timing unconfirmed)')+'</title></rect>';
    }
    for(const v of [0,top/2,top]) s+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+y(v)+'" y2="'+y(v)+'" stroke="#d7e0e1" stroke-width=".75"/><text x="'+(L-6)+'" y="'+(y(v)+4)+'" text-anchor="end">'+Number(v.toFixed(1))+'</text>';
    for(const h of W<430?[8,12,16]:[8,10,12,14,16]) s+='<text x="'+x(h)+'" y="'+(H-7)+'" text-anchor="middle">'+(h===12?'Noon':h<12?h+'a':h-12+'p')+'</text>';
    let path='',connected=false;
    for(const p of ps){
      const v=value(p,metric),px=x(p.hstHour);
      if(v===null){
        connected=false;
        s+='<path d="M'+(px-3)+','+(y(0)-4)+'l6,6m-6,0l6,-6" stroke="#7c898c" stroke-width="1.5"><title>'+hourLabel(p.hstHour)+': no sample</title></path>';
      }else{
        path+=(connected?'L':'M')+px+','+y(v)+' ';connected=true;
        s+='<circle cx="'+px+'" cy="'+y(v)+'" r="2.7" fill="'+m.color+'"><title>'+hourLabel(p.hstHour)+': '+show(v,m.unit)+'</title></circle>';
      }
    }
    s+='<path class="hourly-data-line" d="'+path+'" fill="none" stroke="'+m.color+'" stroke-width="2.25" stroke-linejoin="round" stroke-linecap="round"/>';
    s+='<line x1="'+x(hour)+'" x2="'+x(hour)+'" y1="'+(T-3)+'" y2="'+(H-B+4)+'" stroke="#20363c" stroke-width="1.5" stroke-dasharray="4 3"/>';
    const selected=value(ps[hour-8],metric);
    if(selected!==null) s+='<circle cx="'+x(hour)+'" cy="'+y(selected)+'" r="5" fill="'+m.color+'" stroke="white" stroke-width="2"/>';
    return s+'</svg>';
  }
  function create(doc,onDate=()=>{}){
    const win=doc.defaultView;
    let host=doc.getElementById('coast-hours');
    if(!host){
      const anchor=doc.querySelector('.live-card');if(!anchor)return null;
      host=doc.createElement('section');host.id='coast-hours';anchor.after(host);
    }
    if(host.hourlyView)return host.hourlyView;
    host.className='coast-hours';host.setAttribute('aria-labelledby','hourly-heading');
    host.innerHTML='<div class="hourly-intro"><p class="eyebrow">One island. Six different coastlines.</p><h2 id="hourly-heading">Which coast, which hour?</h2><p>Move through the day to compare model waves and wind. Every coast uses the same scale, so a small line really does mean a smaller value.</p></div><p class="hourly-status" role="status">Loading hourly samples…</p><div class="hourly-body" hidden><div class="hourly-controls"><label for="hourly-date">Your day<select id="hourly-date"></select></label><div class="hourly-metrics" role="group" aria-label="Chart measurement"><button type="button" data-metric="wave">Model waves · ft</button><button type="button" data-metric="wind">Wind · mph</button></div></div><div class="hourly-clock"><div><span>Compare at</span><strong id="hourly-clock-label"></strong></div><div class="hourly-time-controls"><button type="button" data-step="-1" aria-label="One hour earlier">−</button><label class="hourly-slider-label" for="hourly-time">Hour in Hawaii<input id="hourly-time" type="range" min="8" max="16" step="1" value="10"></label><button type="button" data-step="1" aria-label="One hour later">+</button></div></div><p class="hourly-summary" aria-live="polite"></p><p class="hourly-key">Blue: model waves · Purple: wind · Red shading: matching alert · Dashed red: alert timing unconfirmed · ×: missing sample</p><div class="hourly-cards"></div><details class="hourly-data"><summary>Read all hourly values</summary><div class="hourly-table-scroll" tabindex="0" role="region" aria-label="Hourly forecast data table"><table><caption>Model samples, HST. Missing values are not zero.</caption><thead><tr><th scope="col">Coast</th><th scope="col">HST</th><th scope="col">Waves (ft)</th><th scope="col">Wind (mph)</th><th scope="col">Alerts</th></tr></thead><tbody></tbody></table></div></details><p class="hourly-footnote">Wave height is the model’s significant wave height at a coastal grid cell, not breaking surf at a beach. Wind is modeled at 10 m. NWS surf ranges below cover the day; they are not hourly measurements. No matching alert is not an all-clear. Check beach conditions, closures and lifeguard advice before entering.</p><p class="hourly-retrieved"></p><div class="hourly-sources"><a href="https://www.pacioos.hawaii.edu/waves/model-hawaiiisland/">About the PacIOOS wave model</a><a href="https://open-meteo.com/en/docs/gfs-api">About the wind forecast</a><a href="https://www.weather.gov/hfo/">Official surf forecast and alerts</a></div></div>';
    const $=q=>host.querySelector(q);
    let payload=null,day=null,hour=10,metric='wave',initialized=false,lastWidth=0;
    const dateSelect=$('#hourly-date'),range=$('#hourly-time');
    function applyHash(){
      if(!win.location.hash.startsWith('#coast-hours?')||!payload)return;
      const p=new URLSearchParams(win.location.hash.split('?')[1]);
      day=payload.days.find(d=>d.date===p.get('date'))||day;
      const h=/^\d+$/.test(p.get('hour')||'')?Number(p.get('hour')):null;
      if(Number.isInteger(h)&&h>=8&&h<=16)hour=h;
      if(Object.hasOwn(METRICS,p.get('metric')))metric=p.get('metric');
    }
    function save(){win.history.replaceState(null,'','#coast-hours?'+new URLSearchParams({date:day.date,hour,metric}));}
    function coasts(){return [...day.coasts].sort((a,b)=>ORDER.indexOf(a.id)-ORDER.indexOf(b.id));}
    function draw(){
      if(!day||!payload)return;
      const cs=coasts(),top=domain(cs,day.date,metric);
      for(const card of host.querySelectorAll('.hourly-coast')){
        const c=cs.find(c=>c.id===card.dataset.coast),plot=card.querySelector('.hourly-plot');
        plot.innerHTML=svg(c,day.date,metric,hour,top,plot.getBoundingClientRect().width);
      }
    }
    function renderValues(){
      const cs=coasts(),vals=cs.map(c=>value(points(c,day.date)[hour-8],metric)).filter(finite);
      const elapsed=Date.parse(day.date+'T00:00:00-10:00')+hour*3600000<Date.parse(payload.updated);
      $('#hourly-clock-label').textContent=hourLabel(hour)+' HST';
      range.value=String(hour);range.setAttribute('aria-valuetext',hourLabel(hour)+' Hawaii time');
      host.querySelector('[data-step="-1"]').disabled=hour<=8;host.querySelector('[data-step="1"]').disabled=hour>=16;
      $('.hourly-summary').textContent=dateLabel(day.date)+': '+(vals.length?METRICS[metric].label+' range from '+show(Math.min(...vals),METRICS[metric].unit)+' to '+show(Math.max(...vals),METRICS[metric].unit)+' across '+vals.length+' of '+cs.length+' coasts.':'No samples for this measurement at this hour.')+(elapsed?' Earlier forecast hour, not an observation.':'');
      $('.hourly-cards').innerHTML=cs.map(c=>{
        const p=points(c,day.date)[hour-8],nw=c.nws?c.nws.lowFt+'–'+c.nws.highFt+' ft':'not available';
        return '<article class="hourly-coast" data-coast="'+esc(c.id)+'"><h3>'+esc(c.name)+'</h3><div class="hourly-values"><span><b>'+show(value(p,'wave'),'ft')+'</b> model waves</span><span><b>'+show(value(p,'wind'),'mph')+'</b> wind</span></div><div class="hourly-plot"></div><p class="hourly-alert'+(p.alerts?.length?' has-alert':'')+'">'+esc(alertText(p))+'</p><p class="hourly-context">NWS daytime surf: '+esc(nw)+(finite(p.periodS)?' · Wave period '+p.periodS.toFixed(0)+' s':'')+(finite(p.onshoreMph)?' · '+Math.abs(p.onshoreMph).toFixed(0)+' mph '+(p.onshoreMph>=0?'toward shore':'away from shore')+' wind component':'')+'</p></article>';
      }).join('');
      host.querySelectorAll('[data-metric]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.metric===metric)));
      draw();
    }
    function render(){
      if(!day)return;
      dateSelect.innerHTML=payload.days.map(d=>'<option value="'+esc(d.date)+'">'+esc(dateLabel(d.date))+'</option>').join('');dateSelect.value=day.date;
      $('.hourly-body').hidden=false;
      $('.hourly-status').textContent='Forecast samples, 8 a.m.–4 p.m. Hawaii time. Gaps stay empty; lines only join neighboring samples.';
      $('.hourly-retrieved').textContent='Forecasts retrieved '+new Intl.DateTimeFormat('en-US',{timeZone:'Pacific/Honolulu',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(payload.updated))+'. This is the retrieval time, not the model run time.';
      $('.hourly-data tbody').innerHTML=coasts().map(c=>points(c,day.date).map(p=>'<tr><th scope="row">'+esc(c.name)+'</th><td>'+hourLabel(p.hstHour)+'</td><td>'+show(value(p,'wave'),'ft')+'</td><td>'+show(value(p,'wind'),'mph')+'</td><td>'+esc(alertText(p))+'</td></tr>').join('')).join('');
      renderValues();
    }
    function clear(message='Updating hourly samples…'){
      payload=null;day=null;$('.hourly-body').hidden=true;$('.hourly-cards').replaceChildren();$('.hourly-data tbody').replaceChildren();$('.hourly-summary').textContent='';$('.hourly-status').textContent=message;
    }
    function update(p,date){
      if(p.hourlyVersion!==1||!p.days?.length){clear('Hourly samples are not available in this forecast. Use the daily comparison below.');return;}
      payload=p;day=p.days.find(d=>d.date===date)||p.days[0];
      if(!initialized){applyHash();initialized=true;}
      render();
    }
    dateSelect.addEventListener('change',()=>{if(!payload)return;day=payload.days.find(d=>d.date===dateSelect.value)||day;save();render();onDate(day.date);});
    host.querySelectorAll('[data-metric]').forEach(b=>b.addEventListener('click',()=>{if(!day)return;metric=b.dataset.metric;renderValues();save();}));
    range.addEventListener('input',()=>{if(!day)return;hour=Number(range.value);renderValues();save();});
    host.querySelectorAll('[data-step]').forEach(b=>b.addEventListener('click',()=>{if(!day)return;hour=Math.max(8,Math.min(16,hour+Number(b.dataset.step)));renderValues();save();}));
    win.addEventListener('hashchange',()=>{if(!payload||!win.location.hash.startsWith('#coast-hours'))return;applyHash();render();onDate(day.date);});
    if(win.ResizeObserver)new win.ResizeObserver(es=>{const w=es[0]?.contentRect.width;if(w!==lastWidth){lastWidth=w;draw();}}).observe($('.hourly-cards'));
    const api={update,clear};host.hourlyView=api;return api;
  }
  return {create,points,domain,svg,value,alertText};
});
