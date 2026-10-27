<?php
declare(strict_types=1);
require dirname(__DIR__) . '/includes/bootstrap.php';
set_exception_handler(function (Throwable $e): void {
    global $pdo;
    if ($pdo instanceof PDO && $pdo->inTransaction()) { $pdo->rollBack(); }
    if ($e instanceof InvalidArgumentException) { respond($e->getMessage(), 422); }
    if ($e instanceof RuntimeException && $e->getCode() === 409) { respond($e->getMessage(), 409); }
    error_log((string)$e);
    respond('The request could not be completed. Check the server log and database connection, then retry.', 500);
});
if (!$pdo) { respond('Database unavailable. Check your database settings (.env) and verify MySQL is running.', 503); }
header('X-Content-Type-Options: nosniff');
$action = $_GET['action'] ?? 'metadata';
$module = $_GET['module'] ?? '';
$write = ['save','delete','save_kpi','undo','add_intern'];
if (in_array($action, $write, true)) {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') { header('Allow: POST'); respond('Use POST for this action.', 405); }
    if (!hash_equals($_SESSION['csrf'], (string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''))) { respond('The session expired. Refresh the page before saving.', 403); }
    if (!str_starts_with($_SERVER['CONTENT_TYPE'] ?? '', 'application/json')) { respond('Send a JSON request.', 415); }
    $body = file_get_contents('php://input');
    if (strlen($body) > 200000) { respond('Request is too large.', 413); }
    try { $input = json_decode($body, true, 32, JSON_THROW_ON_ERROR); }
    catch (JsonException $e) { invalid('The request body must contain valid JSON.'); }
    if (!is_array($input)) { invalid('Invalid request.'); }
} elseif ($_SERVER['REQUEST_METHOD'] !== 'GET') { header('Allow: GET'); respond('Use GET for this action.', 405); }
session_write_close();
function version(array $record): string { return hash('sha256', json_encode($record)); }
function find_record(array $m, int $id, bool $lock = false): array {
    $r = rows('SELECT * FROM ' . $m['table'] . ' WHERE ' . $m['id'] . ' = ?' . ($lock ? ' FOR UPDATE' : ''), [$id]);
    if (!$r) { respond('This record no longer exists.', 404); }
    $module = array_search($m, modules(), true);
    return decorate_record($module, $r[0]);
}
require __DIR__ . '/workflow_routes.php';
if ($action === 'interns') { respond(interns()); }
if ($action === 'add_intern') {
    respond(['employee_id' => add_intern($input)], 201);
}
if ($action === 'metadata') {
    $stats = rows('SELECT MIN(week_year) AS first_year, MAX(week_year) AS last_year FROM kpi_records')[0];
    respond(['interns' => interns(), 'people' => rows('SELECT employee_id, full_name FROM users ORDER BY full_name'), 'kpis' => kpi_types(), 'years' => $stats, 'calendar_configured' => (bool)calendar(), 'today' => date('Y-m-d')]);
}
if (in_array($action, ['list','detail','save','delete'], true)) {
    if (!isset(modules()[$module])) { invalid('Unknown module.'); } $m = modules()[$module];
    if ($action === 'list') { respond(module_rows($module, filters())); }
    if ($action === 'detail') {
        $r = find_record($m, integer_value($_GET['id'] ?? '', 'Record ID', 1, PHP_INT_MAX));
        respond(['record' => $r, 'version' => version($r)]);
    }
    $id = isset($input['id']) && $input['id'] !== '' ? integer_value($input['id'], 'Record ID', 1, PHP_INT_MAX) : null;
    if ($action === 'delete' && !$id) { invalid('Record ID is required.'); }
    if ($action === 'save' && !is_array($input['record'] ?? null)) { invalid('Provide the record fields as a JSON object.'); }
    $data = $action === 'save' ? validate_record($module, $input['record']) : [];
    if ($action === 'save' && $module === 'tasks' && !array_key_exists('tat_description', $input['record'])) {
        unset($data['tat_description']);
    }
    $pdo->beginTransaction();
    $existing = null;
    if ($id) {
        $existing = find_record($m, $id, true);
        if (!hash_equals(version($existing), (string)($input['version'] ?? ''))) { throw new RuntimeException('This record changed after you opened it. Reload its details and try again.', 409); }
    }
    if ($action === 'delete') {
        record_history($module, $id, 'deleted', $existing, $input);
        execute_sql('DELETE FROM ' . $m['table'] . ' WHERE ' . $m['id'] . ' = ?', [$id]);
    } else {
        $data = sync_work_completion($module, $data, $existing);
        if ($module === 'tasks') {
            $data['completed_at'] = $data['status'] === 'completed' ? ($existing && $existing['status'] === 'completed' ? $existing['completed_at'] : date('Y-m-d H:i:s')) : null;
        }
        $columns = array_keys($data);
        if ($id) {
            execute_sql('UPDATE ' . $m['table'] . ' SET ' . implode(', ', array_map(fn($c) => "$c = ?", $columns)) . ' WHERE ' . $m['id'] . ' = ?', [...array_values($data), $id]);
        } else {
            execute_sql('INSERT INTO ' . $m['table'] . ' (' . implode(',', $columns) . ') VALUES (' . implode(',', array_fill(0, count($columns), '?')) . ')', array_values($data));
            $id = (int)$pdo->lastInsertId();
        }
        record_history($module, $id, $existing ? 'updated' : 'created', $existing, $input);
    }
    $history = (int)rows('SELECT MAX(history_id) AS id FROM work_history WHERE module=? AND record_id=?', [$module,$id])[0]['id'];
    $pdo->commit(); respond(['id' => $id, 'history_id' => $history]);
}
if ($action === 'kpi') {
    $f = filters(); $records = kpi_rows($f);
    $years = array_column(rows('SELECT DISTINCT week_year FROM kpi_records ORDER BY week_year'), 'week_year');
    $weeks = $f['week'] ? [$f['week']] : range(1,54);
    $dates = calendar()[$f['year']] ?? [];
    if ($f['month'] || $f['from'] || $f['to']) {
        $from = $f['from'] ?? '0001-01-01'; $to = $f['to'] ?? '9999-12-31';
        if ($f['month']) {
            $start = sprintf('%04d-%02d-01', $f['year'], $f['month']);
            $from = max($from, $start); $to = min($to, (new DateTimeImmutable($start))->format('Y-m-t'));
        }
        $weeks = array_values(array_filter($weeks, function ($week) use ($f, $from, $to) {
            $range = week_range($f['year'], $week); return $range['start'] <= $to && $range['end'] >= $from;
        }));
    }
    respond(['types' => kpi_types(), 'records' => $records, 'years' => $years, 'weeks' => $weeks, 'dates' => $dates]);
}
if ($action === 'save_kpi') {
    $employee = validate_employee((string)($input['employee_id'] ?? ''));
    $year = integer_value($input['year'] ?? '', 'Year', 1900, 2200);
    $cells = $input['cells'] ?? null;
    if (!is_array($cells) || count($cells) < 1 || count($cells) > 756) { invalid('Provide between 1 and 756 KPI cells.'); }
    $validKpis = array_column(kpi_types(), 'kpi_id'); $seen = []; $changes = [];
    foreach ($cells as $cell) {
        if (!is_array($cell) || !array_key_exists('original', $cell)) { invalid('Each KPI cell must include its original value.'); }
        $kpi = integer_value($cell['kpi_id'] ?? '', 'KPI', 1, PHP_INT_MAX);
        $week = integer_value($cell['week'] ?? '', 'Work week', 1, 54);
        if (!in_array($kpi, $validKpis, true)) { invalid('Unknown KPI activity.'); }
        $key = "$kpi:$week"; if (isset($seen[$key])) { invalid('Duplicate cell in request.'); } $seen[$key] = true;
        $quantity = $cell['quantity'] ?? null;
        if ($quantity !== null && $quantity !== '' && (!is_scalar($quantity) || !preg_match('/^\d{1,8}(\.\d{1,2})?$/D', (string)$quantity))) { invalid('Quantity must be a nonnegative number with up to two decimal places (maximum 99999999.99).'); }
        $quantity = ($quantity === null || $quantity === '') ? null : number_format((float)$quantity, 2, '.', '');
        $changes[] = [$kpi, $week, $quantity, $cell['original']];
    }
    $pdo->beginTransaction();
    // Serialize saves for this employee, including cells that do not exist yet.
    rows('SELECT employee_id FROM users WHERE employee_id = ? FOR UPDATE', [$employee]);
    foreach ($changes as [$kpi, $week, $quantity, $original]) {
        $key = [$employee, $kpi, $year, $week];
        $existing = rows('SELECT record_id, quantity FROM kpi_records WHERE employee_id=? AND kpi_id=? AND week_year=? AND week_no=? FOR UPDATE', $key);
        $current = $existing ? $existing[0]['quantity'] : null;
        if ($original !== $current) { throw new RuntimeException('A KPI cell changed in another window. Refresh the matrix before saving again.', 409); }
        if ($quantity === null) {
            if ($existing) { execute_sql('DELETE FROM kpi_records WHERE record_id = ?', [$existing[0]['record_id']]); }
        } elseif ($existing) {
            execute_sql('UPDATE kpi_records SET quantity = ? WHERE record_id = ?', [$quantity, $existing[0]['record_id']]);
        } else {
            execute_sql('INSERT INTO kpi_records (employee_id,kpi_id,week_year,week_no,quantity) VALUES (?,?,?,?,?)', [...$key, $quantity]);
        }
    }
    $pdo->commit(); respond(['saved' => count($changes)]);
}
if ($action === 'dashboard') {
    $f = filters(); $f['status'] = ''; $f['search'] = '';
    $f['active_only'] = true;
    $activities = module_rows('activities', $f, false)['rows'];
    $tasks = module_rows('tasks', $f, false)['rows'];
    $projects = module_rows('projects', $f, false)['rows'];
    $records = kpi_rows($f); $trend = []; $distribution = []; $statuses = array_fill_keys(['pending','in_progress','on_hold','completed'], 0); $units = [];
    foreach ($records as $r) {
        $label = $r['week_year'] . '-WW' . str_pad((string)$r['week_no'], 2, '0', STR_PAD_LEFT);
        $trend[$label] = ($trend[$label] ?? 0) + (float)$r['quantity'];
        $distribution[$r['kpi_name']] = ($distribution[$r['kpi_name']] ?? 0) + (float)$r['quantity'];
        $units[$r['unit']] = true;
    }
    foreach ($tasks as $t) { $statuses[$t['status']]++; }
    ksort($trend);
    $completed = fn($r) => $r['status'] === 'completed';
    respond([
        'summary' => [count($activities), count(array_filter($activities, $completed)), count($units) <= 1 ? array_sum(array_column($records, 'quantity')) : null, count($tasks), $statuses['pending'], $statuses['completed'], count(array_filter($projects, fn($p) => in_array($p['development_status'], ['in_progress','testing'], true))), count(array_filter($tasks, fn($t) => $t['due_date'] && $t['due_date'] < date('Y-m-d') && $t['status'] !== 'completed'))],
        'trend' => count($units) <= 1 ? $trend : [], 'distribution' => count($units) <= 1 ? $distribution : [], 'statuses' => $statuses,
        'projects' => $projects, 'recent' => array_slice($activities, 0, 6), 'mixed_units' => count($units) > 1,
    ]);
}
if ($action === 'report' || $action === 'export') {
    $f = filters();
    if ($module === 'monthly') {
        $data = module_rows('activities', $f, false)['rows']; $groups = [];
        foreach ($data as $r) {
            $key = substr($r['activity_date'],0,7) . ':' . $r['employee_id'];
            if (!isset($groups[$key])) { $groups[$key] = ['month'=>substr($r['activity_date'],0,7),'employee_id'=>$r['employee_id'],'intern'=>$r['full_name'],'total'=>0,'pending'=>0,'in_progress'=>0,'completed'=>0]; }
            $groups[$key]['total']++; $groups[$key][$r['status']]++;
        } $data = array_values($groups);
        $columns = ['month','employee_id','intern','total','pending','in_progress','completed'];
    } elseif ($module === 'work') {
        $data=work_items($f);$columns=['title','people','type','stage','assigned_date','due_date','progress','overdue'];
    } elseif ($module === 'kpi') {
        $data = kpi_rows($f); $columns = ['employee_id','full_name','category_name','kpi_name','unit','week_year','week_no','quantity','remarks'];
    } elseif (isset(modules()[$module])) {
        $m = modules()[$module]; $data = module_rows($module, $f, false)['rows'];
        $columns = array_values(array_diff([$m['id'], ...$m['fields']], ['tat_description'])); if ($module === 'activities') { $columns[] = 'full_name'; }
    } else { invalid('Unknown report type.'); }
    $formatted = array_map(fn($r) => array_intersect_key(array_replace(array_fill_keys($columns, null), $r), array_flip($columns)), $data);
    if ($action === 'report') { respond(['columns' => $columns, 'rows' => $formatted, 'total' => count($formatted)]); }
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="intern-' . $module . '-' . date('Y-m-d') . '.csv"');
    header('Cache-Control: no-store');
    $out = fopen('php://output', 'w'); fwrite($out, "\xEF\xBB\xBF");
    fputcsv($out, array_map(fn($c) => ucwords(str_replace('_', ' ', $c)), $columns));
    foreach ($formatted as $r) {
        $values = [];
        foreach ($columns as $c) {
            $v = (string)($r[$c] ?? '');
            // Neutralize spreadsheet formulas, including values prefixed with control characters.
            if (preg_match('/^[\s\x00-\x1f]*[=+@-]/u', $v)) { $v = "'" . $v; }
            $values[] = $v;
        } fputcsv($out, $values);
    } fclose($out); exit;
}
respond('Unknown API action.', 404);
