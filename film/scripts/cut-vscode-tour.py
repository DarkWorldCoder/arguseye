"""Cut the raw VS Code tour recording into a 4:5 LinkedIn/X video with captions.
Usage: python3 -I film/scripts/cut-vscode-tour.py <raw.webm> <out.mp4>"""
import subprocess, sys, tempfile, os
raw, out = sys.argv[1], sys.argv[2]
START, END, SPEED = 35.0, 81.0, 1.5
dur = (END - START) / SPEED
font_b = "/usr/share/fonts/truetype/ubuntu/Ubuntu-B.ttf"
font_r = "/usr/share/fonts/truetype/ubuntu/Ubuntu-R.ttf" if os.path.exists("/usr/share/fonts/truetype/ubuntu/Ubuntu-R.ttf") else "/usr/share/fonts/truetype/ubuntu/Ubuntu-L.ttf"
def t(raw_s): return (raw_s - START) / SPEED
captions = [  # (start, end, text) in output seconds
    (0.0, t(38.4), "Open a component in VS Code."),
    (t(38.4), t(61.0), "Switch files. Arguseye follows."),
    (t(61.0), t(76.5), "Change a class.\nIt re-renders as you type."),
    (t(76.5), dur, "No dev server. No stories."),
]
tmp = tempfile.mkdtemp()
draws = []
for i, (a, b, text) in enumerate(captions):
    p = os.path.join(tmp, f"c{i}.txt"); open(p, "w").write(text)
    draws.append(f"drawtext=fontfile={font_b}:textfile={p}:fontsize=58:fontcolor=white:line_spacing=14:x=(w-text_w)/2:y=(210-text_h)/2+8:enable='between(t,{a:.2f},{b:.2f})'")
foot = os.path.join(tmp, "foot.txt"); open(foot, "w").write("Arguseye  ·  VS Code extension + MCP server  ·  open source")
draws.append(f"drawtext=fontfile={font_r}:textfile={foot}:fontsize=32:fontcolor=0x94a3b8:x=(w-text_w)/2:y=1139+(211-text_h)/2")
fc = (f"[0:v]trim=start={START}:end={END},setpts=(PTS-STARTPTS)/{SPEED},fps=30,crop=930:800:990:30,scale=1080:-2:flags=lanczos[v];"
      f"color=c=0x0d1117:s=1080x1350:r=30:d={dur:.2f}[bg];[bg][v]overlay=0:210:shortest=1," + ",".join(draws) +
      f",fade=t=in:st=0:d=0.3,fade=t=out:st={dur-0.5:.2f}:d=0.5,format=yuv420p[o]")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", raw, "-filter_complex", fc, "-map", "[o]", "-c:v", "libx264", "-crf", "19",
                "-preset", "slow", "-profile:v", "high", "-movflags", "+faststart", "-an", out], check=True)
print(out, f"{dur:.1f}s")
