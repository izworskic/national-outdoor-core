module.exports=async function californiaRoads(req,res){
 res.setHeader('X-Robots-Tag','noindex,nofollow');
 res.setHeader('Content-Type','application/json; charset=utf-8');
 const origin=req.headers?.origin||'';
 if(origin==='https://chrisizworski.com'||origin==='https://www.chrisizworski.com'){
  res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Vary','Origin');
 }
 if(req.method==='OPTIONS'){res.setHeader('Access-Control-Allow-Methods','GET,OPTIONS');res.statusCode=204;return res.end();}
 if(req.method!=='GET'){res.statusCode=405;return res.end(JSON.stringify({ok:false,error:'Use GET'}));}
 const kind=String(req.query?.kind||new URL(req.url,'https://example.test').searchParams.get('kind')||'').slice(0,20);
 if(!['coast','sierra'].includes(kind)){res.statusCode=400;return res.end(JSON.stringify({ok:false,error:'Choose coast or sierra'}));}
 try{
  const {getCaliforniaRoads}=await import('../lib/california-roads.mjs');
  const data=await getCaliforniaRoads(kind);
  res.setHeader('Cache-Control','public,s-maxage=300,stale-while-revalidate=300');
  res.statusCode=200;return res.end(JSON.stringify(data));
 }catch(e){
  res.setHeader('Cache-Control','public,s-maxage=30');
  res.statusCode=503;return res.end(JSON.stringify({ok:false,error:'Official road feed unavailable. Check Caltrans directly.',checkedAt:new Date().toISOString()}));
 }
};