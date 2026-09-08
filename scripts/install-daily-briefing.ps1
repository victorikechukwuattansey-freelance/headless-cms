param(
    [string]$TaskName = "Jarvis-Daily-Briefing",
    [string]$Time = "18:00",
    [string]$ProjectDir = "C:\Users\1040 G8\Documents\jarvis-demo",
    [switch]$Remove
)

$ErrorActionPreference = "Stop"

$scriptPath = Join-Path $ProjectDir "scripts\daily-briefing.ps1"

if ($Remove) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
    Write-Host "Removed scheduled task '$TaskName' (if it existed)."
    exit 0
}

$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`" -ProjectDir `"$ProjectDir`""

$trigger = New-ScheduledTaskTrigger -Daily -At $Time

$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 10) `
    -MultipleInstances IgnoreNew `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Description "Run OpenCode daily briefing: opencode run --command briefing -> vault daily note" -Force | Out-Null

Write-Host "Registered '$TaskName' daily at $Time -> $scriptPath"
Get-ScheduledTask -TaskName $TaskName | Select-Object TaskName, State