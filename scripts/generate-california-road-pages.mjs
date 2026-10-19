#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const origin='https://chrisizworski.com',owner='https://national-outdoor-core.vercel.app';
const modified='2026-10-19';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pages=[
 {slug:'big-sur-highway-1',kind:'coast',title:'Big Sur Highway 1 Closures & Drive Planner | Chris Izworski',
 description:'Compare Big Sur Highway 1 closures by origin, destination and travel day. Check official Caltrans work zones, restrictions and mapped coastal stops.',
 heading:'Can I drive Highway 1 through Big Sur today?',
 lede:'Bixby Bridge, McWay Falls, the cliff road and Cambria form one of America’s great coastal journeys. But a closure near Lucia can divide the trip. Check official road notes and choose the piece of Highway 1 you actually intend to drive.',
 kicker:'Coastal drive · Monterey to San Luis Obispo County',
 image:'https://commons.wikimedia.org/wiki/Special:FilePath/Bixby_Creek_Bridge%2C_California%2C_USA_-_May_2013.jpg?width=1400',
 caption:'Bixby Creek Bridge on Highway 1 · Photo by Diliff, CC BY-SA 3.0',imagePage:'https://commons.wikimedia.org/wiki/File:Bixby_Creek_Bridge,_California,_USA_-_May_2013.jpg',license:'https://creativecommons.org/licenses/by-sa/3.0/',
 pick:'Which part of Big Sur do you want to drive?',
 interpretation:'Highway 1 is not an interstate. It follows a narrow coastal slope where winter storms, landslides, fires and bridge work can change the journey with little notice. An open road can still have single-lane controls. If the through-drive is interrupted, plan a same-side visit instead of following a map app onto unsuitable mountain backroads.',
 flip:'A new overnight work window, falling rock, washout, fire activity or emergency traffic control can supersede an earlier Caltrans report. Some park access restrictions apply even when the highway is open.',
 sources:[['Caltrans Highway 1 report','https://roads.dot.ca.gov/?roadnumber=1'],['Caltrans QuickMap live road map','https://quickmap.dot.ca.gov/'],['CHP incident reports','https://cad.chp.ca.gov/']]},
 {slug:'sierra-pass-status',kind:'sierra',title:'Sierra Nevada Pass Status & Crossing Planner | Chris Izworski',
 description:'Compare Sierra Nevada pass conditions for Sonora, Ebbetts, Carson, Monitor, Tioga, Echo Summit and Donner using official Caltrans road reports.',
 heading:'Which Sierra Nevada mountain passes can I cross?',
 lede:'The difference between Sonora Pass, Carson Pass and Donner Summit is more than elevation. Some summit roads close seasonally; others stay vital all winter but require chains or close temporarily. Explore the real crossing choices before committing to the drive.',
 kicker:'Mountain road access · California Sierra Nevada',
 image:'https://upload.wikimedia.org/wikipedia/commons/2/2a/Sonora_pass_sunset_2.jpg',
 caption:'Sunset over Sonora Pass, CA-108 · Photo by A Silly Person, CC BY-SA 2.0',imagePage:'https://commons.wikimedia.org/wiki/File:Sonora_pass_sunset_2.jpg',license:'https://creativecommons.org/licenses/by-sa/2.0/',
 pick:'Compare the actual passes, not a generic mountain forecast',
 interpretation:'A Caltrans message saying “no restrictions” is not a guarantee that a seasonal pass gate is open. For Yosemite, NPS controls the park crossing. For the other high passes, verify the exact summit closure on Caltrans QuickMap before leaving the last convenient town. Do not treat US-50 or I-80 as interchangeable scenic detours.',
 flip:'Early winter snow, rockfall, seasonal gate operations, chain requirements and incident response can change the pass choice quickly. Vehicle length and grade matter on narrow alpine routes.',
 sources:[['Caltrans QuickMap road controls','https://quickmap.dot.ca.gov/'],['Caltrans Highway Reports','https://roads.dot.ca.gov/'],['Yosemite Tioga Road planner',origin+'/national-tools/tioga-road-status/']]}
];
function schema(p){
 const u=origin+'/national-tools/'+p.slug+'/';
 return JSON.stringify({'@context':'https://schema.org','@graph':[
 {'@type':'WebSite','@id':origin+'/#website','url':origin+'/','name':'Chris Izworski','publisher':{'@id':origin+'/#person'}},
 {'@type':'Person','@id':origin+'/#person','name':'Chris Izworski','url':origin+'/'},
 {'@type':'WebApplication','@id':u+'#app','name':p.title.split(' | ')[0],'url':u,'applicationCategory':'TravelApplication','operatingSystem':'Any','isAccessibleForFree':true,'description':p.description,'author':{'@id':origin+'/#person'}},
 {'@type':'WebPage','@id':u+'#page','url':u,'name':p.heading,'dateModified':modified,'inLanguage':'en-US','mainEntity':{'@id':u+'#app'},'author':{'@id':origin+'/#person'},'isPartOf':{'@id':origin+'/#website'}},
 {'@type':'BreadcrumbList','itemListElement':[{'@type':'ListItem','position':1,'name':'Home','item':origin+'/'},{'@type':'ListItem','position':2,'name':'National Tools','item':origin+'/national-tools/'},{'@type':'ListItem','position':3,'name':p.title.split(' | ')[0],'item':u}]}
 ]}).replace(/</g,'\\u003c');
}
function page(p){
 const u=origin+'/national-tools/'+p.slug+'/';
 const coast=p.kind==='coast';
 const controls=coast?'<div class="picker"><label for="tripPicker">Suggested itinerary</label><select id="tripPicker"><option>Loading route options…</option></select></div><div class="road-controls"><div class="picker"><label for="coastFrom">Start from</label><select id="coastFrom" aria-label="Coastal drive origin"></select></div><div class="picker"><label for="coastTo">Drive toward</label><select id="coastTo" aria-label="Coastal drive destination"></select></div><div class="picker"><label for="travelDate">Travel day (Pacific time)</label><select id="travelDate" aria-label="Travel day"></select></div></div><div id="dayWindow" class="road-days" aria-label="Compare next seven days"></div><div id="routeVerdict" class="verdict" aria-live="polite"><h3>Checking Caltrans...</h3></div><p id="routeType" class="fine"></p><div id="routeEvidence" class="notes" aria-live="polite"></div><div class="section-head"><div><h2>Coastal stops in your trip</h2><p>Select a stop to highlight it on the map.</p></div></div><div id="stopList" class="stop-list"></div><div id="reachableResult" class="interpretive" aria-live="polite"></div>':
 '<p class="fine">Passes are geographic comparison points. Highway status does not guarantee the entire through-route or that winter chains will not be required later.</p><div id="passList" class="pass-list"></div><div id="chainSummary" class="fine" aria-live="polite"></div><div id="passDetail" aria-live="polite"></div>';
 const side=coast?'<h3>Official Highway 1 notices (which may extend beyond your selected stretch)</h3><div id="workNotes" class="notes"><article>Checking Highway 1…</article></div>':'<h3>What counts as an open crossing?</h3><p>All the relevant gates must agree: Caltrans road notices, the actual seasonal summit gate, chain controls, and (for Tioga Road) the National Park Service. An empty restrictions report only answers one of those questions.</p>';
 const links=p.sources.map(x=>'<a href="'+esc(x[1])+'" target="_blank" rel="noopener noreferrer">'+esc(x[0])+' ↗</a>').join('');
 const related=coast?'<a href="/national-tools/sierra-pass-status/">Explore Sierra mountain passes →</a><a href="/national-tools/tioga-road-status/">Check Tioga Road →</a>':
 '<a href="/national-tools/big-sur-highway-1/">Plan the Big Sur coast →</a><a href="/national-tools/tioga-road-status/">Open dedicated Tioga planner →</a>';
 return '<!doctype html><html lang="en"><head>'+
 '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
 '<title>'+esc(p.title)+'</title><meta name="description" content="'+esc(p.description)+'"><link rel="canonical" href="'+u+'"><meta name="robots" content="index,follow,max-image-preview:large">'+
 '<meta property="og:type" content="website"><meta property="og:title" content="'+esc(p.title.split(' | ')[0])+'"><meta property="og:description" content="'+esc(p.description)+'"><meta property="og:url" content="'+u+'"><meta property="og:image" content="'+esc(p.image)+'">'+
 '<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="'+esc(p.title.split(' | ')[0])+'"><meta name="twitter:description" content="'+esc(p.description)+'">'+
 '<script type="application/ld+json">'+schema(p)+'</script>'+
 '<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin="">'+
 '<link rel="stylesheet" href="'+owner+'/assets/california-roads.css">'+
 '<script defer src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>'+
 '<script defer src="'+owner+'/assets/california-roads.js"></script></head>'+
 '<body data-california-road="'+p.kind+'"><header class="top"><a href="/">Chris Izworski</a><nav aria-label="Primary"><a href="/tools/">Tools</a><a href="/national-tools/">National Tools</a><a href="/national-tools/tioga-road-status/">Tioga Road</a></nav></header>'+
 '<main class="wrap"><nav class="crumb" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/national-tools/">National Tools</a> / '+esc(p.title.split(' | ')[0])+'</nav>'+
 '<section class="hero"><div class="intro"><span class="eyebrow">'+esc(p.kicker)+'</span><h1>'+esc(p.heading)+'</h1><p class="lede">'+esc(p.lede)+'</p></div>'+
 '<figure class="hero-photo"><img src="'+esc(p.image)+'" alt="'+esc(coast?'The Pacific coast at Bixby Creek Bridge in Big Sur':'An alpine roadway curving through Sonora Pass at sunset')+'" fetchpriority="high" decoding="async"><figcaption>'+esc(p.caption)+' · <a target="_blank" rel="noopener" href="'+esc(p.imagePage)+'">Photo source</a> · <a target="_blank" rel="noopener" href="'+esc(p.license)+'">License</a></figcaption></figure></section>'+
 '<section class="panel status-layout" aria-label="Official conditions summary"><div><p class="eyebrow">Official reports and trip consequence</p><h2 class="status-big" id="liveState" aria-live="polite">Checking Caltrans…</h2><p id="liveHeadline">Loading official roadway reports, not guessing from a seasonal calendar.</p><p class="source-metadata" id="liveFresh">Connecting to the source.</p><p id="loadError" class="fine" hidden></p></div><div class="status-actions"><button id="refreshReports" type="button" class="button">Refresh official report</button><a class="button" target="_blank" rel="noopener" href="https://quickmap.dot.ca.gov/">Open Caltrans QuickMap ↗</a><p class="fine">Caltrans highway line: <a href="tel:18004277623">1-800-427-7623</a></p></div></section>'+
 '<div class="section-head"><div><p class="eyebrow">Interactive decision engine</p><h2>'+esc(p.pick)+'</h2><p>Tap a route or place, inspect its evidence, and verify unresolved segments before departure.</p></div></div>'+
 '<div class="tool-grid"><section class="panel">'+controls+'</section>'+
 '<aside class="panel sticky-map"><div class="map-head"><h3>Explore the road corridor</h3><button type="button" class="button" id="myLocation">My location</button></div><div id="californiaMap" class="map" role="region" aria-label="Interactive California roadway map"></div><p id="mapFallback" class="map-fallback" hidden>Map tiles are unavailable. The trip stops and road sources remain usable.</p><div class="map-foot">CARTO / OpenStreetMap basemap. Lines are schematic connections, not routable directions. <span id="locationNote">Location is optional and never stored.</span></div></aside></div>'+
 '<section class="panel"><div class="section-head"><div><p class="eyebrow">Why the journey changes</p><h2>Read the landscape, not just the road badge</h2></div></div><div class="interpretive"><p>'+esc(p.interpretation)+'</p><p><strong>What can change the plan:</strong> '+esc(p.flip)+'</p></div><div class="section-head"><div><h2>Evidence you can check yourself</h2></div></div>'+side+'<div class="source-links">'+links+'</div></section>'+
 '<section class="panel"><h2>Other California road planners</h2><div class="crosslinks">'+related+'</div><p class="fine">These tools summarize official public information for trip planning, not navigation, emergency instructions, or proof of safe passage. Obey posted signs and temporary closures. Built by <a href="/chris-izworski/">Chris Izworski</a>.</p></section>'+
 '</main><footer class="footer"><div class="wrap">© 2026 Chris Izworski · <a href="/chris-izworski/">Built by Chris Izworski</a> · <a href="/privacy/">Privacy</a></div></footer></body></html>';
}
for(const p of pages){
 if(p.description.length>158)throw Error(p.slug+' meta description too long');
 const dir=path.join(root,'public','national-tools',p.slug);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'index.html'),page(p));
}
console.log('Generated '+pages.length+' California route decision pages.');
