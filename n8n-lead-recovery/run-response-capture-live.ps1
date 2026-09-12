# Outreach Response Capture V1 - live runner
# Validates the deterministic capture engine against the configured Response Log.
# Mirrors run-execution-reconciliation-live.ps1: PowerShell 5.1, prompted secrets,
# no credentials stored in files. Dry-run by default.
# NOTE: this artifact NEVER sends, replies, schedules follow-ups, or calls a
# provider. Only TEST-RESP-* Response Log rows are ever seeded/deleted, and only
# with -Execute.
#Requires -Version 5.1

[CmdletBinding()]
param(
  [switch]$Execute,          # allow seeding/deleting TEST-RESP-* Response Log rows (default dry-run)
  [switch]$NoInteractive,    # never prompt; requires GOOGLE creds for live phases
  [string]$Scenario = 'TEST-RESP-001',
  [switch]$SkipSeed,
  [switch]$SkipIngest,
  [switch]$SkipVerify,
  [switch]$SkipRepeat,
  [switch]$SkipIdempotency,
  [switch]$SkipCleanup,
  [string]$ReportsDir = ''
)

$ErrorActionPreference = 'Stop'

function Read-Secret {
  param([Parameter(Mandatory = $true)][string]$Label)
  $secure = Read-Host -Prompt $Label -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  }
  finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}

if (-not $env:GOOGLE_SHEET_ID) {
  $env:GOOGLE_SHEET_ID = Read-Host -Prompt 'GOOGLE_SHEET_ID (target spreadsheet)'
}
if (-not $env:GOOGLE_ACCESS_TOKEN -and -not $env:GOOGLE_SERVICE_ACCOUNT_JSON) {
  $mode = Read-Host -Prompt 'Auth mode (token | service-account)'
  if ($mode -eq 'service-account') {
    $env:GOOGLE_SERVICE_ACCOUNT_JSON = Read-Host -Prompt 'Path to GOOGLE_SERVICE_ACCOUNT_JSON'
  }
  else {
    $env:GOOGLE_ACCESS_TOKEN = Read-Secret 'GOOGLE_ACCESS_TOKEN'
  }
}

$phases = @()
if (-not $SkipSeed)         { $phases += '--seed' }
if (-not $SkipIngest)       { $phases += '--ingest' }
if (-not $SkipVerify)       { $phases += '--verify' }
if (-not $SkipRepeat)       { $phases += '--repeat' }
if (-not $SkipIdempotency)  { $phases += '--verify-idempotency' }
if (-not $SkipCleanup)      { $phases += '--cleanup' }
$phases += '--verify-cleanup'
if ($Execute)       { $phases += '--execute' }
if ($NoInteractive) { $phases += '--no-interactive' }
$phases += "--scenario=$Scenario"
if ($ReportsDir)    { $phases += "--reports-dir=$ReportsDir" }

Write-Host "Running: node scripts/run-response-capture-live.js $($phases -join ' ')"
node scripts/run-response-capture-live.js @phases
exit $LASTEXITCODE