'use strict';
App.renderers.reports=async()=>{
 const A=App,types={work:'Team Task Report',activities:'Daily Log Report',kpi:'Weekly KPI Report',monthly:'Monthly Activity Report',tasks:'Special Task Report',projects:'System Development Report'};
 const module=Object.hasOwn(types,A.state.report)?A.state.report:'activities';A.state.report=module;
 const d=await A.api('report',{module,sort:''});
 const statuses=module==='monthly'?ModuleConfig.activities.statuses:ModuleConfig[module]?.statuses||[];
 const perPage=20,pages=Math.max(1,Math.ceil(d.rows.length/perPage)),page=Math.min(A.state.page,pages),visible=d.rows.slice((page-1)*perPage,page*perPage);
 A.$('pageActions').innerHTML='<button class="btn btn-primary" id="exportReport">↓ Export CSV</button>';
 A.$('pageContent').innerHTML=`<section class="panel"><div class="table-toolbar"><label for="reportType" class="text-muted small">Report</label><select id="reportType" class="form-select" style="max-width:245px">${Object.entries(types).map(([key,label])=>`<option value="${key}" ${key===module?'selected':''}>${label}</option>`).join('')}</select>${statuses.length?`<select id="reportStatus" class="form-select" aria-label="Filter report status"><option value="">All statuses</option>${statuses.map(s=>`<option value="${s}" ${s===A.state.status?'selected':''}>${A.label(s)}</option>`).join('')}</select>`:''}<span class="record-count">${A.num(d.total)} report rows</span></div><div class="panel-header"><div><h2>${types[module]}</h2><div class="panel-subtitle">Shared team records matching your selected intern and dates</div></div></div>${d.rows.length?`<div class="table-responsive report-preview"><table class="table table-hover"><thead><tr>${d.columns.map(c=>`<th>${A.esc(A.label(c))}</th>`).join('')}</tr></thead><tbody>${visible.map(r=>`<tr>${d.columns.map(c=>`<td>${c==='status'||c==='development_status'?A.badge(r[c]):c==='progress_percent'?A.progress(r[c]):`<span class="truncate" title="${A.esc(r[c])}">${A.esc(r[c]??'—')}</span>`}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:A.empty('No matching report records','Select a different intern or date period.')}${A.pagination({total:d.total,page,pages})}</section><p class="kpi-note">Export includes every matching row across all pages. KPI reports show recorded weekly quantities.</p>`;
 A.$('reportType').addEventListener('change',e=>A.change({report:e.target.value,status:'',search:'',sort:''}));
 A.$('reportStatus')?.addEventListener('change',e=>A.change({status:e.target.value}));
 A.$('exportReport').addEventListener('click',()=>A.export(module,{sort:''}));
};
