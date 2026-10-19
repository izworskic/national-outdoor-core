const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const fixture=[
  'Current Conditions Road Status',
  'Wawona Road (continuation of Highway 41 from Fresno) Open',
  'El Portal Road (continuation of Highway 140 from Merced) Open',
  'Big Oak Flat Road (continuation of Highway 120 from Manteca) Expect 15-minute delays on weekdays Open',
  'Yosemite Valley Roads Open',
  'Hetch Hetchy Road Open',
  'Tioga Road (continuation of Highway 120 through the park) Expect 10-minute delays in Tuolumne Meadows, Monday through Thursday No overnight parking along the road or parking lots Open',
  'Glacier Point Road Drive carefully and watch for firefighters along the road. Open',
  'Mariposa Grove Road Open',
  'Last updated: October 18, 2026'
].join(' ');

test('Tioga status comes from its own NPS row, not adjacent roads',async()=>{
  const {parseYosemiteRoadSection}=await import('../lib/breakout-live-replacements.mjs');
  const tioga=parseYosemiteRoadSection(fixture,'Tioga Road','Glacier Point Road');
  const west=parseYosemiteRoadSection(fixture,'Big Oak Flat Road','Yosemite Valley Roads');
  assert.equal(tioga.state,'OPEN');
  assert.equal(west.state,'OPEN');
  assert.match(tioga.note,/10-minute delays/i);
  assert.match(tioga.note,/No overnight parking/i);
  assert.doesNotMatch(tioga.row,/watch for firefighters/i);
});

test('a CLOSED Tioga badge wins over opening language elsewhere on the page',async()=>{
  const {parseYosemiteRoadSection}=await import('../lib/breakout-live-replacements.mjs');
  const text=fixture.replace(
    'No overnight parking along the road or parking lots Open',
    'Road opens for bicycles after plowing, but is not open to cars. Closed'
  );
  assert.equal(parseYosemiteRoadSection(text,'Tioga Road','Glacier Point Road').state,'CLOSED');
});

test('ambiguous and truncated road rows must not be presented as open',async()=>{
  const {parseYosemiteRoadSection}=await import('../lib/breakout-live-replacements.mjs');
  assert.equal(parseYosemiteRoadSection('Tioga Road (continuation of Highway 120) Roadwork under review Glacier Point Road Open','Tioga Road','Glacier Point Road').state,'VERIFY');
  assert.equal(parseYosemiteRoadSection('Tioga Road Open','Tioga Road','Glacier Point Road').state,'VERIFY');
  assert.equal(parseYosemiteRoadSection('Other Yosemite areas Open Glacier Point Road Open','Tioga Road','Glacier Point Road').state,'VERIFY');
});

test('Caltrans 120 reports regional restrictions without declaring the full Sierra crossing open',async()=>{
  const {parseCaltrans120}=await import('../lib/breakout-live-replacements.mjs');
  assert.equal(parseCaltrans120('SR 120 [IN THE CENTRAL CALIFORNIA AREA & SIERRA NEVADA] No traffic restrictions are reported for this area. [YOSEMITE NATL PARK] Call NPS').state,'NO RESTRICTIONS REPORTED');
  assert.equal(parseCaltrans120('SR 120 [IN THE CENTRAL CALIFORNIA AREA & SIERRA NEVADA] Is closed from Lee Vining to Tioga Pass due to snow. [YOSEMITE NATL PARK] Call NPS').state,'RESTRICTIONS');
  assert.equal(parseCaltrans120('SR 120 [IN THE CENTRAL CALIFORNIA AREA & SIERRA NEVADA] Conditions unknown.').state,'VERIFY');
  assert.equal(parseCaltrans120('No highway section returned').state,'VERIFY');
});

test('Tioga page contains connected route choices, live facts and official evidence',()=>{
  const html=fs.readFileSync('public/national-tools/tioga-road-status/index.html','utf8');
  for(const str of ['id="tiogaTrip"','id="tiogaRouteResult"','id="tiogaWest"','id="tiogaPark"','id="tiogaEast"','roads.dot.ca.gov/?roadnumber=120','quickmap.dot.ca.gov','tel:12093720200','NARA_-_7722409.jpg']) {
    assert.ok(html.includes(str),str);
  }
  const js=fs.readFileSync('public/assets/breakout-live.js','utf8');
  assert.match(js,/renderTiogaPlanner\(d\)/);
  assert.match(js,/renderTiogaPlanner\(\{status:'UNAVAILABLE'\}\)/);
  assert.match(js,/park==='CLOSED'/);
  assert.match(js,/source freshness/i);
});
