#!/usr/bin/env bash
# Build the Country Smart AI reel from a short vertical iPhone clip.
#
# The source clip is only ~3.5s, so the footage is slowed to half speed and
# ping-ponged (forward, reverse, forward) to carry a full 25s reel. Captions are
# rendered as transparent PNGs by make-cards.py and composited with alpha fades,
# because they need to fade in and out as one piece with their background pills.
#
# Usage: ./build-reel.sh /path/to/clip.mov [output.mp4]

set -euo pipefail

SRC="${1:?usage: build-reel.sh <source clip> [output.mp4]}"
OUT="${2:-country-smart-ai-catering-website-reel.mp4}"
DIR="$(cd "$(dirname "$0")" && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

FF="${FFMPEG:-ffmpeg}"
CARDS="$WORK/cards"

python3 "$DIR/make-cards.py" "$CARDS"

# Half speed, 1080x1920 @ 30fps, gentle grade lift for indoor kitchen light.
"$FF" -y -loglevel error -i "$SRC" -map 0:v:0 -an -sn -dn \
  -vf "setpts=PTS/0.5,scale=1080:1920:flags=lanczos,fps=30,eq=contrast=1.06:brightness=0.015:saturation=1.10,format=yuv420p" \
  -c:v libx264 -preset medium -crf 19 "$WORK/fwd.mp4"

"$FF" -y -loglevel error -i "$WORK/fwd.mp4" -vf reverse -an \
  -c:v libx264 -preset medium -crf 19 "$WORK/rev.mp4"

printf "file '%s'\nfile '%s'\nfile '%s'\n" "$WORK/fwd.mp4" "$WORK/rev.mp4" "$WORK/fwd.mp4" > "$WORK/list.txt"
"$FF" -y -loglevel error -f concat -safe 0 -i "$WORK/list.txt" -c copy "$WORK/base.mp4"

# Caption overlays. Each card is a full-frame transparent PNG faded in and out.
"$FF" -y -loglevel error \
  -i "$WORK/base.mp4" \
  -loop 1 -t 21 -i "$CARDS/lockup.png" \
  -loop 1 -t 21 -i "$CARDS/cap_a.png" \
  -loop 1 -t 21 -i "$CARDS/cap_b.png" \
  -loop 1 -t 21 -i "$CARDS/cap_c.png" \
  -loop 1 -t 21 -i "$CARDS/cap_d.png" \
  -filter_complex "\
[1:v]fps=30,format=rgba,fade=t=in:st=0.1:d=0.5:alpha=1[lock];\
[2:v]fps=30,format=rgba,fade=t=in:st=0.3:d=0.35:alpha=1,fade=t=out:st=4.9:d=0.35:alpha=1[ca];\
[3:v]fps=30,format=rgba,fade=t=in:st=5.6:d=0.35:alpha=1,fade=t=out:st=10.1:d=0.35:alpha=1[cb];\
[4:v]fps=30,format=rgba,fade=t=in:st=10.8:d=0.35:alpha=1,fade=t=out:st=15.3:d=0.35:alpha=1[cc];\
[5:v]fps=30,format=rgba,fade=t=in:st=16.0:d=0.35:alpha=1,fade=t=out:st=20.4:d=0.4:alpha=1[cd];\
[0:v][lock]overlay=0:0[v1];[v1][ca]overlay=0:0[v2];[v2][cb]overlay=0:0[v3];\
[v3][cc]overlay=0:0[v4];[v4][cd]overlay=0:0,format=yuv420p[vout]" \
  -map "[vout]" -c:v libx264 -preset medium -crf 19 -t 20.9 "$WORK/captioned.mp4"

"$FF" -y -loglevel error -loop 1 -t 4.6 -i "$CARDS/outro.png" \
  -vf "fps=30,scale=1080:1920,format=yuv420p" -c:v libx264 -preset medium -crf 19 "$WORK/outro.mp4"

# Cross-fade to the brand card. Silent AAC track so every platform accepts the
# upload; the reel is meant to have a trending audio added in-app.
"$FF" -y -loglevel error -i "$WORK/captioned.mp4" -i "$WORK/outro.mp4" \
  -f lavfi -t 30 -i anullsrc=channel_layout=stereo:sample_rate=48000 \
  -filter_complex "[0:v][1:v]xfade=transition=fade:duration=0.5:offset=20.4,format=yuv420p[v]" \
  -map "[v]" -map 2:a -shortest \
  -c:v libx264 -preset slow -crf 20 -profile:v high -level 4.1 -pix_fmt yuv420p -movflags +faststart \
  -c:a aac -b:a 128k -ac 2 -ar 48000 \
  "$OUT"

echo "wrote $OUT"
