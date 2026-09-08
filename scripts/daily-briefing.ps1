param(
    [string]$ProjectDir = "C:\Users\1040 G8\Documents\jarvis-demo",
    [string]$LogDir = "",
    [string]$VaultNotesDir = "C:\Users\1040 G8\Documents\Brain\01 - Daily Notes",
    [string]$Model = "opencode/deepseek-v4-flash-free"
)

$ErrorActionPreference = "Stop"

$date = Get-Date -Format "yyyy-MM-dd"

if ([string]::IsNullOrEmpty($LogDir)) {
    $LogDir = Join-Path $ProjectDir "logs"
}
if (-not (Test-Path -LiteralPath $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir | Out-Null
}

$logFile = Join-Path $LogDir "briefing-$date.log"

$opencode = Join-Path $env:APPDATA "npm\opencode.cmd"
if (-not (Test-Path -LiteralPath $opencode)) {
    $opencode = "opencode"
}

function Write-Log([string]$line) {
    "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $line" | Out-File -FilePath $logFile -Append -Encoding utf8
}

function Sync-SessionsToVault {
    $sessionsJson = (& $opencode session list --format json 2>$null) -join "`n"
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($sessionsJson)) {
        Write-Log "WARN: session list failed - skipping session sync"
        return
    }

    $sessions = $null
    try { $sessions = $sessionsJson | ConvertFrom-Json } catch { }

    $notePath = Join-Path $VaultNotesDir "$date.md"
    if (-not (Test-Path -LiteralPath $notePath)) {
        New-Item -ItemType Directory -Path $VaultNotesDir -Force | Out-Null
        Set-Content -LiteralPath $notePath -Value "# $date" -Encoding utf8
    }

    $existing = Get-Content -LiteralPath $notePath -Raw -Encoding utf8
    $todayStart = Get-Date -Hour 0 -Minute 0 -Second 0

    $newLines = @()
    foreach ($s in $sessions) {
        if ($s.directory -ne $ProjectDir) { continue }
        $created = [DateTimeOffset]::FromUnixTimeMilliseconds([long]$s.created).LocalDateTime
        if ($created -lt $todayStart) { continue }
        if ($s.title -like "New session - *") { continue }
        $short = if ($s.id.Length -ge 8) { $s.id.Substring(0, 8) } else { $s.id }
        if ($existing -and $existing.Contains('`' + $short + '`')) { continue }
        $entry = "- " + '`' + $created.ToString("HH:mm") + '`' + " - " + '`' + $short + '`' + " - *" + $s.title + "*"
        $newLines += $entry
    }

    if ($newLines.Count -eq 0) {
        Write-Log "session sync: no new sessions to add"
        return
    }

    $block = "## Auto Log"
    if ($existing.Contains($block)) {
        $content = $existing.TrimEnd() + "`n" + (($newLines | ForEach-Object { $_ }) -join "`n") + "`n"
    } else {
        $content = $existing.TrimEnd() + "`n`n" + $block + "`n`n" + (($newLines | ForEach-Object { $_ }) -join "`n") + "`n"
    }
    Set-Content -LiteralPath $notePath -Value $content -Encoding utf8
    Write-Log "session sync: added $($newLines.Count) session(s) to $notePath"
}

Write-Log "START briefing run"

Sync-SessionsToVault

try {
    $ErrorActionPreference = "Continue"
    $output = & $opencode run --command briefing --dir $ProjectDir --model $Model --auto 2>&1
    $exit = $LASTEXITCODE
    $ErrorActionPreference = "Stop"
    $output | Out-File -FilePath $logFile -Append -Encoding utf8
    Write-Log "EXIT code: $exit"
    if ($exit -ne 0) {
        Write-Log "ERROR: non-zero exit"
        exit $exit
    }
}
catch {
    Write-Log "ERROR: $($_.Exception.Message)"
    exit 1
}

Write-Log "DONE briefing run"
exit 0