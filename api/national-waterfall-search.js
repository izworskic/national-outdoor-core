"use strict";

const { finite } = require("../index");
const UA = "ChrisIzworskiWaterfallWindow/1.0 (+https://chrisizworski.com/national-tools/waterfalls/)";
const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const OVERPASS = "https://overpass-api.de/api/interpreter";

function haversine(a, b, c, d) {
  const r = 3958.7613, rad = (x) => x * Math.PI / 180;
  const q = Math.sin(rad(c-a)/2)**2 + Math.cos(rad(a))*Math.cos(rad(c))*Math.sin(rad(d-b)/2)**2;
  return 2 * r * Math.asin(Math.sqrt(q));
}
function clean(value, max=100) { return String(value || "").replace(/\s+/g, " ").trim().slice(0,max); }
async function fetchJson(url, timeout=7000, options={}) {
  const response = await fetch(url, { method: options.method || "GET", headers: { accept:"application/json", "accept-language":"en-US,en;q=.8", "user-agent":UA, ...(options.headers||{}) }, body:options.body, signal:AbortSignal.timeout(timeout) });
  if (!response.ok) throw new Error(`${new URL(url).hostname} returned ${response.status}`);
  return response.json();
}
function normalizeNominatim(rows) {
  return (rows || []).map((row) => ({
    id: `osm-${row.osm_type || "x"}-${row.osm_id || Math.random()}`,
    name: clean(row.namedetails?.name || row.name || String(row.display_name || "").split(",")[0], 120),
    label: clean(row.display_name, 180),
    latitude: finite(row.lat, -90, 90), longitude: finite(row.lon, -180, 180),
    source: "OpenStreetMap/Nominatim",
  })).filter((row) => row.name && row.latitude != null && row.longitude != null);
}
async function namedSearch(q) {
  const query = /waterfall|falls/i.test(q) ? q : `${q} waterfall`;
  const url = new URL(NOMINATIM);
  url.searchParams.set("q", query); url.searchParams.set("format", "jsonv2"); url.searchParams.set("limit", "8");
  url.searchParams.set("countrycodes", "us"); url.searchParams.set("addressdetails", "1"); url.searchParams.set("namedetails", "1");
  const rows = await fetchJson(url, 7000);
  return { results: normalizeNominatim(rows).slice(0,8), source_url:url.toString() };
}
function overpassPoint(row) {
  const lat = finite(row.lat ?? row.center?.lat, -90, 90), lon = finite(row.lon ?? row.center?.lon, -180, 180);
  if (lat == null || lon == null) return null;
  const name = clean(row.tags?.name || row.tags?.["name:en"], 120);
  if (!name) return null;
  return { id:`osm-${row.type}-${row.id}`, name, label:clean([name,row.tags?.operator,row.tags?.description].filter(Boolean).join(" · "),180), latitude:lat, longitude:lon, source:"OpenStreetMap/Overpass" };
}
async function nearby(lat, lon, radiusMiles=50) {
  const radius = Math.round(Math.min(80, Math.max(5, radiusMiles)) * 1609.344);
  const query = `[out:json][timeout:15];(node["natural"="waterfall"](around:${radius},${lat},${lon});way["natural"="waterfall"](around:${radius},${lat},${lon});relation["natural"="waterfall"](around:${radius},${lat},${lon}););out center tags;`;
  const body = new URLSearchParams({ data:query }).toString();
  const payload = await fetchJson(OVERPASS, 12000, { method:"POST", headers:{"content-type":"application/x-www-form-urlencoded"}, body });
  const results = (payload?.elements || []).map(overpassPoint).filter(Boolean)
    .map((row) => ({...row, distance_miles:Math.round(haversine(lat,lon,row.latitude,row.longitude)*10)/10}))
    .sort((a,b)=>a.distance_miles-b.distance_miles).slice(0,30);
  return { results, source_url:OVERPASS };
}
module.exports = async function handler(req,res) {
  res.setHeader("Access-Control-Allow-Origin","*"); res.setHeader("X-Robots-Tag","noindex, nofollow");
  res.setHeader("Cache-Control","public, s-maxage=21600, stale-while-revalidate=86400");
  if (req.method !== "GET" && req.method !== "HEAD") { res.setHeader("Allow","GET, HEAD"); return res.status(405).json({error:"Method not allowed"}); }
  try {
    const q=clean(req.query?.q); const lat=finite(req.query?.lat,-90,90), lon=finite(req.query?.lon,-180,180);
    let result;
    if (q.length >= 2) result=await namedSearch(q);
    else if (lat!=null && lon!=null) result=await nearby(lat,lon,finite(req.query?.radius,5,80) ?? 50);
    else return res.status(400).json({error:"Search for a waterfall name or provide latitude and longitude for nearby waterfalls."});
    return res.status(200).json({generated_at:new Date().toISOString(), mode:q?"name-search":"nearby-waterfalls", ...result, disclaimer:"Waterfall discovery uses OpenStreetMap data and may not include every named or seasonal waterfall."});
  } catch(error) {
    res.setHeader("Cache-Control","no-store");
    return res.status(502).json({error:"Waterfall search is temporarily unavailable.",detail:String(error?.message||error).slice(0,220)});
  }
};
module.exports._test={haversine,normalizeNominatim,overpassPoint};
