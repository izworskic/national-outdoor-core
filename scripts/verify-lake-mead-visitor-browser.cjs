#!/usr/bin/env node
'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../public'),out=path.resolve(__dirname,'../artifacts/lake-mead-visitor');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript','.png':'image/png','.svg':'image/svg+xml'};
fs.mkdirSync(out,{recursive:true});
const server=http.createServer(async(req,res)=>{
 try{
  const p=new URL(req.url,'http://localhost').pathname;
  const file=path.resolve(root,'.'+(p.endsWith('/')?p+'index.html':p));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  const data=await fs.promises.readFile(file).catch(()=>null);
  if(!data){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream'});res.end(data);
 }catch{res.writeHead(500);res.end();}
});
const rows=[
 {name:'Callville Bay',houseboats:'OPEN',motorized:'OPEN',nonMotorized:'OPEN',minSafe:1065,aboveMin:false,thresholdConflict:true,motorizedCandidate:false,note:'NPS published open, measured level below minimum.'},
 {name:'Hemenway Harbor',houseboats:'OPEN',motorized:'OPEN',nonMotorized:'OPEN',minSafe:1030,aboveMin:true,thresholdConflict:false,motorizedCandidate:false,note:'Pipe mat. Four lanes.'},
 {name:'Boulder Harbor',houseboats:'CLOSED',motorized:'CLOSED',nonMotorized:'CLOSED',minSafe:null,aboveMin:null,motorizedCandidate:false,note:'Concrete ramp closed.'},
 {name:'Government Wash',houseboats:'CLOSED',motorized:'CLOSED',nonMotorized:'CLOSED',minSafe:null,aboveMin:null,motorizedCandidate:false,primitiveNonMotorizedMention:true,note:'Concrete ramp closed; primitive paddle access mentioned in published NPS note.'}
];
const body={ok:true,id:'lake-mead-access',updated:'2026-11-02T16:00:00Z',
  status:'VERIFY NPS TABLE DATE',headline:'NPS table published October 5, 2026. Present-day ramp operations unconfirmed.',
  source:{name:'National Park Service — Lake Mead launch table',url:'https://www.nps.gov/lake/planyourvisit/changing-lake-levels.htm'},
  sourcePublishedDate:'2026-10-05',sourceAgeDays:28,sourceFresh:false,
  facts:[{label:'NPS table published',value:'2026-10-05'}],launches:rows,sourceExcerpt:'Historical ramp table; verify before launching.'};
function need(ok,what){if(!ok)throw Error(what);}
async function main(){
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 const url='http://127.0.0.1:'+server.address().port+'/national-tools/lake-mead-access/';
 let browser;const report={devices:[],failures:[]};
 try{
  browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
  for(const device of [{name:'mobile',width:390,height:844},{name:'desktop',width:1366,height:900}]){
   const ctx=await browser.newContext({viewport:{width:device.width,height:device.height}});
   const page=await ctx.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/assets/breakout-live.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:fs.readFileSync(path.join(root,'assets/breakout-live.js'),'utf8')}));
   await page.route('**/assets/breakout-live.css',route=>route.fulfill({status:200,contentType:'text/css',body:fs.readFileSync(path.join(root,'assets/breakout-live.css'),'utf8')}));
   await page.route('**/api/breakout-live?**',route=>route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(body)}));
   const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
   need(response.status()===200,device.name+' page failed');
   await page.waitForSelector('.launch-row',{timeout:12000});
   need((await page.locator('#liveStatus').innerText()).includes('VERIFY NPS TABLE DATE'),device.name+' missing stale NPS warning');
   need((await page.locator('.launch-row.launch-candidate').count())===0,device.name+' stale rows were marked available');
   need(await page.locator('.launch-row').count()===rows.length,device.name+' missing vessel rows');
   need((await page.locator('#sourceLink').getAttribute('href'))==='https://www.nps.gov/lake/planyourvisit/changing-lake-levels.htm',device.name+' NPS source missing');
   await page.locator('[data-mode="nonMotorized"]').click();
   need((await page.locator('#meadLaunchResult').innerText()).includes('PRIMITIVE PADDLE OPTION NOTED'),device.name+' Government Wash primitive exception hidden');
   need((await page.locator('.launch-row.launch-candidate').count())===0,device.name+' stale paddle options marked available');
   await page.locator('[data-mode="motorized"]').click();
   const width=await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth}));
   need(width.scroll<=width.viewport+18,device.name+' horizontal overflow '+JSON.stringify(width));
   need(errors.length===0,device.name+' JS errors: '+errors.join('; '));
   await page.screenshot({path:path.join(out,device.name+'.png'),fullPage:true,animations:'disabled'});
   report.devices.push({name:device.name,launches:rows.length,staleCandidateCount:0,paddleException:true,width});
   await ctx.close();
  }
 }catch(err){report.failures.push(String(err.stack||err));throw err;}
 finally{await browser?.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
