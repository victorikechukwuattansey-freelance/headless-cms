param(
  [Parameter(Mandatory)][string]$ScriptPath,
  [Parameter(Mandatory)][string]$WorkDir
)

$lines = Get-Content $ScriptPath
$scenes = @()
$currentLines = @()
$sceneIndex = 0
$project = "untitled"

# First pass: extract project title
foreach ($line in $lines) {
  if ($line -match '^#\s+(.+?)$' -and $line -notmatch '^##') {
    $project = $matches[1] -replace '[^\w-]', '-' -replace '-+', '-' -replace '^-|-$', ''
    break
  }
}

$foundHeading = $false

# Second pass: split into scenes by ## headings
foreach ($line in $lines) {
  if ($line -match '^##\s') {
    $foundHeading = $true
    if ($currentLines.Count -gt 0) {
      $block = $currentLines -join "`n"
      $title = ""
      $narration = ""
      $visual = ""

      if ($block -match '^##\s+(.+?)(?:\r?\n|$)') { $title = $matches[1].Trim() }
      if ($block -match 'Narration:\s*"(.+?)"') { $narration = $matches[1] }
      elseif ($block -match 'Narration:\s*(.+?)(?:\r?\n|$)') { $narration = $matches[1].Trim('"') }
      if ($block -match 'Visual:\s*"(.+?)"') { $visual = $matches[1] }
      elseif ($block -match 'Visual:\s*(.+?)(?:\r?\n|$)') { $visual = $matches[1].Trim('"') }

      $sceneIndex++
      $scenes += @{
        number = $sceneIndex
        title = $title
        narration = $narration
        visual = $visual
      }
    }
    $currentLines = @($line)
  } elseif ($foundHeading) {
    $currentLines += $line
  }
}

# Process the last scene
if ($currentLines.Count -gt 0) {
  $block = $currentLines -join "`n"
  $narration = ""
  $visual = ""
  $title = ""

  if ($block -match '^##\s+(.+?)(?:\r?\n|$)') { $title = $matches[1].Trim() }
  if ($block -match 'Narration:\s*"(.+?)"') { $narration = $matches[1] }
  elseif ($block -match 'Narration:\s*(.+?)(?:\r?\n|$)') { $narration = $matches[1].Trim('"') }
  if ($block -match 'Visual:\s*"(.+?)"') { $visual = $matches[1] }
  elseif ($block -match 'Visual:\s*(.+?)(?:\r?\n|$)') { $visual = $matches[1].Trim('"') }

  $sceneIndex++
  $scenes += @{
    number = $sceneIndex
    title = $title
    narration = $narration
    visual = $visual
  }
}

if ($scenes.Count -eq 0) { throw "No scenes found in script file" }

$manifest = @{
  project = $project
  model   = "google/veo-3-1-fast"
  voice   = "Microsoft Zira Desktop"
  scenes  = $scenes
}

$manifest | ConvertTo-Json -Depth 10 | Set-Content (Join-Path $WorkDir "manifest.json") -Encoding utf8
Write-Host "Parsed $($scenes.Count) scenes -> manifest.json"
