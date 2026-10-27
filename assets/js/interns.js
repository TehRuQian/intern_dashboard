'use strict';
window.Interns = {
    adding:false,
    async render() {
        const A=App, people=await A.api('interns');
        // Refresh shared choices so new interns are available throughout the workspace.
        A.meta.interns=people;
        A.$('internSelect').innerHTML='<option value="">All Interns</option>'+people.filter(p=>p.is_active).map(p=>`<option value="${A.esc(p.employee_id)}">${A.esc(p.full_name)}</option>`).join('');
        A.$('internSelect').value=A.state.employee_id;
        A.$('pageActions').innerHTML='<button class="btn btn-primary" id="addIntern">+ Add intern</button>';
        A.$('pageContent').innerHTML=`<section class="panel mb-4" id="internFormPanel" hidden>
            <div class="panel-header"><h2>Add intern</h2></div>
            <form id="internForm" class="panel-body">
                <div id="internError" class="alert alert-danger" role="alert" hidden></div>
                <div class="row g-3">
                    <div class="col-md-6"><label class="form-label" for="internEmployee">Employee ID *</label><input id="internEmployee" name="employee_id" class="form-control" maxlength="30" required></div>
                    <div class="col-md-6"><label class="form-label" for="internName">Full name *</label><input id="internName" name="full_name" class="form-control" maxlength="150" required></div>
                    <div class="col-md-6"><label class="form-label" for="internStart">Internship start *</label><input id="internStart" name="internship_start" type="date" class="form-control" required></div>
                    <div class="col-md-6"><label class="form-label" for="internEnd">Internship end *</label><input id="internEnd" name="internship_end" type="date" class="form-control" required></div>
                </div>
                <p class="text-muted mt-3">Status is calculated automatically from the internship dates.</p>
                <div class="d-flex gap-2"><button class="btn btn-primary" id="saveIntern">Save intern</button><button type="button" class="btn btn-light" id="cancelIntern">Cancel</button></div>
            </form></section>
            <section class="panel"><div class="panel-header"><div><h2>Intern directory</h2><div class="panel-subtitle">${people.length} interns · Includes active and inactive internships</div></div></div>
            ${people.length?`<div class="table-responsive"><table class="table table-hover"><thead><tr><th>Employee ID</th><th>Full name</th><th>Internship start</th><th>Internship end</th><th>Status</th><th></th></tr></thead><tbody>${people.map(p=>`<tr><td>${A.esc(p.employee_id)}</td><td>${A.esc(p.full_name)}</td><td>${A.date(p.internship_start)}</td><td>${A.date(p.internship_end)}</td><td><span class="status-badge ${p.is_active?'status-completed':'status-not_started'}">${p.is_active?'Active':'Inactive'}</span></td><td><button class="link-button" data-intern-workspace="${A.esc(p.employee_id)}">View workspace</button></td></tr>`).join('')}</tbody></table></div>`:A.empty('No interns yet','Add an intern to get started.')}</section>`;
        A.$('addIntern').addEventListener('click',()=>{
            A.$('internFormPanel').hidden=false;
            A.$('internEmployee').focus();
        });
        A.$('cancelIntern').addEventListener('click',()=>{
            if(this.adding)return;
            if(A.dirty&&!confirm('Discard the unsaved intern details?'))return;
            A.dirty=false; A.$('internForm').reset(); A.$('internError').hidden=true; A.$('internFormPanel').hidden=true;
        });
        A.$('internStart').addEventListener('change',()=>A.$('internEnd').min=A.$('internStart').value);
        A.$('internForm').addEventListener('input',()=>A.dirty=true);
        A.$('internForm').addEventListener('submit',event=>this.save(event));
        A.$('pageContent').querySelectorAll('[data-intern-workspace]').forEach(button=>button.addEventListener('click',()=>A.change({view:'dashboard',employee_id:button.dataset.internWorkspace})));
    },
    async save(event) {
        event.preventDefault();
        if(this.adding)return;
        const A=App;
        this.adding=true; A.$('saveIntern').disabled=true; A.$('internError').hidden=true;
        try {
            await A.api('add_intern',{},Object.fromEntries(new FormData(event.target)));
            A.dirty=false;
            A.meta=await A.api('metadata');
            A.toast('Intern added.');
            await A.load();
        } catch(error) {
            A.$('internError').textContent=error.message; A.$('internError').hidden=false;
        } finally {
            this.adding=false;
            if(A.$('saveIntern'))A.$('saveIntern').disabled=false;
        }
    }
};
App.renderers.interns=()=>Interns.render();
