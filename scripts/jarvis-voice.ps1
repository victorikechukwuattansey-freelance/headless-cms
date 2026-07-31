param(
  [string]$ConfigPath = "$PSScriptRoot\jarvis-config.json",
  [string]$OllamaModel = "",
  [string]$TtsVoice = "",
  [string]$AudioDevice = "",
  [switch]$ShowConfig
)

$ScriptName = "Jarvis"
$TempDir = "$env:TEMP\jarvis-voice"
$null = New-Item -Type Directory -Path $TempDir -Force
$AudioFile = "$TempDir\recording.wav"
$ResponseWav = "$TempDir\response.wav"
$TtsScript = "$PSScriptRoot\tts.ps1"

# ── Load config ──────────────────────────────────────────────────────────
function Load-Config {
  $defaults = @{
    ollamaModel = "llama3.2:latest"
    ttsVoice = "Microsoft Zira Desktop"
    whisperExe = "~/.whisper/whisper-cli.exe"
    whisperModel = "~/.whisper/ggml-tiny.bin"
    audioDevice = ""
    recordTimeoutSec = 15
  }
  $cfg = @{}
  if (Test-Path $ConfigPath) {
    try { $cfg = Get-Content $ConfigPath -Raw | ConvertFrom-Json } catch { Warn "Config parse error, using defaults" }
  }
  foreach ($k in $defaults.Keys) { if (-not $cfg.$k) { $cfg.$k = $defaults.$k } }

  # Expand ~ to userprofile
  $cfg.whisperExe = $cfg.whisperExe -replace '^~', $env:USERPROFILE
  $cfg.whisperModel = $cfg.whisperModel -replace '^~', $env:USERPROFILE

  # CLI overrides
  if ($OllamaModel) { $cfg.ollamaModel = $OllamaModel }
  if ($TtsVoice)    { $cfg.ttsVoice = $TtsVoice }
  if ($AudioDevice) { $cfg.audioDevice = $AudioDevice }

  return $cfg
}

$Cfg = Load-Config
$WhisperExe = $Cfg.whisperExe
$WhisperModel = $Cfg.whisperModel
$OllamaModel = $Cfg.ollamaModel
$TtsVoice = $Cfg.ttsVoice
$AudioDevice = $Cfg.audioDevice
$RecordTimeoutSec = $Cfg.recordTimeoutSec

if ($ShowConfig) { $Cfg | ConvertTo-Json; return }

# ── Global key-state API ──────────────────────────────────────────────────
Add-Type @"
using System.Runtime.InteropServices;
public static class Kbd {
    [DllImport("user32.dll")] public static extern short GetAsyncKeyState(int vKey);
}
"@
function IsKeyDown($vk) { ([Kbd]::GetAsyncKeyState($vk) -band 0x8000) -ne 0 }

# ── Colored logging ───────────────────────────────────────────────────────
function Log  { Write-Host "[$ScriptName] $($args -join ' ')" -ForegroundColor Cyan }
function Good { Write-Host "[$ScriptName] $($args -join ' ')" -ForegroundColor Green }
function Warn { Write-Host "[$ScriptName] WARN: $($args -join ' ')" -ForegroundColor Yellow }
function Fail { Write-Host "[$ScriptName] ERROR: $($args -join ' ')" -ForegroundColor Red }

# ─── Audio device ────────────────────────────────────────────────────────
function Find-Mic {
  $lines = & $script:ffmpegPath -list_devices true -f dshow -i dummy 2>&1
  $names = $lines | Select-String '"([^"]+)"' | ForEach-Object { $_.Matches.Groups[1].Value }
  $mic = $names | Where-Object { $_ -match '(?i)(microphone|mic|input|line|array)' } | Select-Object -First 1
  if (-not $mic) { $mic = $names | Where-Object { $_ -notmatch '(?i)(speaker|output|headphone|echo)' } | Select-Object -First 1 }
  if (-not $mic) { $mic = $names | Select-Object -First 1 }
  return $mic
}

# ─── Recording ───────────────────────────────────────────────────────────
$isRecording = $false
$processing = $false
$ffmpegProc = $null
$procJob = $null

function Start-Recording {
  if ($isRecording) { return }
  $device = if ($AudioDevice) { $AudioDevice } else { Find-Mic }
  if (-not $device) { Fail "No mic found. Edit audioDevice in jarvis-config.json"; return }
  Remove-Item $AudioFile -ErrorAction SilentlyContinue
  $psi = New-Object Diagnostics.ProcessStartInfo
  $psi.FileName = $script:ffmpegPath
  $psi.Arguments = "-f dshow -i `"audio=$device`" -acodec pcm_s16le -ar 16000 -ac 1 -y `"$AudioFile`""
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true
  $script:ffmpegProc = [Diagnostics.Process]::Start($psi)
  if ($script:ffmpegProc -and -not $script:ffmpegProc.HasExited) { $script:isRecording = $true; Good "Listening..." }
}

function Stop-Recording {
  if (-not $isRecording) { return }
  $script:isRecording = $false; Kill-FFmpeg
  if ((Get-Item $AudioFile -ErrorAction SilentlyContinue).Length -lt 1000) { Warn "No audio captured."; return }
  Process-Background
}

function Kill-FFmpeg {
  if ($script:ffmpegProc -and -not $script:ffmpegProc.HasExited) { $script:ffmpegProc.Kill(); $script:ffmpegProc.Dispose(); $script:ffmpegProc = $null }
}

