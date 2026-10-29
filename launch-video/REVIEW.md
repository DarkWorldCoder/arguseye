# Arguseye launch film review

## Creative decisions

Selected “The visible edit”: one real source edit changes the WiseScore button label and its layout. The same actual component travels through render evidence, a baseline/current comparison, and the real VS Code panel. The alternatives “One component, two collaborators” and “Through the eye” are documented in STORYLINES.md. The prior 81-second project notes and index are preserved in archive/81s/; its original scene files and renders remain.

The film is 42 seconds at 1920×1080, 30 fps. Its product material is actual project screenshot/source evidence, not an invented dashboard. There are no speed metrics or automatic-correctness claims. The Next.js runtime warning remains visible in the render proof.

Prompt Motion's public index and six text references informed staging. Three authorized public reference videos were downloaded and frames inspected internally (Cinetic, browser skill, UI morph). Their original footage is ignored under `.media/references/` and excluded from the delivered website assets. The finished film uses original arrangements, a registry-derived before/after wipe, a registry-derived cursor over the actual editor controls, and a source-change focus underline. Creator footage is never rehosted in this film.

## Narration and sound

The voiced revision re-edits complete supported sentences from `assets/audio/voice.mp3`, identified as ElevenLabs narration in the existing project's original SPEC. No new API request, voice generation or voice cloning occurred. Exact source in/out and film start positions are recorded in `assets/audio/narration-42s.json`; the readable transcript is SCRIPT-42s.md. Universal fidelity and 40ms claims from the older narration are excluded.

Music is the user-authorized pre-existing local bed in `assets/audio/music.wav`; no new music purchase or download occurred. The five sound assets remain the bundled HyperFrames library, recorded in `.media/manifest.jsonl`. The delivery uses typing, click, whoosh and pop sounds synchronized to visible actions. Narration is normalized to -16 LUFS before mixing; the music bed has explicit volume automation under speech. WebVTT subtitles ship separately for accessible playback.

## Review performed

The first music/SFX render passed the complete HyperFrames check with zero errors and zero warnings across lint, runtime, layout, contrast and craft. It rendered successfully as a 42.0-second, 7.0 MB MP4.

Beat, seam and 360-pixel phone sheets were inspected, followed by full-size screenshots at 2.6, 8, 14, 21.5, 31.5, 36.2 and 40.5 seconds. Fixes from those reviews: move the hook outline onto the actual changed button; match the displayed viewport/accessibility excerpt to the actual desktop screenshot; separate the baseline label from the comparison headline; enlarge the client-name rolling slot; retain the runtime warning long enough to read; remove blank scene-transition frames; raise the secondary label to the 28px text floor. A separate UX reviewer found no P0/P1 issues in the revised scene contact sheet.

Final narrated check, rendered-file probe and decoded-frame results are recorded in the delivery section below after completion. The sound is measured, not subjectively listened to. No claim of a full-speed physical-phone review is made.

## Honest limitations

The weakest proof shot is the editor: it is an actual screenshot with original camera/cursor annotation, not a live screen recording of typing. With more time, record the real edit/capture/compare journey end to end. Screenshot details and terminal evidence are secondary at phone width; the large headlines and final install command carry the main story. The public reference videos are internal inspiration only and their separate redistribution rights were not established.

## Narrated revision gate

`renders/check-42s-voiced.json` reports **0 errors and 0 warnings** in lint, runtime, layout, contrast and craft. New comparison-focus and editor-cursor frames were inspected at 21.8, 30.5 and 31.8 seconds. The final narration asset is 41.7 seconds inside the 42-second film; the last 0.3 seconds remain a music/end-card tail. `scripts/edit-narration.py` rebuilds the reused narration and subtitle asset from the preserved source file and passage manifest; the timeline's explicit automation owns the mix.

## Verified delivery

- Website MP4: `docs/video/arguseye-launch.mp4` (7,320,550 bytes).
- Master: `launch-video/renders/arguseye-launch-42s-scoped.mp4`.
- Poster: `docs/video/arguseye-launch-poster.jpg`; accessible captions: `docs/video/arguseye-launch.vtt`.
- ffprobe: exactly 42.000 seconds, 1920×1080, 30 fps, H.264 video, stereo AAC at 48 kHz.
- Loudness analysis: −17.99 LUFS integrated, −3.42 dBTP true peak, 4.60 LU loudness range. No clipping was measured. Sound was measured, not listened to.
- Decoded MP4 frames at 21.8, 31.8 and 40.5 seconds were inspected: the new focus underline and editor pointer are visible and correctly framed; the end command remains readable.
- Final render completed in 2m 1.3s using the local software screenshot path. No hosted rendering credits or new paid media generation were used.
- Editable preview is live at `http://localhost:3002/#project/launch-video`; “Edit with Framey” opens the HyperFrames desktop app. The preview remains available for user editing.

## Scoped npm package correction

npm rejected the unscoped package name as too similar to an existing package. The current 42-second composition now displays `npx @ayushniroula/arguseye install codex`; its workspace scene also demonstrates the supported Claude client. The product name and CLI executable remain Arguseye / `arguseye`. The longer workspace command uses 48px text and the end card 40px, both above the 28px reading floor. Narration is unchanged because it does not speak the literal command. The historical 81-second archive was preserved.

Final scoped-command render: `renders/check-42s-scoped.json` passes with zero errors and warnings. Workspace commands and decoded MP4 end card were inspected; the full scoped command fits without clipping. Final SHA-256: `82ef25ae2aaeb4d4d0ad1cbbd52beb4ad50661e3c9e5ace67ca8d0984b834b54`. Duration remains exactly 42.000 seconds. Corrected render took 1m 47.5s. Narration, music and effect assets are unchanged.
