<#
.SYNOPSIS
  Commit a multi-line message body without writing a UTF-8 BOM.

.DESCRIPTION
  `Out-File -Encoding utf8` on Windows PowerShell 5.1 produces a BOM
  that pollutes the commit subject (byte 0xEF). This helper:
    1. Reads the body file
    2. Rewrites it as UTF-8 without BOM
    3. Runs `git commit -F <path>`
    4. Deletes the temp file
  See docs/5b1-final-handoff.md §18 T7.13.

.PARAMETER BodyFile
  Path to the commit-body file (subject + body). Must exist.

.PARAMETER NoTempCleanup
  Skip temp-file deletion. Useful for debugging.

.EXAMPLE
  .\scripts\commit-body.ps1 -BodyFile "$env:TEMP\msg.txt"
#>

param(
  [Parameter(Mandatory = $true)]
  [string]$BodyFile,

  [switch]$NoTempCleanup
)

if (-not (Test-Path -LiteralPath $BodyFile)) {
  Write-Error "Body file not found: $BodyFile"
  exit 1
}

$content = Get-Content -LiteralPath $BodyFile -Raw -Encoding UTF8
if ([string]::IsNullOrWhiteSpace($content)) {
  Write-Error "Body file is empty: $BodyFile"
  exit 1
}

[System.IO.File]::WriteAllText($BodyFile, $content, (New-Object System.Text.UTF8Encoding $false))

git commit -F $BodyFile
$exitCode = $LASTEXITCODE

if (-not $NoTempCleanup -and $exitCode -eq 0) {
  try {
    [System.IO.File]::Delete($BodyFile)
  } catch {
    Write-Warning "Commit succeeded but temp cleanup failed: $_"
  }
}

exit $exitCode
