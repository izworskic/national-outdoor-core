const {test}=require('node:test');
const assert=require('node:assert/strict');

const powell= [
  'Lake Powell Elevation (10/29/2026) 3531.42 ft',
  'Lake Level Effects to Launch Ramps and Services',
  'Wahweap Main Launch Ramp Closed Closed Launch at your own risk 3545 ft Ramp closed to motorized vessels. Open to paddlecraft only.',
  'Wahweap Stateline Launch Ramp Closed Closed Launch at your own risk 3567 ft Paddlecraft only.',
  'Wahweap Stateline Auxiliary Launch Ramp Available Available Closed 3515 ft Open to motorized vessels. Plate mats needed at 3524 ft.',
  'Castle Rock Cut Closed Closed Closed 3583 ft Navigation buoys at 3590.',
  'Antelope Point Public Launch Ramp Closed Closed Launch at your own risk 3588 ft Paddlecraft only.',
  'Antelope Point Business Ramp Closed Closed Closed 3535 ft Limited launch. Contact valet.',
  'Halls Crossing Launch Ramp Closed Closed Closed 3557 ft Closed to all vessels.',
  'UDOT Ferry Closed Closed Closed 3575 ft Not operating.',
  'UDOT Launch Ramps Closed Closed Closed 3575 ft No private launching.',
  'Bullfrog North Launch Ramp Launch at your own risk Launch at your own risk Launch at your own risk 3525 ft Open to all vessels.',
  'Bullfrog Main Launch Ramp Closed Closed Launch at your own risk 3578 ft Motorized closed.',
  'Bullfrog Main Launch Ramp Spur Closed Closed Launch at your own risk 3549 ft Paddlecraft only.',
  'Bullfrog Primitive Launch Ramp Closed Closed Closed Primitive steel-plate ramp.',
  'Stanton Creek Primitive Area Closed Closed Launch at your own risk Primitive beach.',
  'Hite Launch Ramp Closed Closed Closed 3650 ft Ramp out of water.',
  'Rainbow Bridge National Monument Visit at your own risk Visit at your own risk Visit at your own risk 3548 ft Docks disconnected.',
  'For more information on launch ramp improvement projects',
  'Last updated: October 30, 2026'
].join(' ');

const mead=[
  'Lake Mead Launch Ramps and Services',
  'Callville Bay Open Open Open 1,065 feet Open via concession managed Mobi Mat.',
  'Echo Bay Closed Open Open 1,035 feet Ramp is under construction.',
  'Hemenway Harbor Open Open Open 1,030 feet via pipe mat. 4 lanes available.',
  'Temple Bar Open Open Open 950 feet Open via concession managed Mobi Mat.',
  'South Cove Closed Open Open 1,035 feet via primitive ramp. Concrete ramp is closed.',
  'Boulder Harbor Closed Closed Closed --- The harbor is too shallow.',
  'Government Wash Closed Closed Closed --- Primitive paddle day use mentioned in notes.',
  'Las Vegas Bay Closed Closed Closed --- Marina relocated.',
  'Overton Beach Closed Closed Closed --- Ramp closed.',
  'Lake Mohave Current Water Level',
  'Last updated: October 5, 2026'
].join(' ');
const usbr=[
  'REPORT LAST UPDATED ON: 11/02/2026 03:13 AM',
  'SITE NAME: LAKE MEAD',
  'PARAMETER: RESERVOIR WS ELEVATION, END OF PERIOD PRIMARY READING',
  'UNITS: FEET',
  '10/31/2026 12:00:00 AM 1038.9',
  '11/1/2026 12:00:00 AM 1038.9',
  '11/2/2026 12:00:00 AM NaN'
].join(' ');

test('NPS Powell columns override open words in ramp notes, and risk never becomes AVAILABLE',async()=>{
  const {parsePowellRampTable}=await import('../lib/lake-ramp-decisions.mjs');
  const d=parsePowellRampTable(powell,new Date('2026-11-02T14:00:00Z'));
  assert.equal(d.level,3531.42);
  assert.equal(d.levelDay,'2026-10-29');
  assert.equal(d.levelAgeDays,4);
  assert.equal(d.ramps.length,13);
  assert.deepEqual(d.otherFacilities.map(x=>x.name),['Castle Rock Cut','UDOT Ferry','Rainbow Bridge National Monument']);
  assert.equal(d.ramps.some(x=>x.name==='Rainbow Bridge National Monument'),false);
  const main=d.ramps.find(x=>x.name==='Wahweap Main Launch Ramp');
  assert.equal(main.motorized,'CLOSED');
  assert.equal(main.nonMotorized,'AT YOUR OWN RISK');
  assert.equal(main.motorizedCandidate,false);
  const aux=d.ramps.find(x=>x.name==='Wahweap Stateline Auxiliary Launch Ramp');
  assert.equal(aux.motorized,'OPEN');
  assert.equal(aux.nonMotorized,'CLOSED');
  assert.equal(aux.min,3515);
  assert.equal(aux.aboveThreshold,true);
  const bullfrog=d.ramps.find(x=>x.name==='Bullfrog North Launch Ramp');
  assert.equal(bullfrog.motorized,'AT YOUR OWN RISK');
  assert.equal(bullfrog.motorizedCandidate,false);
  assert.equal(bullfrog.motorizedRisk,true);
  const primitive=d.ramps.find(x=>x.name==='Bullfrog Primitive Launch Ramp');
  assert.equal(primitive.min,null);
  assert.equal(primitive.motorized,'CLOSED');
});

