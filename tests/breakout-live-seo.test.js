const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const slugs=['zion-narrows-conditions','grand-canyon-access','going-to-the-sun-road-status','haleakala-sunrise','yellowstone-road-status','tioga-road-status','cadillac-mountain-sunrise','mount-rainier-road-status','lake-mead-access','lake-powell-ramp-status'];

test('generated breakout pages include useful decision guidance and hub structured data',()=>{
  for(const slug of slugs){
    const html=fs.readFileSync(`public/national-tools/${slug}/index.html`,'utf8');
    assert.match(html,/How to use this result/);
    assert.match(html,/Recheck close to departure/);
    assert.match(html,/Live destination decision/);
  }
  const hub=fs.readFileSync('public/national-tools/live-decisions/index.html','utf8');
  assert.match(hub,/<title>Live Destination Decisions \| Chris Izworski<\/title>/);
  assert.match(hub,/Start with where you're going\./);
  for(const region of ['Southwest &amp; Colorado Plateau','Rockies &amp; Mountain West','California &amp; Sierra','Pacific Northwest','Northeast &amp; Great Lakes','Hawaii']) assert.match(hub,new RegExp(region));
  const match=hub.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(match,'hub JSON-LD missing');
  const json=JSON.parse(match[1]);
  const types=json['@graph'].flatMap(x=>Array.isArray(x['@type'])?x['@type']:[x['@type']]);
  assert.ok(types.includes('CollectionPage'));
  assert.ok(types.includes('ItemList'));
  assert.ok(types.includes('BreadcrumbList'));
  const list=json['@graph'].find(x=>x['@type']==='ItemList');
  assert.equal(list.name,'Live Destination Decisions by Region');
  assert.equal(list.numberOfItems,10);
  assert.equal(list.itemListElement.length,10);
  assert.equal(new Set(list.itemListElement.map(x=>x.url)).size,10);
});

test('geography taxonomy assigns each breakout tool exactly once',()=>{
  const geo=JSON.parse(fs.readFileSync('config/breakout-live-geography.json','utf8'));
  const assigned=geo.regions.flatMap(r=>r.toolIds);
  assert.deepEqual([...assigned].sort(),[...slugs].sort());
  assert.equal(new Set(assigned).size,slugs.length);
  for(const slug of slugs) assert.ok(geo.tools[slug]?.place,`missing directory place for ${slug}`);
});
