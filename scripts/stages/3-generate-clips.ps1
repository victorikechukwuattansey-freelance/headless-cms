param(
  [Parameter(Mandatory)][string]$WorkDir,
  [string]$Model = "",
  [switch]$FailFast
)

$manifestPath = Join-Path $WorkDir "manifest.json"
$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json

if ($Model -eq "") { $Model = $manifest.model }

$clipsDir = Join-Path $WorkDir "clips"
New-Item -ItemType Directory -Path $clipsDir -Force | Out-Null

$changed = $false
$failures = @()

foreach ($scene in $manifest.scenes) {
  $sceneNum = $scene.number.ToString('000')
  $outFile = "clips/scene-$sceneNum.mp4"
  $outPath = Join-Path $WorkDir $outFile

  if ((Test-Path $outPath) -and $scene.clip_file) {
    Write-Host "  [SKIP] Scene $($scene.number) - clip exists"
    continue
  }

  $preview = $scene.visual
  if ($preview.Length -gt 60) { $preview = $preview.Substring(0, 57) + "..." }
  Write-Host "  [VID]  Scene $($scene.number): $preview"

  $inputPath = Join-Path $WorkDir "temp-input-$sceneNum.json"
  $jsonContent = @{prompt = $scene.visual} | ConvertTo-Json -Compress
  [System.IO.File]::WriteAllText($inputPath, $jsonContent)

  $tryCount = 0
  $succeeded = $false
  do {
    $tryCount++
    try {
      $oldEA = $ErrorActionPreference
      $ErrorActionPreference = "Continue"
      try {
        $result = belt app run $Model --input "@$inputPath" --json 2>&1
      } finally {
        $ErrorActionPreference = $oldEA
      }
      $jsonOut = $result | Out-String

      $parsed = $jsonOut | ConvertFrom-Json -ErrorAction Stop

      $videoUrl = ""
      if ($parsed.output.videos) { $videoUrl = $parsed.output.videos[0] }
      elseif ($parsed.video_url) { $videoUrl = $parsed.video_url }
      elseif ($parsed.output -is [string]) { $videoUrl = $parsed.output }
      elseif ($parsed.url) { $videoUrl = $parsed.url }
      elseif ($parsed.result) { $videoUrl = $parsed.result }
      else {
        $urlMatch = [Regex]::Match($jsonOut, 'https?://[^\s"''<>]+\.(mp4|webm|mov)')
        if ($urlMatch.Success) { $videoUrl = $urlMatch.Value }
        else { throw "Could not extract video URL from output" }
      }

      Write-Host "    -> Downloading..."
      Invoke-WebRequest -Uri $videoUrl -OutFile $outPath -UseBasicParsing
      $succeeded = $true
    } catch {
      Write-Host "    [WARN] Attempt $tryCount failed: $_"
      if ($tryCount -ge 2) {
        if ($FailFast) { throw "Clip generation failed for scene $($scene.number): $_" }
        $failures += "Scene $($scene.number): $_"
      } else {
        Write-Host "    -> Retrying..."
        Start-Sleep -Seconds 3
      }
    }
  } while (-not $succeeded -and $tryCount -lt 2)

  if (Test-Path $inputPath) { Remove-Item $inputPath -Force }
  $changed = $true
}

$scenes = $manifest.scenes | ForEach-Object {
  $s = $_ | Select-Object * -ExcludeProperty clip_file
  $file = "clips/scene-$($s.number.ToString('000')).mp4"
  $s | Select-Object *, @{n='clip_file';e={$file}}
}
$manifest = $manifest | Select-Object * -ExcludeProperty scenes
$manifest | Add-Member -NotePropertyName scenes -NotePropertyValue @($scenes) -Force
$manifest | ConvertTo-Json -Depth 10 | Set-Content $manifestPath -Encoding utf8

Write-Host "Clips complete - $($manifest.scenes.Count) files"
if ($failures.Count -gt 0) {
  Write-Host "Failures ($($failures.Count)):"
  $failures | ForEach-Object { Write-Host "  - $_" }
}
