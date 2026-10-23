# Existing database inspection

Inspected the actual local MySQL `intern_dashboard` database before implementation. No schema migration or seed data was needed or applied.

| Table | Primary key | Initial records | Relationships / constraints |
| --- | --- | ---: | --- |
| users | employee_id (varchar 30) | 4 | unique full_name |
| daily_activities | activity_id | 75 | employee_id → users |
| kpi_categories | category_id | 6 | unique category_name; sort_order |
| kpi_types | kpi_id | 14 | category_id → kpi_categories; unique kpi_name; sort_order |
| kpi_records | record_id | 105 | employee_id → users; kpi_id → kpi_types; unique employee_id/kpi_id/week_year/week_no; nonnegative quantity |
| special_tasks | task_id | 14 | PIC text, no employee foreign key; progress ≤100 |
| projects | project_id | 7 | developers text, no employee foreign key; progress ≤100 |

`users` contains the three named interns plus Dalila, and has no role field. Intern membership therefore uses the exact three specified names, resolving their actual employee IDs from the database. There are no new user_id or intern_id columns.

Special-task statuses: pending, in_progress, on_hold, completed. Project development statuses: not_started, in_progress, testing, completed, on_hold. Project review statuses are preserved. KPI quantity uses DECIMAL(10,2), and the existing week check accepts 1–54.

`scripts/inspect_database.php` prints read-only table definitions, row counts and selected sample records in CLI. `scripts/fingerprint_database.php` prints counts and hashes only. Both are blocked from HTTP. Existing quantity rows, shared KPI definitions, PIC text, historical week labels, imported completion/progress values and existing relationships were retained.
