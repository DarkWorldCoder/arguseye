#!/usr/bin/env bash
# Pre-cuts the laptop-screen clips from the real VS Code recording (social/tour/assets/footage/tour.mp4)
# at their final speed, 1280x720, all-intra so every seek lands on a decodable frame.
set -euo pipefail
cd "$(dirname "$0")/../assets/footage"
SRC=../../../tour/assets/footage/tour.mp4
ffmpeg -v error -y -ss 9.6 -t 7.8125 -i "$SRC" -vf "setpts=PTS/2.5,scale=1280:720:flags=lanczos,fps=30" -an -c:v libx264 -preset slow -crf 16 -g 1 -pix_fmt yuv420p screen-tour.mp4
ffmpeg -v error -y -ss 34 -t 10 -i "$SRC" -vf "setpts=PTS/2,scale=1280:720:flags=lanczos,fps=30" -an -c:v libx264 -preset slow -crf 16 -g 1 -pix_fmt yuv420p screen-edit.mp4
