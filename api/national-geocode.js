const NOMINATIM_SEARCH = "https://nominatim.openstreetmap.org/search";
const NOMINATIM_REVERSE = "https://nominatim.openstreetmap.org/reverse";
const NWS_POINTS = "https://api.weather.gov/points";
const TIGER_PLACES = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Places_CouSub_ConCity_SubMCD/MapServer";
const TIGER_ZCTA = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/PUMA_TAD_TAZ_UGA_ZCTA/MapServer/1";
const TIGER_STATES = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/0";
const USER_AGENT = "ChrisIzworskiNationalOutdoorTools/2.2 (+https://chrisizworski.com/national-tools/)";

const STATE_INFO = {
  AL:["01","Alabama"],AK:["02","Alaska"],AZ:["04","Arizona"],AR:["05","Arkansas"],CA:["06","California"],
  CO:["08","Colorado"],CT:["09","Connecticut"],DE:["10","Delaware"],DC:["11","District of Columbia"],FL:["12","Florida"],
  GA:["13","Georgia"],HI:["15","Hawaii"],ID:["16","Idaho"],IL:["17","Illinois"],IN:["18","Indiana"],IA:["19","Iowa"],
  KS:["20","Kansas"],KY:["21","Kentucky"],LA:["22","Louisiana"],ME:["23","Maine"],MD:["24","Maryland"],MA:["25","Massachusetts"],
  MI:["26","Michigan"],MN:["27","Minnesota"],MS:["28","Mississippi"],MO:["29","Missouri"],MT:["30","Montana"],NE:["31","Nebraska"],
  NV:["32","Nevada"],NH:["33","New Hampshire"],NJ:["34","New Jersey"],NM:["35","New Mexico"],NY:["36","New York"],NC:["37","North Carolina"],
  ND:["38","North Dakota"],OH:["39","Ohio"],OK:["40","Oklahoma"],OR:["41","Oregon"],PA:["42","Pennsylvania"],RI:["44","Rhode Island"],
  SC:["45","South Carolina"],SD:["46","South Dakota"],TN:["47","Tennessee"],TX:["48","Texas"],UT:["49","Utah"],VT:["50","Vermont"],
  VA:["51","Virginia"],WA:["53","Washington"],WV:["54","West Virginia"],WI:["55","Wisconsin"],WY:["56","Wyoming"],
  AS:["60","American Samoa"],GU:["66","Guam"],MP:["69","Northern Mariana Islands"],PR:["72","Puerto Rico"],VI:["78","U.S. Virgin Islands"]
};
const STATE_NAME_TO_CODE = Object.fromEntries(Object.entries(STATE_INFO).map(([code,info])=>[info[1].toLowerCase(),code]));

function cleanQuery(value) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 100);
}