# ─── Background processing job ──────────────────────────────────────────
function Process-Background {
  if ($processing) { return }
  $script:processing = $true; Log "Thinking..."
  $script:procJob = Start-Job -Name "JarvisProc" -ScriptBlock {
    param($af, $wp, $wm, $om, $ts, $tv, $td, $rw)
    $null = New-Item -Type Directory -Path $td -Force

    # Transcribe
    $jsonOut = "$td\result.json"
    & $wp -m $wm -f $af -oj -of "$td\result" --no-prints 2>&1 | Out-Null
    $text = ""
    if (Test-Path $jsonOut) {
      $p = Get-Content $jsonOut -Raw | ConvertFrom-Json -ErrorAction SilentlyContinue
      if ($p -and $p.transcription -and $p.transcription.Count -gt 0) {
        $text = ($p.transcription | ForEach-Object { $_.text }) -join " "
        $text = $text -replace '\[BLANK_AUDIO\]', '' -replace '\s+', ' ' | ForEach-Object { $_.Trim() }
      }
    }
    if (-not $text) { return "[no speech]" }
    "TRANSCRIPT:$text"

    # AI via Ollama
    $body = @{ model = $om; prompt = $text; stream = $false } | ConvertTo-Json -Compress
    $reply = ""
    try {
      $resp = Invoke-RestMethod "http://localhost:11434/api/generate" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 60
      if ($resp.response) { $reply = $resp.response.Trim() }
    } catch { $reply = "[Ollama error: $_]" }
    "REPLY:$reply"

    # TTS
    if ($reply) { & $ts -Text $reply -OutFile $rw -Voice $tv 2>&1 | Out-Null }
    "DONE"
  } -ArgumentList $AudioFile, $WhisperExe, $WhisperModel, $OllamaModel, $TtsScript, $TtsVoice, $TempDir, $ResponseWav
}

# ─── Prerequisites ──────────────────────────────────────────────────────
function Find-FFmpeg {
  $name = (Get-Command ffmpeg -ErrorAction SilentlyContinue)
  if ($name) { return $name.Source }
  $wingetPath = "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.2-full_build\bin\ffmpeg.exe"
  if (Test-Path $wingetPath) { return $wingetPath }
  return $null
}

function Check-Deps {
  $ok = $true
  if (-not (Get-Command ollama -ErrorAction SilentlyContinue)) { Fail "Missing: Ollama (ollama.com)"; $ok = $false }
  if (-not (Test-Path $WhisperExe))    { Fail "Missing: $WhisperExe"; $ok = $false }
  if (-not (Test-Path $WhisperModel))  { Fail "Missing: $WhisperModel"; $ok = $false }
  $script:ffmpegPath = Find-FFmpeg
  if (-not $script:ffmpegPath)         { Fail "Missing: ffmpeg (run setup-voice.ps1)"; $ok = $false }
  if (-not (Test-Path $TtsScript))     { Fail "Missing: $TtsScript"; $ok = $false }
  if ($ok) {
    try { $null = Invoke-RestMethod "http://localhost:11434/api/tags" -TimeoutSec 3 } catch { Fail "Ollama not running"; $ok = $false }
  }
  return $ok
}

# ─── Main loop ──────────────────────────────────────────────────────────
function Main {
  if (-not (Check-Deps)) { return }

  Good "Ollama: $OllamaModel | Voice: $TtsVoice"

  Write-Host @"

 ╔══════════════════════════════════════╗
 ║       Jarvis Voice Assistant         ║
 ║                                      ║
 ║   F2 — toggle recording              ║
 ║   Esc — quit                         ║
 ╚══════════════════════════════════════╝

"@ -ForegroundColor Cyan

  $prevF2 = $false; $running = $true

  while ($running) {
    $f2 = IsKeyDown 0x71; $esc = IsKeyDown 0x1B

    if ($esc) {
      if ($isRecording) { Stop-Recording }
      Kill-FFmpeg; $running = $false; continue
    }

    if ($f2 -and -not $prevF2 -and -not $processing) {
      if ($isRecording) { Stop-Recording } else { Start-Recording }
    }
    $prevF2 = $f2

    if ($processing -and $script:procJob) {
      $state = $script:procJob.JobStateInfo.State
      if ($state -eq 'Completed' -or $state -eq 'Failed') {
        $data = Receive-Job $script:procJob; Remove-Job $script:procJob
        $script:procJob = $null; $script:processing = $false

        $reply = ""
        foreach ($line in $data) { if ($line -match '^REPLY:(.*)') { $reply = $Matches[1]; break } }

        if ($reply) {
          Write-Host "[Jarvis] $reply" -ForegroundColor Green
          if (Test-Path $ResponseWav) {
            try {
              $player = New-Object System.Media.SoundPlayer($ResponseWav)
              $player.PlaySync(); $player.Dispose()
            } catch { Fail "Playback: $_" }
          }
        } elseif (($data | Select-String '\[no speech\]' -SimpleMatch).Count -gt 0) { Warn "No speech detected." }
        else { Warn "Empty response." }
        Remove-Item $ResponseWav -ErrorAction SilentlyContinue
      }
    }
    Start-Sleep -Milliseconds 60
  }

  Kill-FFmpeg; Remove-Item "$TempDir\*" -Force -ErrorAction SilentlyContinue; Good "Bye!"
}

if ($ShowConfig) { return }
Main
