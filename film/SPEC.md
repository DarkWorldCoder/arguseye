# Arguseye launch film: "How an agent sees"

GOAL:    A developer understands in one viewing that a coding agent cannot see the UI it writes, how Arguseye
         renders a component for it (what it reads from the project, what comes back) and that installing it is one
         command. No screenshots of any client app: every component on screen is a demo built for this film in
         film/demo-app and film/demo-vue, rendered by Arguseye itself.
OUTPUT:  HyperFrames 0.8.190, 1920 x 1080, 30 fps. Captioned and clean renders.
TIME:    57.5 s x 30 = 1725 frames. The voice (assets/audio/voice2.mp3, ElevenLabs "Zuko", eleven_v4, 53.55 s) starts
         at 0.40 s and is the clock: every cue in the composition is cue("word", n) = Scribe word start + 0.40
         (assets/audio/words2.json, inlined as words2.js), so a re-voiced take re-times the picture by itself.
         Music bed assets/audio/music.wav, 96 BPM (0.625 s a beat, phase 0.01 s). Part A 0 → 10.10 s; silence
         10.10 → 10.80 (the stop on "blind"); part B re-enters at 10.80 ("Arguseye") from media 12.51 s (a bar
         start), so the montage cuts on "Any component" fall on eighth notes of part B.

LOOK:    The live site's palette and the brand mark: paper #fafbfc, hairline #e4e7ec, ink #25282d, muted #626975;
         navy #0f172a for the one dark world (the agent's blind view, the result panel); iris orange #f97316 only
         for what the agent's eye catches (the ring on the break, the iris); indigo #6c70c9 for Arguseye's own
         marks (found rows, layout frames, capture frame, scanline); green #367760 for pass. Inter for type,
         JetBrains Mono for code and tool output, never under 28 px for reading text at 1080p.
         Product material is real and live: the demo components are mounted 1:1 from Arguseye's own renders (real
         DOM, real Tailwind v4 CSS, real fonts and images in shadow roots, scripts/capture-live.mjs; @property rules
         hoisted to document scope). Edits change the live DOM, so wraps and pill shapes are real CSS layout.
         Tool output is copied from real runs (assets/loop/*.json, scripts/record-loop.mjs): before → broken →
         fixed, snapshotDiff, changedPixels 29,322, 191 ms and 104 ms warm renders.

OBJECTS: the PricingCard source (lines 28–43, the fixed w-[180px] button); a phone holding the live card; the
         Arguseye mark whose eye opens; the render_component call (file, usage, viewport); the demo project tree
         (real paths and real package versions: react 19.3.1, react-dom 19.3.1, tailwindcss 4.3.3); the two real
         call sites with their props; the component assembling as layouts, theme, global CSS, fonts and images
         are found; the bundle; Chromium's scanline; the result panel; seven other live components (sign-in form,
         stats card, toast, profile card, command menu, starter pricing card, a Vue storage meter); an editor with
         the live preview beside it; the install command with the real client names.

MOTION:  One timeline. One camera per world with zoom in log space (prompt-motion: ultimaxbt-2ddf1e); every scene is
         entered through an object of the previous one or a whip on the film's leftward current (twoclipping-221cab);
         the agent's edits cause every change (notdwd-7de38a); the real UI rebuilt 1:1 instead of a screenshot
         (daniel-haida-8691d4, Tim Koch's Remotion demo); reveals timed to the spoken word (rossaxbt-3085b7).
         huashu-motion rhythm: hook < 3 s, a stop before the drop, a montage burst at ~70%, hits on landings.
         Arrivals expo.out 0.3–0.65 s; camera power2/power3.inOut 0.5–0.9 s; whips power3.in/out 0.3–0.42 s.

SHOTS (video time, s; anchored to words):
 1  0–5.8     EDIT. Code close-up (poster); the agent appends ", save 20% yearly" (0.62–1.81); camera eases back;
              "agent › edited PricingCard.tsx" types; "✓ Done" on "done".
 2  5.8–8.8   PHONE. Phone whips in with the live card; the label retypes; camera punches 2.3x into the button;
              the orange ring draws on "broke" around "20% yearly" hanging outside the button.
 3  8.8–10.8  BLIND. Navy wipe; only the code line survives under "what your agent sees"; the empty phone frame
              closes like an eyelid on "blind" and slides to the eye position.
 4  10.8–12.9 EYES. The line opens into the mark's eye; wordmark wipes in; the camera dives through the iris.
 5  12.9–31.8 HOW IT WORKS. render_component call types; the project tree slides in and a scan reads it ("reads
              your project"); PricingCard.tsx found; page.tsx found with both call sites; the Pro props fly into the
              stage and the raw component appears (no CSS, default theme, fallback font, no image); then each found
              piece flies from its row and lands: two layout frames, ThemeProvider accent, globals.css (the card snaps
              into its real styles), Inter, orbit.svg. react, react-dom, tailwindcss fly into one "bundled once,
              cached" block; Chromium's scanline draws the result; "$ next dev" is struck.
 6  31.8–35.8 RESULT. Stage slides left; the navy result panel builds field by field on the words: png crop of the
              real broken render, three snapshot lines, changes (status, changedPixels, the diff); punch-in.
 7  35.8–39.6 THE LOOP. Back to the editor and the phone. Ring on "break"; the w-[180px] line highlights; the agent
              rewrites the label to "Save 20% on {plan}" and the live button reflows to one line; the terminal shows
              the real changed result and 104 ms; the ring turns green.
 8  39.6–42.6 ANY COMPONENT. Eighth-note burst through seven live components; the chip rolls React → Next.js → Vue
              (the Vue meter lands on "Vue").
 9  42.6–45.5 EDITOR. Code beside the live preview; "rounded-xl" retypes to "rounded-full" and the preview's
              button becomes a pill.
10  45.5–49.8 ANY AGENT. Agent chips; the install command's client word rolls on each spoken name.
11  49.8–57.5 END. The mark lands and its eye opens; wordmark; "Eyes for coding agents. Open source · MIT"; the
              command settles with the repo URL; hold 3.5 s.

SOUND:   voice 1.0; music 0.26 alone, 0.10 under words, silent across the stop, 2.5 s fade at the end. 47 effects,
         each placed so its measured peak lands one frame after its picture: typing on edits and calls, pop on
         every landing, whoosh on whips and the dive, click on every montage cut, roll and strike.
BANNED:  screenshots of any client app; invented UI, numbers or agent features; a dark void with floating cards;
         glow, bloom, particles; three equal feature cards; a title over a dimmed screenshot; a docked logo;
         everything fading and sliding up; idle float loops; crossfades between worlds.
QA:      0.0 poster, 2.4 edit done, 7.9 ring on the break, 9.6 blind, 11.4 mark, 21.4 raw component, 24.4 CSS
         landed, 29.6 scanline, 33.6 result, 35.5 diff, 39.2 fixed, 40.2/42.3 montage, 45.3 pill, 49.2 all, 55 end.
