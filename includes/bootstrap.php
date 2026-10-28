<?php
declare(strict_types=1);
ini_set('display_errors', '0');
ini_set('log_errors', '1');
date_default_timezone_set('Asia/Kuala_Lumpur');
ini_set('session.use_strict_mode', '1');
session_name('INTERNHUBSESSID');
$requestIsSecure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || strtolower((string)($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https';
session_set_cookie_params(['path' => '/', 'httponly' => true, 'samesite' => 'Lax', 'secure' => $requestIsSecure]);
$sessionDirectory = dirname(__DIR__) . '/storage/sessions';
if ((is_dir($sessionDirectory) || @mkdir($sessionDirectory, 0700, true)) && is_writable($sessionDirectory)) {
    session_save_path($sessionDirectory);
}
if (!session_start()) { throw new RuntimeException('The PHP session could not be started.'); }
if (empty($_SESSION['csrf'])) { $_SESSION['csrf'] = bin2hex(random_bytes(32)); }
require_once dirname(__DIR__) . '/config/db.php';
require_once __DIR__ . '/workflow.php';

function respond($data, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode(['success' => $status < 400, $status < 400 ? 'data' : 'error' => $data], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}
function invalid(string $message): void { throw new InvalidArgumentException($message); }
function rows(string $sql, array $params = []): array {
    global $pdo;
    $stmt = $pdo->prepare($sql); $stmt->execute($params); return $stmt->fetchAll();
}
function execute_sql(string $sql, array $params = []): int {
    global $pdo;
    $stmt = $pdo->prepare($sql); $stmt->execute($params); return $stmt->rowCount();
}
function interns(): array {
    $people = rows('SELECT employee_id, full_name, internship_start, internship_end FROM users WHERE internship_start IS NOT NULL OR internship_end IS NOT NULL ORDER BY full_name');
    $today = date('Y-m-d');
    foreach ($people as &$person) {
        $person['is_active'] = !empty($person['internship_start']) && !empty($person['internship_end'])
            && $person['internship_start'] <= $today && $person['internship_end'] >= $today;
    }
    unset($person);
    return $people;
}
function intern_ids(): array { return array_column(interns(), 'employee_id'); }
function add_intern(array $input): string {
    $employee = text_field($input['employee_id'] ?? null, 'Employee ID', 30, true);
    $name = text_field($input['full_name'] ?? null, 'Full name', 150, true);
    $start = date_value($input['internship_start'] ?? null, 'Internship start', true);
    $end = date_value($input['internship_end'] ?? null, 'Internship end', true);
    if ($start > $end) { invalid('Internship end must be on or after the start date.'); }
    try {
        execute_sql('INSERT INTO users (employee_id, full_name, internship_start, internship_end) VALUES (?, ?, ?, ?)', [$employee, $name, $start, $end]);
    } catch (PDOException $e) {
        if (($e->errorInfo[1] ?? null) === 1062) { invalid('An employee with this ID or full name already exists.'); }
        throw $e;
    }
    return $employee;
}
function validate_employee(string $id): string {
    if (!in_array($id, intern_ids(), true)) { invalid('Choose an intern from the list.'); } return $id;
}
function date_value($value, string $label, bool $required = false): ?string {
    if ($value === '' || $value === null) { if ($required) { invalid("$label is required."); } return null; }
    if (!is_string($value)) { invalid("$label must be a date."); }
    $d = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
    if (!$d || $d->format('Y-m-d') !== $value) { invalid("$label must be a valid date."); } return $value;
}
function integer_value($value, string $label, int $min, int $max): int {
    if (filter_var($value, FILTER_VALIDATE_INT) === false || (int)$value < $min || (int)$value > $max) { invalid("$label must be between $min and $max."); } return (int)$value;
}
function filters(): array {
    $f = [];
    $f['employee_id'] = trim((string)($_GET['employee_id'] ?? ''));
    if ($f['employee_id'] !== '') { validate_employee($f['employee_id']); }
    foreach (['year' => [1900, 2200], 'month' => [1, 12], 'week' => [1, 54]] as $key => $range) {
        $f[$key] = ($_GET[$key] ?? '') === '' ? null : integer_value($_GET[$key], ucfirst($key), ...$range);
    }
    if ($f['week'] && !$f['year']) { invalid('Select a year with a work week.'); }
    if ($f['month'] && !$f['year']) { invalid('Select a year with a month.'); }
    $f['from'] = date_value($_GET['from'] ?? '', 'From date');
    $f['to'] = date_value($_GET['to'] ?? '', 'To date');
    if ($f['from'] && $f['to'] && $f['from'] > $f['to']) { invalid('From date must be on or before To date.'); }
    $f['status'] = trim((string)($_GET['status'] ?? ''));
    $f['search'] = trim((string)($_GET['search'] ?? ''));
    $f['kpi_id'] = ($_GET['kpi_id'] ?? '') === '' ? null : integer_value($_GET['kpi_id'], 'KPI activity', 1, PHP_INT_MAX);
    return $f;
}
function modules(): array {
    return [
        'activities' => ['table' => 'daily_activities', 'id' => 'activity_id', 'date' => 'activity_date', 'status' => 'status', 'pic' => null,
            'search' => ['task_title', 'remarks', 'milestone'], 'fields' => ['employee_id','activity_date','task_title','milestone','remarks','status'],
            'statuses' => ['pending','in_progress','completed']],
        'tasks' => ['table' => 'special_tasks', 'id' => 'task_id', 'date' => 'assigned_date', 'status' => 'status', 'pic' => 'pic',
            'search' => ['task_title','description','pic','modification_request'], 'fields' => ['task_title','description','pic','assigned_date','start_date','due_date','tat_description','status','priority','progress_percent','modification_request'],
            'statuses' => ['pending','in_progress','ready_for_review','completed']],
        'projects' => ['table' => 'projects', 'id' => 'project_id', 'date' => 'assigned_date', 'status' => 'development_status', 'pic' => 'developers',
            'search' => ['project_name','description','developers','improvement_notes'], 'fields' => ['project_name','project_type','description','developers','assigned_date','start_date','due_date','development_status','review_status','progress_percent','project_link','improvement_notes'],
            'statuses' => ['not_started','in_progress','ready_for_review','completed']],
    ];
}
function calendar(): array { return require dirname(__DIR__) . '/config/work_weeks.php'; }
function week_range(int $year, int $week): array {
    $map = calendar();
    if (!isset($map[$year][$week])) { invalid('Calendar dates for this work week are unverified. Configure config/work_weeks.php from the Excel tracker, or clear the work-week filter.'); }
    return $map[$year][$week];
}
function name_pattern(string $name): string {
    // Match a complete name token in the existing free-text multi-person field.
    return '(^|[^[:alnum:]_])' . preg_quote($name, '/') . '([^[:alnum:]_]|$)';
}
function module_where(array $m, array $f): array {
    $conditions = []; $params = [];
    $people = interns();
    if (!empty($f['active_only'])) { $people = array_values(array_filter($people, fn($p) => $p['is_active'])); }
    if ($f['employee_id'] !== '') { $people = array_values(array_filter($people, fn($p) => $p['employee_id'] === $f['employee_id'])); }
    if ($m['pic']) {
        $parts = [];
        foreach ($people as $p) { $parts[] = 'REGEXP_LIKE(t.' . $m['pic'] . ', ?, \'i\')'; $params[] = name_pattern($p['full_name']); }
        $conditions[] = '(' . implode(' OR ', $parts ?: ['0=1']) . ')';
    } else {
        $ids = array_column($people, 'employee_id');
        $conditions[] = $ids ? 't.employee_id IN (' . implode(',', array_fill(0, count($ids), '?')) . ')' : '0=1';
        array_push($params, ...$ids);
    }
    $date = 't.' . $m['date'];
    foreach (['year' => 'YEAR', 'month' => 'MONTH'] as $key => $fn) {
        if ($f[$key] && !($key === 'year' && $f['week'])) { $conditions[] = "$fn($date) = ?"; $params[] = $f[$key]; }
    }
    foreach (['from' => '>=', 'to' => '<='] as $key => $op) {
        if ($f[$key]) { $conditions[] = "$date $op ?"; $params[] = $f[$key]; }
    }
    if ($f['week']) {
        $range = week_range($f['year'], $f['week']);
        $conditions[] = "$date BETWEEN ? AND ?"; array_push($params, $range['start'], $range['end']);
    }
    if ($f['status'] !== '') {
        if (!in_array($f['status'], $m['statuses'], true)) { invalid('Invalid status for this module.'); }
        $conditions[] = 't.' . $m['status'] . ' = ?'; $params[] = $f['status'];
    }
    if ($f['search'] !== '') {
        $parts = [];
        foreach ($m['search'] as $col) { $parts[] = "t.$col LIKE ?"; $params[] = '%' . str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $f['search']) . '%'; }
        $conditions[] = '(' . implode(" ESCAPE '!' OR ", $parts) . " ESCAPE '!')";
    }
    return [implode(' AND ', $conditions), $params];
}
function module_rows(string $module, array $f, bool $paginate = true): array {
    $m = modules()[$module]; [$where, $params] = module_where($m, $f);
    $count = (int)rows('SELECT COUNT(*) AS n FROM ' . $m['table'] . ' t WHERE ' . $where, $params)[0]['n'];
    $page = integer_value($_GET['page'] ?? 1, 'Page', 1, 1000000);
    $size = 15; $page = min($page, max(1, (int)ceil($count / $size)));
    $sorts = [$m['date'], $m['id'], $m['status'], $module === 'projects' ? 'project_name' : 'task_title'];
    $sort = $_GET['sort'] ?? $m['date'];
    if (!in_array($sort, $sorts, true)) { invalid('Invalid sort column.'); }
    $dir = ($_GET['direction'] ?? 'desc') === 'asc' ? 'ASC' : 'DESC';
    $select = $module === 'activities' ? 't.*, u.full_name' : 't.*';
    $join = $module === 'activities' ? ' JOIN users u ON u.employee_id = t.employee_id' : '';
    $sql = 'SELECT ' . $select . ' FROM ' . $m['table'] . ' t' . $join . ' WHERE ' . $where . " ORDER BY t.$sort $dir, t." . $m['id'] . ' DESC';
    if ($paginate) { $sql .= ' LIMIT ' . $size . ' OFFSET ' . (($page - 1) * $size); }
    return ['rows' => array_map(fn($r) => decorate_record($module, $r), rows($sql, $params)), 'total' => $count, 'page' => $page, 'pages' => max(1, (int)ceil($count / $size)), 'page_size' => $size];
}
function kpi_types(): array {
    return rows('SELECT k.*, c.category_name FROM kpi_types k JOIN kpi_categories c ON c.category_id = k.category_id ORDER BY c.sort_order, c.category_id, k.sort_order, k.kpi_id');
}
function kpi_rows(array $f): array {
    $people = interns();
    if (!empty($f['active_only'])) { $people = array_values(array_filter($people, fn($p) => $p['is_active'])); }
    $ids = array_column($people, 'employee_id');
    if ($f['employee_id'] !== '') { $ids = array_values(array_intersect($ids, [$f['employee_id']])); }
    $conditions = [$ids ? 'r.employee_id IN (' . implode(',', array_fill(0, count($ids), '?')) . ')' : '0=1']; $params = $ids;
    if ($f['status'] !== '' || $f['search'] !== '') { invalid('Status and text search do not apply to weekly KPI.'); }
    foreach (['year' => 'week_year', 'week' => 'week_no', 'kpi_id' => 'kpi_id'] as $key => $col) {
        if ($f[$key]) { $conditions[] = "r.$col = ?"; $params[] = $f[$key]; }
    }
    $result = rows('SELECT r.*, u.full_name, k.kpi_name, k.unit, c.category_name FROM kpi_records r JOIN users u ON u.employee_id = r.employee_id JOIN kpi_types k ON k.kpi_id = r.kpi_id JOIN kpi_categories c ON c.category_id = k.category_id WHERE ' . implode(' AND ', $conditions) . ' ORDER BY r.week_year, r.week_no, c.sort_order, k.sort_order, u.full_name', $params);
    if ($f['month'] || $f['from'] || $f['to']) {
        // A weekly quantity cannot be prorated into daily quantities. Include overlapping weeks.
        $from = $f['from'] ?? '0001-01-01'; $to = $f['to'] ?? '9999-12-31';
        if ($f['month']) {
            $start = sprintf('%04d-%02d-01', $f['year'], $f['month']);
            $from = max($from, $start); $to = min($to, (new DateTimeImmutable($start))->format('Y-m-t'));
        }
        $result = array_values(array_filter($result, function ($r) use ($from, $to) {
            $range = week_range((int)$r['week_year'], (int)$r['week_no']);
            return $range['start'] <= $to && $range['end'] >= $from;
        }));
    }
    return $result;
}
function text_field($value, string $label, int $max, bool $required = false): ?string {
    if ($value !== null && !is_string($value)) { invalid("$label must be text."); }
    $v = trim((string)$value);
    if ($required && $v === '') { invalid("$label is required."); }
    $length = function_exists('mb_strlen') ? mb_strlen($v, 'UTF-8') : strlen($v);
    if ($length > $max) { invalid("$label exceeds $max characters."); }
    return $v === '' && !$required ? null : $v;
}
function validate_record(string $module, array $input): array {
    $m = modules()[$module]; $out = [];
    foreach ($m['fields'] as $field) {
        $value = $input[$field] ?? null;
        if ($field === 'employee_id') { $out[$field] = validate_employee((string)$value); }
        elseif (str_ends_with($field, '_date')) { $out[$field] = date_value($value, ucwords(str_replace('_',' ',$field)), $field === 'activity_date'); }
        elseif ($field === $m['status']) {
            if (!in_array($value, $m['statuses'], true)) { invalid('Select a valid status.'); } $out[$field] = $value;
        } elseif ($field === 'progress_percent') { $out[$field] = integer_value($value, 'Progress', 0, 100); }
        elseif ($field === 'priority') {
            if (!in_array($value, ['low','medium','high'], true)) { invalid('Invalid priority.'); } $out[$field] = $value;
        } elseif ($field === 'review_status') {
            if (!in_array($value, ['pending','in_review','approved','revisions_required'], true)) { invalid('Invalid review status.'); } $out[$field] = $value;
        } else {
            $max = ['task_title'=>255,'project_name'=>255,'project_type'=>100,'pic'=>500,'developers'=>500,'tat_description'=>50][$field] ?? 16000;
            $out[$field] = text_field($value, $field, $max, in_array($field, ['task_title','project_name'], true));
        }
    }
    if (!empty($out['project_link']) && (!filter_var($out['project_link'], FILTER_VALIDATE_URL) || !in_array(strtolower(parse_url($out['project_link'], PHP_URL_SCHEME) ?? ''), ['http','https'], true))) { invalid('Project link must be an HTTP or HTTPS URL.'); }
    foreach (['assigned_date','start_date'] as $field) {
        if (!empty($out[$field]) && !empty($out['due_date']) && $out[$field] > $out['due_date']) { invalid('Due date must not precede assigned or start date.'); }
    }
    if ($m['pic']) {
        $pic = $out[$m['pic']];
        if (!$pic) { invalid('Choose at least one intern for this assignment.'); }
        $matched = false;
        foreach (interns() as $p) { if (preg_match('/' . name_pattern($p['full_name']) . '/iu', $pic)) { $matched = true; } }
        if (!$matched) { invalid('Assign this task to at least one intern. Dalila is the supervisor; use feedback for supervisor notes.'); }
    }
    return $out;
}
