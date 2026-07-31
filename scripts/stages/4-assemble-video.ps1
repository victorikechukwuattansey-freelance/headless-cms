param(
  [Parameter(Mandatory)][string]$WorkDir,
  [ValidateSet("cut", "fade")][string]$Transition = "cut",
  [float]$TransitionDuration = 1.0,
  [string]$Resolution = "1920x1080",
  [int]$Fps = 24
)

$WorkDir = Resolve-Path $WorkDir -ErrorAction Stop

$manifestPath = Join-Path $WorkDir "manifest.json"
$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json

$outputDir = Join-Path $WorkDir "output"
$tempDir = Join-Path $WorkDir "temp"
New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

$scenes = $manifest.scenes
$totalScenes = $scenes.Count

function Get-Duration($file) {
  $oldEA = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $r = & ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 $file 2>$null
    return [double]$r
  } catch { return 0.0 }
  finally { $ErrorActionPreference = $oldEA }
}

function exec-ffmpeg($argList) {
  $oldEA = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    & ffmpeg @argList 2>$null
    if ($LASTEXITCODE -ne 0) { throw "ffmpeg failed (exit $LASTEXITCODE)" }
  } finally {
    $ErrorActionPreference = $oldEA
  }
}

Write-Host "[1/3] Preparing scenes (syncing video to audio)..."
$preparedFiles = @()
foreach ($scene in $scenes) {
  $num = $scene.number.ToString('000')
  $videoPath = Join-Path $WorkDir $scene.clip_file
  $audioPath = Join-Path $WorkDir $scene.tts_file
  $preparedPath = Join-Path $tempDir "prepared-$num.mp4"

  if (-not (Test-Path $videoPath)) {
    Write-Host "  [WARN] Scene $($scene.number) - video missing, generating placeholder"
    $dur = 5.0
    if (Test-Path $audioPath) { $dur = [math]::Max(3.0, (Get-Duration $audioPath)) }
    exec-ffmpeg @("-y", "-f", "lavfi", "-i", "color=c=black:s=${Resolution}:r=${Fps}:d=$dur", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "ultrafast", $preparedPath)
    $preparedFiles += $preparedPath
    continue
  }

  $videoDur = Get-Duration $videoPath
  $audioDur = Get-Duration $audioPath
  $resW, $resH = $Resolution.Split('x')
  $scale = "scale=${Resolution}:force_original_aspect_ratio=decrease,pad=${resW}:${resH}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${Fps}"

  if ($videoDur -ge $audioDur) {
    exec-ffmpeg @("-y", "-i", $videoPath, "-t", $audioDur, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-vf", $scale, "-preset", "fast", "-c:a", "aac", $preparedPath)
  } else {
    $extra = $audioDur - $videoDur
    exec-ffmpeg @("-y", "-i", $videoPath, "-filter_complex", "tpad=stop_mode=clone:stop_duration=$extra,$scale", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "fast", "-c:a", "aac", $preparedPath)
  }
  $preparedFiles += $preparedPath
  Write-Host "  [OK]   Scene $($scene.number) prepared"
}

Write-Host "[2/3] Concatenating audio..."
$concatAudio = Join-Path $tempDir "tts-concat.wav"

if ($totalScenes -eq 1) {
  $src = Join-Path $WorkDir $scenes[0].tts_file
  Copy-Item $src $concatAudio -Force
} elseif ($Transition -eq "cut") {
  $audioArgs = @("-y")
  for ($i = 0; $i -lt $totalScenes; $i++) {
    $audioArgs += "-i"; $audioArgs += (Join-Path $WorkDir $scenes[$i].tts_file)
  }
  $labels = for ($i = 0; $i -lt $totalScenes; $i++) { "[${i}:a]" }
  $filter = "$($labels -join '')concat=n=${totalScenes}:v=0:a=1[aout]"
  $audioArgs += "-filter_complex"; $audioArgs += $filter
  $audioArgs += "-map"; $audioArgs += "[aout]"
  $audioArgs += $concatAudio
  exec-ffmpeg $audioArgs
} else {
  $audioArgs = @("-y")
  for ($i = 0; $i -lt $totalScenes; $i++) {
    $audioArgs += "-i"; $audioArgs += (Join-Path $WorkDir $scenes[$i].tts_file)
  }
  $afilterParts = @()
  for ($i = 0; $i -lt $totalScenes; $i++) {
    $p = Join-Path $WorkDir $scenes[$i].tts_file
    if ($i -eq 0) {
      $dur = [math]::Max(0.01, (Get-Duration $p) - $TransitionDuration)
      $afilterParts += "[0:a]atrim=0:$dur[at$i]"
    } elseif ($i -eq 1) {
      $afilterParts += "[at$($i-1)][${i}:a]acrossfade=d=$TransitionDuration[af$i]"
    } else {
      $afilterParts += "[af$($i-1)][${i}:a]acrossfade=d=$TransitionDuration[af$i]"
    }
  }
  $lastLabel = if ($totalScenes -le 2) { "af1" } else { "af$($totalScenes-1)" }
  $audioArgs += "-filter_complex"; $audioArgs += ($afilterParts -join ";")
  $audioArgs += "-map"; $audioArgs += "[$lastLabel]"
  $audioArgs += $concatAudio
  exec-ffmpeg $audioArgs
}

Write-Host "[3/3] Assembling final video..."
$finalOutput = Join-Path $outputDir "final.mp4"

if ($Transition -eq "cut" -or $totalScenes -eq 1) {
  $fileList = Join-Path $tempDir "video-list.txt"
  $preparedFiles | ForEach-Object { "file '$_'" | Add-Content $fileList -Encoding Ascii }
  exec-ffmpeg @("-y", "-f", "concat", "-safe", "0", "-i", $fileList, "-i", $concatAudio, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "medium", "-c:a", "aac", "-b:a", "192k", "-map", "0:v", "-map", "1:a", "-shortest", $finalOutput)
} else {
  $durations = $preparedFiles | ForEach-Object { Get-Duration $_ }
  $xfadeArgs = @("-y")
  for ($i = 0; $i -lt $totalScenes; $i++) {
    $xfadeArgs += "-i"; $xfadeArgs += $preparedFiles[$i]
  }
  $xfadeArgs += "-i"; $xfadeArgs += $concatAudio

  $vfilterParts = @()
  for ($i = 0; $i -lt $totalScenes; $i++) {
    if ($i -eq 0) {
      $vfilterParts += "[${i}:v]setpts=PTS-STARTPTS,trim=0:$($durations[$i])[v$i]"
    } else {
      $cumulative = 0
      for ($j = 0; $j -lt $i; $j++) { $cumulative += $durations[$j] }
      $offset = $cumulative - $i * $TransitionDuration
      $prev = if ($i -eq 1) { "v$($i-1)" } else { "vf$($i-1)" }
      $vfilterParts += "[$prev][${i}:v]xfade=transition=fade:duration=${TransitionDuration}:offset=$offset[vf$i]"
    }
  }
  $vfilterStr = $vfilterParts -join ";"
  $lastLabel = if ($totalScenes -eq 1) { "0:v" } else { "vf$($totalScenes-1)" }

  $xfadeArgs += "-filter_complex"; $xfadeArgs += $vfilterStr
  $xfadeArgs += "-map"; $xfadeArgs += "[$lastLabel]"
  $xfadeArgs += "-map"; $xfadeArgs += "$($totalScenes):a"
  $xfadeArgs += "-c:v"; $xfadeArgs += "libx264"
  $xfadeArgs += "-pix_fmt"; $xfadeArgs += "yuv420p"
  $xfadeArgs += "-preset"; $xfadeArgs += "medium"
  $xfadeArgs += "-c:a"; $xfadeArgs += "aac"
  $xfadeArgs += "-b:a"; $xfadeArgs += "192k"
  $xfadeArgs += "-shortest"
  $xfadeArgs += $finalOutput
  exec-ffmpeg $xfadeArgs
}

Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue

$size = [math]::Round((Get-Item $finalOutput).Length / 1MB, 1)
Write-Host "Done - $finalOutput ($size MB)"
