#!/usr/bin/env bash
# Rebuild the footage for this clip from a raw VS Code tour recording.
# 1) Record:  xvfb-run -a -s "-screen 0 1920x1080x24" node film/scripts/record-vscode-tour.mjs film/renders/vscode-tour
# 2) Prepare: social/tour/scripts/prepare-footage.sh film/renders/vscode-tour/<recording>.webm
# Source times in the composition are "raw recording seconds − 35"; re-check render beats if a new take shifts them.
set -euo pipefail
raw="$1"
cd "$(dirname "$0")/.."
ffmpeg -v error -y -ss 35 -to 81.2 -i "$raw" -r 30 -c:v libx264 -g 1 -crf 16 -preset veryfast -pix_fmt yuv420p -an assets/footage/tour.mp4
ffmpeg -v error -y -ss 31 -to 46 -i assets/footage/tour.mp4 -vf "crop=892:232:92:476" -r 30 -c:v libx264 -g 1 -crf 14 -preset veryfast -pix_fmt yuv420p -an assets/footage/edit-code.mp4
ffmpeg -v error -y -ss 31 -to 46 -i assets/footage/tour.mp4 -vf "crop=408:366:1195:160" -r 30 -c:v libx264 -g 1 -crf 14 -preset veryfast -pix_fmt yuv420p -an assets/footage/edit-card.mp4
# The two agent-panel images are real CLI renders (run from film/demo-app):
#   node ../../dist/cli.mjs shot components/WeatherCard.tsx --usage "app/(app)/showcase/page.tsx:10" --viewport 320x640 --out ../../social/tour/assets/footage/weather-320.png
#   node ../../dist/cli.mjs shot components/WeatherCard.tsx --usage "app/(app)/showcase/page.tsx:10" --viewport 390x640 --out ../../social/tour/assets/footage/weather-390.png
echo "footage ready"
