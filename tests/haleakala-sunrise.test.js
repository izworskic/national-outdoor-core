const test=require('node:test');
const assert=require('node:assert/strict');

let hale;
test.before(async()=>{hale=await import('../lib/haleakala-sunrise-production.mjs');});

const NOW=Date.parse('2026-09-30T12:00:00Z');
const fresh='2026-09-30T11:45:00Z';
const nearSunrise='2026-09-30T17:30:00Z';
const farSunrise='2026-10-01T16:15:00Z';
const dryGfs={row:{rh850:78,rh700:14,rh600:24,z700:3020}};
const wetGfs={row:{rh850:91,rh700:90,rh600:84,z700:3010}};
const dryLco={humidity:{current:38,observedAt:fresh,slopePerHour:1},boltwood:{current:-18,observedAt:fresh,slopePerHour:0}};
const wetLco={humidity:{current:94,observedAt:fresh,slopePerHour:2},boltwood:{current:-18,observedAt:fresh,slopePerHour:0}};

test('FAVORABLE requires dry vertical profile plus fresh dry summit humidity',()=>{
  const d=hale.classifyHaleakalaEvidence({sunriseIso:nearSunrise,gfs:dryGfs,lco:dryLco,nws:{hardStops:[]},nps:{access:'OPEN'}},NOW);
  assert.equal(d.state,'FAVORABLE');
  assert.equal(d.confidence,'HIGH');
  assert.equal(d.observationUsedForDecision,true);
});

test('wet summit observation vetoes a dry GFS profile near sunrise',()=>{
  const d=hale.classifyHaleakalaEvidence({sunriseIso:nearSunrise,gfs:dryGfs,lco:wetLco,nws:{hardStops:[]},nps:{access:'OPEN'}},NOW);
  assert.equal(d.state,'UNFAVORABLE');
  assert.equal(d.disagreement,true);
});

test('rapid summit humidity change produces CHANGING instead of fake persistence',()=>{
  const lco={humidity:{current:62,observedAt:fresh,slopePerHour:14}};
  const d=hale.classifyHaleakalaEvidence({sunriseIso:nearSunrise,gfs:{row:{rh700:35,rh600:42,rh850:70}},lco,nws:{hardStops:[]},nps:{access:'OPEN'}},NOW);
  assert.equal(d.state,'CHANGING');
  assert.equal(d.changing,true);
});

test('far-ahead summit observation is context rather than a sunrise decision gate',()=>{
  const d=hale.classifyHaleakalaEvidence({sunriseIso:farSunrise,gfs:dryGfs,lco:dryLco,nws:{hardStops:[]},nps:{access:'OPEN'}},NOW);
  assert.equal(d.state,'UNCERTAIN');
  assert.equal(d.observationUsedForDecision,false);
  assert.ok(d.cautions.some(x=>/outside the 8-hour decision window/i.test(x)));
});

test('high-impact NWS warning is a hard UNFAVORABLE gate',()=>{
  const d=hale.classifyHaleakalaEvidence({sunriseIso:nearSunrise,gfs:dryGfs,lco:dryLco,nws:{hardStops:[{event:'High Wind Warning'}]},nps:{access:'OPEN'}},NOW);
  assert.equal(d.state,'UNFAVORABLE');
  assert.equal(d.hardStop,true);
});

test('strong dry GFS alone abstains when summit humidity is missing',()=>{
  const d=hale.classifyHaleakalaEvidence({sunriseIso:nearSunrise,gfs:dryGfs,nws:{hardStops:[]},nps:{access:'OPEN'}},NOW);
  assert.equal(d.state,'UNCERTAIN');
  assert.equal(d.confidence,'LOW');
});

test('Boltwood alone can never create a favorable state',()=>{
  const d=hale.classifyHaleakalaEvidence({sunriseIso:nearSunrise,gfs:dryGfs,lco:{boltwood:{current:-25,observedAt:fresh,slopePerHour:0}},nws:{hardStops:[]},nps:{access:'OPEN'}},NOW);
  assert.equal(d.state,'UNCERTAIN');
});

test('generic cloudy wording does not override validated dry-profile and summit evidence',()=>{
  const d=hale.classifyHaleakalaEvidence({sunriseIso:nearSunrise,gfs:dryGfs,lco:dryLco,nps:{access:'OPEN'},nws:{hardStops:[],nearSunrise:{shortForecast:'Mostly Cloudy'}}},NOW);
  assert.equal(d.state,'FAVORABLE');
  assert.ok(d.cautions.some(x=>/Generic NWS cloud wording/.test(x)));
});

test('stale summit humidity is excluded from a favorable call',()=>{
  const d=hale.classifyHaleakalaEvidence({sunriseIso:nearSunrise,gfs:dryGfs,lco:{humidity:{current:35,observedAt:'2026-09-30T09:00:00Z',slopePerHour:0}},nws:{hardStops:[]},nps:{access:'OPEN'}},NOW);
  assert.equal(d.state,'UNCERTAIN');
});

test('strong moist GFS profile can support UNFAVORABLE without generic cloud percentage',()=>{
  const d=hale.classifyHaleakalaEvidence({sunriseIso:farSunrise,gfs:wetGfs,lco:{humidity:{current:78,observedAt:fresh,slopePerHour:0}},nws:{hardStops:[]},nps:{access:'OPEN'}},NOW);
  assert.equal(d.state,'UNFAVORABLE');
});

test('above-cloud inference stays explicitly experimental',()=>{
  const x=hale.inferAboveCloud(dryGfs);
  assert.equal(x.experimental,true);
  assert.match(x.label,/local summit cloud remains possible/i);
});

test('all-sky redirect timestamp parser supports freshness gating',()=>{
  assert.equal(hale.parseCameraTimestamp('https://s3.example/ogg/allsky/20260930-115500.jpg'),'2026-09-30T11:55:00.000Z');
  assert.equal(hale.parseCameraTimestamp('https://example/no-timestamp.jpg'),null);
});

test('sunrise geometry returns a plausible eastward azimuth',()=>{
  const s=hale.nextSunrise(new Date('2026-09-30T12:00:00Z'));
  assert.match(s.label,/HST/);
  assert.ok(s.azimuthDeg>70&&s.azimuthDeg<115);
  assert.ok(Date.parse(s.civilTwilightIso)<Date.parse(s.iso));
});

test('custom page generator exposes decision states and crawlable evidence boundaries',()=>{
  const fs=require('node:fs');
  const source=fs.readFileSync('scripts/generate-haleakala-sunrise-page.mjs','utf8');
  for(const term of ['FAVORABLE','CHANGING','UNFAVORABLE','UNCERTAIN']) assert.match(source,new RegExp(term));
  assert.match(source,/vertical GFS moisture/i);
  assert.match(source,/No sunrise score/i);
  assert.match(source,/google-adsense-account/);
  assert.match(source,/G-Y5D2V2W7HN/);
  assert.match(source,/assets\/haleakala-sunrise\.js/);
  assert.match(source,/assets\/haleakala-sunrise\.css/);
});
