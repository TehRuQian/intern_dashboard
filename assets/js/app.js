'use strict';
window.App = {
    state: {view:'dashboard',employee_id:'',year:'',month:'',week:'',from:'',to:'',page:1,search:'',status:'',sort:'',direction:'desc',report:'activities',projectView:'table'},
    renderers:{}, charts:[], meta:null, dirty:false, controller:null,
    $: id => document.getElementById(id),
    esc: value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
    label: value => String(value ?? '').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase()),
    num: value => value === null ? '—' : new Intl.NumberFormat('en-MY',{maximumFractionDigits:2}).format(Number(value)),
    icon: name => `<svg width="20" height="20" fill="currentColor" aria-hidden="true"><use href="assets/vendor/bootstrap-icons.svg#${name}"></use></svg>`,
    date(value) { return value ? new Date(value.slice(0,10)+'T12:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '—'; },
    badge(value) { return `<span class="status-badge status-${this.esc(value)}">${this.esc(this.label(value))}</span>`; },
    progress(value) { const n=Math.min(100,Math.max(0,Number(value)||0)); return `<div class="progress-value">${n}%</div><div class="progress" role="progressbar" aria-label="Completion" aria-valuenow="${n}" aria-valuemin="0" aria-valuemax="100"><div class="progress-bar" style="width:${n}%"></div></div>`; },
    empty(title='No records found',text='Try adjusting the filters, or add a new record.') { return `<div class="empty-state"><span class="empty-symbol" aria-hidden="true">▤</span><strong>${this.esc(title)}</strong>${this.esc(text)}</div>`; },
    params(extra={}) {
        const p=new URLSearchParams();
        for(const key of ['employee_id','year','month','week','from','to','search','status','page','sort','direction']) if(this.state[key] !== '' && this.state[key] !== null) p.set(key,this.state[key]);
        for(const [key,value] of Object.entries(extra)) { if(value === '' || value === null) p.delete(key); else p.set(key,value); }
        return p;
    },
    async api(action,extra={},body=null) {
        const p=this.params({...extra,action});
        const response=await fetch('api/index.php?'+p,{signal:this.controller?.signal,credentials:'same-origin',headers:body?{'Content-Type':'application/json','X-CSRF-Token':document.querySelector('meta[name="csrf-token"]').content}:{},...(body?{method:'POST',body:JSON.stringify(body)}:{})});
        let result; try { result=await response.json(); } catch { throw new Error('Unexpected server response. Check that PHP is running and retry.'); }
        if(!response.ok || !result.success) throw new Error(result.error || 'Request failed.');
        return result.data;
    },
    error(error) { if(error.name==='AbortError') return; this.$('errorBanner').textContent=error.message || String(error); this.$('errorBanner').classList.remove('d-none'); },
    toast(message) { this.$('toastText').textContent=message; bootstrap.Toast.getOrCreateInstance(this.$('appToast'),{delay:4000}).show(); },
    mayLeave() { if(!this.dirty) return true; if(!confirm('Discard your unsaved KPI changes?')) return false; this.dirty=false; return true; },
    syncFilters() {
        for(const key of ['year','month','week','from','to']) this.$('filter'+this.label(key)).value=this.state[key];
        this.$('internSelect').value=this.state.employee_id;
    },
    saveURL(replace=false) {
        const params=this.params({view:this.state.view,report:this.state.report});
        params.set('employee_id',this.state.employee_id);
        history[replace?'replaceState':'pushState']({},'',location.pathname+'?'+params);
        try { localStorage.setItem('internHub.employee',this.state.employee_id); } catch {}
    },
    readURL() {
        const q=new URLSearchParams(location.search);
        for(const key of ['view','employee_id','year','month','week','from','to','search','status','sort','direction','report']) if(q.has(key)) this.state[key]=q.get(key);
        if(!q.has('employee_id')) { try { this.state.employee_id=localStorage.getItem('internHub.employee')||''; } catch {} }
        if(!['dashboard','activities','tasks','projects','kpi','reports'].includes(this.state.view)) this.state.view='dashboard';
        this.state.page=Math.max(1,parseInt(q.get('page'),10)||1);
    },
    async load() {
        this.controller?.abort(); this.controller=new AbortController();
        this.charts.forEach(c=>c.destroy()); this.charts=[];
        const view=this.state.view;
        const title=ModuleConfig[view]?.title || ({dashboard:'Dashboard',kpi:'Weekly KPI',reports:'Reports'}[view]);
        this.$('pageTitle').textContent=title; this.$('breadcrumb').textContent=title;
        this.$('pageDescription').textContent=ModuleConfig[view]?.description || ({dashboard:'A clear view of your team’s progress and contributions.',kpi:'Track weekly activity quantities. Every contribution counts.',reports:'Turn your team’s records into clear, shareable reports.'}[view]);
        this.$('pageActions').innerHTML=''; this.$('errorBanner').classList.add('d-none');
        document.querySelectorAll('[data-view]').forEach(a=>{a.classList.toggle('active',a.dataset.view===view); if(a.dataset.view===view)a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current');});
        this.syncFilters();
        this.$('pageContent').innerHTML='<div class="loading-state"><span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Loading records…</div>';
        this.$('liveStatus').textContent='Loading '+title;
        try { await this.renderers[view](); this.$('liveStatus').textContent=title+' loaded'; }
        catch(e) { if(e.name==='AbortError')return; this.error(e); this.$('pageContent').innerHTML=this.empty('Unable to load records','Adjust the filters or use Refresh to try again.'); }
    },
    async change(changes,{resetPage=true}={}) {
        if(!this.mayLeave()) { this.syncFilters(); return; }
        Object.assign(this.state,changes); if(resetPage)this.state.page=1;
        if(changes.view) { this.state.status=''; this.state.search=''; this.state.sort=''; }
        if(this.state.view==='kpi' && !this.state.year)this.state.year=String(this.meta.years.last_year || this.meta.today.slice(0,4));
        document.body.classList.remove('sidebar-open'); this.saveURL(); await this.load();
    },
    pagination(data) {
        return `<div class="table-bottom"><span>${this.num(data.total)} records · Page ${data.page} of ${data.pages}</span><div class="d-flex gap-2"><button class="btn btn-light btn-sm" data-page="${data.page-1}" ${data.page<=1?'disabled':''}>← Previous</button><button class="btn btn-light btn-sm" data-page="${data.page+1}" ${data.page>=data.pages?'disabled':''}>Next →</button></div></div>`;
    },
    async export(module,extra={}) {
        try {
            const response=await fetch('api/index.php?'+this.params({action:'export',module,...extra}),{credentials:'same-origin'});
            if(!response.ok) { const result=await response.json(); throw new Error(result.error || 'Export failed.'); }
            const blob=await response.blob(); const url=URL.createObjectURL(blob); const a=document.createElement('a');
            a.href=url; a.download=`intern-${module}-${this.meta.today}.csv`; document.body.append(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
            this.toast('Filtered CSV exported.');
        } catch(e) { this.error(e); }
    },
    chart(id,type,labels,datasets,options={}) {
        const node=this.$(id); if(!node)return;
        if(!window.Chart || !labels.length) { node.parentElement.innerHTML='<div class="chart-empty">'+(!window.Chart?'Chart library unavailable.':'No recorded data for these filters.')+'</div>'; return; }
        Chart.defaults.font.family='"Segoe UI", Arial, sans-serif'; Chart.defaults.font.size=10; Chart.defaults.color='#8a96a9';
        const scales=type==='doughnut'?{}:{x:{grid:{display:false},border:{display:false}},y:{beginAtZero:true,grid:{color:'#eef1f6'},border:{display:false},ticks:{precision:0}}};
        this.charts.push(new Chart(node,{type,data:{labels,datasets},options:{responsive:true,maintainAspectRatio:false,animation:{duration:250},plugins:{legend:{display:type==='doughnut',position:'bottom',labels:{usePointStyle:true,boxWidth:7,padding:16}},tooltip:{padding:10}},scales,...options}}));
    }
};
document.addEventListener('DOMContentLoaded',async()=>{
    const A=App; A.readURL();
    document.querySelectorAll('[data-view]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();A.change({view:a.dataset.view});}));
    A.$('sidebarToggle').addEventListener('click',()=>{
        const mobile=matchMedia('(max-width:767px)').matches;
        document.body.classList.toggle(mobile?'sidebar-open':'sidebar-collapsed');
        A.$('sidebarToggle').setAttribute('aria-expanded',String(mobile?document.body.classList.contains('sidebar-open'):!document.body.classList.contains('sidebar-collapsed')));
    });
    A.$('sidebarScrim').addEventListener('click',()=>document.body.classList.remove('sidebar-open'));
    A.$('internSelect').addEventListener('change',e=>A.change({employee_id:e.target.value}));
    A.$('applyFilters').addEventListener('click',()=>{
        const changes={}; for(const key of ['year','month','week','from','to'])changes[key]=A.$('filter'+A.label(key)).value;
        A.change(changes);
    });
    A.$('clearFilters').addEventListener('click',()=>A.change({year:'',month:'',week:'',from:'',to:'',status:'',search:'',sort:''}));
    A.$('refreshButton').addEventListener('click',()=>{if(A.mayLeave())A.load();});
    addEventListener('beforeunload',e=>{if(A.dirty){e.preventDefault();e.returnValue='';}});
    addEventListener('popstate',()=>{ if(!A.mayLeave()){A.saveURL();return;} A.state.search='';A.state.status='';A.state.sort='';A.state.year='';A.state.month='';A.state.week='';A.state.from='';A.state.to='';A.readURL();A.load(); });
    document.addEventListener('click',e=>{const b=e.target.closest('[data-page]');if(b && !b.disabled)A.change({page:Number(b.dataset.page)},{resetPage:false});});
    try {
        A.meta=await A.api('metadata');
        if(A.state.employee_id && !A.meta.interns.some(p=>p.employee_id===A.state.employee_id))A.state.employee_id='';
        A.$('internSelect').innerHTML='<option value="">All Interns</option>'+A.meta.interns.map(p=>`<option value="${A.esc(p.employee_id)}">${A.esc(p.full_name)}</option>`).join('');
        A.$('today').textContent=new Date(A.meta.today+'T12:00:00').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short',year:'numeric'});
        if(A.state.view==='kpi' && !A.state.year)A.state.year=String(A.meta.years.last_year || A.meta.today.slice(0,4));
        A.saveURL(true); await A.load();
    } catch(e) { A.error(e); A.$('pageContent').innerHTML=A.empty('Database connection required','Start MySQL in Laragon and check your .env settings, then refresh this page.'); }
});
