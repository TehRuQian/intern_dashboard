'use strict';
window.Records={
 current:null, saving:false, formChanged:false, modalReady:false,
 toolbar(module,data) {
  const A=App,c=ModuleConfig[module];
  return `<div class="table-toolbar"><form id="searchForm" class="d-flex gap-2 search"><input type="search" id="recordSearch" class="form-control" aria-label="Search records" placeholder="Search tasks, remarks…" value="${A.esc(A.state.search)}"><button class="btn btn-light btn-sm" type="submit">Search</button></form><select id="recordStatus" class="form-select" aria-label="Filter status"><option value="">All statuses</option>${c.statuses.map(s=>`<option value="${s}" ${s===A.state.status?'selected':''}>${A.esc(A.label(s))}</option>`).join('')}</select><select id="recordSort" class="form-select" aria-label="Sort records">${[[c.date+':desc','Newest date first'],[c.date+':asc','Oldest date first'],...(module==='activities'?[]:[[c.name+':asc','Title A–Z'],[c.status+':asc','Status']])].map(([v,l])=>`<option value="${v}" ${v===(A.state.sort||c.date)+':'+A.state.direction?'selected':''}>${l}</option>`).join('')}</select>${module==='projects'?`<button class="btn btn-light btn-sm" id="toggleProjectView">${A.state.projectView==='table'?'Card view':'Table view'}</button>`:''}<span class="record-count">${A.num(data.total)} records</span></div>`;
 },
 actions(module,r) {
  const A=App,c=ModuleConfig[module];
  return `<div class="table-actions">${[['view','View'],['edit','Edit'],['delete','Delete']].map(([action,label])=>`<button class="link-button ${action==='delete'?'danger':''}" data-record-action="${action}" data-module="${module}" data-id="${r[c.id]}">${label}</button>`).join('')}</div>`;
 },
 cell(module,r,key) {
  const A=App,c=ModuleConfig[module],v=r[key];
  if(key===c.status || key==='priority')return A.badge(v);
  if(key==='progress_percent')return A.progress(v);
  if(key.endsWith('_date'))return `<span class="text-nowrap">${A.date(v)}</span>`+(key==='due_date' && module==='tasks' && v && v<A.meta.today && r.status!=='completed'?'<div class="mt-1">'+A.badge('overdue')+'</div>':'');
  return `<span class="${[c.name,'remarks','milestone'].includes(key)?'truncate':''}" title="${A.esc(v)}">${A.esc(v??'—')}</span>`;
 },
 timeline(rows) {
  const A=App,groups=new Map();
  for(const r of rows){
   const date=r.activity_date||'';
   if(!groups.has(date))groups.set(date,[]);
   groups.get(date).push(r);
  }
  const dates=[...groups.keys()].sort((a,b)=>A.state.direction==='asc'?a.localeCompare(b):b.localeCompare(a));
  return `<div class="daily-timeline">${dates.map(date=>`<section class="daily-date-group"><h2 class="daily-date-heading">${date?A.date(date):'Undated'}<span>${groups.get(date).length} ${groups.get(date).length===1?'update':'updates'}</span></h2><div class="daily-cards">${groups.get(date).map(r=>`<article class="daily-log-card"><div class="daily-card-heading"><h3><button class="task-title" data-record-action="view" data-module="activities" data-id="${r.activity_id}">${A.esc(r.task_title)}</button></h3>${A.badge(r.status)}</div><p class="daily-author">${A.esc(r.full_name||r.employee_id)}</p>${r.milestone?`<div class="daily-card-section"><h4>Achievement / learning</h4><p>${A.esc(r.milestone)}</p></div>`:''}${r.remarks?`<div class="daily-card-section"><h4>Remarks</h4><p>${A.esc(r.remarks)}</p></div>`:''}<div class="daily-card-actions">${this.actions('activities',r)}</div></article>`).join('')}</div></section>`).join('')}</div>`;
 },
 async render(module) {
  const A=App,c=ModuleConfig[module],data=await A.api('list',{module});
  A.$('pageActions').innerHTML=`<button class="btn btn-light" id="exportRecords">↓ Export CSV</button><button class="btn btn-primary" id="addRecord">＋ Add ${c.singular.toLowerCase()}</button>`;
  let body='';
  if(!data.rows.length)body=A.empty();
  else if(module==='activities')body=this.timeline(data.rows);
  else if(module==='projects' && A.state.projectView==='cards')body='<div class="project-cards">'+data.rows.map(r=>`<article class="project-card"><div class="mb-3">${A.badge(r.development_status)}</div><h3>${A.esc(r.project_name)}</h3><div class="pic">${A.esc(r.developers)}</div><div class="dates">Due ${A.date(r.due_date)}</div>${A.progress(r.progress_percent)}<div class="mt-3">${this.actions(module,r)}</div></article>`).join('')+'</div>';
  else body=`<div class="table-responsive"><table class="table table-hover"><thead><tr>${c.columns.map(([,label])=>`<th>${label}</th>`).join('')}<th>Actions</th></tr></thead><tbody>${data.rows.map(r=>`<tr class="${module==='tasks'&&r.due_date&&r.due_date<A.meta.today&&r.status!=='completed'?'overdue-row':''}">${c.columns.map(([key])=>`<td class="${key===c.name?'title-cell':''}">${this.cell(module,r,key)}</td>`).join('')}<td>${this.actions(module,r)}</td></tr>`).join('')}</tbody></table></div>`;
  A.$('pageContent').innerHTML='<section class="panel">'+this.toolbar(module,data)+body+A.pagination(data)+'</section>';
  A.$('addRecord').addEventListener('click',()=>this.open(module));
  A.$('exportRecords').addEventListener('click',()=>A.export(module));
  A.$('searchForm').addEventListener('submit',e=>{e.preventDefault();A.change({search:A.$('recordSearch').value.trim()});});
  A.$('recordStatus').addEventListener('change',e=>A.change({status:e.target.value}));
  A.$('recordSort').addEventListener('change',e=>{const [sort,direction]=e.target.value.split(':');A.change({sort,direction});});
  A.$('toggleProjectView')?.addEventListener('click',()=>A.change({projectView:A.state.projectView==='table'?'cards':'table'}));
 },
 async open(module,id=null,viewOnly=false) {
  const A=App,c=ModuleConfig[module];
  try {
   const detail=id?await A.api('detail',{module,id}):{record:{},version:null};
   const record=detail.record;
   this.current={module,id,version:detail.version,record,viewOnly};this.formChanged=false;
   A.$('recordForm').reset(); A.$('modalError').classList.add('d-none');
   A.$('modalTitle').textContent=`${viewOnly?'View':id?'Edit':'Add'} ${c.singular}`;
   A.$('saveRecordButton').classList.toggle('d-none',viewOnly);
   A.$('saveRecordButton').disabled=false;
   A.$('saveRecordButton').textContent='Save record';
   A.$('modalFields').innerHTML=c.fields.map(([key,label,type,required,options])=>{
    let value=record[key]??'';
    if(!id) {
      if(type==='intern')value=A.state.employee_id;
      if(type==='pic' && A.state.employee_id)value=A.meta.interns.find(p=>p.employee_id===A.state.employee_id)?.full_name||'';
      if(key===c.status)value=c.statuses[0];if(key==='priority')value='medium';if(key==='review_status')value='pending';if(key==='progress_percent')value=0;
      if(key==='activity_date'||key==='assigned_date')value=A.meta.today;
    }
    const full=type==='textarea'||['task_title','project_name','project_link'].includes(key);
    if(viewOnly) {
      let shown=A.esc(value || (value===0?0:'—'));
      if(type==='intern')shown=A.esc(A.meta.interns.find(p=>p.employee_id===value)?.full_name||value);
      if(type==='select')shown=A.badge(value);
      if(type==='date')shown=A.date(value);
      if(key==='project_link' && /^https?:\/\//i.test(value))shown=`<a href="${A.esc(value)}" target="_blank" rel="noopener noreferrer">${A.esc(value)}</a>`;
      return `<div class="${full?'col-12':'col-md-6'}"><div class="detail-label">${label}</div><div class="detail-value">${shown}</div></div>`;
    }
    const attrs=`id="field_${key}" name="${key}" ${required?'required':''}`;
    let input;
    if(type==='textarea')input=`<textarea class="form-control" ${attrs} rows="3" maxlength="16000">${A.esc(value)}</textarea>`;
    else if(type==='intern')input=`<select class="form-select" ${attrs}><option value="">Select intern</option>${A.meta.interns.map(p=>`<option value="${A.esc(p.employee_id)}" ${p.employee_id===value?'selected':''}>${A.esc(p.full_name)}</option>`).join('')}</select>`;
    else if(type==='select')input=`<select class="form-select" ${attrs}>${options.map(v=>`<option value="${v}" ${v===value?'selected':''}>${A.label(v)}</option>`).join('')}</select>`;
    else input=`<input class="form-control" ${attrs} type="${type==='pic'?'text':type}" value="${A.esc(value)}" ${type==='number'?'min="0" max="100" step="1"':typeof options==='number'?`maxlength="${options}"`:''} ${type==='pic'?'list="internNames"':''}>`;
    if(type==='pic')input+='<small class="text-muted">Use full names; separate multiple people with commas. Include at least one intern.</small>';
    return `<div class="${full?'col-12':'col-md-6'}"><label class="form-label" for="field_${key}">${label}${required?' *':''}</label>${input}</div>`;
   }).join('')+'<datalist id="peopleNames">'+A.meta.people.map(p=>`<option value="${A.esc(p.full_name)}"></option>`).join('')+'</datalist><datalist id="internNames">'+A.meta.interns.map(p=>`<option value="${A.esc(p.full_name)}"></option>`).join('')+'</datalist>';
   if(viewOnly)A.$('modalFields').innerHTML+=`<div class="col-12 border-top pt-3 text-muted small">Created: ${A.esc(record.created_at)} · Updated: ${A.esc(record.updated_at)}</div>`;
   this.modalReady=false;
   bootstrap.Modal.getOrCreateInstance(A.$('recordModal')).show();
  }catch(e){A.error(e);}
 },
 async save(event) {
  event.preventDefault();if(this.saving||this.current?.viewOnly)return;
  const A=App,cur=this.current;const record=Object.fromEntries(new FormData(A.$('recordForm')));
  this.saving=true;A.$('saveRecordButton').disabled=true;A.$('saveRecordButton').textContent='Saving…';
  try {
   await A.api('save',{module:cur.module},{id:cur.id,version:cur.version,record});
   this.formChanged=false;
   // A fast local save can finish before Bootstrap's opening transition.
   if(!this.modalReady)await new Promise(resolve=>A.$('recordModal').addEventListener('shown.bs.modal',resolve,{once:true}));
   this.saving=false;bootstrap.Modal.getInstance(A.$('recordModal')).hide();A.toast('Record saved.');await A.load();
  }catch(e){A.$('modalError').textContent=e.message;A.$('modalError').classList.remove('d-none');}
  finally{this.saving=false;A.$('saveRecordButton').disabled=false;A.$('saveRecordButton').textContent='Save record';}
 },
 async remove(module,id) {
  const A=App;
  try {
   const d=await A.api('detail',{module,id});
   if(!confirm(`Delete “${d.record[ModuleConfig[module].name]}”? This permanently removes the record.`))return;
   await A.api('delete',{module},{id,version:d.version});A.toast('Record deleted.');await A.load();
  }catch(e){A.error(e);}
 }
};
for(const module of ['activities','tasks','projects'])App.renderers[module]=()=>Records.render(module);
document.addEventListener('DOMContentLoaded',()=>{
 App.$('recordModal').addEventListener('shown.bs.modal',()=>Records.modalReady=true);
 App.$('recordForm').addEventListener('submit',e=>Records.save(e));
 App.$('recordForm').addEventListener('input',()=>Records.formChanged=true);
 App.$('recordModal').addEventListener('hide.bs.modal',e=>{if(Records.saving){e.preventDefault();return;}if(Records.formChanged && !confirm('Discard the unsaved changes in this form?'))e.preventDefault();});
 document.addEventListener('click',e=>{
   const b=e.target.closest('[data-record-action]');if(!b)return;
   const {recordAction:action,module,id}=b.dataset;
   if(action==='delete')Records.remove(module,id);else Records.open(module,id,action==='view');
 });
});
