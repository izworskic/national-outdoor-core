const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const chart=require('../public/assets/coast-hourly.js');
let E,H;
test.before(async()=>{E=await import('../lib/big-island-coast.mjs');H=await import('../lib/coast-hourly.mjs');});
const date='2026-11-13';
const ms=h=>Date.parse(date+'T00:00:00-10:00')+h*3600000;
const waves=()=>Array.from({length:9},(_,i)=>({ms:ms(i+8),hs:(i+1)/10,per:10,dir:270}));
const winds=()=>Array.from({length:9},(_,i)=>({ms:ms(i+8),mph:5+i,dir:270}));
const coast={id:'kona',name:'Kailua to Two Step',faces:270};
function payload(){
  const sample={...coast,alerts:[],hourly:H.hourlyForCoast(coast,waves(),winds(),[],true,date),nws:{lowFt:1,highFt:3},decision:{state:'CALM',label:'Calm',plain:'Check the beach',reasons:[]}};
  return {ok:true,hourlyVersion:1,updated:new Date().toISOString(),days:[{date,label:'Tomorrow',coasts:[sample,{...sample,id:'hilo',name:'Hilo',hourly:sample.hourly.map(p=>({...p,waveM:2}))}]}],sources:[]};
}
function dom(hash=''){
  const d=new JSDOM('<section class="live-card"></section>',{url:'https://chrisizworski.com/national-tools/big-island-beach-day/'+hash,runScripts:'outside-only'});
  d.window.eval(fs.readFileSync('public/assets/coast-hourly.js','utf8'));
  return d;
}
test('hourly samples join exact timestamps across UTC midnight and preserve physical units',()=>{
  const ps=H.hourlyForCoast(coast,waves(),winds(),[],true,date);
  assert.equal(ps.length,9);assert.equal(ps[8].time,'2026-11-14T02:00:00.000Z');
  assert.equal(ps[0].waveM,.1);assert.equal(ps[0].windMph,5);assert.equal(ps[0].onshoreMph,5);
});
test('missing, negative, duplicate and off-hour values cannot become fabricated hourly samples',()=>{
  const ws=waves().filter(r=>r.ms!==ms(10));ws.push({...ws[0]});ws.push({ms:ms(10)+1800000,hs:9});ws[1].hs=-1;
  const ps=H.hourlyForCoast(coast,ws,null,[],false,date);
  assert.equal(ps[0].waveM,null);assert.equal(ps[1].waveM,null);assert.equal(ps[2].waveM,null);
  assert.equal(ps[3].waveM,.4);assert.equal(ps[3].windMph,null);assert.equal(ps[3].alertsKnown,false);
});
test('blank CSV heights are missing, never a calm zero',()=>{
  const csv='time,shgt,mper,pdir\n2026-11-13T18:00:00Z,,10,270\n2026-11-13T19:00:00Z,0,10,270\n2026-11-13T20:00:00Z,-1,10,270';
  const out=E.parseSwanCsv(csv);assert.equal(out.length,1);assert.equal(out[0].hs,0);
});
test('alert timing uses half-open intervals and keeps uncertain times explicit',()=>{
  const a={event:'High Surf Advisory',onsetIso:new Date(ms(9)).toISOString(),endsIso:new Date(ms(11)).toISOString()};
  const ps=H.hourlyForCoast(coast,waves(),winds(),[a],true,date);
  assert.equal(ps[0].alerts.length,0);assert.equal(ps[1].alerts[0].timing,'active');assert.equal(ps[3].alerts.length,0);
  assert.equal(H.alertAt({...a,endsIso:null},ms(12)),'unknown');
  assert.match(chart.alertText({alertsKnown:false,alerts:[]}),/unavailable/);
});
test('API hourly contract reuses the six wave and wind requests and retains daily values',async()=>{
  let sw=0,wi=0;
  const p=await E.buildBeachDay(ms(8),{srf:async()=>null,alerts:async()=>({features:[]}),swan:async()=>{sw++;return waves();},wind:async()=>{wi++;return winds();}});
  assert.equal(sw,6);assert.equal(wi,6);assert.equal(p.hourlyVersion,1);
  assert.equal(p.days[0].coasts.length,6);assert.equal(p.days[0].coasts[0].hourly.length,9);
  assert.equal(p.days[0].coasts[0].model.peakM,.9);
});
test('common domains, gap breaks and sub-hour alerts are represented truthfully',()=>{
  const p=payload(),c=p.days[0].coasts[0];c.hourly[2].waveM=null;
  const max=chart.domain(p.days[0].coasts,date,'wave');assert.equal(max,7);
  c.alerts=[{event:'High Surf Advisory',onsetIso:new Date(ms(10)+1800000).toISOString(),endsIso:new Date(ms(10)+2700000).toISOString()}];
  const d=new JSDOM(chart.svg(c,date,'wave',10,max,350));
  const path=d.window.document.querySelector('.hourly-data-line').getAttribute('d');
  assert.equal((path.match(/M/g)||[]).length,2);
  assert.ok(Number(d.window.document.querySelector('.hourly-alert-band').getAttribute('width'))>0);
  d.window.close();
});
test('native controls update all coasts, retain focus and expose table values without hover',()=>{
  const d=dom(),w=d.window;
  try{
    const view=w.CoastHourly.create(w.document);view.update(payload(),date);
    const doc=w.document;assert.equal(doc.querySelectorAll('.hourly-coast').length,2);assert.equal(doc.querySelectorAll('tbody tr').length,18);
    const slider=doc.querySelector('#hourly-time');slider.focus();slider.value='16';slider.dispatchEvent(new w.Event('input'));
    assert.equal(doc.activeElement,slider);assert.match(doc.querySelector('#hourly-clock-label').textContent,/4 p.m./);
    assert.equal(doc.querySelector('[data-step="1"]').disabled,true);
    doc.querySelector('[data-metric="wind"]').click();assert.match(w.location.hash,/metric=wind/);
    assert.equal(doc.querySelector('[data-metric="wind"]').getAttribute('aria-pressed'),'true');
    assert.match(doc.querySelector('.hourly-summary').textContent,/13 mph/);
    view.clear('Forecast failed');assert.equal(doc.querySelectorAll('svg').length,0);assert.equal(doc.querySelectorAll('tbody tr').length,0);assert.equal(doc.querySelector('.hourly-body').hidden,true);
  }finally{w.close();}
});
test('bookmark restore validates date, metric and hour and preserves other page hashes',()=>{
  for(const hash of ['#coast-hours?date='+date+'&hour=14&metric=wind','#coast-hours?date=no&hour=99&metric=__proto__','#south-kona-access?plan=twostep']){
    const d=dom(hash);try{
      const w=d.window;w.CoastHourly.create(w.document).update(payload(),date);
      assert.equal(w.document.querySelector('#hourly-time').value,hash.includes('hour=14')?'14':'10');
      assert.equal(w.location.hash,hash);
    }finally{d.window.close();}
  }
});
test('unsupported payload version shows a fallback without stale charts',()=>{
  const d=dom();try{const v=d.window.CoastHourly.create(d.window.document);v.update(payload(),date);v.update({...payload(),hourlyVersion:2},date);assert.equal(d.window.document.querySelectorAll('svg').length,0);assert.match(d.window.document.querySelector('.hourly-status').textContent,/not available/);}finally{d.window.close();}
});
test('coast names and alert text are escaped',()=>{
  const p=payload();p.days[0].coasts[0].name='<img src=x onerror=alert(1)>';
  const d=dom();try{d.window.CoastHourly.create(d.window.document).update(p,date);assert.equal(d.window.document.querySelector('img'),null);}finally{d.window.close();}
});
test('page integration synchronizes dates and clears every chart on a failed refresh',async()=>{
  const p=payload();p.days.push({...p.days[0],date:'2026-11-14',coasts:p.days[0].coasts.map(c=>({...c,hourly:c.hourly.map(h=>({...h,time:new Date(Date.parse(h.time)+86400000).toISOString()}))}))});
  const d=new JSDOM(fs.readFileSync('public/national-tools/big-island-beach-day/index.html','utf8'),{url:'https://chrisizworski.com/national-tools/big-island-beach-day/#coast-hours?date=2026-11-14&hour=15&metric=wave',runScripts:'outside-only'});
  const w=d.window;let fail=false;
  w.fetch=async()=>{if(fail)throw Error('offline');return{ok:true,json:async()=>p};};
  w.AbortSignal=AbortSignal;w.setInterval=()=>0;w.HTMLElement.prototype.scrollIntoView=()=>{};
  const flush=async()=>{for(let i=0;i<5;i++)await new Promise(r=>setImmediate(r));};
  try{
    w.eval(fs.readFileSync('public/assets/coast-hourly.js','utf8'));
    w.eval(fs.readFileSync('public/assets/big-island-beach-day.js','utf8'));
    w.document.querySelector('script[src$="/assets/coast-hourly.js"]').onload();
    await flush();
    assert.equal(w.document.querySelector('#hourly-date').value,'2026-11-14');
    assert.equal(w.document.querySelector('#bdDays [aria-pressed=true]').dataset.date,'2026-11-14');
    const sel=w.document.querySelector('#hourly-date');sel.value=date;sel.dispatchEvent(new w.Event('change'));
    assert.equal(w.document.querySelector('#bdDays [aria-pressed=true]').dataset.date,date);
    assert.ok(w.document.querySelector('#coast-hours svg'));
    fail=true;w.document.querySelector('#bdRefresh').click();await flush();
    assert.equal(w.document.querySelector('#coast-hours svg'),null);
    assert.equal(w.document.querySelector('.hourly-body').hidden,true);
    assert.match(w.document.querySelector('.hourly-status').textContent,/removed/);
  }finally{w.close();}
});
