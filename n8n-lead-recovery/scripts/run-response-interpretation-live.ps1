# Response Interpretation V1 — Phase 5 live runner
# Seeds the canonical interpretation fixtures into the TEST-RESP-INT-LIVE-* 
# namespace of the Response Log tab, executes the SHIPPED
# "Response-Interpretation V1" workflow (via n8n when configured), collects the
# Interpret Responses output, compares it against the canonical engine, and
# cleans up only the Phase 5 namespace rows. Dry-run by default.
# Mirrors run-response-reconciliation-live.ps1: PowerShell 5.1, prompted
# secrets, no credentials stored in files, no secret printing.
# NOTE: nothing here edits the workflow, posts to external services, writes
# outside the Response Log tab, seeds/deletes anything but TEST-RESP-INT-LIVE-*
# rows (and only with -Execute). No live PASS is ever claimed without a real,
# collected n8n execution result.
#Requires -Version 5.1

[CmdletBinding()]
param(
  [switch]$Execute,          # allow seeding/deleting TEST-RESP-INT-LIVE-* rows (default dry-run)
  [switch]$NoInteractive,    # never prompt; requires GOOGLE creds (and n8n creds) for live phases
  [string]$Scenario = 'TEST-RESP-INT-001',
  [string]$RunToken = '',    # optional deterministic namespace tag (hex 8..32)
  [string]$ExecutionId = '',
  [switch]$PreflightOnly,
  [switch]$SkipSeed,
  [switch]$SkipRun,
  [switch]$SkipCollect,
  [switch]$SkipVerify,
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
  $env:GOOGLE_SHEET_ID = Read-Host -Prompt 'GOOGLE_SHEET_ID (target spreadsheet = pinned engine sheet unless --allow-non-pinned-sheet)'
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
if (-not $env:RESP_INT_LIVE_RUN_TOKEN -and $RunToken) {
  $env:RESP_INT_LIVE_RUN_TOKEN = $RunToken
}

$phases = @()
if ($PreflightOnly) { $phases += '--preflight' } else {
  if (-not $SkipSeed)       { $phases += '--seed' }
  if (-not $SkipSeed)       { $phases += '--verify-seed' }
  if (-not $SkipRun)        { $phases += '--run' }
  if (-not $SkipCollect)    { $phases += '--collect' }
  if (-not $SkipVerify)     { $phases += '--verify' }
  if (-not $SkipCleanup)    { $phases += '--cleanup' }
  if (-not $SkipCleanup)    { $phases += '--verify-cleanup' }
}
if ($Execute)       { $phases += '--execute' }
if ($NoInteractive) { $phases += '--no-interactive' }
$phases += "--scenario=$Scenario"
if ($RunToken)      { $phases += "--run-token=$RunToken" }
if ($ExecutionId)   { $phases += "--execution-id=$ExecutionId" }
if ($ReportsDir)    { $phases += "--reports-dir=$ReportsDir" }

Write-Host "Running: node scripts/run-response-interpretation-live.js $($phases -join ' ')"
node scripts/run-response-interpretation-live.js @phases
exit $LASTEXITCODE