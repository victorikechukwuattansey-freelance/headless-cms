param(
  [Parameter(Mandatory = $true)][string]$Text,
  [Parameter(Mandatory = $true)][string]$OutFile,
  [string]$Voice = "Microsoft Zira Desktop",
  [int]$Rate = 0
)

Add-Type -AssemblyName System.Speech
$speech = New-Object System.Speech.Synthesis.SpeechSynthesizer
$speech.SelectVoice($Voice)
$speech.Rate = $Rate
$speech.SetOutputToWaveFile($OutFile)
$speech.Speak($Text)
$speech.Dispose()

Write-Host "Audio saved to: $OutFile"
