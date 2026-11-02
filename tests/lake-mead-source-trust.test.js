const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const cleanTable=[
'Lake Mead Launch Ramps and Services Location Houseboats Motorized Vessels Non- motorized Vessels Minimum Safe Elevation More Information',
'Callville Bay Open Open Open 1,065 feet via mobi mat',
'Echo Bay Closed Open Open 1,035 feet construction',
'Hemenway Harbor Open Open Open 1,030 feet via pipe mat',
'Temple Bar Open Open Open 950 feet',
'South Cove Closed Open Open 1,035 feet via primitive ramp; concrete closed',
'Boulder Harbor Closed Closed Closed --- closed in 2021',
'Government Wash Closed Closed Closed --- nonmotorized primitive day-use described',
'Las Vegas Bay Closed Closed Closed ---',
'Overton Beach Closed Closed Closed ---',
'Lake Mohave Current Water Level'
].join(' ');
let mod;
test.before(async()=>{mod=await import('../lib/breakout-live-replacements.mjs');});
const page=(date)=>cleanTable+' Last updated: '+date;
test('NPS row data preserves vessel differences and explicit closures',()=>{
 const x=mod.parseMeadLaunchTable(page('November 1, 2026'),1080);
 assert.equal(x.length,9);
 assert.equal(x.find(r=>r.name==='Echo Bay').houseboats,'CLOSED');
 assert.equal(x.find(r=>r.name==='Echo Bay').motorized,'OPEN');
 assert.equal(x.find(r=>r.name==='Boulder Harbor').motorized,'CLOSED');
 assert.equal(x.find(r=>r.name==='Boulder Harbor').aboveMin,null);
 assert.equal(x.find(r=>r.name==='South Cove').minSafe,1035);
});
test('water elevation must not reopen an explicit NPS closure',()=>{
 const d=mod.evaluateMeadTable(page('November 1, 2026'),1080,new Date('2026-11-02T15:00:00Z'));
 assert.equal(d.accessVerified,true);
 assert.equal(d.levelVerified,true);
 assert.equal(d.launches.find(x=>x.name==='Boulder Harbor').motorizedCandidate,false);
 assert.equal(d.launches.find(x=>x.name==='South Cove').motorizedCandidate,true);
 assert.match(d.status,/NPS MOTORIZED OPTIONS/);
});
test('stale or unpublished NPS table cannot assert present launch availability',()=>{
 const old=mod.evaluateMeadTable(page('October 5, 2026'),1080,new Date('2026-11-02T15:00:00Z'));
 assert.equal(old.sourceFresh,false);
 assert.equal(old.launches.filter(x=>x.motorizedCandidate).length,0);
 assert.match(old.status,/VERIFY NPS SOURCE FRESHNESS/);
 const undated=mod.evaluateMeadTable(cleanTable,1080,new Date('2026-11-02T15:00:00Z'));
 assert.equal(undated.accessVerified,false);
});
test('parser structure changes and unknown USBR number fail closed',()=>{
 const bad=mod.evaluateMeadTable('Lake Mead Launch Ramps and Services picnic information Last updated: November 1, 2026',1080,new Date('2026-11-02T15:00:00Z'));
 assert.equal(bad.sourceFormatVerified,false);
 assert.match(bad.status,/VERIFY NPS TABLE FORMAT/);
 const notMead=mod.extractMeadElevation('Lake Mohave 1044.22 Lake Havasu 1043.55');
 assert.equal(notMead,null);
 const level=mod.extractMeadElevation('Hoover Dam reservoir level 1051.25 ft');
 assert.equal(level,1051.25);
});
test('USBR timeout keeps NPS historical context but not a launch all-clear',async()=>{
 const fetcher=async (url)=>{
  if(url.includes('usbr.gov'))throw Error('timeout');
  return {text:async()=>page('November 1, 2026')};
 };
 const result=await mod.lakeMead('lake-mead-access',{fetcher,now:new Date('2026-11-02T15:00:00Z')});
 assert.equal(result.ok,true);
 assert.equal(result.retrieval.usbrAvailable,false);
 assert.equal(result.levelVerified,false);
 assert.equal(result.launches.filter(x=>x.motorizedCandidate).length,0);
 assert.match(result.status,/VERIFY WATER ELEVATION/);
 assert.equal(result.source.url,'https://www.nps.gov/lake/planyourvisit/changing-lake-levels.htm');
 assert.ok(result.retrieval.usbrFailure);
});
test('NPS timeout does not yield availability from USBR-only information',async()=>{
 const fetcher=async (url)=>{
  if(url.includes('nps.gov'))throw Error('NPS timed out');
  return {text:async()=> 'Hoover Dam reservoir 1051.25'};
 };
 await assert.rejects(()=>mod.lakeMead('lake-mead-access',{fetcher}),/NPS timed out/);
});
test('client and API do not relabel stale ramp records as confirmed live',()=>{
 const js=fs.readFileSync('public/assets/breakout-live.js','utf8');
 const api=fs.readFileSync('api/breakout-live.js','utf8');
 const normalizer=fs.readFileSync('lib/breakout-live-value-normalizers.mjs','utf8');
 assert.match(js,/d.accessVerified===true&&d.levelVerified===true/);
 assert.match(normalizer,/typeof payload.accessVerified === 'boolean'/);
 assert.match(api,/s-maxage=60, must-revalidate/);
 assert.match(api,/id==='lake-mead-access'\?'no-store'/);
});
