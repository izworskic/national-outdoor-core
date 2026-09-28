const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const slugs=['zion-narrows-conditions','grand-canyon-access','going-to-the-sun-road-status','haleakala-sunrise','yellowstone-road-status','tioga-road-status','cadillac-mountain-sunrise','mount-rainier-road-status','lake-mead-access','lake-powell-ramp-status'];

test('generated breakout pages include useful decision guidance and hub structured data',()=>{
  for(const slug of slugs){
    const html=fs.readFileSync(`public/national-tools/${slug}/index.html`,'utf8');
    assert.match(html,/How to use this result/);
    assert.match(html,/Recheck close to departure/);
  }
  const hub=fs.readFileSync('public/national-tools/live-decisions/index.html','utf8');
  const match=hub.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(match,'hub JSON-LD missing');
  const json=JSON.parse(match[1]);
  const types=json['@graph'].flatMap(x=>Array.isArray(x['@type'])?x['@type']:[x['@type']]);
  assert.ok(types.includes('CollectionPage'));
  assert.ok(types.includes('ItemList'));
  assert.ok(types.includes('BreadcrumbList'));
  const list=json['@graph'].find(x=>x['@type']==='ItemList');
  assert.equal(list.numberOfItems,10);
  assert.equal(list.itemListElement.length,10);
});
