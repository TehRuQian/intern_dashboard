<?php
declare(strict_types=1);
// Environment variables take precedence over the private local settings file.
$localSettings = [];
$envFile = dirname(__DIR__) . '/.env';
if (is_readable($envFile)) {
    foreach (file($envFile, FILE_IGNORE_NEW_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#' || !str_contains($line, '=')) { continue; }
        [$key, $value] = explode('=', $line, 2);
        $key = trim(trim($key), "\"'"); $value = trim($value);
        if (!in_array($key, ['DB_HOST','DB_NAME','DB_USER','DB_PASS','DB_PORT'], true)) { continue; }
        if (strlen($value) >= 2 && in_array($value[0], ['"', "'"], true) && substr($value,-1) === $value[0]) { $value = substr($value,1,-1); }
        $localSettings[$key] = $value;
    }
}
$setting = static function(string $key, string $default) use ($localSettings): string {
    $v = getenv($key); return $v !== false ? $v : ($localSettings[$key] ?? $default);
};
$pdo = null;
try {
    $pdo = new PDO('mysql:host=' . $setting('DB_HOST','localhost') . ';port=' . $setting('DB_PORT','3306') . ';dbname=' . $setting('DB_NAME','intern_dashboard') . ';charset=utf8mb4', $setting('DB_USER',''), $setting('DB_PASS',''), [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::ATTR_EMULATE_PREPARES=>false]);
} catch (PDOException $e) {
    error_log('Intern Hub database connection failed: ' . $e->getMessage());
}
unset($localSettings, $setting, $value, $line, $key, $envFile);
