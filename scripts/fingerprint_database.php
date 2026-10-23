<?php
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require dirname(__DIR__) . '/config/db.php';
if (!$pdo) { exit(1); }
$result = [];
foreach (['users'=>'employee_id','daily_activities'=>'activity_id','kpi_categories'=>'category_id','kpi_types'=>'kpi_id','kpi_records'=>'record_id','special_tasks'=>'task_id','projects'=>'project_id'] as $table=>$key) {
    $data = $pdo->query("SELECT * FROM $table ORDER BY $key")->fetchAll();
    $result[$table] = ['count'=>count($data),'sha256'=>hash('sha256',json_encode($data))];
}
echo json_encode($result, JSON_PRETTY_PRINT), PHP_EOL;
