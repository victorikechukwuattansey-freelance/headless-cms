# Outreach Execution & Delivery V1 — live runner
# Mirrors run-outreach-queue-live.ps1: PowerShell 5.1, prompted secrets,
# no credentials stored in files. DRY_RUN + NOT_CONFIGURED by default.
#Requires -Version 5.1

[CmdletBinding()]
param(
  [switch]$Execute,          # allow actual spreadsheet writes/deletes (default dry-run)
  [switch]$NoInteractive,    # never prompt; requires N8N creds for the run phase
  [switch]$Local,            # run the engine locally instead of posting to n8n
  [string]$Scenario = 'TEST-EXEC-001',
  [string]$Mode = 'DRY_RUN',
  [string]$Provider = 'NOT_CONFIGURED',
  [switch]$SkipSeed,
  [switch]$SkipRun,
  [switch]$SkipVerify,
  [switch]$SkipCleanup
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
if ($Local -and -not $Execute) {
  Write-Warning 'LOCAL + REAL provider SUCCESS appends rows; pass -Execute to allow.'
}
if ($NoInteractive -and -not $Local -and (-not $env:N8N_BASE_URL -or -not $env:N8N_API_KEY -or -not $env:N8N_WORKFLOW_ID)) {
  Write-Warning '--NoInteractive requires N8N creds (or -Local)'
}

$phases = @()
if (-not $SkipSeed)    { $phases += '--seed' }
if (-not $SkipRun)     { $phases += '--run' }
if (-not $SkipVerify)  { $phases += '--verify' }
if (-not $SkipCleanup) { $phases += '--cleanup' }
$phases += '--verify-final'
if ($Execute)       { $phases += '--execute' }
if ($NoInteractive) { $phases += '--no-interactive' }
if ($Local)         { $phases += '--local' }
$phases += "--scenario=$Scenario"
$phases += "--mode=$Mode"
$phases += "--provider=$Provider"

Write-Host "Running: node scripts/run-execution-live.js $($phases -join ' ')"
node scripts/run-execution-live.js @phases
exit $LASTEXITCODE