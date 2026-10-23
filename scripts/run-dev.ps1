param([ValidateRange(1024,65535)][int]$Port = 8095)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$phpCommand = Get-Command php -ErrorAction SilentlyContinue
if ($phpCommand) {
    $phpBinary = $phpCommand.Source
} else {
    $phpBinary = Get-ChildItem -LiteralPath 'C:\laragon\bin\php' -Filter php.exe -Recurse -File | Select-Object -First 1 -ExpandProperty FullName
}
if (-not $phpBinary) { throw 'PHP 8+ was not found. Add the Laragon PHP directory to PATH.' }
Write-Output "Intern Hub: http://127.0.0.1:$Port/ (Ctrl+C to stop)"
& $phpBinary -S "127.0.0.1:$Port" -t $projectRoot "$PSScriptRoot/router.php"
exit $LASTEXITCODE
