// Dependency-free Chrome DevTools smoke tests. Start headless Chrome on localhost:9227 first.
import net from 'node:net';
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const base=process.argv[2]||'http://127.0.0.1:8095';
const php=process.argv[3]||'php';
const fingerprint=()=>JSON.parse(execFileSync(php,['scripts/fingerprint_database.php'],{cwd:root,encoding:'utf8'}));
const before=fingerprint();
const getJSON=url=>new Promise((resolve,reject)=>http.get(url,r=>{let text='';r.on('data',c=>text+=c);r.on('end',()=>{try{resolve(JSON.parse(text));}catch(e){reject(e);}});}).on('error',reject));
const targets=await getJSON('http://127.0.0.1:9227/json/list');
const target=targets.find(t=>t.type==='page');assert(target,'Chrome page target missing');
const url=new URL(target.webSocketDebuggerUrl);const pending=new Map();let sequence=0,buffer=Buffer.alloc(0),upgraded=false;
const socket=net.createConnection(Number(url.port),url.hostname);const exceptions=[];
const sendFrame=value=>{
 const data=Buffer.from(value),mask=crypto.randomBytes(4);let h;
 if(data.length<126){h=Buffer.alloc(2);h[1]=0x80|data.length;}else if(data.length<65536){h=Buffer.alloc(4);h[1]=0x80|126;h.writeUInt16BE(data.length,2);}else{h=Buffer.alloc(10);h[1]=0x80|127;h.writeBigUInt64BE(BigInt(data.length),2);}
 h[0]=0x81;const payload=Buffer.from(data);for(let i=0;i<payload.length;i++)payload[i]^=mask[i%4];socket.write(Buffer.concat([h,mask,payload]));
};
const connected=new Promise((resolve,reject)=>{
 socket.on('connect',()=>socket.write(`GET ${url.pathname} HTTP/1.1\r\nHost: ${url.host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${crypto.randomBytes(16).toString('base64')}\r\nSec-WebSocket-Version: 13\r\n\r\n`));
 socket.on('error',reject);
 socket.on('data',chunk=>{
  buffer=Buffer.concat([buffer,chunk]);
  if(!upgraded){const end=buffer.indexOf('\r\n\r\n');if(end<0)return;assert(buffer.toString('utf8',0,end).includes('101'),'WebSocket upgrade failed');buffer=buffer.subarray(end+4);upgraded=true;resolve();}
  while(buffer.length>=2){const opcode=buffer[0]&15;let size=buffer[1]&127,offset=2;if(size===126){if(buffer.length<4)return;size=buffer.readUInt16BE(2);offset=4;}else if(size===127){if(buffer.length<10)return;size=Number(buffer.readBigUInt64BE(2));offset=10;}
   if(buffer.length<offset+size)return;const payload=buffer.subarray(offset,offset+size);buffer=buffer.subarray(offset+size);if(opcode!==1)continue;
   const message=JSON.parse(payload.toString());if(message.method==='Runtime.exceptionThrown')exceptions.push(message.params.exceptionDetails.text+': '+(message.params.exceptionDetails.exception?.description||''));
   if(message.id&&pending.has(message.id)){const {resolve:done,reject:fail,timer}=pending.get(message.id);clearTimeout(timer);pending.delete(message.id);message.error?fail(new Error(JSON.stringify(message.error))):done(message.result);}
  }
 });
});
await connected;
function command(method,params={}){const id=++sequence;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(new Error('DevTools timeout '+method));},15000);pending.set(id,{resolve,reject,timer});sendFrame(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const r=await command('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
async function wait(expression){for(let i=0;i<60;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,150));}throw new Error('Timed out waiting for '+expression);}
let passed=0;const ok=name=>{passed++;console.log('PASS '+name);};
const marker='__INTERN_HUB_BROWSER_'+Date.now();let employee;
try{
 await command('Page.enable');await command('Runtime.enable');
 await command('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
 await command('Page.navigate',{url:base+'/'});
 await wait('!!window.App?.meta && !!document.querySelector(".stat-card")');
 assert.equal(await evaluate('document.querySelectorAll(".stat-card").length'),8);assert.equal(await evaluate('document.querySelectorAll("canvas").length'),4);ok('dashboard renders eight cards and four charts');
 const screenshot=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync(new URL('../storage/dashboard-full.png',import.meta.url),Buffer.from(screenshot.data,'base64'));
 await evaluate('document.querySelector("[data-view=activities]").click()');await wait('App.state.view==="activities" && !!document.getElementById("addRecord")');
 await evaluate('document.getElementById("addRecord").click()');await wait('document.getElementById("recordModal").classList.contains("show")');
 assert.equal(await evaluate('document.getElementById("field_employee_id").value'),'');ok('All Interns add form requires explicit intern assignment');
 employee=await evaluate('App.meta.interns[1].employee_id');
 await evaluate(`document.getElementById('field_employee_id').value=${JSON.stringify(employee)};document.getElementById('field_task_title').value=${JSON.stringify(marker)};document.getElementById('field_milestone').value='Browser smoke test';document.getElementById('field_status').value='pending';document.getElementById('recordForm').requestSubmit();`);
 await wait('!Records.saving && getComputedStyle(document.getElementById("recordModal")).display==="none" && document.getElementById("pageContent").textContent.includes('+JSON.stringify(marker)+')');ok('activity modal saves with AJAX and closes successfully');
 const recordId=await evaluate('(async()=>{const d=await App.api("list",{module:"activities",search:'+JSON.stringify(marker)+'});return d.rows[0].activity_id;})()');
 await evaluate(`Records.open('activities',${recordId},true)`);await wait('Records.modalReady && document.getElementById("recordModal").classList.contains("show")');assert.equal(await evaluate('document.getElementById("saveRecordButton").classList.contains("d-none")'),true);ok('record details modal is read-only');
 await evaluate('bootstrap.Modal.getInstance(document.getElementById("recordModal")).hide()');await wait('getComputedStyle(document.getElementById("recordModal")).display==="none"');
 await evaluate(`document.getElementById('internSelect').value=${JSON.stringify(employee)};document.getElementById('internSelect').dispatchEvent(new Event('change'));`);await wait('!!document.getElementById("recordSearch") && App.state.employee_id==='+JSON.stringify(employee));
 assert.equal(await evaluate('document.querySelectorAll("#internSelect option").length'),4);ok('global intern dropdown includes All Interns and exactly three people');
 await evaluate('document.querySelector("[data-view=kpi]").click()');await wait('!!document.querySelector(".kpi-input")');
 const kpiShot=await command('Page.captureScreenshot',{format:'png'});fs.writeFileSync(new URL('../storage/kpi.png',import.meta.url),Buffer.from(kpiShot.data,'base64'));
 await evaluate('(()=>{const cell=document.querySelector(".kpi-input");cell.value=String(Number(cell.value||0)+1);cell.dispatchEvent(new Event("input"));})()');assert.equal(await evaluate('App.dirty && !document.getElementById("saveKpi").disabled'),true);ok('individual KPI cells enable save after editing');
 await evaluate('window.confirm=()=>true;document.querySelector("[data-view=tasks]").click()');await wait('!!document.getElementById("addRecord") && App.state.view==="tasks"');assert.equal(await evaluate('App.dirty'),false);ok('navigation handles unsaved KPI changes');
 await evaluate('document.querySelector("[data-view=projects]").click()');await wait('!!document.getElementById("toggleProjectView")');await evaluate('document.getElementById("toggleProjectView").click()');await wait('!!document.querySelector(".project-card")');ok('system projects support card view');
 await evaluate('document.querySelector("[data-view=reports]").click()');await wait('!!document.getElementById("reportType")');await evaluate('document.getElementById("reportType").value="kpi";document.getElementById("reportType").dispatchEvent(new Event("change"));');await wait('App.state.report==="kpi" && !!document.getElementById("reportType") && document.getElementById("pageContent").textContent.includes("Weekly KPI Report")');ok('reports switch to filtered KPI records');
 await evaluate('document.getElementById("internSelect").value="";document.getElementById("internSelect").dispatchEvent(new Event("change"));');await wait('App.state.employee_id==="" && !!document.getElementById("reportType")');await evaluate('document.querySelector("[data-view=kpi]").click()');await wait('!!document.querySelector(".kpi-table")');assert.equal(await evaluate('document.querySelectorAll(".kpi-input").length'),0);ok('combined KPI matrix is read-only');
 assert.equal(new URLSearchParams(await evaluate('location.search')).get('employee_id'),'');await evaluate(`App.change({employee_id:${JSON.stringify(employee)}})`);await wait('!!document.querySelector(".kpi-input")');await evaluate('history.back()');await wait('App.state.employee_id==="" && !!document.querySelector(".kpi-table") && !document.querySelector(".kpi-input")');ok('browser history restores All Interns despite a persisted individual filter');
 await command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await evaluate('document.querySelector("[data-view=dashboard]").click()');await wait('!!document.querySelector(".stat-card")');
 const overflow=await evaluate('({width:document.documentElement.scrollWidth,viewport:innerWidth})');assert(overflow.width<=overflow.viewport+1,JSON.stringify(overflow));await evaluate('document.getElementById("sidebarToggle").click()');assert.equal(await evaluate('document.body.classList.contains("sidebar-open")'),true);await evaluate('document.getElementById("sidebarScrim").click()');ok('mobile layout fits viewport and sidebar opens/closes');
 const mobile=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync(new URL('../storage/mobile.png',import.meta.url),Buffer.from(mobile.data,'base64'));
 assert.deepEqual(exceptions,[]);ok('no uncaught browser exceptions across modules');
}finally{
 await evaluate(`(async()=>{window.confirm=()=>true;const d=await App.api('list',{module:'activities',search:${JSON.stringify(marker)},employee_id:'',year:'',month:'',week:'',from:'',to:'',status:'',sort:''});for(const r of d.rows){const detail=await App.api('detail',{module:'activities',id:r.activity_id});await App.api('delete',{module:'activities'},{id:r.activity_id,version:detail.version});}})()`);
 assert.deepEqual(fingerprint(),before,'Browser checks changed original records');ok('browser test cleanup preserves all original database values');
 sendFrame(JSON.stringify({id:++sequence,method:'Browser.close'}));socket.end();
}
console.log(`${passed} browser checks passed.`);
