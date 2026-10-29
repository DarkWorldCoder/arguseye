# Review: "How an agent sees" (57.5 s)

## Creative calls

- The owner asked for no app screenshots and for the film to explain how the system works, so every component is a
  demo written for the film (`demo-app/`, `demo-vue/`) and rendered by Arguseye. The previous cut in `launch-video/`
  used a production app's screens and is left untouched.
- The middle third is a mechanism: a project tree is read, the component and its call sites are found, the props
  fly into a stage, and the component assembles as layouts, theme, global CSS, fonts and images land. The "before"
  states are the same live DOM with each piece withheld (no app CSS, the ThemeProvider's default accent, the CSS's
  own fallback font stack, the image hidden), so each step shows what that piece contributes.
- One continuous story carries it: an agent's label edit breaks the button on a phone (real CSS wrap under a fixed
  `w-[180px]`), the agent is blind, Arguseye gives it eyes, the real result shows the break, the agent fixes it.
- Not built: the endless zoom through the mark (STORYLINES.md), a 9:16 cut.

## Measured

- `hyperframes check`: no errors. Kept warnings: the slot-machine roll of client names is on screen 0.1 s a word on
  purpose; contrast findings at 41.5 s and 54.3 s are words hidden inside the roll window; `text_below_floor` is the
  editor's 24 px breadcrumb, chrome rather than reading text; the composition is one 490-line file on purpose (one
  timeline, transitions included).
- Rendered file: H.264 1920×1080 30 fps, AAC 48 kHz, 57.5 s; normalised to −15.9 LUFS integrated, −1.2 dBTP true
  peak, no clipping. The only silence is the planned stop at 10.34–10.76 s.
- Frames decoded from the MP4 at every 2.5 s match the review stills.
- Replica fidelity: the pricing card mounted in the film was compared side by side with Arguseye's own render of
  the same component; Tailwind v4 `@property` rules had to be hoisted to document scope (borders and shadows were
  missing before the fix).

## Looked at, not measured

- Motion between the stills was sampled, not watched at full speed by a second reviewer.
- The sound was measured, not heard: effect placement uses each file's measured peak.

## Weakest shot and next steps

- Shot 9 (editor panel) is drawn in code around a live mount; a real VS Code recording of the extension updating
  as you type would be stronger.
- The montage could use 1–2 more shots on the downbeat before "React".
- A 9:16 cut for Shorts/Reels needs its own layout pass (the tree and the stage sit side by side).

## Credits

Voice: ElevenLabs "Zuko" (eleven_v4); timings: ElevenLabs Scribe. Music bed and effects: the same royalty-free files
used by the previous cut (see `launch-video/.media/SFX-CREDITS.md`). Inter (OFL, `demo-app/public/fonts/OFL.txt`).
Motion references: Prompt Motion entries named in SPEC.md; rhythm method from huashu-motion (MIT).
