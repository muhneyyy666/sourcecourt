# SourceCourt demo package

The final local demo is generated from a verified public, live GPT-5.6 browser run. It is deliberately kept under the gitignored `output/` directory until upload.

## Local review files

- `../output/playwright/sourcecourt-demo-final.mp4` — 155-second H.264/AAC final demo with an embedded English caption track
- `../output/playwright/sourcecourt-live-demo-raw.webm` — unedited public-browser recording
- [`sourcecourt-demo-en.srt`](sourcecourt-demo-en.srt) — upload-ready English caption sidecar

## Rebuild

Requirements: macOS `say`, FFmpeg, ffprobe, and the verified raw recording above.

```bash
scripts/build-demo-draft.sh
```

The build is deterministic: it trims the raw live run into the 2:35 storyboard, generates a local Samantha TTS narration track, embeds the SRT captions, and exports exactly 155 seconds at 1440 × 900 and 25 fps. The narration explicitly distinguishes Codex's build-and-test role from GPT-5.6's constrained in-product role.

The system voice is AI-assisted narration, which the event FAQ permits. Preserve the caption timing and keep the live provider evidence legible when rebuilding or transcoding.
