<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require dirname(__DIR__) . '/includes/bootstrap.php';
if (!$pdo) { throw new RuntimeException('Database unavailable.'); }
$count = 0;
$pdo->beginTransaction();
try {
    foreach (['tasks', 'projects'] as $module) {
        $m = modules()[$module];
        $records = rows("SELECT * FROM {$m['table']} WHERE ({$m['status']}='completed' AND progress_percent<>100) OR (progress_percent=100 AND {$m['status']}<>'completed') FOR UPDATE");
        foreach ($records as $record) {
            $id = (int)$record[$m['id']];
            $snapshot = decorate_record($module, $record);
            $extra = $module === 'tasks' ? ', completed_at=COALESCE(completed_at,CURRENT_TIMESTAMP)' : ", review_status='approved'";
            execute_sql("UPDATE {$m['table']} SET {$m['status']}='completed', progress_percent=100{$extra} WHERE {$m['id']}=?", [$id]);
            record_history($module, $id, 'updated', $snapshot, ['editor'=>'System', 'comment'=>'Synchronized completed status and 100% progress.']);
            $count++;
        }
    }
    $pdo->commit();
    echo "Normalized {$count} records.\n";
} catch (Throwable $e) {
    if ($pdo->inTransaction()) { $pdo->rollBack(); }
    throw $e;
}
