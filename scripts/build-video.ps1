param(
  [Parameter(Mandatory)][string]$Script,
  [ValidateRange(1, 4)][int]$Stage = 1,
  [string]$Model = "",
  [string]$Voice = "",
  [ValidateSet("cut", "fade")][string]$Transition = "cut",
  [float]$TransitionDuration = 1.0,
  [string]$Resolution = "1920x1080",
  [int]$Fps = 24,
  [switch]$FailFast,
  [switch]$Force
)

$ErrorActionPreference = "Stop"

$scriptPath = Resolve-Path $Script -ErrorAction Stop
$scriptBase = [System.IO.Path]::GetFileNameWithoutExtension($scriptPath)
$workDir = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\videos\$scriptBase"))
New-Item -ItemType Directory -Path $workDir -Force | Out-Null

Copy-Item $scriptPath (Join-Path $workDir "script.md") -Force

Write-Host "========================================"
Write-Host "Video Pipeline - $scriptBase"
Write-Host "Work dir: $workDir"
Write-Host "Starting from stage: $Stage"
Write-Host "========================================"

$stages = @(
  @{ num = 1; name = "Parse Script"; file = "1-parse-script.ps1"; args = @{ScriptPath = (Join-Path $workDir "script.md"); WorkDir = $workDir} }
  @{ num = 2; name = "Generate TTS";  file = "2-generate-tts.ps1";  args = @{WorkDir = $workDir; Voice = $Voice} }
  @{ num = 3; name = "Generate Clips"; file = "3-generate-clips.ps1"; args = @{WorkDir = $workDir; Model = $Model; FailFast = $FailFast} }
  @{ num = 4; name = "Assemble Video"; file = "4-assemble-video.ps1"; args = @{WorkDir = $workDir; Transition = $Transition; TransitionDuration = $TransitionDuration; Resolution = $Resolution; Fps = $Fps} }
)

foreach ($s in $stages) {
  if ($s.num -lt $Stage) { continue }

  $stageFile = Join-Path $PSScriptRoot "stages\$($s.file)"
  $doneMarker = Join-Path $workDir ".stage-$($s.num)-done"

  if (-not $Force -and (Test-Path $doneMarker)) {
    Write-Host "[SKIP]  Stage $($s.num) - $($s.name) (already done, use -Force to re-run)"
    continue
  }

  Write-Host ""
  Write-Host "-- Stage $($s.num): $($s.name) --"

  $splat = @{}
  $s.args.GetEnumerator() | ForEach-Object {
    $val = $_.Value
    if ($val -is [bool] -and $val) { $splat[$_.Key] = $true }
    elseif ($val -is [string]) { $splat[$_.Key] = $val }
  }

  try {
    & $stageFile @splat
    Set-Content -Path $doneMarker -Value (Get-Date -Format "yyyy-MM-dd HH:mm:ss") -Encoding utf8
    Write-Host "[DONE]  Stage $($s.num) complete"
  } catch {
    Write-Host "[FAIL]  Stage $($s.num): $_"
    if ($FailFast) { throw $_; return }
    Write-Host "  Continuing to next stage..."
  }
}

Write-Host ""
Write-Host "========================================"
Write-Host "Pipeline finished"
if (Test-Path (Join-Path $workDir "output\final.mp4")) {
  Write-Host "Output: $workDir\output\final.mp4"
}
Write-Host "========================================"
