<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require dirname(__DIR__) . '/config/db.php';
if (!$pdo) { throw new RuntimeException('Database unavailable.'); }
$sql = file_get_contents(dirname(__DIR__) . '/database/workflow.sql');
foreach (explode(';', $sql) as $statement) {
    if (trim($statement)) { $pdo->exec($statement); }
}
echo "Shared workflow schema ready.\n";
