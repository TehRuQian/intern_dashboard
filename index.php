<?php
require __DIR__ . '/includes/bootstrap.php';
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');
header("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
?>
<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="csrf-token" content="<?= htmlspecialchars($_SESSION['csrf'], ENT_QUOTES, 'UTF-8') ?>">
<title>Intern Hub · Wiwynn Product Engineering</title>
<link rel="stylesheet" href="assets/vendor/bootstrap.min.css"><link rel="stylesheet" href="assets/css/style.css">
<?php foreach (['vendor/bootstrap.bundle.min.js','vendor/chart.umd.js','js/modules.js','js/app.js','js/dashboard.js','js/records.js','js/kpi.js','js/reports.js'] as $script): ?><script defer src="assets/<?= $script ?>"></script><?php endforeach; ?>
</head><body class="sidebar-collapsed"><a class="skip-link" href="#content">Skip to content</a>
<aside class="sidebar" id="sidebar">

<div class="workspace-label sidebar-label">INTERN WORKSPACE</div><nav aria-label="Main navigation">
<?php foreach (['dashboard'=>['grid-1x2','Dashboard'],'activities'=>['journal-text','Daily Activity'],'kpi'=>['bar-chart-line','Weekly KPI'],'tasks'=>['list-task','Special Tasks'],'projects'=>['code-square','System Development'],'reports'=>['file-earmark-bar-graph','Reports']] as $view => [$icon,$label]): ?>
<a href="?view=<?= $view ?>" data-view="<?= $view ?>"><svg class="nav-icon" aria-hidden="true" width="20" height="20" fill="currentColor"><use href="assets/vendor/bootstrap-icons.svg#<?= $icon ?>"></use></svg><span class="sidebar-label"><?= $label ?></span></a>
<?php endforeach; ?></nav>
<div class="sidebar-bottom sidebar-label"><strong>Intern Hub</strong><small>Product Engineering</small></div></aside><div class="sidebar-scrim" id="sidebarScrim"></div>
<div class="main-shell"><header class="topbar"><div class="d-flex align-items-center gap-3"><button class="icon-button" id="sidebarToggle" aria-label="Toggle sidebar" aria-expanded="false">☰</button><span class="topbar-breadcrumb">Workspace <span>/</span> <strong id="breadcrumb">Dashboard</strong></span></div>
<div class="topbar-tools"><span class="today" id="today"></span><span class="topbar-divider"></span><label class="intern-label" for="internSelect">Viewing</label><select id="internSelect" class="form-select intern-select" aria-label="Select intern"><option value="">All Interns</option></select><button class="icon-button" id="refreshButton" aria-label="Refresh records" title="Refresh records">↻</button></div></header>
<main id="content" tabindex="-1"><div class="page-heading"><div><div class="eyebrow">PRODUCT ENGINEERING / INTERNSHIP</div><h1 id="pageTitle">Dashboard</h1><p id="pageDescription">A clear view of your team’s progress and contributions.</p></div><div id="pageActions" class="d-flex gap-2"></div></div>
<section class="filter-panel" aria-label="Record filters"><div class="filter-caption">≡ &nbsp; Filters <button class="btn btn-link btn-sm ms-auto p-0" id="clearFilters">Reset</button></div><div class="filters-grid">
<label>Year<input type="number" id="filterYear" min="1900" max="2200" class="form-control" placeholder="All years"></label>
<label>Month<select id="filterMonth" class="form-select"><option value="">All months</option><?php foreach (range(1,12) as $month): ?><option value="<?= $month ?>"><?= date('F', mktime(0,0,0,$month,1,2026)) ?></option><?php endforeach; ?></select></label>
<label>Work week<select id="filterWeek" class="form-select"><option value="">All weeks</option><?php foreach (range(1,54) as $week): ?><option value="<?= $week ?>">WW<?= str_pad((string)$week,2,'0',STR_PAD_LEFT) ?></option><?php endforeach; ?></select></label>
<label>From date<input type="date" id="filterFrom" class="form-control"></label><label>To date<input type="date" id="filterTo" class="form-control"></label><div class="filter-apply"><button class="btn btn-primary" id="applyFilters">Apply filters</button></div></div>
<div class="filter-help">Dates use activity date or assigned date. KPI date filters include whole overlapping weeks. 2026: Thursday–Wednesday, 22 Oct = WW45.</div></section>
<div id="errorBanner" class="alert alert-danger d-none" role="alert"></div><div id="liveStatus" class="visually-hidden" role="status" aria-live="polite"></div><div id="pageContent" aria-live="polite"></div><footer class="page-footer"><span>Intern Hub · Wiwynn Malaysia</span><span>Shared workspace · Changes are visible to everyone</span></footer></main></div>
<div class="modal fade" id="recordModal" tabindex="-1" aria-labelledby="modalTitle" aria-hidden="true"><div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable"><div class="modal-content"><div class="modal-header"><h2 class="modal-title fs-5" id="modalTitle"></h2><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div><form id="recordForm"><div class="modal-body"><div id="modalError" class="alert alert-danger d-none" role="alert"></div><div id="modalFields" class="row g-3"></div></div><div class="modal-footer"><button type="button" class="btn btn-light" data-bs-dismiss="modal">Cancel</button><button type="submit" class="btn btn-primary" id="saveRecordButton">Save record</button></div></form></div></div></div>
<div class="toast-container position-fixed bottom-0 end-0 p-3"><div id="appToast" class="toast" role="status" aria-live="polite"><div class="d-flex"><div class="toast-body" id="toastText"></div><button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button></div></div></div></body></html>
