$ErrorActionPreference = 'Stop'
$dir = $PSScriptRoot
$files = @('01 - lead-IntakeV4.3.json','02-booking-status.json','03-manual-callback-log.json','04-manual-status-update.json','05-followup-sweeper.json')
$results = @()
foreach ($f in $files) {
    $path = Join-Path $dir $f
    if (-not (Test-Path -LiteralPath $path)) { Write-Output "MISSING: $f"; continue }
    $raw = Get-Content -LiteralPath $path -Raw
    try { $wf = $raw | ConvertFrom-Json } catch { Write-Output "JSON FAIL: $f -> $($_.Exception.Message)"; continue }

    $nodeNames = @($wf.nodes | ForEach-Object { $_.name })
    $dupNames = $nodeNames | Group-Object | Where-Object Count -gt 1 | ForEach-Object Name
    $ids = @($wf.nodes | ForEach-Object { $_.id })
    $dupIds = $ids | Group-Object | Where-Object Count -gt 1 | ForEach-Object Name

    # broken connections
    $broken = @()
    foreach ($prop in $wf.connections.PSObject.Properties) {
        $src = $prop.Name
        if ($nodeNames -notcontains $src) { $broken += "conn-source-missing:$src" }
        foreach ($branch in $prop.Value.main) {
            foreach ($t in $branch) {
                if ($nodeNames -notcontains $t.node) { $broken += "conn-target-missing:$src->$($t.node)" }
            }
        }
    }

    # orphan nodes (no incoming connection, not a trigger)
    $triggers = @('webhook','scheduleTrigger','errorTrigger','manualTrigger')
    $targets = @()
    foreach ($prop in $wf.connections.PSObject.Properties) {
        foreach ($branch in $prop.Value.main) { foreach ($t in $branch) { $targets += $t.node } }
    }
    $orphans = @($wf.nodes | Where-Object {
        $n = $_.name
        ($targets -notcontains $n) -and -not ($triggers | Where-Object { $_.type -like "*$_" })
    } | ForEach-Object { $_.name })

    $obsoleteSend = ([regex]::Matches($raw, 'n8n-nodes-base\.sendEmail')).Count
    $dollarHeaders = ([regex]::Matches($raw, '\$headers\[')).Count
    $placeholderDoc = ([regex]::Matches($raw, '__YOUR_GOOGLE_SPREADSHEET_ID__')).Count
    $placeholderCred = ([regex]::Matches($raw, '__GOOGLE_SHEETS_CRED_ID__|__SMTP_CRED_ID__')).Count
    $literalExpr = ([regex]::Matches($raw, '"[^"]*=\{\{')[0] -ne $null)  # sanity only
    $envSecret = ([regex]::Matches($raw, '\$env\.LEAD_ENGINE_SECRET')).Count

    $results += [pscustomobject]@{
        File = $f
        JsonParse = 'PASS'
        Nodes = $wf.nodes.Count
        DupNames = ($(if ($dupNames) { $dupNames -join ',' } else { '-' }))
        DupIds = ($(if ($dupIds) { $dupIds -join ',' } else { '-' }))
        BrokenConn = ($(if ($broken) { $broken -join ';' } else { '-' }))
        Orphans = ($(if ($orphans) { $orphans -join ';' } else { '-' }))
        obsoleteSendEmail = $obsoleteSend
        dollarHeaders = $dollarHeaders
        envSecretRefs = $envSecret
        placeholderDocId = $placeholderDoc
        placeholderCred = $placeholderCred
    }
}
$results | Format-List
