#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const publicDir=path.join(root,'public');
const owner='https://national-outdoor-core.vercel.app';
const pages=JSON.parse(fs.readFileSync(path.join(root,'config','breakout-live-pages.json'),'utf8'));
for (const [id, page] of Object.entries(pages)) {
  if (!page.description || page.description.length > 158) throw new Error(`${id}: description must be 1–158 characters`);
}
const geography=JSON.parse(fs.readFileSync(path.join(root,'config','breakout-live-geography.json'),'utf8'));
const portfolio=JSON.parse(fs.readFileSync(path.join(root,'benchmarks','breakout-live-portfolio.json'),'utf8'));
const candidates=new Map(portfolio.candidates.map(x=>[x.id,x]));
const dateModified=portfolio.date || new Date().toISOString().slice(0,10);
const esc=(v='')=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');

function nameOf(p){return p.title.replace(/ \| Chris Izworski$/,'');}
function regionFor(id){return geography.regions.find(r=>r.toolIds.includes(id));}
function related(current){
  const region=regionFor(current);
  const same=(region?.toolIds||[]).filter(id=>id!==current);
  const rest=Object.keys(pages).filter(id=>id!==current&&!same.includes(id));
  return [...same,...rest].slice(0,4).map(id=>`<a href="/national-tools/${id}/">${esc(nameOf(pages[id]))}</a>`).join('');
}
function attribution(p){
  if(!p.attribution) return '';
  const a=p.attribution;
  return `<p class="attribution">Contains information from <a href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.name)}</a>, made available under the <a href="${esc(a.licenseUrl)}" target="_blank" rel="noopener">${esc(a.license)}</a>.</p>`;
}
function jsonLd(id,p){
  const url=`https://chrisizworski.com/national-tools/${id}/`, name=nameOf(p);
  return JSON.stringify({'@context':'https://schema.org','@graph':[
    {'@type':'WebSite','@id':'https://chrisizworski.com/#website','url':'https://chrisizworski.com/','name':'Chris Izworski','publisher':{'@id':'https://chrisizworski.com/#person'}},
    {'@type':'Person','@id':'https://chrisizworski.com/#person','name':'Chris Izworski','url':'https://chrisizworski.com/'},
    {'@type':'WebApplication','@id':`${url}#app`,'name':name,'applicationCategory':'TravelApplication','operatingSystem':'Any','url':url,'description':p.description,'author':{'@id':'https://chrisizworski.com/#person'}},
    {'@type':'WebPage','@id':`${url}#page`,'url':url,'name':name,'isPartOf':{'@id':'https://chrisizworski.com/#website'},'mainEntity':{'@id':`${url}#app`},'author':{'@id':'https://chrisizworski.com/#person'},'dateModified':id==='tioga-road-status'?'2026-10-19':dateModified,'inLanguage':'en-US'}
  ]}).replace(/</g,'\\u003c');
}
function hubJsonLd(){
  const url='https://chrisizworski.com/national-tools/live-decisions/';
  const items=geography.regions.flatMap(r=>r.toolIds).map((id,i)=>({'@type':'ListItem','position':i+1,'url':`https://chrisizworski.com/national-tools/${id}/`,'name':candidates.get(id)?.name||nameOf(pages[id])}));
  return JSON.stringify({'@context':'https://schema.org','@graph':[
    {'@type':'Person','@id':'https://chrisizworski.com/#person','name':'Chris Izworski','url':'https://chrisizworski.com/'},
    {'@type':'CollectionPage','@id':`${url}#page`,'url':url,'name':'Live Destination Decisions','description':'Destination-specific live decision tools grouped by U.S. geography, using current official-source evidence to show what conditions change in the trip.','author':{'@id':'https://chrisizworski.com/#person'},'dateModified':dateModified,'mainEntity':{'@id':`${url}#list`}},
    {'@type':'BreadcrumbList','@id':`${url}#breadcrumb`,'itemListElement':[{'@type':'ListItem','position':1,'name':'Home','item':'https://chrisizworski.com/'},{'@type':'ListItem','position':2,'name':'National tools','item':'https://chrisizworski.com/national-tools/'},{'@type':'ListItem','position':3,'name':'Live destination decisions','item':url}]},
    {'@type':'ItemList','@id':`${url}#list`,'name':'Live Destination Decisions by Region','numberOfItems':items.length,'itemListElement':items}
  ]}).replace(/</g,'\\u003c');
}
function page(id,p){
  const url=`https://chrisizworski.com/national-tools/${id}/`, name=nameOf(p);
  const region=regionFor(id);
  const tiogaSocial=id==='tioga-road-status'?'<meta property="og:image" content="https://upload.wikimedia.org/wikipedia/commons/7/73/Tioga_Road-Big_Oak_Flat_Road_-_Tioga_Road_in_Yosemite_National_Park_-_NARA_-_7722409.jpg">':'';
  const tiogaImage=id==='tioga-road-status'?'<figure class="tioga-hero-media"><img src="https://upload.wikimedia.org/wikipedia/commons/7/73/Tioga_Road-Big_Oak_Flat_Road_-_Tioga_Road_in_Yosemite_National_Park_-_NARA_-_7722409.jpg" alt="Tioga Road curves around granite slopes at Olmsted Point, with Tenaya Lake and Sierra Nevada peaks beyond" width="1280" height="853" decoding="async" fetchpriority="high"><figcaption>Tioga Road at Olmsted Point · Photograph: Neil Li / Federal Highway Administration, via National Archives · <a href="https://commons.wikimedia.org/wiki/File:Tioga_Road-Big_Oak_Flat_Road_-_Tioga_Road_in_Yosemite_National_Park_-_NARA_-_7722409.jpg" rel="noopener" target="_blank">Public-domain source ↗</a></figcaption></figure>':'';
  const tiogaWorkbench=id==='tioga-road-status'?`<section class="tioga-workbench panel" id="tiogaWorkbench" aria-labelledby="tiogaWorkbenchTitle">
  <div class="tioga-intro"><div><p class="eyebrow">Make the drive decision</p><h2 id="tiogaWorkbenchTitle">Which Tioga Road trip are you making?</h2><p>A park road being open is not an all-clear for both approaches. Select your drive to see the distinct checks that matter.</p></div><span class="tioga-method">NPS park segment + Caltrans Highway 120</span></div>
  <label class="tioga-picker" for="tiogaTrip">Your planned drive</label>
  <select id="tiogaTrip" class="tioga-select"><option value="through">Cross the Sierra: Groveland → Lee Vining</option><option value="valley">Yosemite Valley → Tuolumne Meadows</option><option value="east">Lee Vining → Tuolumne Meadows</option></select>
  <div class="tioga-corridor" role="img" aria-label="Route sequence: western approach, Tioga Road inside Yosemite, eastern Highway 120 approach"><div class="tioga-node"><span>01</span><strong>West approach</strong><small>Big Oak Flat / CA 120</small><b id="tiogaWest">Checking…</b></div><div class="tioga-line" aria-hidden="true"></div><div class="tioga-node tioga-center"><span>02</span><strong>Tioga Road</strong><small>Through Yosemite</small><b id="tiogaPark">Checking…</b></div><div class="tioga-line" aria-hidden="true"></div><div class="tioga-node"><span>03</span><strong>East approach</strong><small>CA 120 · Lee Vining</small><b id="tiogaEast">Checking…</b></div></div>
  <div id="tiogaRouteResult" class="tioga-result" aria-live="polite">Checking the NPS and Caltrans sources. No route is assumed open.</div>
  <div class="tioga-alerts"><article><strong>Current road notes</strong><p id="tiogaRoadNote">Loading NPS notes…</p></article><article><strong>Overnight and seasonal access</strong><p id="tiogaParking">Check NPS parking rules before departing.</p></article></div>
  <div class="tioga-source-actions"><a target="_blank" rel="noopener" href="https://www.nps.gov/yose/planyourvisit/conditions.htm">NPS Yosemite road status ↗</a><a target="_blank" rel="noopener" href="https://roads.dot.ca.gov/?roadnumber=120">Caltrans Highway 120 ↗</a><a target="_blank" rel="noopener" href="https://quickmap.dot.ca.gov/">Caltrans QuickMap ↗</a><a href="tel:12093720200">Call Yosemite road line · 209-372-0200</a></div><p class="tioga-disclaimer">NPS describes its web status as planned or long-term closures; use the Yosemite road phone menu (1, then 1) for the most up-to-date conditions. Caltrans reports may contain sections outside your specific approach.</p>
</section>`:'';
  const rampBox=id==='lake-powell-ramp-status'?'<div id="ramps" class="ramps" aria-live="polite"></div>':'';
  return `<!doctype html><html lang="en-US"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(p.title)}</title><meta name="description" content="${esc(p.description)}"><link rel="canonical" href="${url}"><meta name="robots" content="index,follow,max-image-preview:large">
${tiogaSocial}<meta property="og:type" content="website"><meta property="og:title" content="${esc(name)}"><meta property="og:description" content="${esc(p.description)}"><meta property="og:url" content="${url}"><meta name="twitter:card" content="${id==='tioga-road-status'?'summary_large_image':'summary'}"><meta name="twitter:title" content="${esc(name)}"><meta name="twitter:description" content="${esc(p.description)}">
<link rel="stylesheet" href="${owner}/assets/breakout-live.css"><script type="application/ld+json">${jsonLd(id,p)}</script><script defer src="/_vercel/insights/script.js"></script><script>window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments)};</script><script defer src="${owner}/assets/breakout-live.js"></script></head>
<body data-tool-id="${id}"><header class="site-header"><a class="brand" href="/">Chris Izworski</a><nav class="nav"><a href="/tools/">Tools</a><a href="/national-tools/">National tools</a><a href="/national-tools/live-decisions/">Live destinations</a></nav></header><main class="wrap">
<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/national-tools/">National tools</a> / ${region?`${esc(region.name)} / `:''}${esc(name)}</nav>
<section class="hero"><p class="eyebrow">Live destination decision${region?` · ${esc(region.name)}`:''}</p><h1>${esc(p.h1)}</h1><p class="lede">${esc(p.lede)}</p></section>
${tiogaImage}<section class="live-card" aria-labelledby="liveStatus"><div class="live-row"><div><p class="eyebrow">Current decision</p><h2 class="status" id="liveStatus">Checking live source…</h2><p class="headline" id="liveHeadline">This page will not invent a current answer if the source fails.</p></div><button class="refresh" id="refreshLive" type="button">Refresh live data</button></div><div class="facts" id="liveFacts"></div><p class="fresh" id="liveFresh">Connecting to the source…</p><div class="error" id="liveError" hidden></div></section>
${tiogaWorkbench}<section class="grid"><article class="panel"><p class="eyebrow">The decision</p><h2>${esc(p.decisionTitle)}</h2><p>${esc(p.decisionBody)}</p><ul class="decision-list">${p.bullets.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>${rampBox}</article><aside class="panel sourcebox"><p class="eyebrow">Source-first</p><h2>${esc(p.sourceTitle)}</h2><p>${esc(p.sourceBody)}</p>${attribution(p)}<div class="source-excerpt" id="sourceExcerpt">Live source text will appear after refresh.</div><a class="source-link" id="sourceLink" href="${esc(p.sourceLink)}" rel="noopener" target="_blank">${esc(p.sourceLinkLabel)}</a></aside></section>
<section class="panel"><p class="eyebrow">How to use this result</p><h2>Make the decision from the status, freshness and evidence together</h2><p>Start with the current decision and the trip consequence above it, then check the timestamp and source excerpt. A favorable condition is not a blanket all-clear. If the tool returns VERIFY or LIVE SOURCE UNAVAILABLE, open the official source instead of treating an old reading as current. Recheck close to departure because roads, alerts, water levels and mountain weather can change after you first plan the trip.</p></section>
<section class="network"><p class="eyebrow">Nearby in the network</p><h2>${region?`More ${esc(region.name)} decisions`:'More live destination decisions'}</h2><div class="network-grid">${related(id)}</div><p class="disclaimer">These tools summarize live public-source information for trip planning. Official closures, warnings, permits and on-site instructions control.</p></section></main><footer><div class="wrap">© ${dateModified.slice(0,4)} Chris Izworski · <a href="/about/">About</a> · <a href="/tools/">Tools</a></div></footer></body></html>`;
}
function hub(){
  const url='https://chrisizworski.com/national-tools/live-decisions/';
  const groups=geography.regions.map(r=>{
    const cards=r.toolIds.map(id=>{const c=candidates.get(id)||{};const meta=geography.tools[id]||{};return `<a class="decision-link-card" href="/national-tools/${id}/"><span>${esc(meta.place||r.name)}</span><strong>${esc(c.name||nameOf(pages[id]))}</strong><small>${esc(c.primaryDecision||pages[id]?.h1||'Open the live decision')}</small></a>`;}).join('');
    return `<section class="decision-region"><div class="decision-region-head"><p class="eyebrow">${esc(r.name)}</p><h2>${esc(r.description)}</h2></div><div class="decision-link-grid">${cards}</div></section>`;
  }).join('');
  return `<!doctype html><html lang="en-US"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Live Destination Decisions | Chris Izworski</title><meta name="description" content="Choose a U.S. region, then open the destination-specific live tool for road access, river conditions, sunrise weather or boat-ramp availability."><link rel="canonical" href="${url}"><meta name="robots" content="index,follow,max-image-preview:large"><meta property="og:type" content="website"><meta property="og:title" content="Live Destination Decisions"><meta property="og:description" content="Destination-specific current conditions grouped by geography, with official evidence and truthful degraded states."><meta property="og:url" content="${url}"><meta name="twitter:card" content="summary"><meta name="twitter:title" content="Live Destination Decisions"><meta name="twitter:description" content="Destination-specific current conditions grouped by geography, with official evidence and truthful degraded states."><link rel="stylesheet" href="${owner}/assets/breakout-live.css"><script type="application/ld+json">${hubJsonLd()}</script><script defer src="/_vercel/insights/script.js"></script></head><body><header class="site-header"><a class="brand" href="/">Chris Izworski</a><nav class="nav"><a href="/tools/">Tools</a><a href="/national-tools/">National tools</a></nav></header><main class="wrap"><nav class="crumbs"><a href="/">Home</a> / <a href="/national-tools/">National tools</a> / Live destination decisions</nav><section class="hero"><p class="eyebrow">Destination decision network</p><h1>Start with where you're going.</h1><p class="lede">These are not one national utility. They are place-specific tools across the U.S. Choose the region and destination first, then use current road, river, weather or water-access evidence to decide what changes in the trip.</p></section><section class="destination-map-note panel"><p class="eyebrow">How this is organized</p><h2>Geography first. Decision second.</h2><p>Southwest reservoir access should not sit beside a Maine sunrise as though they are the same product. Each destination lives in its natural regional collection; this page simply gives you one cross-region index when you know the place but not the exact tool.</p></section>${groups}<section class="panel"><p class="eyebrow">Decision standard</p><h2>Current answer → trip consequence → flip conditions → official evidence</h2><p>The useful product is not the raw road status, river gauge or lake elevation. It is the reduction in uncertainty between seeing that signal and deciding what to do. Every tool should expose freshness, explain the consequence for the trip, identify what can invalidate the answer, and degrade to VERIFY or LIVE SOURCE UNAVAILABLE rather than manufacture certainty.</p></section></main><footer><div class="wrap">© ${dateModified.slice(0,4)} Chris Izworski</div></footer></body></html>`;
}
for(const [id,p] of Object.entries(pages)){const dir=path.join(publicDir,'national-tools',id);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'index.html'),page(id,p));}
const hubDir=path.join(publicDir,'national-tools','live-decisions');fs.mkdirSync(hubDir,{recursive:true});fs.writeFileSync(path.join(hubDir,'index.html'),hub());
console.log(`Generated ${Object.keys(pages).length} breakout live pages + geographic hub.`);
