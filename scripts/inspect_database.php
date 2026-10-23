<?php
// Read-only diagnostic; never expose database metadata through HTTP.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require dirname(__DIR__) . '/config/db.php';
if (!$pdo) { exit(1); }
foreach ($pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN) as $table) {
    echo "TABLE $table\n";
    echo $pdo->query('SHOW CREATE TABLE `' . str_replace('`', '``', $table) . '`')->fetch(PDO::FETCH_NUM)[1], "\n";
    echo 'ROWS ', $pdo->query('SELECT COUNT(*) FROM `' . str_replace('`', '``', $table) . '`')->fetchColumn(), "\n";
    if (in_array($table, ['users', 'kpi_categories', 'kpi_types'], true)) {
        echo json_encode($pdo->query('SELECT * FROM `' . $table . '`')->fetchAll(), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), "\n";
    } else {
        echo json_encode($pdo->query('SELECT * FROM `' . str_replace('`', '``', $table) . '` LIMIT 3')->fetchAll(), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), "\n";
    }
}
