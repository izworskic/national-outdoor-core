#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const publicDir=path.join(root,'public');
const owner='https://national-outdoor-core.vercel.app';
const pages=JSON.parse(fs.readFileSync(path.join(root,'config','breakout-live-pages.json'),'utf8'));
const portfolio=JSON.parse(fs.readFileSync(path.join(root,'benchmarks','breakout-live-portfolio.json'),'utf8'));
const dateModified=portfolio.date || new Date().toISOString().slice(0,10);
const esc=(v='')=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');

function nameOf(p){return p.title.replace(/ \| Chris Izworski$/,'');}
function related(current){return Object.keys(pages).filter(id=>id!==current).slice(0,4).map(id=>`<a href="/national-tools/${id}/">${esc(nameOf(pages[id]))}</a>`).join('');}
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
    {'@type':'WebPage','@id':`${url}#page`,'url':url,'name':name,'isPartOf':{'@id':'https://chrisizworski.com/#website'},'mainEntity':{'@id':`${url}#app`},'author':{'@id':'https://chrisizworski.com/#person'},'dateModified':dateModified,'inLanguage':'en-US'}
  ]}).replace(/</g,'\\u003c');
}
function hubJsonLd(){
  const url='https://chrisizworski.com/national-tools/live-decisions/';
  const items=portfolio.candidates.map((c,i)=>({'@type':'ListItem','position':i+1,'url':`https://chrisizworski.com/national-tools/${c.id}/`,'name':c.name}));
  return JSON.stringify({'@context':'https://schema.org','@graph':[
    {'@type':'Person','@id':'https://chrisizworski.com/#person','name':'Chris Izworski','url':'https://chrisizworski.com/'},
    {'@type':'CollectionPage','@id':`${url}#page`,'url':url,'name':'Live National Trip Decisions','description':'Ten live decision tools for famous U.S. outdoor destinations: road status, river conditions, sunrise weather and boat-ramp access.','author':{'@id':'https://chrisizworski.com/#person'},'dateModified':dateModified,'mainEntity':{'@id':`${url}#list`}},
    {'@type':'BreadcrumbList','@id':`${url}#breadcrumb`,'itemListElement':[{'@type':'ListItem','position':1,'name':'Home','item':'https://chrisizworski.com/'},{'@type':'ListItem','position':2,'name':'National tools','item':'https://chrisizworski.com/national-tools/'},{'@type':'ListItem','position':3,'name':'Live decisions','item':url}]},
    {'@type':'ItemList','@id':`${url}#list`,'name':'Live National Trip Decisions','numberOfItems':items.length,'itemListElement':items}
  ]}).replace(/</g,'\\u003c');
}
function page(id,p){
  const url=`https://chrisizworski.com/national-tools/${id}/`, name=nameOf(p);
  const rampBox=id==='lake-powell-ramp-status'?'<div id="ramps" class="ramps" aria-live="polite"></div>':'';
  return `<!doctype html><html lang="en-US"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(p.title)}</title><meta name="description" content="${esc(p.description)}"><link rel="canonical" href="${url}"><meta name="robots" content="index,follow,max-image-preview:large">
<meta property="og:type" content="website"><meta property="og:title" content="${esc(name)}"><meta property="og:description" content="${esc(p.description)}"><meta property="og:url" content="${url}"><meta name="twitter:card" content="summary"><meta name="twitter:title" content="${esc(name)}"><meta name="twitter:description" content="${esc(p.description)}">
<link rel="stylesheet" href="${owner}/assets/breakout-live.css"><script type="application/ld+json">${jsonLd(id,p)}</script><script defer src="/_vercel/insights/script.js"></script><script>window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments)};</script><script defer src="${owner}/assets/breakout-live.js"></script></head>
<body data-tool-id="${id}"><header class="site-header"><a class="brand" href="/">Chris Izworski</a><nav class="nav"><a href="/tools/">Tools</a><a href="/national-tools/">National tools</a><a href="/national-tools/live-decisions/">Live decisions</a></nav></header><main class="wrap">
<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/national-tools/">National tools</a> / ${esc(name)}</nav>
<section class="hero"><p class="eyebrow">Live national decision tool</p><h1>${esc(p.h1)}</h1><p class="lede">${esc(p.lede)}</p></section>
<section class="live-card" aria-labelledby="liveStatus"><div class="live-row"><div><p class="eyebrow">Current decision</p><h2 class="status" id="liveStatus">Checking live source…</h2><p class="headline" id="liveHeadline">This page will not invent a current answer if the source fails.</p></div><button class="refresh" id="refreshLive" type="button">Refresh live data</button></div><div class="facts" id="liveFacts"></div><p class="fresh" id="liveFresh">Connecting to the source…</p><div class="error" id="liveError" hidden></div></section>
<section class="grid"><article class="panel"><p class="eyebrow">The decision</p><h2>${esc(p.decisionTitle)}</h2><p>${esc(p.decisionBody)}</p><ul class="decision-list">${p.bullets.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>${rampBox}</article><aside class="panel sourcebox"><p class="eyebrow">Source-first</p><h2>${esc(p.sourceTitle)}</h2><p>${esc(p.sourceBody)}</p>${attribution(p)}<div class="source-excerpt" id="sourceExcerpt">Live source text will appear after refresh.</div><a class="source-link" id="sourceLink" href="${esc(p.sourceLink)}" rel="noopener" target="_blank">${esc(p.sourceLinkLabel)}</a></aside></section>
<section class="panel"><p class="eyebrow">How to use this result</p><h2>Make the decision from the status, freshness and evidence together</h2><p>Start with the current decision, then check the timestamp and source excerpt before changing a route, reservation or departure time. A green-looking condition is only useful when the underlying source is current. If the tool returns VERIFY or LIVE SOURCE UNAVAILABLE, open the official source instead of treating an old reading as an all-clear. Recheck close to departure because roads, alerts, water levels and mountain weather can change after you first plan the trip.</p></section>
<section class="network"><p class="eyebrow">More live trip decisions</p><h2>Do the next check before you commit the drive</h2><div class="network-grid">${related(id)}</div><p class="disclaimer">These tools summarize live public-source information for trip planning. Official closures, warnings, permits and on-site instructions control.</p></section></main><footer><div class="wrap">© ${dateModified.slice(0,4)} Chris Izworski · <a href="/about/">About</a> · <a href="/tools/">Tools</a></div></footer></body></html>`;
}
function hub(){
  const url='https://chrisizworski.com/national-tools/live-decisions/';
  const cards=portfolio.candidates.map(c=>`<a class="decision-link-card" href="/national-tools/${c.id}/"><span>${esc(c.name)}</span><strong>${esc(c.primaryDecision)}</strong><small>${esc((c.sources||[]).join(' · '))}</small></a>`).join('');
  return `<!doctype html><html lang="en-US"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Live National Trip Decisions | Chris Izworski</title><meta name="description" content="Ten live decision tools for famous U.S. outdoor destinations: road status, river conditions, sunrise weather and boat-ramp access."><link rel="canonical" href="${url}"><meta name="robots" content="index,follow,max-image-preview:large"><meta property="og:type" content="website"><meta property="og:title" content="Live National Trip Decisions"><meta property="og:description" content="Current trip decisions from public-source data, not generic destination guides."><meta property="og:url" content="${url}"><meta name="twitter:card" content="summary"><meta name="twitter:title" content="Live National Trip Decisions"><meta name="twitter:description" content="Current trip decisions from public-source data, not generic destination guides."><link rel="stylesheet" href="${owner}/assets/breakout-live.css"><script type="application/ld+json">${hubJsonLd()}</script><script defer src="/_vercel/insights/script.js"></script></head><body><header class="site-header"><a class="brand" href="/">Chris Izworski</a><nav class="nav"><a href="/tools/">Tools</a><a href="/national-tools/">National tools</a></nav></header><main class="wrap"><nav class="crumbs"><a href="/">Home</a> / <a href="/national-tools/">National tools</a> / Live decisions</nav><section class="hero"><p class="eyebrow">National decision network</p><h1>Live answers for trips that can change today</h1><p class="lede">Roads close. Rivers rise. Lake levels move. Clouds ruin a sunrise. These tools answer the decision people actually have before they commit the drive.</p></section><section class="network"><p class="eyebrow">Ten breakout bets</p><h2>Pick the decision you need now</h2><div class="decision-link-grid">${cards}</div></section><section class="panel"><p class="eyebrow">Product rule</p><h2>No fake live answers</h2><p>Each tool exposes its current source and freshness. When an upstream source is unavailable or ambiguous, the result degrades to VERIFY or LIVE SOURCE UNAVAILABLE rather than fabricating a current condition.</p></section></main><footer><div class="wrap">© ${dateModified.slice(0,4)} Chris Izworski</div></footer></body></html>`;
}
for(const [id,p] of Object.entries(pages)){const dir=path.join(publicDir,'national-tools',id);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'index.html'),page(id,p));}
const hubDir=path.join(publicDir,'national-tools','live-decisions');fs.mkdirSync(hubDir,{recursive:true});fs.writeFileSync(path.join(hubDir,'index.html'),hub());
console.log(`Generated ${Object.keys(pages).length} breakout live pages + hub.`);
