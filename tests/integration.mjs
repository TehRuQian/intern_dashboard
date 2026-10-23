// HTTP integration tests. Only temporary marked rows are created, then removed in finally.
// Run against a local development server, never against a shared live service.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import http from 'node:http';
// Use Node's stable HTTP client (Laragon's bundled Node 18.8 has experimental fetch).
const fetch=(url,options={})=>new Promise((resolve,reject)=>{
 const request=http.request(url,{method:options.method||'GET',headers:options.headers||{},agent:false},response=>{
  const chunks=[];response.on('data',chunk=>chunks.push(chunk));response.on('error',reject);
  response.on('end',()=>{const text=Buffer.concat(chunks).toString('utf8');resolve({status:response.statusCode,headers:{get:key=>{const v=response.headers[key.toLowerCase()];return Array.isArray(v)?v.join(','):v;}},text:async()=>text});});
 });request.on('error',reject);if(options.body)request.write(options.body);request.end();
});
const base=process.argv[2]||'http://127.0.0.1:8095';
const php=process.argv[3]||'php';
const root=fileURLToPath(new URL('../',import.meta.url));
const fingerprint=()=>JSON.parse(execFileSync(php,['scripts/fingerprint_database.php'],{cwd:root,encoding:'utf8'}));
const before=fingerprint();const tracked=[];let cookie='',csrf='',passed=0;
const ok=(name)=>{passed++;console.log('PASS '+name);};
async function api(action,query={},body,expected=200,token=csrf){
 const p=new URLSearchParams({action,...query});
 const r=await fetch(base+'/api/index.php?'+p,{method:body?'POST':'GET',headers:{Cookie:cookie,...(body?{'Content-Type':'application/json','X-CSRF-Token':token}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const text=await r.text();let json;try{json=JSON.parse(text);}catch{throw new Error(`Non-JSON response ${r.status}: ${text.slice(0,300)}`);}
 assert.equal(r.status,expected,`${action}: ${text.slice(0,250)}`);return json.data??json.error;
}
async function cleanup(module,id){const d=await api('detail',{module,id});await api('delete',{module},{id,version:d.version});}
const marker='__INTERN_HUB_TEST_'+Date.now();
let testYear=2199,testEmployee,testKpi,kpiCreated=false;
try {
 const page=await fetch(base+'/');const html=await page.text();assert.equal(page.status,200);assert(!html.includes('Warning:'));csrf=html.match(/name="csrf-token" content="([a-f0-9]+)"/)[1];cookie=page.headers.get('set-cookie').split(';')[0];ok('dashboard serves without login and issues CSRF session');
 const m=await api('metadata');assert.deepEqual(m.interns.map(p=>p.full_name),['Yong Wei','Teh Ru Qian','Elijah She']);ok('intern dropdown excludes Dalila');
 testEmployee=m.interns[0].employee_id;testKpi=m.kpis[0].kpi_id;
 const summary=await api('dashboard');const all=await api('report',{module:'activities'}),kpi=await api('report',{module:'kpi'}),tasks=await api('report',{module:'tasks'}),projects=await api('report',{module:'projects'});
 assert.equal(summary.summary[0],all.total);assert.equal(summary.summary[2],kpi.rows.reduce((s,r)=>s+Number(r.quantity),0));assert.equal(summary.summary[3],tasks.total);ok('dashboard quantities match report records');
 const totalTrend=Object.values(summary.trend).reduce((s,q)=>s+q,0);assert.equal(totalTrend,summary.summary[2]);assert.equal(Object.values(summary.distribution).reduce((s,q)=>s+q,0),summary.summary[2]);ok('KPI charts reconcile with recorded quantities');
 for(const person of m.interns){const d=await api('report',{module:'activities',employee_id:person.employee_id});assert(d.rows.every(r=>r.employee_id===person.employee_id));const dashboard=await api('dashboard',{employee_id:person.employee_id});assert.equal(dashboard.summary[0],d.total);ok('filter '+person.full_name);}
 const ww45=await api('kpi',{year:2026,week:45});assert.equal(ww45.dates[45].start,'2026-10-22');assert.equal(ww45.dates[45].end,'2026-10-28');ok('Thursday WW45 calendar anchor');
 const range=await api('report',{module:'activities',year:2026,week:45});assert(range.rows.every(r=>r.activity_date>='2026-10-22'&&r.activity_date<='2026-10-28'));ok('calendar dates follow selected work-week filter');
 const dated=await api('dashboard',{year:2026,month:9,from:'2026-09-01',to:'2026-09-30'});const datedKpi=await api('report',{module:'kpi',year:2026,month:9,from:'2026-09-01',to:'2026-09-30'});assert.equal(dated.summary[2],datedKpi.rows.reduce((s,r)=>s+Number(r.quantity),0));ok('monthly KPI reporting matches dashboard overlap rule');
 const empty=await api('dashboard',{year:2100});assert(empty.summary.every(n=>n===0));ok('empty datasets return zero counts');
 const search=await api('list',{module:'activities',search:"%' OR 1=1 --"});assert.equal(search.total,0);ok('search safely handles SQL and wildcard characters');
 await api('save',{module:'activities'},{record:{}},403,'invalid');ok('CSRF rejects invalid write token');
 const malformed=await fetch(base+'/api/index.php?action=save&module=activities',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json','X-CSRF-Token':csrf},body:'{broken'});assert.equal(malformed.status,422);assert.equal(JSON.parse(await malformed.text()).success,false);ok('malformed JSON returns a validation error');
 await api('save',{module:'activities'},{record:'invalid'},422);ok('invalid record shape returns a validation error');
 await api('save',{module:'activities'},{record:{employee_id:testEmployee,activity_date:'2026-02-30',task_title:'invalid',status:'pending'}},422);ok('server validates invalid dates');
 const daily={employee_id:testEmployee,activity_date:m.today,task_title:marker,milestone:'Test',remarks:'=SUM(1,2)',status:'pending'};
 const created=await api('save',{module:'activities'},{record:daily});tracked.push(['activities',created.id]);let detail=await api('detail',{module:'activities',id:created.id});assert.equal(detail.record.employee_id,testEmployee);ok('activity creation stores selected employee');
 const stale=detail.version;await api('save',{module:'activities'},{id:created.id,version:detail.version,record:{...daily,status:'completed'}});detail=await api('detail',{module:'activities',id:created.id});assert.equal(detail.record.status,'completed');ok('activity edit targets correct record');
 await api('save',{module:'activities'},{id:created.id,version:stale,record:daily},409);ok('stale activity edit rejected');
 const csv=await fetch(base+'/api/index.php?'+new URLSearchParams({action:'export',module:'activities',search:marker}),{headers:{Cookie:cookie}});const csvText=await csv.text();assert.equal(csv.status,200);assert(csvText.includes(marker));assert(csvText.includes("'=SUM(1,2)"));assert(!csvText.includes('Orientation'));ok('filtered CSV includes matching records and neutralizes formulas');
 const special={task_title:marker,description:'Test',pic:'Yong Wei, Teh Ru Qian, Dalila',assigned_date:'2026-01-01',start_date:'2026-01-01',due_date:'2026-01-02',tat_description:'1 day',status:'pending',priority:'high',progress_percent:25,modification_request:'Test request'};
 const st=await api('save',{module:'tasks'},{record:special});tracked.push(['tasks',st.id]);for(const p of m.interns.slice(0,2)){const found=await api('list',{module:'tasks',search:marker,employee_id:p.employee_id});assert.equal(found.total,1);}const other=await api('list',{module:'tasks',search:marker,employee_id:m.interns[2].employee_id});assert.equal(other.total,0);ok('multi-person PIC filters preserve shared assignment');
 const overdue=await api('dashboard');assert.equal(overdue.summary[7],summary.summary[7]+1);let sd=await api('detail',{module:'tasks',id:st.id});await api('save',{module:'tasks'},{id:st.id,version:sd.version,record:{...special,status:'completed',progress_percent:100}});sd=await api('detail',{module:'tasks',id:st.id});assert(sd.record.completed_at);assert.equal((await api('dashboard')).summary[7],summary.summary[7]);ok('overdue is calculated and completion timestamps are stored');
 const project={project_name:marker,project_type:'Tool',description:'Test',developers:'Elijah She',assigned_date:'2026-01-01',start_date:'2026-01-01',due_date:'2026-01-10',development_status:'testing',review_status:'in_review',progress_percent:70,project_link:'https://example.com',improvement_notes:'Test'};
 const pr=await api('save',{module:'projects'},{record:project});tracked.push(['projects',pr.id]);let pd=await api('detail',{module:'projects',id:pr.id});assert.equal(pd.record.progress_percent,70);await api('save',{module:'projects'},{id:pr.id,version:pd.version,record:{...project,project_link:'javascript:alert(1)'}},422);ok('projects track progress and reject unsafe links');
 const existing=await api('kpi',{year:testYear,employee_id:testEmployee});assert.equal(existing.records.length,0);
 const saveCell=(quantity,original,expected=200)=>api('save_kpi',{}, {employee_id:testEmployee,year:testYear,cells:[{kpi_id:testKpi,week:1,quantity,original}]},expected);
 await saveCell('0',null);kpiCreated=true;let kr=await api('kpi',{year:testYear,employee_id:testEmployee});assert.equal(kr.records.length,1);assert.equal(kr.records[0].quantity,'0.00');ok('KPI explicit zero is stored separately from blank');
 await saveCell('2.50','0.00');await saveCell('2.50','2.50');kr=await api('kpi',{year:testYear,employee_id:testEmployee});assert.equal(kr.records.length,1);assert.equal(kr.records[0].quantity,'2.50');ok('repeated KPI save prevents duplicates');
 await saveCell('4','0.00',409);await saveCell('-1','2.50',422);ok('KPI rejects stale writes and negative quantities');
 const others=await api('kpi',{year:testYear,employee_id:m.interns[1].employee_id});assert.equal(others.records.length,0);ok('KPI saves preserve other interns');
 await saveCell(null,'2.50');kpiCreated=false;kr=await api('kpi',{year:testYear,employee_id:testEmployee});assert.equal(kr.records.length,0);ok('clearing a KPI restores a blank cell');
 const monthly=await api('report',{module:'monthly'});assert.equal(monthly.rows.reduce((s,r)=>s+r.total,0),all.total+1);ok('monthly report totals reconcile with daily records');
 for(const privatePath of ['/.env','/config/db.php','/scripts/inspect_database.php','/storage/','/tests/integration.mjs']){const r=await fetch(base+privatePath);assert.equal(r.status,404);}ok('development router blocks private paths');
 for(const asset of ['assets/vendor/bootstrap.min.css','assets/vendor/bootstrap.bundle.min.js','assets/vendor/chart.umd.js','assets/js/app.js']){const r=await fetch(base+'/'+asset);assert.equal(r.status,200);}ok('frontend dependencies are served locally');
} finally {
 if(kpiCreated){const d=await api('kpi',{year:testYear,employee_id:testEmployee});const cell=d.records.find(r=>r.kpi_id===testKpi&&r.week_no===1);if(cell)await api('save_kpi',{}, {employee_id:testEmployee,year:testYear,cells:[{kpi_id:testKpi,week:1,quantity:null,original:cell.quantity}]});}
 for(const [module,id] of tracked.reverse())await cleanup(module,id);
 const after=fingerprint();assert.deepEqual(after,before,'Existing database records changed during tests');ok('all original database rows and values remain unchanged');
}
console.log(`${passed} integration checks passed.`);
