# Arguseye launch film

A 57.5-second HyperFrames film that shows how Arguseye works, made only from demo components written for it
(`demo-app/`, a Next.js + Tailwind v4 app, and `demo-vue/`) and rendered by Arguseye itself.

## Rebuild

```bash
# from the repository root, after npm run build
ln -s ../../test/fixtures/next-app/node_modules film/demo-app/node_modules
ln -s ../../test/fixtures/vue-app/node_modules film/demo-vue/node_modules
bash film/scripts/capture-all.sh          # live 1:1 captures -> film/assets/live/*.json (+ references)
node film/scripts/record-loop.mjs         # real render, edit, fix -> film/assets/loop/*.json
cd film && npx hyperframes@0.8.190 check && npx hyperframes@0.8.190 render -o renders/arguseye-launch-captioned.mp4 -q delivery
```

`assets/live/replicas.js` and `assets/audio/words2.js` bundle the captures and the narration's word timings so the
composition can mount them synchronously; regenerate them with the snippet in `scripts/bundle-assets.py`.

## What is real

- Every component on screen is mounted from an Arguseye render of the demo source (real DOM, CSS, fonts, images).
- Tool output (snapshot, snapshotDiff, changedPixels, timings) is copied from `assets/loop/*.json`.
- Package versions are the ones installed in `test/fixtures/next-app/node_modules`.
- The voice is ElevenLabs (voice "Zuko", eleven_v4); word timings from ElevenLabs Scribe.
- The editor panel in shot 9 is drawn in code around a live mount of the component; it depicts the VS Code
  extension rather than capturing it.

See `SPEC.md` for the shot list, `REVIEW.md` for what was checked.
