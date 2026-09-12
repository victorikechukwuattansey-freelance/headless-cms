# Outreach Queue & Planning V1 — live runner
# Mirrors the n8n-lead-recovery/run-live-tests.ps1 convention:
# PowerShell 5.1, prompted secrets, no credentials stored in files.
#Requires -Version 5.1

[CmdletBinding()]
param(
  [switch]$Execute,          # allow actual spreadsheet writes/deletes (default dry-run)
  [switch]$NoInteractive,    # never prompt; requires N8N creds for the run phase
  [string]$Scenario = 'TEST-QUEUE-001',
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
if ($NoInteractive -and (-not $env:N8N_BASE_URL -or -not $env:N8N_API_KEY -or -not $env:N8N_WORKFLOW_ID)) {
  Write-Warning '--NoInteractive requires N8N_BASE_URL, N8N_API_KEY and N8N_WORKFLOW_ID'
}

$phases = @()
if (-not $SkipSeed)    { $phases += '--seed' }
if (-not $SkipRun)     { $phases += '--run' }
if (-not $SkipVerify)  { $phases += '--verify' }
if (-not $SkipCleanup) { $phases += '--cleanup' }
$phases += '--verify-final'
if ($Execute)       { $phases += '--execute' }
if ($NoInteractive) { $phases += '--no-interactive' }
$phases += "--scenario=$Scenario"

Write-Host "Running: node scripts/run-outreach-queue-live.js $($phases -join ' ')"
node scripts/run-outreach-queue-live.js @phases
exit $LASTEXITCODE