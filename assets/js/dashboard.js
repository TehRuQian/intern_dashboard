'use strict';
App.renderers.dashboard=async()=>{
 const A=App; const d=await A.api('dashboard');
 const labels=['Total Daily Activities','Completed Activities','Total Activity Quantity','Total Special Tasks','Pending Special Tasks','Completed Special Tasks','Active System Projects','Overdue Special Tasks'];
 const icons=['journal-text','check2-circle','bar-chart-line','list-task','clock','check2-circle','code-square','exclamation-triangle'].map(name=>A.icon(name));
 const panel=(title,subtitle,id,extra='')=>`<section class="panel"><div class="panel-header"><div><h2>${title}</h2><div class="panel-subtitle">${subtitle}</div></div>${extra}</div><div class="panel-body"><div class="chart-wrap"><canvas id="${id}" role="img" aria-label="${title}"></canvas></div></div></section>`;
 A.$('pageActions').innerHTML='<button class="btn btn-primary" id="dashboardAdd">＋ Add activity</button>';
 A.$('pageContent').innerHTML=(d.mixed_units?'<div class="alert alert-info">Different KPI units are recorded. Select an individual activity to view quantities without combining incompatible units.</div>':'')+
 '<div class="section-kicker"><strong>Overview</strong><span>Selected intern · Active filters</span></div><div class="stats-grid">'+labels.map((l,i)=>`<div class="stat-card"><div class="stat-icon" aria-hidden="true">${icons[i]}</div><div><div class="stat-label">${l}</div><div class="stat-value">${A.num(d.summary[i])}</div><div class="stat-unit">${i===2?'Recorded KPI quantities':'From your team’s records'}</div></div></div>`).join('')+'</div><div class="charts-grid">'+
 panel('Weekly KPI trend','Recorded activity quantities across work weeks','trendChart','<select id="dashboardKpi" class="form-select chart-filter" aria-label="Filter KPI activity"><option value="">All KPI activities</option>'+A.meta.kpis.map(k=>`<option value="${k.kpi_id}">${A.esc(k.kpi_name)}</option>`).join('')+'</select>')+
 panel('KPI activity distribution','Compare quantities across activities','distributionChart')+
 panel('Special task status','Where your assignments stand','taskStatusChart')+
 panel('System development','Project completion, as recorded','projectChart')+'</div>'+
 `<section class="panel"><div class="panel-header"><div><h2>Recent activities</h2><div class="panel-subtitle">The latest updates from your team</div></div><button class="link-button" id="viewAllActivities">View all activities →</button></div>${d.recent.length?'<div class="table-responsive"><table class="table table-hover"><thead><tr><th>Date</th><th>Intern</th><th>Task</th><th>Milestone</th><th>Status</th><th>Action</th></tr></thead><tbody>'+d.recent.map(r=>`<tr><td class="text-nowrap">${A.date(r.activity_date)}</td><td class="text-nowrap">${A.esc(r.full_name)}</td><td class="title-cell"><span class="truncate" title="${A.esc(r.task_title)}">${A.esc(r.task_title)}</span></td><td><span class="truncate">${A.esc(r.milestone||'—')}</span></td><td>${A.badge(r.status)}</td><td><button class="link-button" data-record-action="view" data-module="activities" data-id="${r.activity_id}">View details</button></td></tr>`).join('')+'</tbody></table></div>':A.empty('No recent activities','Activities matching your filters will appear here.')}</section>`;
 A.$('dashboardAdd').addEventListener('click',()=>Records.open('activities'));
 A.$('viewAllActivities').addEventListener('click',()=>A.change({view:'activities'}));
 const trend=data=>A.chart('trendChart','line',Object.keys(data),[{label:'Activity quantity',data:Object.values(data),borderColor:'#4f83ee',backgroundColor:'#4f83ee12',fill:true,tension:.3,pointRadius:3,borderWidth:2}]);
 trend(d.trend);
 A.chart('distributionChart','bar',Object.keys(d.distribution),[{label:'Activity quantity',data:Object.values(d.distribution),backgroundColor:'#83a8f5',borderRadius:4}],{indexAxis:'y'});
 A.chart('taskStatusChart','doughnut',d.summary[3]?Object.keys(d.statuses).map(s=>A.label(s)):[],[{data:Object.values(d.statuses),backgroundColor:['#f3bf59','#5a8eef','#af94da','#66b79a'],borderWidth:4,borderColor:'#fff'}],{cutout:'74%',scales:{}});
 A.chart('projectChart','bar',d.projects.map(p=>p.project_name),[{label:'Progress (%)',data:d.projects.map(p=>p.progress_percent),backgroundColor:'#8baaf0',borderRadius:4}],{indexAxis:'y',scales:{x:{min:0,max:100,grid:{color:'#eef1f6'}},y:{grid:{display:false},ticks:{callback:function(value){const label=this.getLabelForValue(value);return label.length>25?label.slice(0,25)+'…':label;}}}}});
 A.$('dashboardKpi').addEventListener('change',async e=>{
   const selected=e.target.value;
   try {const filtered=await A.api('dashboard',{kpi_id:selected}); if(e.target.value!==selected)return; const canvas=A.$('trendChart'); const chart=canvas && Chart.getChart(canvas);chart?.destroy();
     if(!canvas)A.$('dashboardKpi').closest('.panel').querySelector('.chart-wrap').innerHTML='<canvas id="trendChart" role="img" aria-label="Weekly KPI trend"></canvas>';trend(filtered.trend);
   }catch(error){A.error(error);}
 });
};
