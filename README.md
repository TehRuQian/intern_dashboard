# Intern Hub - hosting

Shared PHP/MySQL intern dashboard. No Node.js, Composer, build step or login is required.

## Upload

1. Use Apache with PHP 8+ (PDO MySQL enabled) and MySQL 8. The queries use MySQL 8 functions; MariaDB compatibility has not been verified.
2. Extract storage/intern-dashboard-hosting.zip into the site's document root. Include all .htaccess files; Apache must allow their rules.
3. Export the existing intern_dashboard database from your local MySQL and import it on the hosting server. The ZIP contains application code, not database records. database/workflow.sql is an additive migration, not a complete database backup. Apply it only if the imported database lacks the workflow tables, using your database administration tool or scripts/migrate_workflow.php in PHP CLI.
4. Copy .env.example to .env on the server and enter the hosting database credentials. Real server environment variables can also supply these settings.
5. Give PHP write access to storage/ so it can create storage/sessions/. Open the site and check the dashboard, task list, daily logs, KPI and reports.

## Files

- index.php: application shell
- api/: JSON requests and CSV exports
- assets/: styles, application JavaScript, Bootstrap, Chart.js and icon sprite
- includes/: application queries, validation, sessions and workflow logic
- config/: database connection and confirmed work-week calendar
- database/workflow.sql and scripts/migrate_workflow.php: workflow setup
- storage/.htaccess: protects runtime session storage
- .htaccess: root server protection
- .env.example: database settings template

Keep .env, .git and existing local sessions out of an upload package. The prepared ZIP already excludes them. Keep the .htaccess protections in place and ensure private paths such as /.env, /config/db.php and /storage/ return 403 or 404. This is a shared team interface with no login; use the intended internal hosting access.

Development tests, diagnostics, screenshots, browser profiles and the unused old dashboard renderer have been removed. The existing database, local .env and current sessions were not changed.

Weekly KPI quantities are stored directly in kpi_records. The retired daily-quantity table is removed by the workflow migration; no daily quantity rollup is used.

Intern status is calculated from users.internship_start and users.internship_end using today's date in Asia/Kuala_Lumpur. Both boundary dates are inclusive. Future, ended, or missing date ranges are inactive. Inactive interns remain selectable for historical records; status appears in the intern selector and dashboard team cards.

The Interns sidebar page lists the full intern directory and provides an Add intern form with employee ID, full name and required internship dates. Employee IDs and full names must be unique. Users with at least one internship date are treated as interns; users without internship dates remain outside the intern directory. Newly added interns are available throughout the workspace. No database migration is required.
