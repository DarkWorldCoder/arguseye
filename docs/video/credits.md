# Arguseye launch film: production notes

A 58-second HyperFrames film (source in `film/`). Every component on screen is a demo written for the film
(`film/demo-app`, `film/demo-vue`) and rendered by Arguseye; the film mounts those renders live (real DOM, CSS, fonts
and images), so edits, wraps and the pill shape are real layout. Tool output on screen is copied from real runs
(`film/assets/loop`). The editor panel in the "VS Code" shot is drawn in code around a live mount of the component.

Narration: ElevenLabs, voice "Zuko", eleven_v4, written for this film; word timings from ElevenLabs Scribe.
Music bed and effects: the pre-existing project assets (effects from Pixabay, https://pixabay.com/service/license-summary/).
Type: Inter (SIL OFL) and JetBrains Mono. Motion references: Prompt Motion entries credited in `film/SPEC.md`;
rhythm method from huashu-motion (MIT).

Captions: `arguseye-launch.vtt` (WebVTT, from the same word timings). A version with burned-in captions for
social feeds is produced by `film/` (`renders/arguseye-launch-captioned.mp4`).
