# Intern Hub

A native PHP 8+ / MySQL 8 dashboard for Wiwynn Malaysia Product Engineering. Bootstrap 5.3.3, Bootstrap Icons 1.11.3, and Chart.js 4.4.7 are served locally. No Node build, Composer installation, login, or roles are required.

## Start locally

1. Start MySQL in Laragon. The existing `intern_dashboard` database is required; this app does not recreate or seed it.
2. Keep your existing `.env`, or copy `.env.example` to `.env` and enter your database settings. Real process environment variables take precedence, including an empty password. Enable PDO MySQL in PHP.
3. From this project directory, run:

   ```powershell
   .\scripts\run-dev.ps1
   ```

4. Open **http://127.0.0.1:8095/**. Stop with Ctrl+C. Use `-Port 8096` if necessary.

For Laragon Apache, point a local virtual host's `DocumentRoot` and matching `<Directory>` at this project directory, enable `AllowOverride All`, and start Apache. Use PHP 8+ and Apache 2.4. Verify that `/.env`, `/.git/config`, `/config/db.php`, and `/storage/` return 403/404. The supplied PHP development router also blocks private paths. Do not run PHP's development server without that router. Keep Apache bound to localhost or restrict it to the intended internal network with your network administrator; this shared interface intentionally has no authentication.

PHP needs write access to `storage/sessions`; that folder is created automatically and blocked from HTTP. It contains CSRF session state only, not login accounts. Database exceptions are logged server-side; clients receive a generic error. No database credentials are embedded in PHP or committed to Git.

## Features

- Dashboard: eight database-backed cards, four charts, recent activities, intern and date filters.
- Daily Activity: AJAX add/edit/delete, details, search, date/status filters, sorting, pagination, filtered CSV.
- Weekly KPI: category-grouped matrix, individual editing, combined read-only overview, intern comparisons, trends, atomic saves, duplicate prevention and concurrent-edit checks.
- Special Tasks: free-text multi-person PIC, TAT descriptions, statuses, priorities, progress, modification requests, computed overdue indicator and completion timestamps.
- System Development: table/card views, dates, developer/PIC, status, review status, progress, links, improvement notes.
- Reports: daily, weekly KPI, monthly activity, task and project reports; paginated previews and full filtered UTF-8 CSV exports. XLSX/PDF libraries are not installed, so those optional formats are not offered.

All Interns includes Yong Wei, Teh Ru Qian, and Elijah She. Dalila remains in the database and may appear in PIC text, but is excluded from the intern filter. Existing name-based PIC fields are preserved and matched as complete name tokens, case-insensitively; shared records are counted once in All Interns. New tasks/projects must include at least one intern's full name; other people can also be included.

## Calendar and quantity rules

- User-confirmed anchor: **Thursday, 22 October 2026 begins WW45**. Each week runs Thursday through Wednesday. `config/work_weeks.php` calculates 2026 labels relative to that anchor, without changing stored labels or quantities. The database permits labels 1–54; these are mapped as labels, not a claim about annual rollover. Other years need a confirmed mapping before calendar-based week filtering can be used. No ISO week assumption is made.
- Year selects calendar year for dated records and stored `week_year` for KPI. Selecting an explicit week uses its mapped dates for dated records, including dates across a calendar-year boundary.
- Month/date filters on weekly KPI include the **entire quantity of each overlapping week**. Weekly quantities cannot be prorated into daily quantities. Dashboard and report exports share this logic. Date filters use `activity_date` for daily records and `assigned_date` for tasks/projects. Filters intersect.
- Blank means no KPI record; zero is an explicit recorded quantity. Clearing a saved cell deletes that exact employee/KPI/year/week record and its remarks, after confirmation. Updating a quantity preserves its existing remarks. Saves use a transaction and the existing unique constraint. Other interns' cells are unaffected.
- All current KPI units are `count`; totals are activity quantities, never performance percentages. Combined totals/charts are suppressed if incompatible units appear.
- Overdue means due date precedes today's Malaysia date and status is not completed. It is calculated rather than stored as a status. Imported status/progress inconsistencies are displayed as recorded and never silently corrected.
- Active projects means `in_progress` or `testing`. TAT retains the imported text rather than assuming an undocumented working-day calculation.

## Structure

```text
index.php                  Shared application shell
includes/bootstrap.php     Sessions, validation, shared queries and filters
config/db.php              PDO and private environment settings
config/work_weeks.php      Explicit work-week calendar
api/index.php              JSON CRUD, KPI, dashboard and CSV endpoints
assets/js/                 Separate dashboard, records, KPI, reports and common UI
assets/css/style.css       Responsive dashboard styling
assets/vendor/             Local Bootstrap and Chart.js
scripts/                   Local server and read-only database diagnostics
tests/                     HTTP integration and headless browser tests
database/                  Inspection notes; no migration required
```

API calls use `api/index.php?action=...` and `module=activities|tasks|projects`. Actions: `metadata`, `dashboard`, `list`, `detail`, `save`, `delete`, `kpi`, `save_kpi`, `report`, `export`. Reports additionally support `module=kpi|monthly`. Filters: `employee_id`, `year`, `month`, `week`, `from`, `to`, `status`, `search`. Sorting is allowlisted; pagination uses `page`. Writes require POST JSON and the session's `X-CSRF-Token` from the page meta element. Record edits/deletes include the detail response's `version`; KPI saves include the original quantity of each cell. Conflicts return HTTP 409.

## Validation

Run against a local development database while others are not editing:

```powershell
& 'C:\laragon\bin\nodejs\node-v18\node.exe' tests/integration.mjs 'http://127.0.0.1:8095' 'C:\laragon\bin\php\php-8.1.10-Win32-vs16-x64\php.exe'
```

The 32 integration checks create temporary marked records, clean them in `finally`, and verify SHA-256 fingerprints of all seven original tables before and after. Tests cover CRUD, all intern filters, calendar anchor, dashboard/report/chart consistency, CSRF, invalid input, concurrency, KPI duplicates/blank/zero, shared PICs, overdue calculation, safe links, CSV and private paths. Test inserts may advance AUTO_INCREMENT counters, but original rows and values are unchanged. KPI tests reserve year 2199 and refuse to proceed if the selected employee already has data there.

`tests/browser.mjs` uses Chrome DevTools on localhost port 9227, with no npm packages. Start a separate headless Chrome profile with `--remote-debugging-port=9227`, then invoke the script with the same server/PHP arguments. It tests rendering, AJAX modal save, intern selection, editable/read-only KPI views, unsaved changes, project cards, reports, mobile viewport and browser errors. It creates/removes one temporary activity, verifies database fingerprints, saves screenshots under ignored `storage/`, and closes that dedicated Chrome instance. Never point it at your normal browser profile.

Validation completed: 32 HTTP checks and 14 browser checks. Desktop 1440px and mobile 390px were checked. Original data fingerprints matched after both test suites.
