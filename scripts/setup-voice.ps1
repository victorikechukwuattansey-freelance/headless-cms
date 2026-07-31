param(
  [switch]$Force
)

$ErrorActionPreference = "Stop"
$WhisperDir = "$env:USERPROFILE\.whisper"

Write-Host "=== Jarvis Voice: Dependency Setup ===" -ForegroundColor Cyan

# ── 1. ffmpeg ─────────────────────────────────────────────────────────────
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
  Write-Host "[1/3] Installing ffmpeg via winget..." -ForegroundColor Yellow
  winget install FFmpeg 2>&1 | Out-Null
  if ($?) { Write-Host "  ffmpeg installed. Restart terminal to refresh PATH." -ForegroundColor Green }
  else { Write-Host "  ffmpeg install failed. Download manually from https://ffmpeg.org/download.html" -ForegroundColor Red }
} else {
  Write-Host "[1/3] ffmpeg already installed." -ForegroundColor Green
}

# ── 2. whisper.cpp ────────────────────────────────────────────────────────
$null = New-Item -Type Directory -Path $WhisperDir -Force
$whisperExe = "$WhisperDir\whisper-cli.exe"
$whisperModel = "$WhisperDir\ggml-tiny.bin"

if (-not (Test-Path $whisperExe) -or $Force) {
  Write-Host "[2/3] Downloading whisper-cli.exe..." -ForegroundColor Yellow
  # Find latest windows release asset
  try {
    $release = Invoke-RestMethod -Uri "https://api.github.com/repos/ggerganov/whisper.cpp/releases/latest" -UseBasicParsing
    $asset = $release.assets | Where-Object { $_.name -like '*win*' -and $_.name -like '*.zip' } | Select-Object -First 1
    if (-not $asset) { $asset = $release.assets | Where-Object { $_.name -like '*.zip' } | Select-Object -First 1 }
    if ($asset) {
      $zip = "$env:TEMP\whisper.zip"
      Write-Host "  Downloading $($asset.name) ..." -ForegroundColor Gray
      Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $zip -UseBasicParsing
      Expand-Archive -Path $zip -DestinationPath "$env:TEMP\whisper-extract" -Force
      $releaseDir = Get-ChildItem -Recurse -Path "$env:TEMP\whisper-extract" -Directory -Name "Release" -ErrorAction SilentlyContinue | Select-Object -First 1
      $srcDir = if ($releaseDir) { $releaseDir.FullName } else { "$env:TEMP\whisper-extract" }
      Copy-Item "$srcDir\*.*" -Destination $WhisperDir -Force
      Remove-Item $zip, "$env:TEMP\whisper-extract" -Recurse -Force -ErrorAction SilentlyContinue
    }
  } catch {
    Write-Host "  Auto-download failed. Manual download:" -ForegroundColor Yellow
    Write-Host "  1. Go to https://github.com/ggerganov/whisper.cpp/releases" -ForegroundColor Gray
    Write-Host "  2. Download the Windows .zip" -ForegroundColor Gray
    Write-Host "  3. Extract whisper-cli.exe to $WhisperDir" -ForegroundColor Gray
  }
}

if (-not (Test-Path $whisperExe)) {
  Write-Host "  whisper-cli.exe not found. Place it in $WhisperDir" -ForegroundColor Red
} else {
  Write-Host "[2/3] whisper-cli.exe ready." -ForegroundColor Green
}

# ── 3. Whisper model ──────────────────────────────────────────────────────
if (-not (Test-Path $whisperModel) -or $Force) {
  Write-Host "[3/3] Downloading ggml-tiny.bin model (39 MB)..." -ForegroundColor Yellow
  try {
    $modelUrl = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin"
    Invoke-WebRequest -Uri $modelUrl -OutFile $whisperModel -UseBasicParsing
  } catch {
    Write-Host "  Download failed. Run manually:" -ForegroundColor Yellow
    Write-Host "  curl -L $modelUrl -o $whisperModel" -ForegroundColor Gray
  }
}

if (Test-Path $whisperModel) {
  Write-Host "[3/3] Model ready ($([math]::Round((Get-Item $whisperModel).Length / 1MB, 1)) MB)." -ForegroundColor Green
} else {
  Write-Host "[3/3] Model not found. Place ggml-tiny.bin in $WhisperDir" -ForegroundColor Red
}

# ── Summary ───────────────────────────────────────────────────────────────
Write-Host "`n=== Setup Complete ===" -ForegroundColor Cyan
Write-Host "Run the assistant with:" -ForegroundColor White
Write-Host "  .\scripts\jarvis-voice.ps1" -ForegroundColor Green
Write-Host "`nHotkeys:" -ForegroundColor White
Write-Host "  F2  - Toggle recording (works globally)" -ForegroundColor Gray
Write-Host "  Esc - Quit" -ForegroundColor Gray
