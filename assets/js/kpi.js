'use strict';
window.Kpi={
 data:null,start:null,end:null,
 async render() {
  const A=App;const d=await A.api('kpi');this.data=d;
  const all=!A.state.employee_id;
  const recordedWeeks=d.records.map(r=>Number(r.week_no));
  const min=recordedWeeks.length?Math.min(...recordedWeeks):d.weeks[0]||1,max=recordedWeeks.length?Math.max(...recordedWeeks):Math.min(12,d.weeks.at(-1)||12);
  if(A.state.week || A.state.month || A.state.from || A.state.to){this.start=d.weeks[0]||1;this.end=d.weeks.at(-1)||1;}
  else {this.start=this.start??min;this.end=this.end??max;}
  const weeks=d.weeks.filter(w=>w>=this.start && w<=this.end);
  const values=new Map();
  for(const r of d.records){const key=r.kpi_id+':'+r.week_no;values.set(key,all?(values.get(key)||0)+Number(r.quantity):r.quantity);}
  const units=new Set(d.types.map(t=>t.unit));const canTotal=units.size===1;
  A.$('pageActions').innerHTML=`<button class="btn btn-light" id="exportKpi">↓ Export CSV</button>${!all?'<button class="btn btn-primary" id="saveKpi" disabled>Save changes</button>':''}`;
  const totals={};let lastCategory=null;
  const body=d.types.map(t=>{
    let html='';if(lastCategory!==t.category_name){lastCategory=t.category_name;html=`<tr class="category-row"><td colspan="${weeks.length+1}">${A.esc(t.category_name)}</td></tr>`;}
    html+=`<tr><td>${A.esc(t.kpi_name)}<div class="subtext">${A.esc(t.unit)}${!t.is_active?' · Inactive definition':''}</div></td>`;
    for(const week of weeks){const key=t.kpi_id+':'+week,quantity=values.has(key)?values.get(key):null;totals[week]=(totals[week]||0)+Number(quantity||0);
      html+=`<td>${all?(quantity===null?'<span class="text-muted">—</span>':A.num(quantity)):`<input type="number" class="kpi-input" min="0" max="99999999.99" step="0.01" data-kpi="${t.kpi_id}" data-week="${week}" data-original="${quantity===null?'':A.esc(quantity)}" value="${quantity===null?'':A.esc(Number(quantity))}" aria-label="${A.esc(t.kpi_name)}, WW${week}" placeholder="—">`}</td>`;
    }return html+'</tr>';
  }).join('');
  A.$('pageContent').innerHTML=`<div class="readonly-note">${all?'All Interns combines the three interns’ quantities. Select an intern above to edit their own records.':'Edit a cell, then save your changes. Other interns’ values remain separate.'}</div><section class="panel"><div class="panel-header"><div><h2>Weekly activity matrix · ${A.esc(A.state.year)}</h2><div class="panel-subtitle">${all?'Combined overview':A.esc(A.meta.interns.find(p=>p.employee_id===A.state.employee_id)?.full_name)} · Grouped by KPI category</div></div><form id="kpiRange" class="kpi-range"><label for="weekStart">WW</label><input class="form-control" type="number" min="1" max="54" id="weekStart" value="${this.start}" required><label for="weekEnd">to</label><input class="form-control" type="number" min="1" max="54" id="weekEnd" value="${this.end}" required><button class="btn btn-light btn-sm">Show</button></form></div>${weeks.length?`<div class="table-responsive"><table class="table kpi-table"><thead><tr><th>KPI activity</th>${weeks.map(w=>`<th title="${A.esc(d.dates[w]?d.dates[w].start+' – '+d.dates[w].end:'Calendar not configured')}">WW${String(w).padStart(2,'0')}</th>`).join('')}</tr></thead><tbody>${body}</tbody>${canTotal?`<tfoot><tr><td>Total activity quantity</td>${weeks.map(w=>`<td data-total-week="${w}">${A.num(totals[w]||0)}</td>`).join('')}</tr></tfoot>`:''}</table></div>`:A.empty('No work weeks overlap these filters','Choose a different date range.')}</section><p class="kpi-note">Blank / — = no recorded value. 0 = an explicit zero. Clearing a saved cell removes that KPI record, including its remarks. Weekly totals are quantities, not performance percentages.</p><div class="comparison-grid"><section class="panel"><div class="panel-header"><div><h2>Work-week comparison</h2><div class="panel-subtitle">Activity quantities by intern · all active filters</div></div></div><div class="panel-body"><div class="chart-wrap"><canvas id="kpiTrend" role="img" aria-label="KPI trend by intern"></canvas></div></div></section><section class="panel"><div class="panel-header"><div><h2>Activity comparison</h2><div class="panel-subtitle">Quantities by activity · all active filters</div></div></div><div class="panel-body"><div class="chart-wrap"><canvas id="kpiDistribution" role="img" aria-label="KPI activity comparison"></canvas></div></div></section></div>`;
  if(all){
    A.$('pageContent').insertAdjacentHTML('beforeend',`<section class="panel mt-3"><div class="panel-header"><h2>Intern comparison · ${A.esc(A.state.year)}</h2></div><div class="table-responsive"><table class="table"><thead><tr><th>KPI activity</th>${A.meta.interns.map(p=>`<th>${A.esc(p.full_name)}</th>`).join('')}</tr></thead><tbody>${d.types.map(t=>`<tr><td>${A.esc(t.kpi_name)} <small class="text-muted">(${A.esc(t.unit)})</small></td>${A.meta.interns.map(p=>{const r=d.records.filter(r=>r.kpi_id===t.kpi_id && r.employee_id===p.employee_id);return `<td>${r.length?A.num(r.reduce((s,r)=>s+Number(r.quantity),0)):'—'}</td>`;}).join('')}</tr>`).join('')}</tbody></table></div></section>`);
  }
  A.$('exportKpi').addEventListener('click',()=>A.export('kpi'));
  A.$('saveKpi')?.addEventListener('click',()=>this.save());
  A.$('kpiRange').addEventListener('submit',e=>{e.preventDefault();const start=Number(A.$('weekStart').value),end=Number(A.$('weekEnd').value);if(start>end){A.error(new Error('Start week must not exceed end week.'));return;}if(!A.mayLeave())return;this.start=start;this.end=end;A.load();});
  A.$('pageContent').querySelectorAll('.kpi-input').forEach(input=>input.addEventListener('input',()=>{
    const original=input.dataset.original;
    const same=(input.value===''&&original==='')||(input.value!==''&&original!==''&&Number(input.value)===Number(original));
    input.classList.toggle('dirty',!same);A.dirty=!!document.querySelector('.kpi-input.dirty');A.$('saveKpi').disabled=!A.dirty;
    if(canTotal){let total=0;document.querySelectorAll(`.kpi-input[data-week="${input.dataset.week}"]`).forEach(i=>total+=Number(i.value)||0);document.querySelector(`[data-total-week="${input.dataset.week}"]`).textContent=A.num(total);}
  }));
  const labels=[...new Set(d.records.map(r=>r.week_no))].sort((a,b)=>a-b);
  if(canTotal){
   const people=all?A.meta.interns:A.meta.interns.filter(p=>p.employee_id===A.state.employee_id);
   const colors=['#4f83ee','#68b49b','#b295dc'];
   A.chart('kpiTrend','line',labels.map(w=>'WW'+w),people.map((p,i)=>({label:p.full_name,data:labels.map(w=>{const r=d.records.filter(r=>r.employee_id===p.employee_id&&r.week_no===w);return r.length?r.reduce((s,r)=>s+Number(r.quantity),0):null;}),borderColor:colors[i],backgroundColor:colors[i],tension:.25,pointRadius:3,borderWidth:2})),{plugins:{legend:{display:true,position:'bottom',labels:{usePointStyle:true}}}});
   const names=[...new Set(d.records.map(r=>r.kpi_name))];
   A.chart('kpiDistribution','bar',names,[{label:'Activity quantity',data:names.map(name=>d.records.filter(r=>r.kpi_name===name).reduce((s,r)=>s+Number(r.quantity),0)),backgroundColor:'#8baaf0',borderRadius:4}],{indexAxis:'y'});
  }else{A.$('kpiTrend').parentElement.innerHTML='<div class="chart-empty">Mixed units: compare quantities in the matrix.</div>';A.$('kpiDistribution').parentElement.innerHTML='<div class="chart-empty">Different units are not combined into totals.</div>';}
 },
 async save() {
  const A=App,inputs=[...document.querySelectorAll('.kpi-input.dirty')];if(!inputs.length)return;
  if(inputs.some(i=>!i.checkValidity())){inputs.find(i=>!i.checkValidity()).reportValidity();return;}
  if(inputs.some(i=>i.value===''&&i.dataset.original!=='')&&!confirm('Clear these saved KPI records? Their quantities and remarks will be removed; a blank is not zero.'))return;
  const button=A.$('saveKpi');button.disabled=true;button.textContent='Saving…';document.querySelectorAll('.kpi-input').forEach(i=>i.disabled=true);
  try {
   await A.api('save_kpi',{}, {employee_id:A.state.employee_id,year:Number(A.state.year),cells:inputs.map(i=>({kpi_id:Number(i.dataset.kpi),week:Number(i.dataset.week),quantity:i.value===''?null:i.value,original:i.dataset.original===''?null:i.dataset.original}))});
   A.dirty=false;A.toast('KPI quantities saved.');await A.load();
  }catch(e){A.error(e);button.disabled=false;button.textContent='Save changes';document.querySelectorAll('.kpi-input').forEach(i=>i.disabled=false);}
 }
};
App.renderers.kpi=()=>Kpi.render();
