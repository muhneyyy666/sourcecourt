#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
raw_video="$project_root/output/playwright/sourcecourt-live-demo-raw.webm"
captions="$project_root/demo/sourcecourt-demo-en.srt"
output_video="$project_root/output/playwright/sourcecourt-demo-final.mp4"

for command_name in ffmpeg ffprobe say; do
  command -v "$command_name" >/dev/null 2>&1 || {
    echo "Missing required command: $command_name" >&2
    exit 1
  }
done

[[ -s "$raw_video" ]] || {
  echo "Missing live browser recording: $raw_video" >&2
  exit 1
}

[[ -s "$captions" ]] || {
  echo "Missing English captions: $captions" >&2
  exit 1
}

demo_tmp="$(mktemp -d "${TMPDIR:-/tmp}/sourcecourt-demo.XXXXXX")"
trap 'rm -rf -- "$demo_tmp"' EXIT

narrations=(
  "Fluent is not the same as supported. SourceCourt makes students defend a claim with evidence instead of asking AI to write it."
  "This seven-minute history case contains ten curated sources. The student chooses the evidence, and every marker remains inspectable against the original record."
  "GPT-5.6 is opposing counsel, not the answer writer. At maximum reasoning effort, it finds one material weakness using only the closed record. Here it catches a familiar historical overclaim: the outbreak was already declining before the handle was removed."
  "The model returns strict JSON. Server code rejects unknown source IDs, illegal relations, missing fields, and overlong output, then attaches quotations from local data. Code verifies provenance; semantic relevance remains an AI judgment and may be wrong."
  "The student must acknowledge the opposing evidence and narrow the claim. SourceCourt never generates the final argument for them. Codex built and tested the zero-dependency app, structured-output contract, provenance guards, accessibility, and deployment. GPT-5.6 serves only as the live opposing counsel."
  "Deterministic checks now show broader evidence-facet coverage, a developed response that cites the opposing record, and no uncited assertion. The surface record-use score moves from 48 to 93. These signals can be gamed; they are not semantic grading, a truth score, or a claim of learning outcomes."
  "The result is a portable evidence brief with the claim, challenge, learner response, revision, timestamp, metrics, and original sources."
  "SourceCourt: the student owns the conclusion; AI makes the reasoning harder to fake."
)

audio_inputs=()
for index in "${!narrations[@]}"; do
  scene_number=$(printf "%02d" "$((index + 1))")
  scene_audio="$demo_tmp/scene-$scene_number.aiff"
  say -v Samantha -r 172 -o "$scene_audio" "${narrations[$index]}"
  audio_inputs+=(-i "$scene_audio")
done

filter_graph='[0:v]split=9[r0][r1][r2][r3][r4][r5][r6][r7][r8];
[r0]trim=start=110:end=116,setpts=PTS-STARTPTS,fps=25,format=yuv420p[v0];
[r1]trim=start=50:end=56,setpts=PTS-STARTPTS,fps=25,format=yuv420p[v1];
[r2]trim=start=56:end=67,setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=7,fps=25,format=yuv420p[v2];
[r3]trim=start=67:end=82,setpts=1.6*(PTS-STARTPTS),tpad=stop_mode=clone:stop_duration=4,fps=25,format=yuv420p[v3];
[r4]trim=start=82:end=88,setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=14,fps=25,format=yuv420p[v4];
[r5]trim=start=88:end=100,setpts=2.75*(PTS-STARTPTS),tpad=stop_mode=clone:stop_duration=3,fps=25,format=yuv420p[v5];
[r6]trim=start=100:end=113,setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=8,fps=25,format=yuv420p[v6];
[r7]trim=start=113:end=126,setpts=PTS-STARTPTS,fps=25,format=yuv420p[v7];
[r8]trim=start=126:end=131,setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=2,fps=25,format=yuv420p[v8];
[v0][v1][v2][v3][v4][v5][v6][v7][v8]concat=n=9:v=1:a=0,trim=duration=155,setpts=PTS-STARTPTS[v];
[1:a]aresample=48000,aformat=channel_layouts=stereo,volume=1.15,adelay=500:all=1[a1];
[2:a]aresample=48000,aformat=channel_layouts=stereo,volume=1.15,adelay=12500:all=1[a2];
[3:a]aresample=48000,aformat=channel_layouts=stereo,volume=1.15,adelay=30500:all=1[a3];
[4:a]aresample=48000,aformat=channel_layouts=stereo,volume=1.15,adelay=58500:all=1[a4];
[5:a]aresample=48000,aformat=channel_layouts=stereo,volume=1.15,adelay=78500:all=1[a5];
[6:a]aresample=48000,aformat=channel_layouts=stereo,volume=1.15,adelay=114500:all=1[a6];
[7:a]aresample=48000,aformat=channel_layouts=stereo,volume=1.15,adelay=135500:all=1[a7];
[8:a]aresample=48000,aformat=channel_layouts=stereo,volume=1.15,adelay=148500:all=1[a8];
[a1][a2][a3][a4][a5][a6][a7][a8]amix=inputs=8:duration=longest:normalize=0,apad=pad_dur=155,atrim=duration=155,afade=t=in:st=0:d=0.3,afade=t=out:st=154:d=1[a]'

ffmpeg -y -hide_banner -loglevel warning \
  -i "$raw_video" \
  "${audio_inputs[@]}" \
  -i "$captions" \
  -filter_complex "$filter_graph" \
  -map '[v]' -map '[a]' -map 9:0 \
  -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -r 25 \
  -c:a aac -b:a 192k -ar 48000 \
  -c:s mov_text -metadata:s:s:0 language=eng -disposition:s:0 default \
  -metadata title="SourceCourt — OpenAI Build Week 2026 demo" \
  -movflags +faststart -t 155 "$output_video"

ffprobe -v error \
  -show_entries format=duration,size:stream=codec_name,width,height,r_frame_rate:stream_tags=language \
  -of json "$output_video"

echo "Final demo: $output_video"
