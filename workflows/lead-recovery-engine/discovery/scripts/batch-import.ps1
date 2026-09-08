#Requires -Version 5.1
param(
    [Parameter(Mandatory=$true)]
    [string]$CsvFile,
    [string]$DataDir = ""
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$DiscoveryRoot = Split-Path $ScriptDir -Parent
if (-not $DataDir) { $DataDir = Join-Path $DiscoveryRoot "data" }

if (-not (Test-Path $CsvFile)) {
    Write-Host "ERROR: CSV file not found: $CsvFile" -ForegroundColor Red
    exit 1
}

Write-Host "LRE Batch Import" -ForegroundColor Cyan
Write-Host "================" -ForegroundColor Cyan
Write-Host "CSV:    $CsvFile"
Write-Host "Store:  $(Join-Path $DataDir 'prospects.csv')"
Write-Host ""

Push-Location $DiscoveryRoot
try {
    $storeFile = Join-Path $DataDir "prospects.csv"
    node src/batch-run.js $CsvFile "(--store=$storeFile)"
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "Done. Persisted prospects remain reviewable after this process exits." -ForegroundColor Green
Write-Host "Review with: node cli/review.js list" -ForegroundColor Green
