/* Local planning tools, v1. Official access checks remain separate from estimates. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.HawaiiDayTools = api; api.mount(document); }
})(typeof window === 'object' ? window : globalThis, function () {
  'use strict';
  const REVIEWED = '2026-11-13';
  const sources = {
    directions: 'https://www.nps.gov/havo/planyourvisit/directions.htm',
    iki: 'https://www.nps.gov/havo/planyourvisit/hike_day_kilaueaiki.htm',
    tube: 'https://www.nps.gov/havo/planyourvisit/day-hike-nahuku.htm',
    short: 'https://www.nps.gov/havo/planyourvisit/hike_day_devastation.htm',
    coast: 'https://www.nps.gov/havo/planyourvisit/ccr_tour.htm',
    summit: 'https://www.nps.gov/havo/planyourvisit/craterrimtour.htm',
    alerts: 'https://www.nps.gov/havo/planyourvisit/conditions.htm',
    solar: 'https://gml.noaa.gov/grad/solcalc/solareqns.PDF'
  };
  const places = {
    kona: { name: 'Kailua-Kona · Hawaiʻi', lat: 19.64, lon: -155.996 },
    hilo: { name: 'Hilo · Hawaiʻi', lat: 19.724, lon: -155.087 },
    volcano: { name: 'Kīlauea summit area · Hawaiʻi', lat: 19.43, lon: -155.26 },
    honolulu: { name: 'Honolulu · Oʻahu', lat: 21.307, lon: -157.858 },
    kahului: { name: 'Kahului · Maui', lat: 20.89, lon: -156.47 },
    lihue: { name: 'Līhuʻe · Kauaʻi', lat: 21.975, lon: -159.368 }
  };
  const bases = { kona: ['Kailua-Kona via Hwy 11', 150], hilo: ['Hilo via Hwy 11', 45], waikoloa: ['Waikoloa via Hwy 200', 120], custom: ['Elsewhere / my own allowance', 150] };
  const activities = {
    iki: { name: 'Kīlauea Iki crater loop', min: 180, kind: 'visit', daylight: true, source: sources.iki, place: 'Kilauea Iki Overlook Hawaii', note: '3.3 miles from Kīlauea Iki Overlook; NPS allows 2–3 hours. Steep, rocky, about 400 ft down and back up. Parking is very limited.' },
    long: { name: 'Kīlauea Iki + Nāhuku from Devastation', min: 300, kind: 'visit', daylight: true, source: sources.iki, place: 'Devastation Trailhead Hawaii Volcanoes National Park', note: '6 miles from Devastation Trailhead; NPS allows 4–5 hours. Includes the crater loop and lava tube. This is a different, longer start, not overflow parking for the short loop.' },
    short: { name: 'Devastation Trail', min: 60, kind: 'visit', daylight: true, source: sources.short, place: 'Devastation Trailhead Hawaii Volcanoes National Park', note: '1 mile round trip on a paved path through the recovering cinder landscape. NPS allows about one hour.' },
    tube: { name: 'Nāhuku lava tube', min: 60, kind: 'visit', daylight: false, source: sources.tube, place: 'Nahuku Thurston Lava Tube Hawaii', note: 'Our 60-minute visit allowance, not an official trail-time estimate. The tube is normally lit 8 a.m.–8 p.m.; carry a light and check access. Parking is limited.' },
    coast: { name: 'Chain of Craters Road and coast', min: 180, kind: 'visit', daylight: true, source: sources.coast, place: 'Chain of Craters Road Hawaii Volcanoes National Park', note: 'Our 3-hour allowance includes the drive down, stops and the return uphill. About 18.8 miles each way, not a through road to Puna. Bring food, water and fuel.' },
    summit: { name: 'Summit overlooks', min: 60, kind: 'visit', daylight: true, source: sources.summit, place: 'Hawaii Volcanoes National Park Welcome Center', note: 'Our one-hour allowance for open summit viewpoints. Ask a ranger where to go that day. This does not reserve a lava-viewing location or predict an eruption.' },
    meal: { name: 'Picnic / food break', min: 45, kind: 'break', daylight: false, note: 'Our 45-minute allowance. Bring food; a restaurant stop may need longer.' }
  };
  const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  function validDate(s) {
    if (!/^20\d{2}-\d{2}-\d{2}$/.test(s || '')) return false;
    const d = new Date(s + 'T12:00:00Z');
    return Number.isFinite(+d) && d.toISOString().slice(0,10) === s && +s.slice(0,4) >= 2020 && +s.slice(0,4) <= 2040;
  }
  function today(now = new Date()) {
    return new Date(+now - 10 * 3600000).toISOString().slice(0,10);
  }
  function solar(date, place = 'volcano') {
    if (!validDate(date) || !own(places, place)) return null;
    const d = new Date(date + 'T12:00:00Z'), y = d.getUTCFullYear();
    const day = Math.floor((+d - Date.UTC(y, 0, 1, 12)) / 86400000) + 1;
    const days = (Date.UTC(y + 1, 0, 1) - Date.UTC(y, 0, 1)) / 86400000;
    const g = 2 * Math.PI / days * (day - 1), rad = Math.PI / 180;
    const eq = 229.18 * (0.000075 + 0.001868*Math.cos(g) - 0.032077*Math.sin(g) - 0.014615*Math.cos(2*g) - 0.040849*Math.sin(2*g));
    const dec = 0.006918 - 0.399912*Math.cos(g) + 0.070257*Math.sin(g) - 0.006758*Math.cos(2*g) + 0.000907*Math.sin(2*g) - 0.002697*Math.cos(3*g) + 0.00148*Math.sin(3*g);
    const p = places[place], lat = p.lat * rad;
    const noon = 720 - 4*p.lon - eq - 600;
    const half = zen => Math.acos(Math.cos(zen*rad)/(Math.cos(lat)*Math.cos(dec)) - Math.tan(lat)*Math.tan(dec)) / rad * 4;
    const h = half(90.833), tw = half(96);
    return { sunrise:noon-h, sunset:noon+h, dawn:noon-tw, dusk:noon+tw, noon };
  }
  function clock(min, approximate = false) {
    const n = approximate ? Math.round(min/5)*5 : Math.round(min);
    const days = Math.floor(n/1440), m = ((n%1440)+1440)%1440, hour = Math.floor(m/60);
    return `${hour%12 || 12}:${String(m%60).padStart(2,'0')} ${hour<12?'a.m.':'p.m.'}${days ? ` (+${days} day${days===1?'':'s'})` : ''}`;
  }
  const duration = min => `${Math.floor(Math.abs(min)/60)}h ${Math.round(Math.abs(min)%60)}m`;
  function minutes(v) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(v || '') ? +v.slice(0,2)*60 + +v.slice(3) : null; }
  function defaults() { return { date:today(), base:'kona', depart:'06:00', home:'21:00', drive:150, buffer:60, hike:'iki', tube:false, coast:false, summit:true, meal:true }; }
  function validate(c) {
    return validDate(c.date) && own(bases,c.base) && minutes(c.depart)!==null && minutes(c.home)!==null && minutes(c.home)>minutes(c.depart) && Number.isInteger(c.drive) && c.drive>=0 && c.drive<=360 && Number.isInteger(c.buffer) && c.buffer>=0 && c.buffer<=180 && ['none','iki','long','short'].includes(c.hike) && ['tube','coast','summit','meal'].every(k=>typeof c[k]==='boolean');
  }
  function plan(c) {
    if (!validate(c)) return null;
    const sun = solar(c.date), rows = [], start = minutes(c.depart); let time = start;
    function add(a) { rows.push({...a,start:time,end:time+a.min}); time += a.min; }
    add({name:'Drive to the park',min:c.drive,kind:'drive',note:'Your one-way allowance. Recheck traffic and the route before leaving.'});
    add({name:'Parking, moving between stops and delays',min:c.buffer,kind:'buffer',note:'Your total park allowance, shown here before the visits. Spread this across the day; it does not guarantee parking.'});
    if (c.hike!=='none') add({...activities[c.hike],id:c.hike});
    if (c.meal) add({...activities.meal,id:'meal'});
    if (c.tube && c.hike!=='long') add({...activities.tube,id:'tube'});
    if (c.coast) add({...activities.coast,id:'coast'});
    if (c.summit) add({...activities.summit,id:'summit'});
    const parkEnd = time;
    add({name:'Drive back to your starting area',min:c.drive,kind:'drive',note:'Uses the same allowance as the outward drive. Traffic, weather and stops may differ.'});
    const warnings = [];
    const dark = rows.filter(r=>r.daylight && (r.start<sun.sunrise || r.end>sun.sunset));
    if (dark.length) warnings.push(`${dark.map(r=>r.name).join('; ')} extends outside estimated daylight. Shorten the day or change your departure; the planner does not recommend hiking in darkness.`);
    const tube = rows.find(r=>r.id==='tube'||r.id==='long');
    if (tube && (tube.start<480 || tube.end>1200)) warnings.push('The lava-tube visit could fall outside its usual 8 a.m.–8 p.m. lighting hours. For the longer loop the exact tube arrival is unknown.');
    if (time>sun.sunset || start<sun.sunrise) warnings.push('Part of the drive is before sunrise or after sunset. Plan for darkness; these times do not account for road conditions.');
    if (c.hike==='long') warnings.push('The longer hike already includes Nāhuku. No separate lava-tube stop is added.');
    if (c.hike==='iki') warnings.push('This schedule assumes a space at Kīlauea Iki Overlook. If it is full, choose the longer trailhead option and recalculate.');
    return {rows,sun,start,end:time,parkEnd,remaining:minutes(c.home)-time,total:time-start,driving:c.drive*2,warnings};
  }
  function decode(hash, kind) {
    const prefix = '#' + kind + '?';
    return new URLSearchParams(hash.startsWith(prefix) ? hash.slice(prefix.length) : '');
  }
  function restore(hash) {
    const c = defaults(), p = decode(hash,'volcano-day');
    for (const k of ['date','base','depart','home','hike']) if(p.has(k)) c[k]=p.get(k);
    for (const k of ['drive','buffer']) if(p.has(k)) c[k]=/^\d+$/.test(p.get(k))?Number(p.get(k)):NaN;
    for (const k of ['tube','coast','summit','meal']) if(p.has(k)) c[k]=p.get(k)==='1';
    return validate(c)?c:defaults();
  }
  const encode = c => '#volcano-day?' + new URLSearchParams(Object.fromEntries(Object.entries(c).map(([k,v])=>[k,typeof v==='boolean'?(v?'1':'0'):String(v)])));
  function shell() {
    return `<section id="volcano-day" class="hi-tool" aria-labelledby="volcano-heading"><p class="hi-kicker">Rainforest. Crater floor. Coast.</p><h2 id="volcano-heading">Build a volcano day that fits</h2><p>See what driving, a crater hike and a trip down Chain of Craters Road do to your day. Leave room to linger, and time to get home.</p><p class="hi-fallback">The interactive planner needs JavaScript. Start with <a href="${sources.directions}">NPS driving directions</a>, <a href="${sources.iki}">hike lengths</a> and <a href="${sources.alerts}">current park conditions</a>.</p><div class="hi-app"></div></section><section id="hawaii-daylight" class="hi-tool" aria-labelledby="daylight-heading"><p class="hi-kicker">Find the light</p><h2 id="daylight-heading">How much daylight is in your Hawaii day?</h2><p>Compare sunrise, sunset and the long view across a year. All times are Hawaii time, even when you are planning from home.</p><p class="hi-fallback">Interactive calculations need JavaScript. <a href="https://www.weather.gov/hfo/">Check Hawaii weather</a> before planning an outing.</p><div class="hi-app"></div></section>`;
  }
  function options(o) { return Object.entries(o).map(([id,v])=>`<option value="${id}">${esc(Array.isArray(v)?v[0]:v.name)}</option>`).join(''); }
  const map = place => 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(place);
  function mount(doc) {
    const win = doc.defaultView;
    if (!doc.querySelector('[data-tool-id="big-island-beach-day"]') || doc.querySelector('#volcano-day[data-mounted]')) return;
    if (!doc.querySelector('#volcano-day')) {
      const anchor = doc.querySelector('.bd-method');
      if (!anchor) return;
      anchor.insertAdjacentHTML('beforebegin',shell());
    }
    if (!doc.querySelector('.hi-jumps')) doc.querySelector('.hero')?.insertAdjacentHTML('beforeend','<nav class="hi-jumps" aria-label="Hawaii planning tools"><a href="#coast-hours">Hourly coast charts</a><a href="#volcano-day">Build a volcano day</a><a href="#hawaii-daylight">Find the daylight</a></nav>');
    const host = doc.querySelector('#volcano-day'), light = doc.querySelector('#hawaii-daylight');
    if (!light) return;
    host.dataset.mounted='true';
    for(const section of [host,light]) section.querySelector('.hi-fallback').hidden=true;
    const style=doc.createElement('link'); style.rel='stylesheet';
    style.href=new URL('hawaii-day-tools.css',doc.currentScript?.src || 'https://national-outdoor-core.vercel.app/assets/hawaii-day-tools.js').href;doc.head.append(style);
    host.querySelector('.hi-app').innerHTML=`<div class="hi-presets" role="group" aria-label="Start with a day plan"><button type="button" data-preset="hike">Crater hike day</button><button type="button" data-preset="short">Short walks day</button><button type="button" data-preset="coast">Crater to coast day</button></div><form class="hi-form"><div class="hi-controls"><label>Visit date<input name="date" type="date" min="2020-01-01" max="2040-12-31" required></label><label>Starting area<select name="base">${options(bases)}</select></label><label>Leave your starting area<input name="depart" type="time" required></label><label>Aim to be back by<input name="home" type="time" required></label><label>One-way driving allowance (minutes)<input name="drive" type="number" min="0" max="360" step="5" required></label><label>Parking, transfers and delays (minutes)<input name="buffer" type="number" min="0" max="180" step="5" required></label></div><p class="hi-note">Driving defaults come from <a href="${sources.directions}">NPS directions</a>, not live traffic. Edit both allowances for your lodging, route and pace. The return drive uses the same allowance. Return target must be later on the same date.</p><label class="hi-hike">Your main walk<select name="hike"><option value="none">No main hike</option><option value="iki">Kīlauea Iki from the overlook · allow 3 hours</option><option value="long">Kīlauea Iki + Nāhuku from Devastation · allow 5 hours</option><option value="short">Devastation Trail · allow 1 hour</option></select></label><fieldset class="hi-checks"><legend>Add to your day</legend><label><input type="checkbox" name="tube"> Nāhuku lava tube · 1 hour</label><label><input type="checkbox" name="coast"> Chain of Craters return drive + stops · 3 hours</label><label><input type="checkbox" name="summit"> Summit overlooks · 1 hour</label><label><input type="checkbox" name="meal"> Food break · 45 minutes</label></fieldset><p class="hi-note">Hikes use the upper end of NPS time guidance. Other visit lengths are our planning allowances. The order below is a simple outline, not an optimized route.</p></form><div class="hi-verdict" role="status" aria-live="polite"></div><div class="hi-plan-results"></div><div class="hi-actions"><button type="button" data-action="share">Copy this day’s link</button><button type="button" data-action="print">Print this day</button><button type="button" data-action="reset">Reset plan</button></div><p class="hi-share" role="status"></p><p class="hi-official"><strong>Before leaving:</strong> <a href="${sources.alerts}">Check NPS closures, parking and air quality</a>. A plan that fits the clock does not mean the trail is open. <a href="/national-tools/kilauea-live/">See the Kīlauea viewing tool</a> for eruption context.</p><p class="hi-reviewed"></p>`;
    const form=host.querySelector('form');
    function set(c) { for(const [k,v] of Object.entries(c)){const el=form.elements.namedItem(k);if(el.type==='checkbox')el.checked=v;else el.value=String(v);} }
    function read(){const c={};for(const k of Object.keys(defaults())){const el=form.elements.namedItem(k);c[k]=el.type==='checkbox'?el.checked:el.type==='number'?(el.value===''?NaN:Number(el.value)):el.value;}return c;}
    function render(save=false) {
      const c=read(); const tube=form.elements.namedItem('tube');tube.disabled=c.hike==='long';
      if(tube.disabled){tube.checked=false;c.tube=false;}
      const p=plan(c), verdict=host.querySelector('.hi-verdict'), results=host.querySelector('.hi-plan-results');
      host.querySelector('.hi-share').textContent='';
      if(!p){verdict.textContent='Enter a valid date, driving allowance and a return target later than departure. Previous results have been cleared.';verdict.dataset.state='conflict';results.replaceChildren();return;}
      const hasVisit=p.rows.some(r=>r.kind==='visit');
      verdict.dataset.state=p.remaining<0?'conflict':'fits';
      verdict.innerHTML=`<p class="hi-kicker">Estimated return · ${esc(c.date)} · HST</p><h3>${clock(p.end)}</h3><p>${p.remaining<0?`${duration(p.remaining)} beyond your return target. Remove a stop or leave earlier.`:`${duration(p.remaining)} before your return target.`}${!hasVisit?' Choose a walk or stop to build your visit.':''}</p>`;
      const groups=[['To/from park',p.driving,'drive'],['Visits & park drive',p.rows.filter(r=>r.kind==='visit').reduce((n,r)=>n+r.min,0),'visit'],['Food & buffer',p.rows.filter(r=>r.kind==='break'||r.kind==='buffer').reduce((n,r)=>n+r.min,0),'buffer']];
      results.innerHTML=`<div class="hi-totals">${groups.map(([label,n,kind])=>`<div><b>${duration(n)}</b><span>${label}</span><i class="hi-cost hi-${kind}" style="width:${p.total?n/p.total*100:0}%"></i></div>`).join('')}</div><p class="hi-note">At Kīlauea, estimated sunrise is about <b>${clock(p.sun.sunrise,true)}</b> and sunset about <b>${clock(p.sun.sunset,true)}</b>. Terrain and weather can hide the sun earlier.</p><ol class="hi-itinerary">${p.rows.filter(r=>r.min>0).map(r=>`<li class="hi-${r.kind}"><div class="hi-row-head"><span>${clock(r.start)} – ${clock(r.end)}</span><b>${duration(r.min)}</b></div><h4>${esc(r.name)}</h4><div class="hi-track" aria-hidden="true"><i style="width:${r.min/p.total*100}%"></i></div><p>${esc(r.note)}</p>${r.source?`<div class="hi-links"><a href="${r.source}">Official visit guide</a><a href="${map(r.place)}">Find the starting place</a></div>`:''}</li>`).join('')}</ol>${p.warnings.length?`<div class="hi-cautions"><h4>What to adjust or check</h4><ul>${p.warnings.map(w=>`<li>${esc(w)}</li>`).join('')}</ul></div>`:''}`;
      if(save)win.history.replaceState(null,'',encode(c));
    }
    set(restore(win.location.hash));render();
    form.addEventListener('submit',e=>e.preventDefault());
    form.addEventListener('input',e=>{if(e.target.name==='base'){const b=e.target.value;if(b!=='custom')form.elements.namedItem('drive').value=bases[b][1];}render(true);});
    host.querySelectorAll('[data-preset]').forEach(b=>b.addEventListener('click',()=>{const c=read();c.hike=b.dataset.preset==='short'?'short':'iki';c.coast=b.dataset.preset==='coast';c.summit=b.dataset.preset!=='coast';c.meal=true;c.tube=b.dataset.preset==='short';set(c);render(true);}));
    host.querySelector('[data-action="reset"]').addEventListener('click',()=>{set(defaults());render(true);});
    host.querySelector('[data-action="print"]').addEventListener('click',()=>win.print());
    host.querySelector('[data-action="share"]').addEventListener('click',async()=>{
      const c=read(),message=host.querySelector('.hi-share');if(!validate(c)){message.textContent='Finish the valid inputs first.';return;}
      win.history.replaceState(null,'',encode(c));const url=win.location.href;
      try{await win.navigator.clipboard.writeText(url);message.textContent='Link copied. It includes your date and planning choices.';}
      catch{message.replaceChildren();const input=doc.createElement('input');input.readOnly=true;input.value=url;input.setAttribute('aria-label','Copyable plan link');message.append('Copy this link: ',input);input.select();}
    });
    const age=(+new Date(today()+'T12:00:00Z')-+new Date(REVIEWED+'T12:00:00Z'))/86400000;
    host.querySelector('.hi-reviewed').textContent=`Planning guidance reviewed ${REVIEWED}.${age>90?' This review is more than 90 days old; recheck the linked NPS guidance before using these allowances.':' Check the official guidance again for your visit date.'}`;
    mountLight(doc,light);
    win.addEventListener('hashchange',()=>{if(win.location.hash.startsWith('#volcano-day?')){set(restore(win.location.hash));render();}});
    const jump=win.location.hash.split('?')[0];if(jump==='#volcano-day'||jump==='#hawaii-daylight')doc.querySelector(jump)?.scrollIntoView?.();
  }
  function yearChart(date,place,width=600){
    const year=+date.slice(0,4), days=(Date.UTC(year+1,0,1)-Date.UTC(year,0,1))/86400000;
    const w=Math.max(260,width),left=42,right=12,top=25,bottom=30,h=230, span=w-left-right;
    const x=d=>left+d/(days-1)*span,y=m=>top+(m-300)/900*(h-top-bottom);
    const points=Array.from({length:25},(_,i)=>{const day=Math.round(i*(days-1)/24),s=new Date(Date.UTC(year,0,1+day)).toISOString().slice(0,10);return {day,...solar(s,place)};});
    const band=points.map(p=>`${x(p.day).toFixed(1)},${y(p.sunrise).toFixed(1)}`).join(' ')+' '+points.slice().reverse().map(p=>`${x(p.day).toFixed(1)},${y(p.sunset).toFixed(1)}`).join(' ');
    const selected=Math.floor((Date.parse(date+'T12:00:00Z')-Date.UTC(year,0,1,12))/86400000),s=solar(date,place);
    return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" role="img" aria-label="${year} daylight band for ${esc(places[place].name)}. Sunrise is the upper edge, sunset the lower edge. Selected date: ${esc(date)}. Selected-date estimates are above."><rect x="${left}" y="${top}" width="${span}" height="${h-top-bottom}" fill="#edf0f2"/><polygon points="${band}" fill="#b6dbcf"/>${[360,720,1080].map(t=>`<line x1="${left}" x2="${w-right}" y1="${y(t)}" y2="${y(t)}" stroke="#a4b9b1" stroke-width="0.5"/><text x="${left-6}" y="${y(t)+4}" text-anchor="end" font-size="11" fill="#314a45">${t===360?'6a':t===720?'Noon':'6p'}</text>`).join('')}<line x1="${x(selected)}" x2="${x(selected)}" y1="${top}" y2="${h-bottom}" stroke="#b54a23" stroke-width="2"/>${[s.sunrise,s.sunset].map(t=>`<circle cx="${x(selected)}" cy="${y(t)}" r="4" fill="#b54a23"/>`).join('')}${[0,3,6,9,11].map(m=>{const d=(Date.UTC(year,m,1)-Date.UTC(year,0,1))/86400000;return `<text x="${x(d)}" y="${h-8}" font-size="11" text-anchor="${m===0?'start':m===11?'end':'middle'}" fill="#314a45">${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m]}</text>`;}).join('')}<text x="${left+5}" y="15" font-size="11" fill="#314a45">Earlier ↑ · Hawaii clock time · ↓ Later</text></svg>`;
  }
  function mountLight(doc,host){
    const win=doc.defaultView;
    host.querySelector('.hi-app').innerHTML=`<form class="hi-controls"><label>Place<select name="place">${options(places)}</select></label><label>Your date<input name="date" type="date" min="2020-01-01" max="2040-12-31" required></label></form><div class="hi-light-readout" role="status" aria-live="polite"></div><div class="hi-year"></div><div class="hi-months" role="group" aria-label="Compare months"></div><p class="hi-note">The green band is daylight. Its top edge is sunrise; its bottom edge is sunset. The orange line marks your date. Month buttons select the 15th.</p><p class="hi-note">These are approximate astronomical times for a level, unobstructed horizon, rounded to 5 minutes. Mountains, crater walls, clouds and your elevation change what you actually see. Twilight is not a promise of enough light for a trail. This does not model summit sunrise or sunset visibility.</p><details><summary>How these times are calculated</summary><p>Calculated locally from <a href="${sources.solar}">NOAA’s published solar equations</a> at representative place coordinates, with a fixed UTC−10 offset. Hawaii does not use daylight saving time. Civil twilight uses the sun 6° below the horizon. There is no weather feed in this chart. Dates supported: 2020–2040.</p></details>`;
    const form=host.querySelector('form'),date=form.elements.namedItem('date'),place=form.elements.namedItem('place');
    function restoreLight(){const p=decode(win.location.hash,'hawaii-daylight');date.value=validDate(p.get('date'))?p.get('date'):today();place.value=own(places,p.get('place'))?p.get('place'):'kona';}
    function render(save=false){const s=solar(date.value,place.value),out=host.querySelector('.hi-light-readout'),chart=host.querySelector('.hi-year');if(!s){out.textContent='Choose a valid date from 2020 through 2040. Previous estimates have been cleared.';chart.replaceChildren();return;}
      out.innerHTML=`<p class="hi-day-length"><b>${duration(Math.round((s.sunset-s.sunrise)/5)*5)}</b> of daylight · ${esc(date.value)} · HST</p><div class="hi-sun-times">${[['First light',s.dawn],['Sunrise',s.sunrise],['Sunset',s.sunset],['Civil dusk',s.dusk]].map(([label,n])=>`<div><span>${label}</span><b>~ ${clock(n,true)}</b></div>`).join('')}</div>`;
      chart.innerHTML=yearChart(date.value,place.value,chart.clientWidth||600);
      host.querySelectorAll('[data-month]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.month===+date.value.slice(5,7))));
      if(save)win.history.replaceState(null,'','#hawaii-daylight?'+new URLSearchParams({date:date.value,place:place.value}));
    }
    host.querySelector('.hi-months').innerHTML=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m,i)=>`<button type="button" data-month="${i+1}" aria-pressed="false">${m}</button>`).join('');
    host.querySelectorAll('[data-month]').forEach(b=>b.addEventListener('click',()=>{const y=validDate(date.value)?date.value.slice(0,4):today().slice(0,4);date.value=`${y}-${b.dataset.month.padStart(2,'0')}-15`;render(true);}));
    form.addEventListener('submit',e=>e.preventDefault());form.addEventListener('input',()=>render(true));
    restoreLight();render();
    win.addEventListener('hashchange',()=>{if(win.location.hash.startsWith('#hawaii-daylight?')){restoreLight();render();}});
    if(win.ResizeObserver){let width=0;new win.ResizeObserver(entries=>{const next=Math.round(entries[0]?.contentRect.width||0);if(next>0&&next!==width){width=next;render();}}).observe(host.querySelector('.hi-year'));}
  }
  return {sources,places,bases,activities,validDate,today,solar,clock,duration,minutes,defaults,validate,plan,restore,encode,shell,yearChart,mount};
});
