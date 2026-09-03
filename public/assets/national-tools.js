(function(){
  const CURRENT_STORE="ci-national-location-v2";
  const LEGACY_STORE="ci-national-location-v1";
  const PLACES_STORE="ci-national-places-v1";

  const ANALYTICS_BLOCKED_KEYS=new Set(["query","q","latitude","longitude","displayName","place","state","postalCode","postcode","location"]);

  function currentSurface(){
    const path=(window.location.pathname||"/").replace(/\/+$/,"")||"/";
    if(path==="/national-tools")return "hub";
    const match=path.match(/^\/national-tools\/([^/]+)/);
    return match?match[1]:"national-tools";
  }
  function ensureAnalytics(){
    window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments)};
    if(document.querySelector('script[data-national-analytics="1"]'))return;
    const script=document.createElement("script");
    script.defer=true;
    script.src="/_vercel/insights/script.js";
    script.dataset.nationalAnalytics="1";
    document.head.appendChild(script);
  }
  function eventData(data){
    const safe={surface:currentSurface()};
    Object.entries(data||{}).forEach(function(entry){
      const key=entry[0],value=entry[1];
      if(ANALYTICS_BLOCKED_KEYS.has(key)||value==null)return;
      if(typeof value==="number"||typeof value==="boolean")safe[key]=value;
      else safe[key]=String(value).slice(0,48);
    });
    return safe;
  }
  function track(name,data){
    ensureAnalytics();
    window.va("event",{name:name,data:eventData(data)});
  }
  function inputType(value){
    return /^\d{5}(?:-\d{4})?$/.test(String(value||"").trim())?"zip":"place";
  }

  function $(sel,root){return (root||document).querySelector(sel)}
  function fmtDate(value){
    if(!value)return "Unknown";
    const d=new Date(value);
    return Number.isNaN(d.getTime())?String(value):d.toLocaleString([], {dateStyle:"medium",timeStyle:"short"});
  }
  function fmtInZone(value,timeZone,options){
    if(!value)return "Unknown";
    const d=new Date(value);if(Number.isNaN(d.getTime()))return String(value);
    const base=options||{dateStyle:"medium",timeStyle:"short"};
    try{return d.toLocaleString([],{...base,timeZone:timeZone||undefined})}catch(_){return d.toLocaleString([],base)}
  }
  function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
  function read(key){try{return JSON.parse(localStorage.getItem(key)||"null")}catch(_){return null}}
  function write(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true}catch(_){return false}}
  function locationKey(loc){
    if(loc?.place&&loc?.stateCode)return (String(loc.place)+"|"+String(loc.stateCode)).toLowerCase().trim();
    if(loc?.postcode)return "zip|"+String(loc.postcode).slice(0,10).toLowerCase();
    const named=String(loc?.query||loc?.displayName||"").toLowerCase().trim();
    if(named)return named;
    const lat=Number(loc?.latitude),lon=Number(loc?.longitude);
    return Number.isFinite(lat)&&Number.isFinite(lon)?lat.toFixed(3)+","+lon.toFixed(3):"";
  }
  function label(loc){
    return loc?.place&&loc?.stateCode?loc.place+", "+loc.stateCode:(loc?.displayName||"your location").split(",").slice(0,2).join(",");
  }
  function remember(loc){
    if(!loc)return;
    write(CURRENT_STORE,loc);
  }
  function saved(){
    const current=read(CURRENT_STORE);
    if(current)return current;
    const legacy=read(LEGACY_STORE);
    if(legacy){remember(legacy);return legacy}
    return null;
  }
  function savedPlaces(){
    const rows=read(PLACES_STORE);
    return Array.isArray(rows)?rows.filter(Boolean).slice(0,6):[];
  }
  function savePlace(loc){
    if(!loc)return savedPlaces();
    const key=locationKey(loc);
    const next=[loc,...savedPlaces().filter(item=>locationKey(item)!==key)].slice(0,6);
    write(PLACES_STORE,next);
    remember(loc);
    track("National Saved Place",{saved_count:next.length});
    return next;
  }
  function removePlace(locOrKey){
    const key=typeof locOrKey==="string"?locOrKey:locationKey(locOrKey);
    const next=savedPlaces().filter(item=>locationKey(item)!==key);
    write(PLACES_STORE,next);
    return next;
  }
  function withQuery(path,loc){
    const q=loc?.query||label(loc);
    const base=String(path||"").split("?")[0];
    return base+"?q="+encodeURIComponent(q);
  }
  function propagate(loc,root){
    if(!loc)return;
    (root||document).querySelectorAll('a[href^="/national-tools/"]').forEach(function(anchor){
      const href=anchor.getAttribute("href")||"";
      if(href.startsWith("/national-tools/"))anchor.setAttribute("href",withQuery(href,loc));
    });
  }
  function currentShareUrl(loc){
    const path=window.location.pathname||"/national-tools/";
    return window.location.origin+withQuery(path,loc);
  }
  async function copyText(value){
    if(navigator.clipboard&&window.isSecureContext){
      await navigator.clipboard.writeText(value);
      return true;
    }
    const node=document.createElement("textarea");
    node.value=value;node.setAttribute("readonly","");
    node.style.position="fixed";node.style.opacity="0";
    document.body.appendChild(node);node.select();
    const copied=document.execCommand("copy");
    node.remove();
    if(!copied)throw new Error("Copy unavailable");
    return true;
  }
  async function sharePlace(loc,status){
    const url=currentShareUrl(loc);
    const title=(document.title||"U.S. Outdoor Tools").split("|")[0].trim();
    if(navigator.share){
      try{
        await navigator.share({title:title,text:"Outdoor conditions near "+label(loc),url:url});
        track("National Place Shared",{method:"native"});
        if(status)status.textContent="Share sheet opened";
        return "native";
      }catch(error){
        if(error&&error.name==="AbortError")return null;
      }
    }
    await copyText(url);
    track("National Place Shared",{method:"clipboard"});
    if(status)status.textContent="Share link copied";
    return "clipboard";
  }
  function renderPlaceToolbar(form,loc,onLocation){
    if(!form||!loc)return;
    const parent=form.parentElement,input=$("input",form),status=parent.querySelector(".status");
    let root=parent.querySelector(".place-toolbar");
    if(!root){
      root=document.createElement("div");
      root.className="place-toolbar";
      const privacy=form.nextElementSibling&&form.nextElementSibling.classList&&form.nextElementSibling.classList.contains("location-privacy")?form.nextElementSibling:form;
      privacy.insertAdjacentElement("afterend",root);
    }
    const key=locationKey(loc),hub=form.id==="hub-location";
    const places=savedPlaces();
    const already=places.some(function(item){return locationKey(item)===key});
    const switches=hub?[]:places.filter(function(item){return locationKey(item)!==key}).slice(0,3);
    root.innerHTML=
      '<div class="place-toolbar-current"><span class="tool-kicker">Current place</span><strong>'+esc(label(loc))+'</strong></div>'+
      '<div class="place-toolbar-actions">'+
      (hub?'':'<button type="button" class="secondary-btn" data-place-save '+(already?'disabled':'')+'>'+(already?'Saved':'Save place')+'</button>')+
      '<button type="button" class="secondary-btn" data-place-share>Share</button></div>'+
      (switches.length?'<div class="place-toolbar-switch"><span>Switch:</span>'+switches.map(function(item){return '<button type="button" class="place-chip" data-place-switch="'+esc(locationKey(item))+'">'+esc(label(item))+'</button>'}).join("")+'</div>':'');
    root.hidden=false;
    const saveButton=root.querySelector("[data-place-save]");
    if(saveButton)saveButton.addEventListener("click",function(){
      savePlace(loc);
      renderPlaceToolbar(form,loc,onLocation);
    });
    const shareButton=root.querySelector("[data-place-share]");
    if(shareButton)shareButton.addEventListener("click",async function(){
      shareButton.disabled=true;
      try{await sharePlace(loc,status)}
      catch(err){if(status)status.innerHTML='<span class="error">'+esc(err.message)+"</span>"}
      finally{shareButton.disabled=false}
    });
    root.querySelectorAll("[data-place-switch]").forEach(function(chip){
      chip.addEventListener("click",async function(){
        const next=savedPlaces().find(function(item){return locationKey(item)===chip.dataset.placeSwitch});
        if(!next)return;
        remember(next);if(input)input.value=next.query||label(next);propagate(next);
        track("National Place Switched",{source:"saved-place"});
        if(status)status.textContent=label(next);
        await onLocation(next);
        renderPlaceToolbar(form,next,onLocation);
      });
    });
  }
  async function readJsonResponse(response,fallback){
    const text=await response.text();
    const type=(response.headers.get("content-type")||"").toLowerCase();
    let data=null;
    if(text){
      if(type.includes("application/json")||type.includes("+json")){
        try{data=JSON.parse(text)}catch(_){}
      }else{
        try{data=JSON.parse(text)}catch(_){}
      }
    }
    if(!data){
      const status=response.status?("HTTP "+response.status):"";
      throw new Error((fallback||"Data source unavailable")+(status?" · "+status:""));
    }
    if(!response.ok)throw new Error(data.error||data.detail||fallback||"Request failed");
    return data;
  }
  function delay(ms){return new Promise(function(resolve){setTimeout(resolve,ms)})}
  async function fetchLocation(url,options){
    let response=await fetch(url,options);
    if([502,503,504].includes(response.status)){
      await delay(750);
      response=await fetch(url,options);
    }
    return response;
  }
  async function geocode(q){
    const r=await fetchLocation("/api/national-geocode?q="+encodeURIComponent(q));
    const data=await readJsonResponse(r,"Location lookup unavailable");
    remember(data);
    return data;
  }
  async function reverseGeocode(latitude,longitude){
    const roundedLatitude=Number(Number(latitude).toFixed(3));
    const roundedLongitude=Number(Number(longitude).toFixed(3));
    const r=await fetchLocation("/api/national-geocode",{
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({latitude:roundedLatitude,longitude:roundedLongitude})
    });
    const data=await readJsonResponse(r,"Current location lookup unavailable");
    remember(data);
    return data;
  }
  function geolocationMessage(error){
    if(error&&error.code===1)return "Location permission was not granted";
    if(error&&error.code===2)return "Your location could not be determined";
    if(error&&error.code===3)return "Location lookup timed out";
    return "Your browser could not provide a location";
  }
  async function deviceLocation(){
    if(!navigator.geolocation)throw new Error("This browser does not support device location");
    const position=await new Promise(function(resolve,reject){
      navigator.geolocation.getCurrentPosition(resolve,reject,{
        enableHighAccuracy:false,
        timeout:10000,
        maximumAge:300000
      });
    }).catch(function(error){throw new Error(geolocationMessage(error))});
    return reverseGeocode(position.coords.latitude,position.coords.longitude);
  }
  function bind(form,onLocation){
    if(!form)return;
    const input=$("input",form),button=$(".btn",form),geoButton=$("[data-use-location]",form),status=form.parentElement.querySelector(".status");
    const old=saved();if(old&&input&&!input.value)input.placeholder="Try "+label(old);
    form.addEventListener("submit",async e=>{
      e.preventDefault();const q=input.value.trim();if(!q)return;
      button.disabled=true;if(status)status.textContent="Finding "+q+"…";
      try{const loc=await geocode(q);track("National Location Resolved",{input_type:inputType(q)});if(status)status.textContent=label(loc);propagate(loc);renderPlaceToolbar(form,loc,onLocation);await onLocation(loc)}
      catch(err){track("National Location Error",{input_type:inputType(q)});if(status)status.innerHTML='<span class="error">'+esc(err.message)+"</span>"}
      finally{button.disabled=false}
    });
    if(geoButton){
      if(!navigator.geolocation)geoButton.hidden=true;
      else geoButton.addEventListener("click",async function(){
        geoButton.disabled=true;if(status)status.textContent="Using your device location…";
        try{
          const loc=await deviceLocation();
          track("National Device Location Resolved",{precision:"rounded-0.001deg"});
          if(input)input.value=loc.query||label(loc);
          if(status)status.textContent=label(loc);
          propagate(loc);
          renderPlaceToolbar(form,loc,onLocation);
          await onLocation(loc);
        }catch(err){
          track("National Device Location Error",{reason:String(err&&err.message||"unavailable").slice(0,48)});
          if(status)status.innerHTML='<span class="error">'+esc(err.message)+"</span>";
        }finally{geoButton.disabled=false}
      });
    }
  }
  document.addEventListener("click",function(event){
    const origin=event.target;
    if(!origin||typeof origin.closest!=="function")return;
    const anchor=origin.closest('a[href^="/national-tools/"]');
    if(!anchor)return;
    let target="national-tools";
    try{
      const path=new URL(anchor.href,window.location.href).pathname.replace(/\/+$/,"");
      if(path==="/national-tools")target="hub";
      else{
        const match=path.match(/^\/national-tools\/([^/]+)/);
        if(match)target=match[1];
      }
    }catch(_){}
    if(target===currentSurface())return;
    let placement="in-tool";
    if(anchor.closest(".desk-card"))placement="decision-card";
    else if(anchor.closest(".tool-card"))placement="tool-grid";
    else if(anchor.closest(".nav"))placement="nav";
    track("National Tool Open",{target:target,placement:placement});
  });
  ensureAnalytics();

  window.NationalTools={
    $,fmtDate,fmtInZone,esc,readJsonResponse,geocode,reverseGeocode,deviceLocation,label,bind,saved,savedPlaces,savePlace,removePlace,locationKey,remember,withQuery,propagate,currentShareUrl,sharePlace,renderPlaceToolbar,track
  };
})();
