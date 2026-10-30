# Arguseye social clip: "Open a file. See it rendered."

GOAL:    In 24 s, a developer scrolling LinkedIn or X sees that Arguseye renders whatever component file they open in
         VS Code, with real props and no dev server, and that an unsaved class edit re-renders as they type.
         All product footage is a real VS Code session recorded by film/scripts/record-vscode-tour.mjs on the
         film's demo app (five showcase components). Nothing on the UI is drawn or faked.
OUTPUT:  HyperFrames 0.8.190, 1080 × 1350 (4:5), 30 fps, 25.625 s. Silent-safe: every beat carries a title.
CLOCK:   Music bed assets/audio/music.wav (96 BPM, 0.625 s a beat) from media 12.51 s (a bar start). Every cut and
         landing sits on a beat: b(k) = 0.625 k. Footage is cut so each render lands on a beat.

LOOK:    Cool white gradient ground (#ffffff → #f5f7fc → #eceffb, faint peach top-left and indigo bottom-right tints,
         static), ink type #0f172a, muted #64748b, one highlighted word in deep iris #ea580c (passes contrast on
         white). Inter 700 titles at 64 px, sub-lines 40 px, mono URL in JetBrains Mono. VS Code's own dark footage
         and the dark agent panel sit as windows on the light ground. Changed from navy at Ayush's request.

SHOTS (output s; footage source s = raw recording s − 35):
 A  0.00–2.50  HOOK. Frame 0 = the rendered weather card, cropped to its own bounds (scale 1.75). "Open a
               component." per-word blur-in; "Rendered from source. No dev server." grey→white per word.
 B  2.50–5.00  REVEAL. Camera pulls back to all of VS Code (0.65 s power3.inOut) as Ctrl+P opens; NowPlaying renders
               on beat 6 (3.75) and the camera pushes into the preview panel (scale 1.2). "Switch files." /
               "The preview follows."
 C–F 5.00–11.875 FOLLOW. Cut-the-curve LEFT on beats 8, 11, 14, 17 into chart, boarding pass, chat, weather; each
               render lands on the next beat. Title holds dead still.
 STOP 11.4–11.875  music ducks; waterfall cut to "Change one class."
 G  11.875–20.0 EDIT. Split: the real code line 51 on top (scale 1.12), the real card below (scale 1.75), both from
               the same footage clip. Selection at 2×, typing at 1.5×; the sunset gradient lands on beat 30
               (18.75) and the title zoom-throughs to "It re-renders as you type." The 0.2 s text blink at raw
               79.0 s (font reload after the edit) is skipped by holding a still from raw 79.45 s.
  END 21.25–25.625 Inverse zoom arrival on the end card: mark, "Arguseye", "See every component as your app renders
               it.", "VS Code extension · MCP server · open source", repo URL. Hold 3.8 s.

MOTION:  prompt-motion techniques: one camera over one world with log-space zoom (ultimaxbt-2ddf1e), the real UI
         instead of a mock (daniel-haida-8691d4), reveals timed to beats (twoclipping-6dd14e). Doctrine:
         motion-doctrine current = LEFT; cut-the-curve seams (±130 px, power4 in/out mirrored, opacity ignites at
         0.35); inverse zoom only for the end arrival; render-time motion blur (data-motion-blur) instead of CSS
         blur on footage; captions-overlay: titles are overlays, nothing reserved.
         huashu-motion rhythm: hook < 3 s, montage cuts accelerate, a stop before the drop, hits on landings.
SOUND:   music 0.3, ducked to 0.1 across the stop, 1.5 s fade at the end. Whoosh on every seam, pop on every render
         landing, typing under the edit, click when Ctrl+P opens. Each effect placed by its measured peak.
BANNED:  screenshots of client apps; invented UI or numbers; crossfades between worlds; idle float loops; titles
         that move after landing; CSS filters on footage; glow, particles, gradients on UI chrome (the ground gradient
         is the one exception, requested).
QA:      0.0 hook, 1.5 titles, 3.0 VS Code wide, 3.9 NowPlaying, 5.7 chart, 7.6 boarding pass, 9.5 chat, 11.2 stop,
         15.5 typing, 18.8 sunset + payoff title, 22 end card.
