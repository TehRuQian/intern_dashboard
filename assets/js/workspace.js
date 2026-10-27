'use strict';
window.Workspace={
 type:'',stage:'',sheet:'',
 name(){return App.meta.interns.find(p=>p.employee_id===App.state.employee_id)?.full_name||'All interns';},
 stageOf(module,r){return (module==='projects'&&r.review_status==='in_review'?'ready_for_review':({pending:'not_started',not_started:'not_started',completed:'completed',testing:'ready_for_review'}[r[ModuleConfig[module].status]]||'in_progress'));},
 actions(){return '<button class="btn btn-light" id="quickLog">+ Daily log</button><button class="btn btn-primary" id="quickAssign">+ Assign task</button>';},
 bindActions(){App.$('quickLog')?.addEventListener('click',()=>Records.open('activities'));App.$('quickAssign')?.addEventListener('click',()=>this.assign());},
 assign(){Records.open(this.sheet==='projects'?'projects':'tasks');},
 table(items){
  const A=App;
  return items.length?`<div class="table-responsive"><table class="table table-hover work-table"><thead><tr><th>Task / expected output</th><th>Type</th><th>Assigned to</th><th>Stage</th><th>Due</th><th>Progress</th><th></th></tr></thead><tbody>${items.map(r=>`<tr><td class="title-cell"><button class="task-title" data-record-action="edit" data-module="${r.module}" data-id="${r.id}">${A.esc(r.title)}</button><div class="subtext">${A.label(r.type)}${r.overdue?' Â· '+A.badge('overdue'):''}</div></td><td class="text-nowrap">${r.module==='projects'?'System development':r.module==='tasks'?'Special task':'Daily log'}</td><td>${A.esc(r.people)}</td><td>${A.badge(r.stage)}</td><td class="text-nowrap">${A.date(r.due_date)}</td><td>${r.module==='activities'?'&mdash;':A.progress(r.progress)}</td><td><button class="link-button" data-record-action="edit" data-module="${r.module}" data-id="${r.id}">Open</button></td></tr>`).join('')}</tbody></table></div>`:A.empty('No tasks here','Assign a task or change your filters.');
 },
 async renderWork(){
  const A=App,d=await A.api('work');
  A.$('pageActions').innerHTML='<button class="btn btn-light" id="exportWork">Export CSV</button><button class="btn btn-primary" id="addTask">+ Add tasks</button>';
  const scoped=d.rows.filter(r=>!this.sheet||r.module===this.sheet);
  const counts={all:scoped.length,overdue:scoped.filter(r=>r.overdue).length};
  for(const stage of ['not_started','in_progress','ready_for_review','completed'])counts[stage]=scoped.filter(r=>r.stage===stage).length;
  const items=scoped.filter(r=>(!this.stage||(this.stage==='overdue'?r.overdue:r.stage===this.stage)));
  A.$('pageContent').innerHTML=`<div class="workspace-context"><div><span class="context-dot"></span><strong>${A.esc(this.name())}</strong><span>Special tasks and system development in one place</span></div></div><section class="panel"><div class="work-tabs" aria-label="Task sheets">${[['','All tasks'],['tasks','Special tasks'],['projects','System development']].map(([value,label])=>`<button class="work-tab ${this.sheet===value?'selected':''}" data-work-sheet="${value}">${label}<span>${d.rows.filter(r=>!value||r.module===value).length}</span></button>`).join('')}</div><div class="work-tabs work-stage-tabs">${[['','All stages',counts.all],['not_started','Not started',counts.not_started],['in_progress','In progress',counts.in_progress],['ready_for_review','Ready for review',counts.ready_for_review],['completed','Completed',counts.completed],['overdue','Overdue',counts.overdue]].map(([value,label,count])=>`<button class="work-tab ${this.stage===value?'selected':''}" data-work-stage="${value}">${label}<span>${count}</span></button>`).join('')}</div><div class="table-toolbar"><form id="workSearch" class="search d-flex gap-2"><input id="workQuery" class="form-control" type="search" placeholder="Search tasks or people" aria-label="Search tasks" value="${A.esc(A.state.search)}"><button class="btn btn-light">Search</button></form><span class="record-count">${items.length} tasks</span></div>${this.table(items)}</section><p class="kpi-note">Open a task to update progress, submit for review or leave feedback. Existing imported assignments remain separate records.</p>`;
  A.$('addTask').onclick=()=>this.assign();
  A.$('exportWork').onclick=()=>A.export('work',{sort:'',source:this.sheet,stage:this.stage});
  document.querySelectorAll('[data-work-sheet]').forEach(b=>b.onclick=()=>{this.sheet=b.dataset.workSheet;this.stage='';A.load();});
  document.querySelectorAll('[data-work-stage]').forEach(b=>b.onclick=()=>{this.stage=b.dataset.workStage;A.load();});
  A.$('workSearch').onsubmit=e=>{e.preventDefault();A.change({search:A.$('workQuery').value.trim()});};
 },
 async dashboard(){
  const A=App,[d,t]=await Promise.all([A.api('dashboard'),A.api('team')]);
  const work=t.work,counts=[work.filter(r=>r.stage!=='completed').length,work.filter(r=>r.stage==='ready_for_review').length,work.filter(r=>r.overdue).length];
  const attention=work.filter(r=>r.stage==='ready_for_review'||r.overdue);
  A.$('pageActions').innerHTML=this.actions();
  A.$('pageContent').innerHTML=`<div class="stats-grid">${['Open tasks','Ready for review','Overdue tasks'].map((label,i)=>`<button class="stat-card stat-link" data-dashboard-stage="${['','ready_for_review','overdue'][i]}"><span class="stat-icon">${A.icon(['list-task','check2-circle','clock'][i])}</span><span><span class="stat-label d-block">${label}</span><span class="stat-value d-block">${counts[i]}</span></span></button>`).join('')}</div><div class="section-kicker"><strong>Team at a glance</strong><span>Select an intern to open their workspace</span></div><div class="team-grid">${t.people.filter(p=>p.is_active&&(!A.state.employee_id||p.employee_id===A.state.employee_id)).map(p=>`<button class="person-card" data-person="${A.esc(p.employee_id)}"><span class="person-avatar">${A.esc(p.full_name.split(' ').map(n=>n[0]).slice(0,2).join(''))}</span><span><strong>${A.esc(p.full_name)}</strong><small class="intern-status ${p.is_active?'intern-active':'intern-inactive'}">${p.is_active?'Active':'Inactive'}</small><small>${p.active} open tasks Â· ${p.logs} daily logs</small><small>${p.review} to review</small></span><span class="person-arrow">â†’</span></button>`).join('')}</div><section class="panel mb-4"><div class="panel-header"><div><h2>Needs attention</h2><div class="panel-subtitle">Deliverables to review and work needing support</div></div><button class="link-button" id="allWork">All tasks â†’</button></div>${attention.length?this.table(attention):'<div class="calm-empty">'+A.icon('check2-circle')+'<div><strong>Nothing needs attention</strong><span>No overdue or review-ready tasks in this selection.</span></div></div>'}</section><div class="charts-grid"><section class="panel"><div class="panel-header"><div><h2>Weekly activity quantities</h2><div class="panel-subtitle">Recorded work volume, not a performance score</div></div></div><div class="panel-body"><div class="chart-wrap"><canvas id="teamTrend" aria-label="Weekly activity quantities" role="img"></canvas></div></div></section><section class="panel"><div class="panel-header"><div><h2>Recent daily logs</h2><div class="panel-subtitle">Work completed, learning and progress</div></div><button class="link-button" id="allLogs">View all â†’</button></div>${t.recent.length?'<div class="recent-list">'+t.recent.map(r=>`<button class="recent-item" data-record-action="view" data-module="activities" data-id="${r.activity_id}"><span class="recent-date">${A.date(r.activity_date)}</span><strong>${A.esc(r.task_title)}</strong><span>${A.esc(r.full_name)} Â· ${A.label(r.status)}</span></button>`).join('')+'</div>':A.empty('No daily logs yet','Use + Daily log to record an update.')}</section></div>`;
  this.bindActions(); A.$('allWork').onclick=()=>A.change({view:'tasks'});A.$('allLogs').onclick=()=>A.change({view:'activities'});
  document.querySelectorAll('[data-person]').forEach(b=>b.onclick=()=>A.change({employee_id:b.dataset.person}));
  document.querySelectorAll('[data-dashboard-stage]').forEach(b=>b.onclick=()=>{this.stage=b.dataset.dashboardStage;A.change({view:'tasks'});});
  A.chart('teamTrend','line',Object.keys(d.trend),[{label:'Activity quantity',data:Object.values(d.trend),borderColor:'#9273ee',backgroundColor:'#9273ee15',fill:true,tension:.3,pointRadius:3,borderWidth:2}]);
 },
 async enhance(module,id,viewOnly){
  const A=App,r=Records.current.record,stage=module==='activities'?'':this.stageOf(module,r);
  const select=(key,label,values,value)=>`<div class="col-md-6"><label class="form-label" for="${key}">${label}</label><select id="${key}" class="form-select">${values.map(([v,l])=>`<option value="${v}" ${v===value?'selected':''}>${l}</option>`).join('')}</select></div>`;
  let html='';
  if(!viewOnly){
   if(module!=='activities'){
    html+=select('work_kind','Task type',[['special_task','Special task'],['system_development','System development']],module==='projects'?'system_development':'special_task');
   }
   let editor='';try{editor=localStorage.getItem('internHub.editor')||'';}catch{}
   html+=`<div class="col-12"><label class="form-label" for="update_comment">Update / supervisor feedback</label><textarea id="update_comment" class="form-control" rows="2" maxlength="4000" placeholder="Leave a progress note or explain requested changes"></textarea></div><div class="col-12"><label class="form-label" for="update_editor">Updated by (optional)</label><input id="update_editor" class="form-control" maxlength="100" list="peopleNames" value="${A.esc(editor)}" placeholder="Your name"><small class="text-muted">Shared workspace Â· names are self-reported</small></div>`;
  }else{
   html+=`<div class="col-12">${module==='activities'?'':A.badge(stage)}</div>`;

  }
  if(id){const events=await A.api('history',{module,id});html+=`<div class="col-12"><div class="form-section-heading"><strong>Change history</strong><span class="form-hint">Names are self-reported</span></div><div class="history-list">${events.map(e=>`<div class="history-item"><strong>${A.esc(e.editor)}</strong> <span>${A.label(e.action)} Â· ${A.esc(e.created_at)}</span>${e.comment?`<p>${A.esc(e.comment)}</p>`:''}</div>`).join('')||'<p class="form-hint">Imported record. New updates will appear here.</p>'}</div></div>`;}
  A.$('modalFields').insertAdjacentHTML('beforeend',html);
  if(!viewOnly && module!=='activities'){
   const status=A.$('field_'+ModuleConfig[module].status),progress=A.$('field_progress_percent');
   status.addEventListener('change',()=>{
    if(status.value==='completed')progress.value='100';
    else if(Number(progress.value)===100)progress.value=['pending','not_started'].includes(status.value)?'0':'99';
   });
   progress.addEventListener('input',()=>{
    if(!progress.value||!progress.checkValidity())return;
    if(Number(progress.value)===100)status.value='completed';
    else if(status.value==='completed')status.value='in_progress';
   });
   const kind=A.$('work_kind');
   if(id){kind.disabled=true;}
   else kind.onchange=async()=>{
    const type=kind.value,desired=type==='system_development'?'projects':'tasks';if(desired===module)return;
    const values=Object.fromEntries(new FormData(A.$('recordForm')));
    Records.formChanged=false;Workspace.type=type;await Records.open(desired);
    const mapping=module==='tasks'?{task_title:'project_name',pic:'developers'}:{project_name:'task_title',developers:'pic'};
    for(const [key,value] of Object.entries(values)){const node=A.$('field_'+(mapping[key]||key));if(node&& !['status','development_status','review_status'].includes(key))node.value=value;}
    Records.formChanged=true;
   };
  }
  if(!viewOnly && module==='activities'){
   const footer=A.$('saveRecordButton').parentElement;
   footer.insertAdjacentHTML('beforeend','<button type="submit" class="btn btn-light" id="saveAnother" value="another">Save & add another</button>');
  }
 }
};
const originalOpen=Records.open.bind(Records);
Records.open=async function(module,id=null,viewOnly=false){
 if(this.saving)return;
 const wasShown=App.$('recordModal').classList.contains('show');
 App.$('saveAnother')?.remove();
 App.$('deleteFromModal')?.remove();
 await originalOpen(module,id,viewOnly);
 if(wasShown)this.modalReady=true;
 if(this.current?.module===module && String(this.current.id)===String(id)){
  App.$('saveRecordButton').disabled=true;
  try{await Workspace.enhance(module,id,viewOnly);App.$('saveRecordButton').disabled=false;
   if(id&&!viewOnly)App.$('saveRecordButton').parentElement.insertAdjacentHTML('afterbegin',`<button type="button" class="btn btn-light text-danger me-auto" id="deleteFromModal" data-record-action="delete" data-module="${module}" data-id="${id}">Delete</button>`);
  }catch(e){App.$('modalError').textContent=e.message;App.$('modalError').classList.remove('d-none');App.$('saveRecordButton').disabled=true;}
 }
};
Records.save=async function(event){
 event.preventDefault();if(this.saving||this.current?.viewOnly)return;
 const A=App,cur=this.current,record=Object.fromEntries(new FormData(A.$('recordForm'))),another=event.submitter?.id==='saveAnother';
 const comment=A.$('update_comment').value.trim(),editor=A.$('update_editor').value.trim();
 if(A.$('update_comment').required&&!comment){A.$('update_comment').reportValidity();return;}
 this.saving=true;A.$('saveRecordButton').disabled=true;A.$('saveRecordButton').textContent='Savingâ€¦';if(A.$('saveAnother'))A.$('saveAnother').disabled=true;
 try{
  await A.api('save',{module:cur.module},{id:cur.id,version:cur.version,record,editor,comment});
  try{localStorage.setItem('internHub.editor',editor);}catch{}
  this.formChanged=false;
  if(!this.modalReady)await new Promise(resolve=>A.$('recordModal').addEventListener('shown.bs.modal',resolve,{once:true}));
  // Wait until Bootstrap finishes opening before requesting a close.
  // Form readiness can precede the end of the opening transition.
  const modal=bootstrap.Modal.getInstance(A.$('recordModal'));
  while(modal._isTransitioning)await new Promise(resolve=>setTimeout(resolve,20));
  this.saving=false;
  const hidden=new Promise(resolve=>A.$('recordModal').addEventListener('hidden.bs.modal',resolve,{once:true}));
  bootstrap.Modal.getInstance(A.$('recordModal')).hide();this.saving=true;A.toast('Saved. The shared workspace is updated.');await hidden;await A.load();this.saving=false;if(another)await this.open('activities');
 }catch(e){A.$('modalError').textContent=e.message;A.$('modalError').classList.remove('d-none');}
 finally{this.saving=false;A.$('saveRecordButton').disabled=false;A.$('saveRecordButton').textContent='Save record';if(A.$('saveAnother'))A.$('saveAnother').disabled=false;}
};
Records.remove=async function(module,id){
 const A=App;try{
  const d=await A.api('detail',{module,id});if(!confirm('Delete â€œ'+d.record[ModuleConfig[module].name]+'â€? You can restore it using Undo.'))return;
  const result=await A.api('delete',{module},{id,version:d.version});
  if(A.$('recordModal').classList.contains('show')){Records.formChanged=false;bootstrap.Modal.getInstance(A.$('recordModal')).hide();}
  A.$('toastText').innerHTML=`Record deleted. <button class="link-button" data-undo="${result.history_id}">Undo</button>`;bootstrap.Toast.getOrCreateInstance(A.$('appToast'),{delay:30000}).show();await A.load();
 }catch(e){A.error(e);}
};
App.renderers.tasks=()=>Workspace.renderWork();
App.renderers.projects=()=>{Workspace.sheet='projects';return Workspace.renderWork();};
App.renderers.dashboard=()=>Workspace.dashboard();
document.addEventListener('click',async e=>{
 const undo=e.target.closest('[data-undo]');if(undo){undo.disabled=true;try{await App.api('undo',{}, {history_id:Number(undo.dataset.undo)});App.toast('Record restored.');await App.load();}catch(error){App.error(error);undo.disabled=false;}}
});

