const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const geo=require("../api/national-geocode.js")._test;

test("device coordinates are rounded to about 0.001 degrees",()=>{
  assert.equal(geo.roundCoord(43.5941234),43.594);
  assert.equal(geo.roundCoord(-83.8898765),-83.89);
  assert.deepEqual(geo.validCoordinates(43.5941234,-83.8898765),{
    latitude:43.594,
    longitude:-83.89
  });
});

test("invalid coordinates are rejected before reverse geocoding",()=>{
  assert.equal(geo.validCoordinates(91,-83),null);
  assert.equal(geo.validCoordinates(43,-181),null);
  assert.equal(geo.validCoordinates("nope",-83),null);
});

test("reverse-geocoded location continuity uses a place label rather than coordinates",()=>{
  const address={
    city:"Bay City",
    state:"Michigan",
    "ISO3166-2-lvl4":"US-MI",
    postcode:"48708",
    country_code:"us"
  };
  assert.equal(geo.queryLabel(address),"Bay City, MI");
  const payload=geo.locationPayload({
    display_name:"Bay City, Bay County, Michigan, United States",
    type:"city",
    address
  },geo.queryLabel(address),{latitude:43.594,longitude:-83.89},{timeZone:"America/Detroit"},"device");
  assert.equal(payload.query,"Bay City, MI");
  assert.equal(payload.latitude,43.594);
  assert.equal(payload.longitude,-83.89);
  assert.equal(payload.sourceMode,"device");
  assert.match(payload.coordinate_precision,/0\.001/);
});

test("U.S. candidate detection works for reverse-geocoder rows",()=>{
  assert.equal(geo.isUsCandidate({address:{country_code:"us"}}),true);
  assert.equal(geo.isUsCandidate({address:{"ISO3166-2-lvl4":"US-MI"}}),true);
  assert.equal(geo.isUsCandidate({address:{country_code:"ca"}}),false);
});


test("manual geocode parser recognizes city-state and ZIP inputs",()=>{
  assert.deepEqual(geo.parseManualQuery("Portland, OR"),{
    kind:"place",
    city:"Portland",
    state:{code:"OR",fips:"41",name:"Oregon"}
  });
  assert.deepEqual(geo.parseManualQuery("Portland Oregon"),{
    kind:"place",
    city:"Portland",
    state:{code:"OR",fips:"41",name:"Oregon"}
  });
  assert.deepEqual(geo.parseManualQuery("Portland OR"),{
    kind:"place",
    city:"Portland",
    state:{code:"OR",fips:"41",name:"Oregon"}
  });
  assert.deepEqual(geo.parseManualQuery("97201"),{kind:"zip",zip:"97201"});
  assert.deepEqual(geo.stateInfo("Michigan"),{code:"MI",fips:"26",name:"Michigan"});
  assert.deepEqual(geo.stateInfo("PR"),{code:"PR",fips:"72",name:"Puerto Rico"});
  assert.equal(geo.parseManualQuery("Portland").kind,"flexible");
});

test("Census place rows preserve U.S. state identity and coordinates",()=>{
  const row=geo.censusPlaceRow({
    BASENAME:"Portland",
    CENTLAT:"+45.5371760",
    CENTLON:"-122.6500235"
  },geo.stateInfo("OR"),"city");
  assert.equal(row.address.city,"Portland");
  assert.equal(row.address.state,"Oregon");
  assert.equal(row.address["ISO3166-2-lvl4"],"US-OR");
  assert.equal(row._provider,"census-tigerweb");
  assert.equal(Number(row.lat),45.537176);
  assert.equal(Number(row.lon),-122.6500235);
});

test("Census ZIP rows retain state identity for cross-tool continuity",()=>{
  const row=geo.censusZipRow({
    CENTLAT:"+45.5100000",
    CENTLON:"-122.6800000"
  },geo.stateInfo("OR"),"97201");
  assert.equal(row.address.postcode,"97201");
  assert.equal(row.address.state,"Oregon");
  assert.equal(row.address["ISO3166-2-lvl4"],"US-OR");
  assert.equal(row.type,"postcode");
});

test("Census-backed location payload exposes truthful provider attribution",()=>{
  const row=geo.censusPlaceRow({
    BASENAME:"Portland",
    CENTLAT:"+45.5371760",
    CENTLON:"-122.6500235"
  },geo.stateInfo("OR"),"city");
  const payload=geo.locationPayload(
    row,
    "Portland, OR",
    {latitude:45.537,longitude:-122.65},
    {timeZone:"America/Los_Angeles"},
    "manual"
  );
  assert.equal(payload.geocodeSource,"U.S. Census Bureau TIGERweb");
  assert.match(payload.attribution,/U\.S\. Census Bureau TIGERweb/);
  assert.equal(payload.stateCode,"OR");
  assert.equal(payload.timeZone,"America/Los_Angeles");
});

test("TIGERweb query builder remains server-side and keyless",()=>{
  const url=new URL(geo.tigerQueryUrl(
    "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Places_CouSub_ConCity_SubMCD/MapServer/4",
    "STATE='41' AND UPPER(BASENAME)=UPPER('Portland')",
    "BASENAME,STATE,CENTLAT,CENTLON"
  ));
  assert.equal(url.hostname,"tigerweb.geo.census.gov");
  assert.equal(url.searchParams.get("returnGeometry"),"false");
  assert.match(url.searchParams.get("where"),/Portland/);
  assert.equal(url.searchParams.get("f"),"json");
});


test("national client retries transient edge geocode failures once",()=>{
  const client=fs.readFileSync(require.resolve("../public/assets/national-tools.js"),"utf8");
  assert.match(client,/function fetchLocation/);
  assert.match(client,/\[502,503,504\]\.includes\(response\.status\)/);
  assert.match(client,/await delay\(750\)/);
  assert.match(client,/fetchLocation\("\/api\/national-geocode\?q="/);
});


test("shared national place toolbar keeps shared links query-based and analytics-safe",()=>{
  const client=fs.readFileSync(require.resolve("../public/assets/national-tools.js"),"utf8");
  assert.match(client,/function renderPlaceToolbar/);
  assert.match(client,/function currentShareUrl/);
  assert.match(client,/withQuery\(path,loc\)/);
  assert.match(client,/navigator\.share/);
  assert.match(client,/clipboard\.writeText/);
  assert.match(client,/National Place Shared/);
  assert.match(client,/National Place Switched/);
  assert.doesNotMatch(client,/National Place Shared[^\n]{0,160}(?:query|latitude|longitude|place)/);
});
