param(
  [Parameter(Mandatory)][string]$WorkDir,
  [string]$Voice = ""
)

$manifestPath = Join-Path $WorkDir "manifest.json"
$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json

if ($Voice -eq "") { $Voice = $manifest.voice }

$ttsDir = Join-Path $WorkDir "tts"
New-Item -ItemType Directory -Path $ttsDir -Force | Out-Null

$ttsScript = Join-Path $PSScriptRoot "..\tts.ps1"
$changed = $false
$durations = @{}

foreach ($scene in $manifest.scenes) {
  $sceneNum = $scene.number.ToString('000')
  $outFile = "tts/scene-$sceneNum.wav"
  $outPath = Join-Path $WorkDir $outFile

  if ((Test-Path $outPath) -and $scene.tts_file) {
    Write-Host "  [SKIP] Scene $($scene.number) - TTS exists"
    $durations[$scene.number] = (Get-Item $outPath).Length
    continue
  }

  $preview = $scene.narration
  if ($preview.Length -gt 50) { $preview = $preview.Substring(0, 47) + "..." }
  Write-Host "  [TTS]  Scene $($scene.number): $preview"

  & $ttsScript -Text $scene.narration -OutFile $outPath -Voice $Voice
  if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) { throw "TTS failed for scene $($scene.number)" }

  $durations[$scene.number] = (Get-Item $outPath).Length
  $changed = $true
}

# Update manifest with tts_file paths
$scenes = $manifest.scenes | ForEach-Object {
  $s = $_
  $file = "tts/scene-$($s.number.ToString('000')).wav"
  $s | Select-Object *, @{n='tts_file';e={$file}}
}
$manifest = $manifest | Select-Object * -ExcludeProperty scenes
$manifest | Add-Member -NotePropertyName scenes -NotePropertyValue @($scenes) -Force
$manifest | ConvertTo-Json -Depth 10 | Set-Content $manifestPath -Encoding utf8

Write-Host "TTS complete - $($manifest.scenes.Count) files"
