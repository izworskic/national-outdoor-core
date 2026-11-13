const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const api=require('../public/assets/hawaii-day-tools.js');
const reference=require('./fixtures/hawaii-solar-reference.json');
const script=fs.readFileSync('public/assets/hawaii-day-tools.js','utf8');
const c=(extra={})=>({...api.defaults(),date:'2026-12-25',...extra});
function dom(hash=''){
 const d=new JSDOM('<body data-tool-id="big-island-beach-day"><main><section class="bd-method"></section></main></body>',{url:'https://example.test/national-tools/big-island-beach-day/'+hash,runScripts:'outside-only'});
 d.window.eval(script);return d;
}
function change(w,name,value,section='#volcano-day'){
 const el=w.document.querySelector(`${section} [name="${name}"]`);
 if(el.type==='checkbox')el.checked=value;else el.value=value;
 el.dispatchEvent(new w.Event('input',{bubbles:true}));return el;
}
test('calendar validation rejects nonexistent dates, unsupported years and malformed state',()=>{
 for(const s of ['2026-02-29','2026-04-31','2019-12-31','2041-01-01','2026-2-01','no',null]) assert.equal(api.validDate(s),false);
 for(const s of ['2020-02-29','2028-02-29','2040-12-31'])assert.equal(api.validDate(s),true);
 assert.equal(api.solar('2026-12-25','__proto__'),null);
 assert.equal(api.solar('invalid'),null);
 assert.equal(api.today(new Date('2026-12-25T08:00:00Z')),'2026-12-24');
});
test('astronomical outputs agree with independent Python/Astral fixtures within five minutes',()=>{
 assert.ok(reference.summary.cases>=6500);
 for(const r of reference.samples){const s=api.solar(r.date,r.place);for(const k of ['dawn','sunrise','sunset','dusk'])assert.ok(Math.abs(s[k]-r[k])<=5,`${r.date} ${r.place} ${k}`);assert.ok(s.dawn<s.sunrise&&s.sunrise<s.noon&&s.noon<s.sunset&&s.sunset<s.dusk);}
});
test('a Kona crater day includes both drives, delay budget, food and the actual hike',()=>{
 const p=api.plan(c());assert.equal(p.driving,300);assert.equal(p.total,645);assert.equal(p.end,1005);assert.equal(p.remaining,255);assert.equal(p.rows[0].end,510);
 assert.equal(p.rows.at(-1).end,p.end);assert.ok(p.warnings.some(w=>w.includes('space at Kīlauea Iki')));
});
test('long trailhead replaces the short loop and never charges a second tube visit',()=>{
 const p=api.plan(c({hike:'long',tube:true}));assert.equal(p.rows.filter(r=>r.id==='tube').length,0);assert.equal(p.rows.find(r=>r.id==='long').min,300);assert.ok(p.warnings.some(w=>w.includes('already includes')));
});
test('tight plans and overnight returns remain explicit, not wrapped into an earlier time',()=>{
 const p=api.plan(c({depart:'15:00',home:'21:00',coast:true,hike:'long',tube:true}));assert.ok(p.remaining<0);assert.ok(p.end>1440);assert.match(api.clock(p.end),/\(\+1 day\)/);assert.ok(p.warnings.some(w=>w.includes('outside estimated daylight')));
 assert.equal(api.plan(c({home:'05:00'})),null);assert.equal(api.plan(c({drive:NaN})),null);assert.equal(api.plan(c({drive:-1})),null);assert.equal(api.plan(c({buffer:181})),null);
});
test('a return drive crossing sunset is flagged even if all park visits finish in daylight',()=>{
 const p=api.plan(c({depart:'14:00',hike:'none',summit:true,meal:false,buffer:0}));assert.ok(p.parkEnd<p.sun.sunset);assert.ok(p.end>p.sun.sunset);assert.ok(p.warnings.some(w=>w.includes('Part of the drive')));
});
test('saved plans round trip and reject crafted parameter values',()=>{
 const choice=c({base:'hilo',drive:45,tube:true,coast:true});assert.deepEqual(api.restore(api.encode(choice)),choice);
 for(const hash of ['#volcano-day?base=__proto__','#volcano-day?drive=','#volcano-day?drive=Infinity','#volcano-day?date=2026-02-31','#volcano-day?hike=%3Cscript%3E']) assert.deepEqual(api.restore(hash),api.defaults());
 assert.equal(api.restore('#hawaii-daylight?date=2026-12-25').date,api.defaults().date);
});
test('mount works on older mirrored HTML, exposes controls and fails closed on incomplete input',()=>{
 const d=dom();try{const w=d.window,doc=w.document;assert.equal(doc.querySelectorAll('#volcano-day').length,1);assert.equal(doc.querySelectorAll('#hawaii-daylight').length,1);w.HawaiiDayTools.mount(doc);assert.equal(doc.querySelectorAll('#volcano-day').length,1);
 change(w,'base','hilo');assert.equal(doc.querySelector('[name="drive"]').value,'45');
 const input=change(w,'date','');input.focus();assert.equal(doc.querySelectorAll('.hi-itinerary li').length,0);assert.match(doc.querySelector('.hi-verdict').textContent,/Previous results/);assert.equal(doc.activeElement,input);
 change(w,'date','2026-12-25');assert.ok(doc.querySelectorAll('.hi-itinerary li').length>0);assert.match(w.location.hash,/date=2026-12-25/);
 }finally{d.window.close();}
});
test('long option disables separate tube, presets and reset recalculate, unrelated hash is initially preserved',()=>{
 const d=dom('#coast-hours?hour=12');try{const w=d.window,doc=w.document;assert.equal(w.location.hash,'#coast-hours?hour=12');change(w,'tube',true);change(w,'hike','long');assert.equal(doc.querySelector('[name="tube"]').disabled,true);assert.equal(doc.querySelector('[name="tube"]').checked,false);
 doc.querySelector('[data-preset="short"]').click();assert.equal(doc.querySelector('[name="hike"]').value,'short');assert.equal(doc.querySelector('[name="tube"]').disabled,false);assert.equal(doc.querySelector('[name="tube"]').checked,true);
 doc.querySelector('[data-action="reset"]').click();assert.equal(doc.querySelector('[name="hike"]').value,'iki');assert.equal(doc.querySelector('[name="base"]').value,'kona');
 }finally{d.window.close();}
});
test('daylight explorer restores its own date and location, responds to months and clears invalid results',()=>{
 const d=dom('#hawaii-daylight?date=2028-02-29&place=lihue');try{const w=d.window,doc=w.document;assert.equal(doc.querySelector('#hawaii-daylight [name="date"]').value,'2028-02-29');assert.equal(doc.querySelector('#hawaii-daylight [name="place"]').value,'lihue');assert.equal(doc.querySelectorAll('.hi-year svg').length,1);
 doc.querySelector('[data-month="12"]').click();assert.equal(doc.querySelector('#hawaii-daylight [name="date"]').value,'2028-12-15');assert.equal(doc.querySelector('[data-month="12"]').getAttribute('aria-pressed'),'true');assert.match(w.location.hash,/place=lihue/);
 change(w,'date','', '#hawaii-daylight');assert.equal(doc.querySelectorAll('.hi-year svg').length,0);assert.match(doc.querySelector('.hi-light-readout').textContent,/Previous estimates/);
 }finally{d.window.close();}
});
test('hash navigation restores both tools without accumulating mounts or controls',()=>{
 const d=dom();try{const w=d.window;w.location.hash=api.encode(c({drive:45,base:'hilo'}));w.dispatchEvent(new w.HashChangeEvent('hashchange'));assert.equal(w.document.querySelector('[name="drive"]').value,'45');
 w.location.hash='#hawaii-daylight?place=honolulu&date=2027-03-15';w.dispatchEvent(new w.HashChangeEvent('hashchange'));assert.equal(w.document.querySelector('#hawaii-daylight [name="place"]').value,'honolulu');assert.equal(w.document.querySelectorAll('.hi-months button').length,12);
 }finally{d.window.close();}
});
test('copy failure still gives a copyable valid link and static shell preserves official alternatives',async()=>{
 const d=dom();try{const w=d.window,doc=w.document;doc.querySelector('[data-action="share"]').click();await new Promise(r=>setImmediate(r));assert.ok(doc.querySelector('[aria-label="Copyable plan link"]').value.includes('#volcano-day?'));
 const shell=api.shell();assert.match(shell,/NPS driving directions/);assert.match(shell,/current park conditions/);assert.ok(!shell.includes('safe to'));
 const page=fs.readFileSync('public/national-tools/big-island-beach-day/index.html','utf8');assert.ok(page.includes('id="volcano-day"'));assert.ok(page.includes('id="hawaii-daylight"'));assert.ok(page.includes('ca-pub-8222782620788075'));assert.ok(page.includes('G-Y5D2V2W7HN'));
 }finally{d.window.close();}
});