function stateInfo(value) {
  const raw = cleanQuery(value);
  if (!raw) return null;
  const code = raw.length === 2 ? raw.toUpperCase() : STATE_NAME_TO_CODE[raw.toLowerCase()];
  const info = code && STATE_INFO[code];
  return info ? { code, fips: info[0], name: info[1] } : null;
}
function parseManualQuery(value) {
  const q = cleanQuery(value);
  const zip = q.match(/^(\d{5})(?:-\d{4})?$/);
  if (zip) return { kind:"zip", zip:zip[1] };

  let city = null, state = null;
  const comma = q.match(/^(.+?),\s*(.+)$/);
  if (comma) {
    city = cleanQuery(comma[1]);
    state = stateInfo(comma[2]);
  } else {
    const abbrev = q.match(/^(.+?)\s+([A-Za-z]{2})$/);
    if (abbrev) {
      city = cleanQuery(abbrev[1]);
      state = stateInfo(abbrev[2]);
    }
    if (!state) {
      for (const [name, code] of Object.entries(STATE_NAME_TO_CODE)) {
        if (q.toLowerCase().endsWith(" " + name)) {
          city = cleanQuery(q.slice(0, -(name.length + 1)));
          state = stateInfo(code);
          break;
        }
      }
    }
  }
  return city && state ? { kind:"place", city, state } : { kind:"flexible", query:q };
}
function sqlText(value) {
  return String(value || "").replace(/'/g, "''");
}
function finite(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function roundCoord(value) {
  const n = finite(value);
  return n == null ? null : Math.round(n * 1000) / 1000;
}
function validCoordinates(latitude, longitude) {
  const lat = roundCoord(latitude);
  const lon = roundCoord(longitude);
  if (lat == null || lon == null || lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { latitude: lat, longitude: lon };
}
function isUsCandidate(row = {}) {
  const address = row.address || {};
  const countryCode = String(address.country_code || "").toLowerCase();
  const iso = String(address["ISO3166-2-lvl4"] || "").toUpperCase();
  return countryCode === "us" || iso.startsWith("US-");
}
function placeName(address = {}) {
  return address.city || address.town || address.village || address.hamlet || address.municipality || address.county || null;
}
function stateCode(address = {}) {
  return String(address["ISO3166-2-lvl4"] || "").replace(/^US-/, "") || null;
}
function queryLabel(address = {}, fallback = "Current location") {
  const place = placeName(address);
  const state = stateCode(address);
  if (place && state) return place + ", " + state;
  if (address.postcode) return String(address.postcode).slice(0, 10);
  if (place) return place;
  if (address.state) return address.state;
  return fallback;
}
function chooseCandidate(rows = []) {
  const valid = rows.filter((row) => isUsCandidate(row) && finite(row.lat) !== null && finite(row.lon) !== null);
  if (!valid.length) return null;
  const preferred = valid.find((row) => {
    const type = String(row.type || "").toLowerCase();
    return ["city", "town", "village", "hamlet", "administrative", "postcode"].some((x) => type.includes(x));
  });
  return preferred || valid[0];
}
async function fetchJson(url, timeout = 8000) {
  const response = await fetch(url, {
    headers: {
      accept: "application/geo+json, application/json",
      "accept-language": "en-US,en;q=0.8",
      "user-agent": USER_AGENT,
    },
    signal: AbortSignal.timeout(timeout),
  });
  if (!response.ok) {
    const error = new Error(`${new URL(url).hostname} returned ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function nominatimJson(url) {
  try {
    return await fetchJson(url);
  } catch (error) {
    if (!(error?.status === 429 || error?.status >= 500)) throw error;
    // Public Nominatim requires no more than one request per second.
    await wait(1100);
    return fetchJson(url);
  }
}
function tigerQueryUrl(base, where, outFields, extras = {}) {
  const params = new URLSearchParams({
    f:"json",
    where,
    outFields,
    returnGeometry:"false",
    ...extras,
  });
  return base + "/query?" + params.toString();
}
function censusStateRow(attributes = {}) {
  const code = String(attributes.STUSAB || "").toUpperCase();
  const info = STATE_INFO[code];
  return info ? { code, fips:info[0], name:info[1] } : null;
}
async function censusStateForPoint(latitude, longitude) {
  const url = tigerQueryUrl(
    TIGER_STATES,
    "1=1",
    "STUSAB,STATE,BASENAME",
    {
      geometry: String(longitude) + "," + String(latitude),
      geometryType:"esriGeometryPoint",
      inSR:"4326",
      spatialRel:"esriSpatialRelIntersects",
    }
  );
  const data = await fetchJson(url, 6000);
  if (data?.error) throw new Error("Census TIGERweb state lookup failed");
  return censusStateRow(data?.features?.[0]?.attributes);
}
function censusPlaceRow(attributes = {}, state, type = "city") {
  const latitude = finite(attributes.CENTLAT) ?? finite(attributes.INTPTLAT);
  const longitude = finite(attributes.CENTLON) ?? finite(attributes.INTPTLON);
  const name = String(attributes.BASENAME || "").trim();
  if (!name || latitude == null || longitude == null || !state) return null;
  return {
    lat:String(latitude),
    lon:String(longitude),
    display_name:name + ", " + state.name + ", United States",
    type,
    _provider:"census-tigerweb",
    address:{
      city:name,
      state:state.name,
      "ISO3166-2-lvl4":"US-" + state.code,
      country_code:"us",
    },
  };
}
function censusZipRow(attributes = {}, state, zip) {
  const latitude = finite(attributes.CENTLAT) ?? finite(attributes.INTPTLAT);
  const longitude = finite(attributes.CENTLON) ?? finite(attributes.INTPTLON);
  if (latitude == null || longitude == null || !state) return null;
  return {
    lat:String(latitude),
    lon:String(longitude),
    display_name:zip + ", " + state.name + ", United States",
    type:"postcode",
    _provider:"census-tigerweb",
    address:{
      postcode:zip,
      state:state.name,
      "ISO3166-2-lvl4":"US-" + state.code,
      country_code:"us",
    },
  };
}
async function censusPlaceGeocode(parsed) {
  if (parsed.kind === "place") {
    const where = "STATE='" + parsed.state.fips + "' AND UPPER(BASENAME)=UPPER('" + sqlText(parsed.city) + "')";
    const fields = "BASENAME,NAME,STATE,CENTLAT,CENTLON,INTPTLAT,INTPTLON";
    const settled = await Promise.allSettled([
      fetchJson(tigerQueryUrl(TIGER_PLACES + "/4", where, fields), 6000),
      fetchJson(tigerQueryUrl(TIGER_PLACES + "/5", where, fields), 6000),
    ]);
    for (let i = 0; i < settled.length; i++) {
      const item = settled[i];
      if (item.status !== "fulfilled") continue;
      if (item.value?.error) continue;
      const row = censusPlaceRow(item.value?.features?.[0]?.attributes, parsed.state, i === 0 ? "city" : "administrative");
      if (row) return row;
    }
    if (settled.every((item)=>item.status === "rejected")) throw settled[0].reason;
    return null;
  }
  if (parsed.kind === "zip") {
    const where = "ZCTA5='" + parsed.zip + "'";
    const data = await fetchJson(tigerQueryUrl(TIGER_ZCTA, where, "ZCTA5,CENTLAT,CENTLON,INTPTLAT,INTPTLON"), 6000);
    if (data?.error) throw new Error("Census TIGERweb ZIP lookup failed");
    const attributes = data?.features?.[0]?.attributes;
    const latitude = finite(attributes?.CENTLAT) ?? finite(attributes?.INTPTLAT);
    const longitude = finite(attributes?.CENTLON) ?? finite(attributes?.INTPTLON);
    if (latitude == null || longitude == null) return null;
    const state = await censusStateForPoint(latitude, longitude);
    return censusZipRow(attributes, state, parsed.zip);
  }
  return null;
}
async function nominatimGeocode(query) {
  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    limit: "5",
    countrycodes: "us",
    addressdetails: "1",
  });
  return chooseCandidate(await nominatimJson(`${NOMINATIM_SEARCH}?${params}`));
}
async function geocode(query) {
  const parsed = parseManualQuery(query);
  let censusError = null;
  if (parsed.kind !== "flexible") {
    try {
      const row = await censusPlaceGeocode(parsed);
      if (row) return row;
    } catch (error) {
      censusError = error;
    }
  }
  try {
    return await nominatimGeocode(query);
  } catch (error) {
    if (censusError) {
      throw new Error("Census TIGERweb and OpenStreetMap location services are temporarily unavailable");
    }
    throw error;
  }
}
async function reverseGeocode(latitude, longitude) {
  const params = new URLSearchParams({
    lat: latitude.toFixed(3),
    lon: longitude.toFixed(3),
    format: "jsonv2",
    zoom: "10",
    addressdetails: "1",
  });
  const row = await nominatimJson(`${NOMINATIM_REVERSE}?${params}`);
  return isUsCandidate(row) ? row : null;
}
async function nwsContext(latitude, longitude) {
  try {
    const data = await fetchJson(`${NWS_POINTS}/${latitude.toFixed(3)},${longitude.toFixed(3)}`);
    return {
      timeZone: data?.properties?.timeZone || null,
      forecastOffice: data?.properties?.cwa || null,
      radarStation: data?.properties?.radarStation || null,
      forecastZone: data?.properties?.forecastZone || null,
      county: data?.properties?.county || null,
    };
  } catch {
    return { timeZone: null, forecastOffice: null, radarStation: null, forecastZone: null, county: null };
  }
}
function locationPayload(row, query, coordinates, context = {}, sourceMode = "manual") {
  const address = row?.address || {};
  const provider = row?._provider === "census-tigerweb" ? "census-tigerweb" : "nominatim";
  const latitude = coordinates?.latitude ?? roundCoord(row?.lat);
  const longitude = coordinates?.longitude ?? roundCoord(row?.lon);
  return {
    query: cleanQuery(query || queryLabel(address)),
    displayName: row?.display_name || queryLabel(address),
    place: placeName(address),
    state: address.state || null,
    stateCode: stateCode(address),
    postcode: address.postcode || null,
    latitude,
    longitude,
    timeZone: context.timeZone || null,
    elevation_m: null,
    forecastOffice: context.forecastOffice || null,
    radarStation: context.radarStation || null,
    type: row?.type || null,
    sourceMode,
    coordinate_precision: sourceMode === "device" ? "rounded to 0.001° before lookup" : null,
    geocodeSource: provider === "census-tigerweb" ? "U.S. Census Bureau TIGERweb" : "OpenStreetMap Nominatim",
    attribution: provider === "census-tigerweb"
      ? "Place/ZIP coordinates from the U.S. Census Bureau TIGERweb; timezone context from the National Weather Service."
      : "Geocoding © OpenStreetMap contributors via Nominatim; timezone context from the National Weather Service.",
    retrieved_at: new Date().toISOString(),
  };
}
function bodyObject(req) {
  if (req?.body && typeof req.body === "object") return req.body;
  if (typeof req?.body === "string") {
    try { return JSON.parse(req.body); } catch {}
  }
  return {};
}

module.exports = async function handler(req, res) {
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  const method = String(req.method || "GET").toUpperCase();
  if (!["GET", "HEAD", "POST"].includes(method)) {
    res.setHeader("Allow", "GET, HEAD, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (method === "POST") {
      res.setHeader("Cache-Control", "no-store");
      const body = bodyObject(req);
      const coordinates = validCoordinates(body.latitude, body.longitude);
      if (!coordinates) return res.status(400).json({ error: "Valid U.S. coordinates are required" });

      const row = await reverseGeocode(coordinates.latitude, coordinates.longitude);
      if (!row) return res.status(404).json({ error: "Current location was not found in the United States" });

      const context = await nwsContext(coordinates.latitude, coordinates.longitude);
      return res.status(200).json(locationPayload(row, queryLabel(row.address), coordinates, context, "device"));
    }

    res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
    const q = cleanQuery(req.query?.q);
    if (q.length < 2) return res.status(400).json({ error: "Enter a U.S. city or ZIP code" });

    const row = await geocode(q);
    if (!row) return res.status(404).json({ error: "Location not found in the United States" });

    const coordinates = validCoordinates(row.lat, row.lon);
    const context = coordinates ? await nwsContext(coordinates.latitude, coordinates.longitude) : {};
    return res.status(200).json(locationPayload(row, q, coordinates, context, "manual"));
  } catch (error) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(502).json({
      error: "Location lookup unavailable",
      detail: String(error?.message || error),
    });
  }
};

module.exports._test = {
  bodyObject,
  censusPlaceGeocode,
  censusPlaceRow,
  censusStateRow,
  censusZipRow,
  chooseCandidate,
  cleanQuery,
  finite,
  isUsCandidate,
  locationPayload,
  parseManualQuery,
  placeName,
  queryLabel,
  roundCoord,
  stateCode,
  stateInfo,
  tigerQueryUrl,
  validCoordinates,
};
