# Video Pipeline — Stage-Based Build System

## Overview

A reusable PowerShell pipeline that takes a markdown script (scenes with narration + visual prompt), generates TTS audio and AI video clips per scene, and assembles them into a single MP4 file. Designed for ongoing iterative use — any stage can be re-run independently.

## Input Format

A markdown file with `##` headings delimiting scenes:

```markdown
# My Video

## Scene 1
Narration: "The ocean waves crash against the shore at golden hour..."
Visual: waves crashing on a rocky beach at sunset, cinematic

## Scene 2
Narration: "Marine life thrives beneath the surface..."
Visual: coral reef with colorful fish swimming, underwater, vibrant
```

Each scene block must contain a `Narration:` line and a `Visual:` line. Text after the colon is the value.

## Architecture

```
scripts/
  build-video.ps1              # Orchestrator — runs/selects stages
  stages/
    1-parse-script.ps1          # Parse markdown → manifest.json
    2-generate-tts.ps1          # TTS per scene → tts/*.wav
    3-generate-clips.ps1        # AI video per scene → clips/*.mp4
    4-assemble-video.ps1        # ffmpeg stitch + audio → output/final.mp4
```

### Per-run working directory

```
videos/<project-name>/
  script.md            # Copy of source script
  manifest.json        # Scene list, enriched by each stage
  tts/                 # scene-001.wav, scene-002.wav ...
  clips/               # scene-001.mp4, scene-002.mp4 ...
  output/
    final.mp4          # Final assembled video
```

### manifest.json

The contract between stages. Written by stage 1, read/enriched by subsequent stages.

```json
{
  "project": "my-video",
  "model": "google/veo-3-1-fast",
  "voice": "Microsoft Zira Desktop",
  "scenes": [
    {
      "number": 1,
      "narration": "The ocean waves crash against the shore...",
      "visual": "waves crashing on a rocky beach at sunset, cinematic"
    }
  ]
}
```

Stage 2 adds `"tts_file": "tts/scene-001.wav"`, stage 3 adds `"clip_file": "clips/scene-001.mp4"` to each scene object.

## Pipeline Stages

### Stage 1 — Parse Script

- Reads the markdown file
- Extracts scenes by splitting on `## ` headings
- Parses `Narration:` and `Visual:` lines via regex
- Writes `manifest.json` to the working directory
- Skips if `manifest.json` already exists (idempotent)

### Stage 2 — Generate TTS

- For each scene, calls `scripts/tts.ps1` with the narration text
- Output: `tts/scene-NNN.wav` (zero-padded number)
- Skips scenes whose WAV already exists
- Updates manifest with `tts_file` paths

### Stage 3 — Generate Video Clips

- For each scene, calls `belt app run <model>` with the visual prompt as JSON input
- Downloads the resulting MP4 to `clips/scene-NNN.mp4`
- Skips scenes whose clip already exists
- Updates manifest with `clip_file` paths
- Configurable model (default: `google/veo-3-1-fast`)
- Failed belt calls retried once, then logged and skipped unless `-FailFast` is set

### Stage 4 — Assemble Video

- Builds an ffmpeg concat filter from all clips (with crossfade transitions)
- Overlays each scene's TTS audio at the correct timestamp
- Handles duration mismatch: if clip < audio, loop/pad; if clip > audio, trim
- Outputs `output/final.mp4`
- Writes `output/build.log` with assembly details

## Orchestrator — build-video.ps1

```powershell
.\scripts\build-video.ps1 -Script "videos/my-project/script.md" [-Stage 3] [-FailFast]
```

- `-Script`: path to the markdown script file
- `-Stage`: start from a specific stage (default: 1). Stages before it execute only if their outputs are missing
- `-FailFast`: exit on first generation failure (default: skip and continue)

## Dependencies

- **PowerShell 5.1+** (Windows)
- **ffmpeg** — for assembly (must be on PATH)
- **belt CLI** — for AI video generation (`npx skills add belt-sh/cli` + `belt login`)
- **System.Speech** — Windows built-in (used by `tts.ps1`)

## Error Handling

- Each stage writes a `.stage-done` marker after successful completion
- Idempotent: re-running a stage skips already-completed items
- Scene-level failures in stages 2/3 are logged and skipped (allows partial builds)
- `-FailFast` overrides to exit on any failure

## Future Considerations

- Parallel clip generation (stage 3 runs belt calls concurrently)
- Transition type configurable (fade, dissolve, cut)
- Support for image-to-video models (stage 3 accepts image_url)
- Foley sound effects via HunyuanVideo Foley on final clip
