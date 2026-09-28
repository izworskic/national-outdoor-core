const test=require('node:test');
const assert=require('node:assert/strict');
let replacements,normalizers;

test.before(async()=>{
  replacements=await import('../lib/breakout-live-replacements.mjs');
  normalizers=await import('../lib/breakout-live-value-normalizers.mjs');
});

test('Glacier crossing parser distinguishes full crossing from alpine closure',()=>{
  assert.equal(
    replacements.parseGlacierThroughStatus('Going-to-the-Sun Road is fully open to vehicle traffic through Logan Pass.'),
    'THROUGH-DRIVE SOURCE READS OPEN'
  );
  assert.equal(
    replacements.parseGlacierThroughStatus('Going-to-the-Sun Road is closed from Avalanche Creek to Jackson Glacier Overlook because of weather.'),
    'ALPINE CROSSING RESTRICTED'
  );
});

test('Lake Mead parser preserves named NPS ramp statuses and thresholds',()=>{
  const text=[
    'Callville Bay Open Open Open 1,065 feet Open via concession-managed Mobi Mat.',
    'Echo Bay Closed Open Open 1,035 feet Ramp construction through remainder of 2026.',
    'Hemenway Harbor Open Open Open 1,030 feet Open via pipe mat with four lanes.',
    'Temple Bar Open Open Open 950 feet Open via concession Mobi Mat.',
    'South Cove Closed Open Open 1,035 feet Open via primitive launch south of concrete ramp.',
    'Boulder Harbor Closed Closed Closed The concrete ramp is closed.',
    'Government Wash Closed Closed Closed The concrete ramp is closed.',
    'Las Vegas Bay Closed Closed Closed Closed.',
    'Overton Beach Closed Closed Closed Closed.'
  ].join(' ');
  const rows=replacements.parseMeadLaunchTable(text,1046);
  const callville=rows.find(x=>x.name==='Callville Bay');
  const hemenway=rows.find(x=>x.name==='Hemenway Harbor');
  const south=rows.find(x=>x.name==='South Cove');
  assert.equal(callville.motorized,'OPEN');
  assert.equal(callville.minSafe,1065);
  assert.equal(callville.aboveMin,false);
  assert.equal(hemenway.aboveMin,true);
  assert.equal(south.motorized,'OPEN');
  assert.equal(rows.find(x=>x.name==='Boulder Harbor').motorized,'CLOSED');
});

test('Lake Mead normalization never silently overrides current NPS OPEN with a threshold calculation',()=>{
  const payload={
    status:'MOTORIZED LAUNCH OPTIONS FOUND',headline:'raw',facts:[{label:'Motorized candidates',value:'2'},{label:'Start with',value:'Hemenway'}],
    launches:[
      {name:'Callville Bay',motorized:'OPEN',nonMotorized:'OPEN',minSafe:1065,aboveMin:false,motorizedCandidate:false,note:'NPS says open via Mobi Mat.'},
      {name:'Hemenway Harbor',motorized:'OPEN',nonMotorized:'OPEN',minSafe:1030,aboveMin:true,motorizedCandidate:true,note:'Pipe mat.'},
      {name:'Boulder Harbor',motorized:'CLOSED',nonMotorized:'CLOSED',minSafe:null,aboveMin:null,motorizedCandidate:false,note:'Closed.'}
    ]
  };
  const out=normalizers.normalizeMeadPayload(payload);
  const callville=out.launches.find(x=>x.name==='Callville Bay');
  assert.equal(callville.motorizedCandidate,true);
  assert.equal(callville.thresholdConflict,true);
  assert.equal(callville.aboveMin,null);
  assert.match(callville.note,/VERIFY: NPS currently lists motorized access OPEN/i);
  assert.match(out.headline,/threshold conflict/i);
  assert.equal(out.facts.find(x=>x.label==='Motorized candidates').value,'2');
});

test('Yellowstone route presets evaluate projected seasonal windows without claiming a live all-clear',()=>{
  const text=[
    'Open year-round: North Entrance to Northeast Entrance.',
    'Open April 17 - October 31, 2026: West Entrance to Madison, Madison to Old Faithful, Madison to Norris, Mammoth Hot Springs to Norris, Norris to Canyon Village.',
    'Open May 8 - October 31, 2026: South Entrance to West Thumb, West Thumb to Old Faithful, West Thumb to Lake Village.',
    'Anticipated Traffic Delays Old Faithful Access: Expect up to 15-minute delays during October. Parkwide Access: Expect up to 30-minute delays throughout 2026.'
  ].join(' ');
  const september=replacements.buildYellowstoneRoutes(text,new Date('2026-09-28T12:00:00Z'));
  assert.equal(september.find(x=>x.id==='west-old-faithful').state,'SEASONALLY AVAILABLE — VERIFY LIVE MAP');
  assert.equal(september.find(x=>x.id==='south-old-faithful').state,'SEASONALLY AVAILABLE — VERIFY LIVE MAP');
  assert.equal(september.find(x=>x.id==='north-northeast').state,'SEASONALLY AVAILABLE — VERIFY LIVE MAP');
  assert.ok(september.find(x=>x.id==='west-old-faithful').delays.length>=1);
  const november=replacements.buildYellowstoneRoutes(text,new Date('2026-11-05T12:00:00Z'));
  assert.equal(november.find(x=>x.id==='west-old-faithful').state,'OUTSIDE PROJECTED SEASON');
  assert.equal(november.find(x=>x.id==='north-northeast').state,'SEASONALLY AVAILABLE — VERIFY LIVE MAP');
});

test('client ships route, launch and Glacier crossing workbenches',()=>{
  const fs=require('node:fs');
  const js=fs.readFileSync('public/assets/breakout-live.js','utf8');
  assert.match(js,/Route workbench/);
  assert.match(js,/Launch workbench/);
  assert.match(js,/West side \+ Logan Pass \+ east side must all work/);
  assert.match(js,/breakout_route_selected/);
  assert.match(js,/breakout_launch_mode/);
});
