const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
let roads;
test.before(async()=>{roads=await import('../lib/california-roads.mjs');});
const coastHtml='<html><div>Road Information</div><p>This highway information is the latest reported as of Monday, October 19th, 2026 at 10:35 AM.</p><h3>SR 1</h3><p>[IN THE SOUTHERN CALIFORNIA AREA]</p><p>One lane closed in Laguna Beach (Orange Co)</p><p>[IN THE CENTRAL CALIFORNIA AREA]</p><p>1-way controlled traffic at Mud Creek (Monterey Co) through 11/13/26</p><p>1-way controlled traffic 15.7 mi south of Monterey at Rocky Creek Bridge (Monterey Co) due to construction</p><p>[IN THE NORTHERN CALIFORNIA AREA]</p><p>Road is closed in Mendocino County</p></html>';
test('coast report keeps Big Sur and northern California closures separate',()=>{
 const report=roads.parseReport(coastHtml,1),a=roads.assessBigSur(report);
 assert.equal(a.state,'WORK ZONES REPORTED');
 assert.equal(a.notes.length,2);
 assert.equal(a.closures,0);
 assert.equal(report.reportedAt.includes('October 19th'),true);
});
test('closure in Big Sur is not silently converted to work zones',()=>{
 const body=coastHtml.replace('1-way controlled traffic at Mud Creek','Highway is closed from Lucia to Gorda at Mud Creek');
 assert.equal(roads.assessBigSur(roads.parseReport(body,1)).state,'CLOSURE REPORTED');
});
test('missing Central California section never means road open',()=>{
 assert.equal(roads.assessBigSur(roads.parseReport('<h3>SR 1</h3><p>[IN THE SOUTHERN CALIFORNIA AREA]</p>Road open',1)).state,'VERIFY');
 assert.equal(roads.assessBigSur(roads.parseReport('No highway data',1)).state,'VERIFY');
});
test('Caltrans no restrictions is not a verified open seasonal summit',()=>{
 const html='<h3>SR 108</h3><p>[IN THE CENTRAL CALIFORNIA AREA & SIERRA NEVADA]</p><p>No traffic restrictions are reported for this area.</p>';
 const report=roads.parseReport(html,108);
 assert.equal(roads.assessPass(report,roads.PASSES.find(x=>x.id==='sonora')).state,'NO RESTRICTIONS REPORTED');
 assert.match(roads.assessPass(report,roads.PASSES.find(x=>x.id==='sonora')).explanation,/seasonal gate/i);
});
test('Tioga Caltrans report cannot establish Yosemite NPS road gate',()=>{
 const html='<h3>SR 120</h3><p>[IN THE CENTRAL CALIFORNIA AREA & SIERRA NEVADA]</p><p>No traffic restrictions are reported for this area.</p>';
 const p=roads.PASSES.find(x=>x.id==='tioga');
 const a=roads.assessPass(roads.parseReport(html,120),p);
 assert.equal(a.state,'PARK CHECK REQUIRED');
 assert.match(a.explanation,/NPS/);
});
test('chain controls and closures outrank unrelated clear areas',()=>{
 const chains='<h3>SR 88</h3><p>[IN THE CENTRAL CALIFORNIA AREA & SIERRA NEVADA]</p><p>Chains are required from Peddler Hill to Silver Lake.</p>';
 const closed='<h3>SR 4</h3><p>[IN THE CENTRAL CALIFORNIA AREA]</p><p>Is closed from Lake Alpine to Ebbetts Pass due to snow.</p>';
 assert.equal(roads.assessPass(roads.parseReport(chains,88),roads.PASSES.find(x=>x.id==='carson')).state,'RESTRICTIONS REPORTED');
 assert.equal(roads.assessPass(roads.parseReport(closed,4),roads.PASSES.find(x=>x.id==='ebbetts')).state,'CLOSURE REPORTED');
});
test('pass network has unique canonical passes and usable map coordinates',()=>{
 assert.equal(roads.PASSES.length,7);
 assert.equal(new Set(roads.PASSES.map(p=>p.id)).size,7);
 for(const p of roads.PASSES){assert.ok(p.lat>35&&p.lat<42);assert.ok(p.lng<-118&&p.lng>-124);}
 assert.equal(new Set(roads.BIGSUR_STOPS.map(s=>s.id)).size,roads.BIGSUR_STOPS.length);
 for(const t of roads.COAST_TRIPS)assert.ok(t.stops.every(id=>roads.BIGSUR_STOPS.some(s=>s.id===id)));
});
test('pages have real photos, schema, explicit controls, and official links',()=>{
 for(const slug of ['big-sur-highway-1','sierra-pass-status']){
  const html=fs.readFileSync('public/national-tools/'+slug+'/index.html','utf8');
  assert.match(html,/name="description"/);
  assert.match(html,/chrisizworski.com\/#person/);
  assert.match(html,/Built by Chris Izworski/);
  assert.match(html,/california-roads\.js/);
  assert.match(html,/cartocdn\.com|californiaMap/);
  assert.match(html,/commons.wikimedia.org|upload.wikimedia.org/);
  assert.match(html,/roads\.dot\.ca\.gov|quickmap\.dot\.ca\.gov/);
 }
 const js=fs.readFileSync('public/assets/california-roads.js','utf8');
 assert.match(js,/fetch\('\/api\/california-roads\?kind='/);
 assert.match(js,/navigator\.geolocation/);
 assert.match(js,/cartocdn\.com/);
});
