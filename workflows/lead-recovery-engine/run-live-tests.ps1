#Requires -Version 5.1
<#
.SYNOPSIS
  Live validation runner for Lead Recovery Engine Workflows 02-05.
.PARAMETER BaseUrl
  n8n base URL, e.g. https://yourinstance.app.n8n.cloud (no trailing slash).
.PARAMETER Secret
  The LEAD_ENGINE_SECRET value (the n8n Variable). Never written to disk or output.
.EXAMPLE
  .\run-live-tests.ps1 -BaseUrl https://xxx.app.n8n.cloud
#>
param(
    [Parameter(Mandatory = $true)][string]$BaseUrl,
    [Parameter(Mandatory = $false)][string]$Secret
)

$BaseUrl = $BaseUrl.TrimEnd('/')
if (-not $Secret) { $Secret = Read-Host 'Enter LEAD_ENGINE_SECRET (input hidden)' -AsSecureString
    $Secret = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secret)) }

$H = @{ 'X-Lead-Engine-Secret' = $Secret; 'Content-Type' = 'application/json' }
$script:pass = 0; $script:fail = 0

function Invoke-Test {
    param($Name, $ExpectedCode, $Url, $Body, $Headers)
    try {
        $resp = Invoke-WebRequest -Uri $Url -Method Post -Headers $Headers -Body ($Body | ConvertTo-Json -Depth 6) -UseBasicParsing -ErrorAction Stop
        $code = [int]$resp.StatusCode; $content = $resp.Content
    } catch {
        $code = [int]$_.Exception.Response.StatusCode
        try { $sr = New-Object IO.StreamReader($_.Exception.Response.GetResponseStream()); $content = $sr.ReadToEnd() } catch { $content = '' }
    }
    $ok = ($code -eq $ExpectedCode)
    if ($ok) { $script:pass++ } else { $script:fail++ }
    Write-Output ("[{0}] {1}  ->  HTTP {2} (expected {3})" -f ($(if ($ok) {'PASS'} else {'FAIL'})), $Name, $code, $ExpectedCode)
    if ($content) { Write-Output ("      body: " + $content.Substring(0, [Math]::Min(300, $content.Length))) }
}

Write-Output "== TEST 4: Invalid secret (expect 401, no writes) =="
Invoke-Test -Name 'T4 invalid secret' -ExpectedCode 401 -Url "$BaseUrl/webhook/booking-status" `
    -Headers @{ 'X-Lead-Engine-Secret' = 'wrong-secret'; 'Content-Type' = 'application/json' } `
    -Body @{ business_id='BIZ-1001'; lead_id='lead_1787477445223_vtikt1cg'; booking_id='TEST-BAD-001' }

Write-Output "`n== TEST 3: Unknown lead (expect 404, no booking append, no lead update) =="
Invoke-Test -Name 'T3 unknown lead' -ExpectedCode 404 -Url "$BaseUrl/webhook/booking-status" -Headers $H `
    -Body @{ business_id='BIZ-1001'; lead_id='lead_does_not_exist_000'; booking_id='TEST-NONE-001'; booking_at='2026-08-23T10:00:00Z'; source='test'; status='confirmed' }

Write-Output "`n== TEST 8: Cross-business isolation (valid lead_id, wrong business -> expect 404, no writes) =="
Invoke-Test -Name 'T8 cross-business' -ExpectedCode 404 -Url "$BaseUrl/webhook/booking-status" -Headers $H `
    -Body @{ business_id='BIZ-9999'; lead_id='lead_1787477445223_vtikt1cg'; booking_id='TEST-XBIZ-001' }

Write-Output "`n== TEST 1: Booking success (expect 200 status=booked; then VERIFY in Sheets) =="
Invoke-Test -Name 'T1 booking success' -ExpectedCode 200 -Url "$BaseUrl/webhook/booking-status" -Headers $H `
    -Body @{ business_id='BIZ-1001'; lead_id='lead_1787477445223_vtikt1cg'; booking_id='TEST-BOOK-001'; booking_at='2026-08-23T10:00:00Z'; source='test'; status='confirmed' }

Write-Output @"
      VERIFY leads row: booked=TRUE, status=booked, booking_id=TEST-BOOK-001,
      booked_at=2026-08-23T10:00:00Z, next_followup_at empty.
      VERIFY bookings tab: exactly ONE row with TEST-BOOK-001. Owner email at vic2sleek@gmail.com.
"@

Write-Output "== TEST 2: Duplicate booking event (expect 200 duplicate=true; NO second bookings row) =="
Invoke-Test -Name 'T2 idempotent replay' -ExpectedCode 200 -Url "$BaseUrl/webhook/booking-status" -Headers $H `
    -Body @{ business_id='BIZ-1001'; lead_id='lead_1787477445223_vtikt1cg'; booking_id='TEST-BOOK-001'; booking_at='2026-08-23T10:00:00Z'; source='test'; status='confirmed' }

Write-Output @"

== MANUAL SWEEPER PREP (Tests 5-7) ==
In the leads tab create/backdate rows for BIZ-1001:

  T5  lead_id=lead_sweep_t5   email=<your real inbox>   status=new
      followup_count=0        next_followup_at=(now minus 1 hour)
      -> Run Workflow 05 manually once.
      EXPECT: followup_count=1, last_contact_at set, next_followup_at ~ +24h, status=new.

  T6  lead_id=lead_sweep_t6   email=<your real inbox>   status=new
      followup_count=2        next_followup_at=(now minus 1 hour)
      EXPECT after run: followup_count=3, status=no_response, next_followup_at empty.

  T7 lead_id=lead_sweep_t7   email=invalid@domain-does-not-exist-invalid.invalid
      status=new  followup_count=0  next_followup_at=(now minus 1 hour)
      EXPECT: send fails (error path), followup_count stays 0, next_followup_at unchanged.

Run Workflow 05 manually (Execute Workflow), then verify each row above.
"@

Write-Output ("`nRESULT: {0} passed, {1} failed (webhook tests only)." -f $script:pass, $script:fail)
