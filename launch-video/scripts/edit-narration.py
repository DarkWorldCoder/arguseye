from pathlib import Path
import subprocess,json,html
p=Path(__file__).resolve().parents[1]
segments=[
 {'id':'button-wrap','start':.3,'sourceStart':6.08,'sourceEnd':7.48,'text':'The button that wraps.'},
 {'id':'diff-limits','start':2.2,'sourceStart':11.68,'sourceEnd':13.4,'text':'None of that shows up in a diff.'},
 {'id':'intro','start':5.2,'sourceStart':24.88,'sourceEnd':27.92,'text':'Meet Arguseye. Eyes for coding agents.'},
 {'id':'real-props','start':11.2,'sourceStart':33.6,'sourceEnd':35.6,'text':'Real props from your own call sites.'},
 {'id':'real-styles','start':13.4,'sourceStart':35.76,'sourceEnd':39.12,'text':'Your theme, your layouts, your global CSS.'},
 {'id':'evidence','start':17.3,'sourceStart':42.32,'sourceEnd':49.68,'text':'The agent gets back a cropped screenshot, the accessibility tree, what changed since its last render, and errors with file paths.'},
 {'id':'vscode','start':25.2,'sourceStart':69.6,'sourceEnd':74.2,'text':'And in VS Code, the preview lives beside your code and updates as you type.'},
 {'id':'no-server','start':30.2,'sourceStart':39.2,'sourceEnd':40.16,'text':'No dev server.'},
 {'id':'no-stories','start':31.3,'sourceStart':40.24,'sourceEnd':41.12,'text':'No stories.'},
 {'id':'clients','start':32.2,'sourceStart':63.76,'sourceEnd':69.56,'text':'It works with Claude Code, Codex, Cursor, Gemini, Copilot, any MCP client.'},
 {'id':'outro','start':38.3,'sourceStart':74.32,'sourceEnd':77.55,'text':'Arguseye. Open source. One command to install.'}
]
meta={'provider':'Existing ElevenLabs narration, re-edited; no new synthesis request','original':'assets/audio/voice.mp3','originalWords':'assets/audio/words.json','duration':42,'segments':segments,'licenseNote':'User-owned pre-existing project audio reused under explicit request; original project SPEC identifies ElevenLabs Zuko. No new API authentication or voice cloning.'}
(p/'assets/audio/narration-42s.json').write_text(json.dumps(meta,indent=2)+'\n')
(p/'SCRIPT-42s.md').write_text('# Arguseye 42-second launch narration\n\nRe-edited complete supported sentences from the existing project narration. No new voice was synthesized.\n\n'+'\n\n'.join(f"**{s['start']:.2f}s** — {s['text']}" for s in segments)+'\n')
filters=[]
for i,s in enumerate(segments):
 d=s['sourceEnd']-s['sourceStart']
 filters.append(f"[0:a]atrim=start={s['sourceStart']}:end={s['sourceEnd']},asetpts=PTS-STARTPTS,afade=t=in:d=0.012,afade=t=out:st={d-.025}:d=0.025,adelay={round(s['start']*1000)}|{round(s['start']*1000)}[v{i}]")
filters.append(''.join(f'[v{i}]' for i in range(len(segments)))+f'amix=inputs={len(segments)}:normalize=0:duration=longest,apad=whole_dur=42,atrim=0:42,loudnorm=I=-16:TP=-1.5:LRA=8[out]')
subprocess.run(['ffmpeg','-y','-v','error','-i',str(p/'assets/audio/voice.mp3'),'-filter_complex',';'.join(filters),'-map','[out]','-ar','48000','-ac','2',str(p/'assets/audio/narration-42s.wav')],check=True)
def tc(t):
 ms=round(t*1000);return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02}.{ms%1000:03}'
vtt='WEBVTT\n\n'
for s in segments:
 vtt+=f"{s['id']}\n{tc(s['start'])} --> {tc(s['start']+s['sourceEnd']-s['sourceStart'])}\n{s['text']}\n\n"
(p.parent/'docs/video/arguseye-launch.vtt').write_text(vtt)
print('Narration rebuilt from existing source passages; timeline mixing stays in index.html.')
