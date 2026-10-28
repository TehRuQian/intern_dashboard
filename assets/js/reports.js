'use strict';
App.renderers.reports=async()=>{
 const A=App,types={work:'Team Task Report',activities:'Daily Log Report',kpi:'Weekly KPI Report',monthly:'Monthly Activity Report',tasks:'Special Task Report',projects:'System Development Report'};
 const titleFields={work:'title',activities:'task_title',kpi:'kpi_name',monthly:'intern',tasks:'task_title',projects:'project_name'};
 const module=Object.hasOwn(types,A.state.report)?A.state.report:'activities';A.state.report=module;
 const d=await A.api('report',{module,sort:''});
 const statuses=module==='monthly'?ModuleConfig.activities.statuses:ModuleConfig[module]?.statuses||[];
 const perPage=12,pages=Math.max(1,Math.ceil(d.rows.length/perPage)),page=Math.min(A.state.page,pages),visible=d.rows.slice((page-1)*perPage,page*perPage);
 const titleField=titleFields[module],statusField=module==='projects'?'development_status':module==='work'?'stage':'status';
 const value=(column,record)=>{
  const raw=record[column];
  if(column===statusField&&raw)return A.badge(raw);
  if(column==='progress_percent'||column==='progress')return A.progress(raw);
  if(column.endsWith('_date'))return A.date(raw);
  if(column==='overdue')return raw?A.badge('overdue'):'No';
  return `<span>${A.esc(raw??'-')}</span>`;
 };
 const cards=visible.map(record=>{
  const fields=d.columns.filter(column=>column!==titleField&&column!==statusField);
  return `<article class="report-card"><header class="report-card-header"><div><span class="report-card-type">${A.esc(types[module])}</span><h3>${A.esc(record[titleField]??'Record')}</h3></div>${record[statusField]?A.badge(record[statusField]):''}</header><div class="report-card-fields">${fields.map(column=>`<div class="report-field"><span class="report-field-label">${A.esc(A.label(column))}</span><div class="report-field-value">${value(column,record)}</div></div>`).join('')}</div></article>`;
 }).join('');
 A.$('pageActions').innerHTML='<button class="btn btn-primary" id="exportReport">Export CSV</button>';
 A.$('pageContent').innerHTML=`<section class="report-shell"><div class="report-controls"><div><label for="reportType">Report type</label><select id="reportType" class="form-select">${Object.entries(types).map(([key,label])=>`<option value="${key}" ${key===module?'selected':''}>${label}</option>`).join('')}</select></div>${statuses.length?`<div><label for="reportStatus">Status</label><select id="reportStatus" class="form-select"><option value="">All statuses</option>${statuses.map(s=>`<option value="${s}" ${s===A.state.status?'selected':''}>${A.label(s)}</option>`).join('')}</select></div>`:''}<span class="report-count">${A.num(d.total)} records</span></div><div class="report-heading"><div><h2>${types[module]}</h2><p>Records matching the selected intern and date filters</p></div></div>${d.rows.length?`<div class="report-card-list">${cards}</div>`:A.empty('No matching report records','Select a different intern or date period.')}${A.pagination({total:d.total,page,pages})}</section><p class="kpi-note">CSV export includes every matching record across all pages.</p>`;
 A.$('reportType').addEventListener('change',e=>A.change({report:e.target.value,status:'',search:'',sort:''}));
 A.$('reportStatus')?.addEventListener('change',e=>A.change({status:e.target.value}));
 A.$('exportReport').addEventListener('click',()=>A.export(module,{sort:''}));
};