test('dated USBR Lake Mead records ignore future NaN and do not pick unrelated lakes',async()=>{
  const {parseMeadElevation}=await import('../lib/lake-ramp-decisions.mjs');
  const d=parseMeadElevation(usbr,new Date('2026-11-02T14:00:00Z'));
  assert.equal(d.level,1038.9);
  assert.equal(d.day,'2026-11-01');
  assert.equal(parseMeadElevation(usbr.replace('LAKE MEAD','LAKE MOHAVE')),null);
});

test('Mead NPS OPEN below 1065 ft is VERIFY, while distinct lower-threshold ramps remain candidates',async()=>{
  const {combineMeadEvidence}=await import('../lib/lake-ramp-decisions.mjs');
  const d=combineMeadEvidence(mead,usbr,new Date('2026-11-02T14:00:00Z'));
  assert.equal(d.launches.length,9);
  assert.equal(d.sourceDay,'2026-10-05');
  assert.equal(d.sourceAgeDays,28);
  const callville=d.launches.find(x=>x.name==='Callville Bay');
  assert.equal(callville.motorized,'OPEN');
  assert.equal(callville.thresholdConflict,true);
  assert.equal(callville.motorizedCandidate,false);
  assert.match(callville.note,/VERIFY/);
  const south=d.launches.find(x=>x.name==='South Cove');
  assert.equal(south.houseboats,'CLOSED');
  assert.equal(south.motorized,'OPEN');
  assert.equal(south.motorizedCandidate,true);
  const candidateNames=d.launches.filter(x=>x.motorizedCandidate).map(x=>x.name);
  assert.deepEqual(candidateNames,['Echo Bay','Hemenway Harbor','Temple Bar','South Cove']);
});

test('USBR outage does not erase NPS ramp rows or assert threshold clearance',async()=>{
  const {combineMeadEvidence}=await import('../lib/lake-ramp-decisions.mjs');
  const d=combineMeadEvidence(mead,null,new Date('2026-11-02T14:00:00Z'));
  assert.equal(d.launches.length,9);
  assert.equal(d.elevationAvailable,false);
  assert.equal(d.launches.filter(x=>x.motorizedCandidate).length,0);
  assert.equal(d.launches.find(x=>x.name==='Echo Bay').aboveMin,null);
});

test('truncated or unrecognized official tables fail closed, not as all ramps closed',async()=>{
  const {parsePowellRampTable,parseMeadRampTable}=await import('../lib/lake-ramp-decisions.mjs');
  assert.throws(()=>parsePowellRampTable('Lake Powell Elevation (10/29/2026) 3531.42 ft'),/heading/);
  assert.throws(()=>parseMeadRampTable('Lake Mead Launch Ramps and Services Hemenway Harbor Open Open Open Lake Mohave Current Water Level'),/incomplete/);
});

test('core API returns a complete vessel-specific Powell decision',async()=>{
  const handler=require('../api/breakout-live.js');
  const orig=global.fetch;
  global.fetch=async(url)=>{
    if(String(url).includes('glca/learn/changing-lake-levels.htm'))return {ok:true,status:200,text:async()=>powell};
    throw new Error('Unexpected outbound URL '+url);
  };
  const data={statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},end(body){this.body=JSON.parse(body);return this;}};
  try{
    await handler({url:'/api/breakout-live?id=lake-powell-ramp-status',query:{id:'lake-powell-ramp-status'},headers:{}},data);
    assert.equal(data.statusCode,200);
    assert.equal(data.body.ok,true);
    assert.equal(data.body.ramps.length,13);
    assert.equal(data.body.otherFacilities.length,3);
    assert.equal(data.body.status,'VERIFY ELEVATION DATE');
    assert.equal(data.body.ramps.find(x=>x.name==='Wahweap Main Launch Ramp').motorized,'CLOSED');
  }finally{global.fetch=orig;}
});

test('core API preserves Mead NPS decision even when separate level feed fails',async()=>{
  const handler=require('../api/breakout-live.js');
  const orig=global.fetch;
  global.fetch=async(url)=>{
    if(String(url).includes('lake/planyourvisit/changing-lake-levels.htm'))return {ok:true,status:200,text:async()=>mead};
    if(String(url).includes('HOVR_FB_LastSevenDays_Daily'))throw new Error('USBR timeout');
    throw new Error('Unexpected outbound URL '+url);
  };
  const res={statusCode:200,setHeader(){},end(body){this.body=JSON.parse(body);return this;}};
  try{
    await handler({url:'/api/breakout-live?id=lake-mead-access',query:{id:'lake-mead-access'},headers:{}},res);
    assert.equal(res.statusCode,200);
    assert.equal(res.body.launches.length,9);
    assert.equal(res.body.facts.find(x=>x.label==='USBR measured elevation').value,'Unavailable / not recent');
    assert.equal(res.body.launches.filter(x=>x.motorizedCandidate).length,0);
  }finally{global.fetch=orig;}
});
