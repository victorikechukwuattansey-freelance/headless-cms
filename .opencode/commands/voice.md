---
description: Launch the voice-activated assistant (global hotkey F2 to talk, Esc to quit).
---

Start the Jarvis voice assistant. Requires dependencies (run `setup-voice.ps1` first).

```powershell
.\scripts\jarvis-voice.ps1
```

Hold F2 globally (walkie-talkie mode) → speak → release → Jarvis transcribes with whisper.cpp, queries AI via opencode, and speaks the reply aloud.

Dependencies: ffmpeg, whisper-cli.exe + ggml-tiny.bin (see `scripts/setup-voice.ps1`).
