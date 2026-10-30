"""Builds compositions/launch.html and index.html for the 'Give your agent eyes' launch clip (4:5, 30.6 s, 96 BPM).

Stills in assets/ai/ are AI-generated with Higgsfield Soul 2.0 (robot, sculpture, hourglass, laptop); the end card says so.
The laptop act re-types real commands and their real output, and assets/evidence/ holds the real before/after/diff PNGs
from `arguseye shot --capture-dir` + `arguseye diff` on film/demo-app/components/BoardingPass.tsx after one edit
(values text-lg -> text-3xl text-indigo-600): 3.83% changed pixels, card 338 -> 346 px tall.
Stills are 1152x1536 and placed as 1080x1440 at top -45 (cover). Laptop screen in frame space: 187,424 697x443."""
import os
from html import escape
here = os.path.dirname(os.path.abspath(__file__))
root = os.path.join(here, "..")
B = lambda k: 0.625 * k
DUR = B(49)


def masked(words, cls=lambda w, i: ""):
    return "".join(f'<span class="m"><span class="w{(" " + cls(w, i)) if cls(w, i) else ""}">{w}</span></span>' for i, w in enumerate(words))


def words_of(text):
    parts = text.split(" ")
    return [p + " " for p in parts[:-1]] + [parts[-1]]


def line(id_, text, cls="", hl=()):
    return f'<div class="title {cls}" id="{id_}" data-layout-allow-overflow>{masked(words_of(text), lambda w, i: "vi" if i in hl else "")}</div>'


# terminal lines: (id, class, text). Commands are what a user types; outputs are what the CLI printed.
TERM = [
    ("L1a", "cmd", '$ npx @ayushniroula/arguseye shot \\'),
    ("L1d", "cmd", '    components/BoardingPass.tsx \\'),
    ("L1b", "cmd", '    --usage "app/(app)/showcase/page.tsx:13" \\'),
    ("L1c", "cmd", '    --capture-dir .baseline'),
    ("O1a", "ok", "BoardingPass.png · 900 ms"),
    ("O1b", "ok", "errors: none"),
    ("D0", "dim gap", "components/BoardingPass.tsx"),
    ("D1", "del", '- <p className="text-lg font-bold text-slate-900">'),
    ("D2", "add", '+ <p className="text-3xl font-bold text-indigo-600">'),
    ("L2", "cmd gap", "$ npx @ayushniroula/arguseye diff \\"),
    ("L2b", "cmd", "    --baseline .baseline --out .diff"),
    ("O2", "warn", "changed: 3.83% changed pixels; evidence in .diff"),
]
S = 1.7  # evidence card scale (340 px wide renders)

css = """
#root { position: absolute; inset: 0; overflow: hidden; background: #f4f3fb; font-family: "Inter", sans-serif; color: #0f172a; }
.mono { font-family: "JetBrains Mono", monospace; }
.scene { position: absolute; inset: 0; overflow: hidden; background: #f4f3fb; }
.cam { position: absolute; inset: 0; }
.bg { position: absolute; left: 0; top: -45px; width: 1080px; height: 1440px; }
.title { position: absolute; left: 70px; right: 70px; font-weight: 800; letter-spacing: -0.03em; line-height: 1.04; z-index: 5; }
.m { display: inline-block; overflow: hidden; vertical-align: top; padding-bottom: 0.1em; margin-bottom: -0.1em; }
.w { display: inline-block; white-space: pre; }
.vi { color: #6d28d9; }
.center { text-align: center; }
.sweep { position: absolute; top: -10%; bottom: -10%; width: 38%; background: linear-gradient(100deg, rgba(255,255,255,0) 0%, rgba(255,255,255,.42) 50%, rgba(255,255,255,0) 100%); mix-blend-mode: soft-light; }
.scrim { position: absolute; left: 0; right: 0; bottom: 0; height: 560px; background: linear-gradient(to top, rgba(246,245,252,.97) 0%, rgba(246,245,252,.88) 42%, rgba(246,245,252,0) 100%); }
/* S1 */
#t1a { top: 92px; font-size: 62px; text-align: center; }
#t1b { top: 168px; font-size: 150px; text-align: center; color: #6d28d9; }
/* S2: the hourglass is parked right, so the stage behind it continues the photo's own edge colours */
#s2 { background: linear-gradient(to bottom, #bbb8c7 0%, #dad3e3 22%, #dfd8e8 44%, #d5cede 62%, #aca5af 82%, #99939e 100%); }
#cam2 .bg { -webkit-mask-image: linear-gradient(to right, transparent 0, #000 180px); mask-image: linear-gradient(to right, transparent 0, #000 180px); }
#t2 { left: 64px; right: auto; width: 470px; top: 430px; font-size: 92px; }
/* S3 */
#t3 { top: 1110px; font-size: 104px; }
#wm3 { position: absolute; left: 0; right: 0; top: 1040px; text-align: center; font-size: 156px; font-weight: 800; letter-spacing: -0.045em; z-index: 5; }
#wm3 .ch { display: inline-block; }
#sub3 { top: 1232px; font-size: 40px; font-weight: 600; color: #475569; letter-spacing: -0.01em; }
/* S4: a terminal on the laptop screen */
#screen { position: absolute; left: 187px; top: 424px; width: 697px; height: 443px; background: #0d1117; overflow: hidden; }
#glare { position: absolute; inset: 0; background: linear-gradient(160deg, rgba(255,255,255,.08) 0%, rgba(255,255,255,0) 38%); }
#term { position: absolute; inset: 0; padding: 0 22px; font-size: 18px; line-height: 26px; color: #e6edf3; }
#term .bar { height: 34px; display: flex; align-items: center; gap: 8px; color: #7d8590; font-size: 14px; margin: 0 -22px 12px; padding: 0 16px; background: #161b22; }
#term .bar i { width: 11px; height: 11px; border-radius: 50%; background: #3b434d; display: inline-block; }
#term .bar span { margin-left: 10px; }
#term .tl { white-space: pre; }
#term .gap { margin-top: 14px; }
#term .ok { color: #7ee2a8; } #term .warn { color: #fbbf24; } #term .dim { color: #7d8590; }
#term .del { color: #ff8b8b; background: rgba(248,81,73,.12); } #term .add { color: #7ee2a8; background: rgba(46,160,67,.15); }
#t4a, #t4b, #t4c { top: 96px; font-size: 76px; }
/* S6: the evidence, on a clean stage */
#s6 { background: radial-gradient(circle at 12% 8%, rgba(139,92,246,.12), transparent 44%), radial-gradient(circle at 92% 88%, rgba(99,102,241,.14), transparent 46%), linear-gradient(165deg, #ffffff 0%, #f5f4fc 55%, #ece9fb 100%); }
#t6a, #t6b { top: 96px; font-size: 68px; }
#chips { position: absolute; left: 0; right: 0; top: 268px; height: 48px; text-align: center; }
#chips span { position: absolute; left: 50%; transform: translateX(-50%); padding: 8px 22px; border-radius: 999px; font-size: 30px; font-weight: 700; white-space: nowrap; }
#cb { background: #e2e8f0; color: #334155; } #ca { background: #ede9fe; color: #5b21b6; } #cd { background: #fce7f3; color: #be185d; }
#card { position: absolute; left: CARD_Lpx; top: 340px; width: CARD_Wpx; height: CARD_Hpx; border-radius: CARD_Rpx; overflow: hidden; background: #fff; box-shadow: 0 34px 80px rgba(30,27,75,.20); }
#card img { position: absolute; left: 0; top: 0; width: CARD_Wpx; }
#ev-b { height: CARD_BHpx; } #ev-a, #ev-d { height: CARD_Hpx; }
#slider { position: absolute; top: -6px; bottom: -6px; width: 4px; margin-left: -2px; background: #6d28d9; box-shadow: 0 0 0 3px rgba(109,40,217,.18); }
#notes { position: absolute; left: 110px; right: 80px; top: 1000px; }
.note { position: relative; font-size: 38px; font-weight: 600; line-height: 1.3; margin-bottom: 18px; padding-left: 40px; color: #1e293b; }
.note .dot { position: absolute; left: 0; top: 14px; width: 20px; height: 20px; border-radius: 50%; }
.dot.g { background: #22c55e; } .dot.p { background: #db2777; }
/* S5 */
#t5 { top: 88px; font-size: 74px; }
/* END */
#end { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;
  background: radial-gradient(circle at 15% 10%, rgba(139,92,246,.14), transparent 45%), radial-gradient(circle at 90% 90%, rgba(99,102,241,.16), transparent 48%), linear-gradient(165deg, #ffffff 0%, #f5f4fc 55%, #ece9fb 100%); }
#end .mark { width: 150px; height: 150px; }
#end .name { margin-top: 28px; font-size: 112px; font-weight: 800; letter-spacing: -0.045em; }
#end .ch { display: inline-block; }
#end .line { margin-top: 16px; font-size: 50px; font-weight: 700; line-height: 1.15; }
#end .meta { margin-top: 34px; font-size: 30px; color: #475569; }
#end .url { margin-top: 18px; font-size: 32px; color: #5b21b6; }
#end .ai { position: absolute; left: 80px; right: 80px; bottom: 54px; font-size: 28px; color: #64748b; line-height: 1.35; }
"""
cw, chh, cbh = round(340 * S), round(346 * S), round(338 * S)
css = (css.replace("CARD_W", str(cw)).replace("CARD_BH", str(cbh)).replace("CARD_H", str(chh))
       .replace("CARD_L", str((1080 - cw) // 2)).replace("CARD_R", str(round(24 * S))))

h = ['<div id="root" data-composition-id="launch" data-width="1080" data-height="1350">']
# S1: the agent codes blind
h.append('<div class="scene" id="s1"><div class="cam" id="cam1"><img class="bg" src="assets/ai/robot-blind.jpg" alt="" /></div>'
         + f'<div class="title" id="t1a" data-layout-allow-overflow>{masked(words_of("Your coding agent writes UI"))}</div>'
         + f'<div class="title" id="t1b" data-layout-allow-overflow>{masked(["blind."])}</div></div>')
# S2: guessing costs tokens
h.append('<div class="scene" id="s2"><div class="cam" id="cam2"><img class="bg" src="assets/ai/hourglass.jpg" alt="" /><div class="sweep" id="sw2"></div></div>'
         + line("t2", "Every guess burns tokens.", hl=(3,)) + '</div>')
# S3: give it eyes -> Arguseye
h.append('<div class="scene" id="s3"><div class="cam" id="cam3a"><img class="bg" src="assets/ai/eyes-two-lit.jpg" alt="" /></div>'
         '<div class="cam" id="cam3b"><img class="bg" src="assets/ai/eyes-all-lit.jpg" alt="" /></div><div class="scrim"></div>'
         + line("t3", "Give it eyes.", "center", hl=(2,))
         + '<div id="wm3" data-layout-allow-overflow>' + "".join(f'<span class="ch">{c}</span>' for c in "Arguseye") + '</div>'
         + line("sub3", "Component previews for coding agents.", "center") + '</div>')
# S4: the real commands on the laptop (terminal text is read after the push-in, at 28 px effective)
term = "".join(f'<div class="tl {c}" id="{i}">{escape(t)}</div>' for i, c, t in TERM)
h.append('<div class="scene" id="s4"><div class="cam" id="cam4"><img class="bg" src="assets/ai/laptop-hero.jpg" alt="" />'
         '<div id="screen"><div id="term" class="mono" data-layout-ignore><div class="bar"><i></i><i></i><i></i><span>zsh · demo-app</span></div>'
         + term + '</div><div id="glare"></div></div><div class="sweep" id="sw4"></div></div>'
         + line("t4a", "Save a baseline.", hl=(2,))
         + line("t4b", "Change one line.", hl=(2,))
         + line("t4c", "Diff the render.", hl=(2,)) + '</div>')
# S6: the evidence
h.append('<div class="scene" id="s6">'
         + line("t6a", "Asked for: a bigger gate.", hl=(3, 4))
         + line("t6b", "Also changed: the barcode.", hl=(3,))
         + '<div id="chips"><span id="cb">Before</span><span id="ca">After</span><span id="cd">Pixel diff</span></div>'
         '<div id="card"><img id="ev-b" src="assets/evidence/before.png" alt="" /><img id="ev-a" src="assets/evidence/after.png" alt="" />'
         '<img id="ev-d" src="assets/evidence/diff.png" alt="" /><div id="slider"></div></div>'
         '<div id="notes"><div class="note" id="n1"><i class="dot g"></i>Gate, seat, boarding: bigger, as asked.</div>'
         '<div class="note" id="n2"><i class="dot p"></i>Tear line and barcode: moved 8 px.</div></div></div>')
# S5: now it sees
h.append('<div class="scene" id="s5"><div class="cam" id="cam5"><img class="bg" src="assets/ai/robot-sees.jpg" alt="" /></div>'
         + line("t5", "Now your agent sees what it ships.", hl=(3,)) + '</div>')
# END
h.append('<div id="end"><img class="mark" src="assets/brand/icon.svg" alt="Arguseye" /><div class="name" id="wordmark" data-layout-allow-overflow>' + "".join(f'<span class="ch">{c}</span>' for c in "Arguseye") + '</div>'
         + f'<div class="line" id="endline" data-layout-allow-overflow>{masked(words_of("Eyes for your coding agent."))}</div>'
         '<div class="meta">VS Code extension · MCP server · free and open source (MIT)</div><div class="url mono" data-var-text="repo-url">github.com/DarkWorldCoder/arguseye</div>'
         '<div class="ai">AI images by Higgsfield. Commands, output and renders are real.</div></div>')
h.append('</div>')

js = r"""
(function () {
  const tl = gsap.timeline({ paused: true });
  const B = (k) => 0.625 * k;
  const W = (sel) => Array.from(document.querySelectorAll(sel + " .w"));
  function rise(sel, t, gap = 0.06) { W(sel).forEach((w, i) => { gsap.set(w, { yPercent: 115, opacity: 0 }); tl.set(w, { opacity: 1 }, t + i * gap); tl.to(w, { yPercent: 0, duration: 0.55, ease: "expo.out" }, t + i * gap); }); }
  function sink(sel, t, gap = 0.02) { W(sel).forEach((w, i) => { tl.to(w, { yPercent: -115, duration: 0.28, ease: "power3.in" }, t - 0.3 + i * gap); tl.set(w, { opacity: 0 }, t + i * gap + 0.01); }); }
  // cut-the-curve LEFT between scene wrappers
  function seam(out, inn, t) {
    tl.to(out, { x: -130, duration: 0.34, ease: "power4.in" }, t - 0.34);
    tl.to(out, { opacity: 0, duration: 0.2, ease: "none" }, t - 0.2);
    tl.set(inn, { x: 130, opacity: 0.35 }, t);
    tl.to(inn, { x: 0, duration: 0.42, ease: "power4.out" }, t);
    tl.to(inn, { opacity: 1, duration: 0.18, ease: "none" }, t);
  }
  // a terminal line types itself in character steps; an output line just appears
  function type(id, t, d) { const el = document.getElementById(id); const n = el.textContent.length; gsap.set(el, { clipPath: "inset(0 100% 0 0)" }); tl.to(el, { clipPath: "inset(0 0% 0 0)", duration: d, ease: "steps(" + n + ")" }, t); }
  function show(id, t) { gsap.set("#" + id, { opacity: 0 }); tl.set("#" + id, { opacity: 1 }, t); }
  ["#s2", "#s3", "#s4", "#s6", "#s5", "#end"].forEach((s) => gsap.set(s, { opacity: 0 }));

  // S1 (0 - B5): line one reads on frame 0, "blind." slams on beat 1.5
  tl.fromTo("#cam1", { scale: 1.0 }, { scale: 1.07, duration: B(5), ease: "sine.inOut", transformOrigin: "50% 60%" }, 0);
  gsap.set("#t1b", { scale: 1.6, opacity: 0, transformOrigin: "50% 50%" });
  tl.set("#t1b", { opacity: 1 }, B(1.5));
  tl.to("#t1b", { scale: 1, duration: 0.42, ease: "expo.out" }, B(1.5));
  seam("#s1", "#s2", B(5));

  // S2 (B5 - B9): hourglass parked right, words stack on the left
  gsap.set("#cam2", { x: 236, scale: 1.12, transformOrigin: "50% 50%" });
  tl.to("#cam2", { scale: 1.2, duration: B(4), ease: "sine.inOut" }, B(5));
  gsap.set("#sw2", { xPercent: -160, opacity: 0 }); tl.set("#sw2", { opacity: 1 }, B(6)); tl.set("#sw2", { opacity: 0 }, B(6) + 1.4);
  tl.to("#sw2", { xPercent: 330, duration: 1.4, ease: "power2.inOut" }, B(6));
  rise("#t2", B(5) + 0.08, 0.16);
  seam("#s2", "#s3", B(9));

  // S3 (B9 - B16): push into the two lit eyes, rack-focus to every eye open, wordmark lands
  gsap.set("#cam3b", { opacity: 0 });
  tl.fromTo("#cam3a", { scale: 1.0 }, { scale: 1.16, duration: B(3), ease: "sine.in", transformOrigin: "50% 30%" }, B(9));
  rise("#t3", B(9.4), 0.08);
  sink("#t3", B(12));
  tl.to("#cam3a", { filter: "blur(10px)", scale: 1.22, duration: 0.24, ease: "power2.in" }, B(12) - 0.24);
  tl.set("#cam3a", { opacity: 0 }, B(12));
  tl.set("#cam3b", { opacity: 1, scale: 1.25, filter: "blur(10px)", transformOrigin: "50% 40%" }, B(12));
  tl.to("#cam3b", { scale: 1, filter: "blur(0px)", duration: 0.6, ease: "expo.out" }, B(12));
  tl.to("#cam3b", { scale: 1.05, duration: B(4) - 0.6, ease: "sine.inOut" }, B(12) + 0.6);
  document.querySelectorAll("#wm3 .ch").forEach((c, i) => { gsap.set(c, { opacity: 0, y: 40, filter: "blur(6px)" }); tl.to(c, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.42, ease: "expo.out" }, B(12) + 0.12 + i * 0.03); });
  rise("#sub3", B(13.2), 0.05);
  seam("#s3", "#s4", B(16));

  // S4 (B16 - B29): establish the laptop, push into the screen, the commands type out
  rise("#t4a", B(16) + 0.08, 0.06);
  gsap.set("#sw4", { xPercent: -160, opacity: 0 }); tl.set("#sw4", { opacity: 1 }, B(16.4)); tl.set("#sw4", { opacity: 0 }, B(16.4) + 1.2);
  tl.to("#sw4", { xPercent: 330, duration: 1.2, ease: "power2.inOut" }, B(16.4));
  gsap.set("#cam4", { transformOrigin: "535px 645px" });
  tl.to("#cam4", { scale: 1.06, y: 4, duration: 0.24, ease: "power3.in" }, B(17.5) - 0.24);
  tl.to("#cam4", { scale: 1.42, y: 30, duration: 0.22, ease: "none" }, B(17.5));
  tl.to("#cam4", { scale: 1.56, y: 44, duration: 0.75, ease: "power4.out" }, B(17.5) + 0.22);
  tl.to("#cam4", { scale: 1.6, duration: B(29) - B(17.5) - 0.97, ease: "sine.inOut" }, B(17.5) + 0.97);
  ["O1a", "O1b", "D0", "D1", "D2", "O2"].forEach((id) => gsap.set("#" + id, { opacity: 0 }));
  type("L1a", B(18), 0.45); type("L1d", B(18.8), 0.35); type("L1b", B(19.45), 0.5); type("L1c", B(20.3), 0.3);
  show("O1a", B(20.9)); show("O1b", B(20.9) + 0.12);
  sink("#t4a", B(21.6)); rise("#t4b", B(21.7), 0.06);
  show("D0", B(22)); show("D1", B(22) + 0.14); show("D2", B(22) + 0.28);
  sink("#t4b", B(24.2)); rise("#t4c", B(24.3), 0.06);
  type("L2", B(24.5), 0.45); type("L2b", B(25.3), 0.4);
  show("O2", B(26));
  seam("#s4", "#s6", B(29));

  // S6 (B29 - B37): the real renders. A slider wipes before -> after, then the pixel diff lands
  rise("#t6a", B(29) + 0.08, 0.06);
  gsap.set(["#ca", "#cd"], { opacity: 0 });
  gsap.set("#ev-a", { clipPath: "inset(0 100% 0 0)" }); gsap.set("#ev-d", { opacity: 0 });
  gsap.set("#slider", { x: 0, opacity: 0 });
  gsap.set("#card", { height: CARD_BH });
  tl.to("#card", { height: CARD_H, duration: 0.9, ease: "power2.inOut" }, B(30.5));
  tl.set("#slider", { opacity: 1 }, B(30.5));
  tl.to("#ev-a", { clipPath: "inset(0 0% 0 0)", duration: 0.9, ease: "power2.inOut" }, B(30.5));
  tl.to("#slider", { x: CARD_W, duration: 0.9, ease: "power2.inOut" }, B(30.5));
  tl.set("#slider", { opacity: 0 }, B(30.5) + 0.92);
  tl.set("#cb", { opacity: 0 }, B(30.5) + 0.45); tl.set("#ca", { opacity: 1 }, B(30.5) + 0.45);
  tl.to("#ev-d", { opacity: 1, duration: 0.35, ease: "none" }, B(32));
  tl.set("#ca", { opacity: 0 }, B(32)); tl.set("#cd", { opacity: 1 }, B(32));
  sink("#t6a", B(32)); rise("#t6b", B(32) + 0.1, 0.06);
  ["#n1", "#n2"].forEach((n, i) => { gsap.set(n, { opacity: 0, y: 30 }); tl.to(n, { opacity: 1, y: 0, duration: 0.45, ease: "expo.out" }, B(32.4) + i * 0.4); });
  seam("#s6", "#s5", B(37));

  // S5 (B37 - B42): it sees
  tl.fromTo("#cam5", { scale: 1.0 }, { scale: 1.07, duration: B(5), ease: "sine.inOut", transformOrigin: "60% 55%" }, B(37));
  rise("#t5", B(37) + 0.08, 0.06);

  // END (B42): inverse zoom-through arrival
  tl.to("#s5", { scale: 0.8, duration: 0.2, ease: "power3.in" }, B(42) - 0.2);
  tl.to("#s5", { opacity: 0, duration: 0.2, ease: "none" }, B(42) - 0.2);
  tl.set("#end", { scale: 1.25, opacity: 0.15 }, B(42));
  tl.to("#end", { scale: 1, opacity: 1, duration: 0.55, ease: "expo.out" }, B(42));
  document.querySelectorAll("#wordmark .ch").forEach((c, i) => { gsap.set(c, { opacity: 0, y: 34, filter: "blur(6px)" }); tl.to(c, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.4, ease: "expo.out" }, B(42) + 0.15 + i * 0.035); });
  rise("#endline", B(43) + 0.1, 0.07);
  gsap.set("#end .meta", { opacity: 0 }); tl.to("#end .meta", { opacity: 1, duration: 0.3, ease: "none" }, B(43) + 0.3);
  gsap.set("#end .url", { clipPath: "inset(0 100% 0 0)" }); tl.to("#end .url", { clipPath: "inset(0 0% 0 0)", duration: 0.6, ease: "none" }, B(43) + 0.6);
  gsap.set("#end .ai", { opacity: 0 }); tl.to("#end .ai", { opacity: 1, duration: 0.3, ease: "none" }, B(42) + 0.4);

  window.__timelines = window.__timelines || {};
  window.__timelines["launch"] = tl;
})();
""".replace("CARD_W", str(cw)).replace("CARD_BH", str(cbh)).replace("CARD_H", str(chh))
open(os.path.join(root, "compositions", "launch.html"), "w").write("<template>\n  <style>" + css + "  </style>\n  " + "\n  ".join(h) + "\n  <script>" + js + "  </script>\n</template>\n")

# root: music + sound placed by each file's measured peak
peak = {"sfx_002.mp3": 0.161, "sfx_004.mp3": 0.119, "sfx_003.mp3": 0.455, "sfx_001.mp3": 0.051}
aud = []
def a(src, ev, d, track, vol, name):
    st = max(0.0, ev - peak[src] + 0.033)
    aud.append(f'      <audio id="sfx-{name}" class="clip" src="assets/audio/{src}" data-start="{st:.3f}" data-duration="{d}" data-track-index="{track}" data-volume="{vol}"></audio>')
a("sfx_004.mp3", B(1.5), 0.72, 3, 0.5, "blind")
a("sfx_002.mp3", B(5), 0.57, 4, 0.3, "seam1")
a("sfx_001.mp3", B(5) + 0.56, 0.36, 5, 0.35, "tokens")
a("sfx_002.mp3", B(9), 0.57, 4, 0.3, "seam2")
a("sfx_002.mp3", B(12), 0.57, 6, 0.32, "rack")
a("sfx_004.mp3", B(12) + 0.3, 0.72, 3, 0.45, "wordmark3")
a("sfx_002.mp3", B(16), 0.57, 4, 0.3, "seam3")
a("sfx_002.mp3", B(17.5), 0.57, 6, 0.32, "push")
a("sfx_003.mp3", B(18) + 0.1, 1.3, 7, 0.26, "typing1")
a("sfx_003.mp3", B(19.4), 1.3, 8, 0.22, "typing2")
a("sfx_001.mp3", B(20.9), 0.36, 5, 0.35, "ok")
a("sfx_001.mp3", B(22), 0.36, 9, 0.3, "diffline")
a("sfx_003.mp3", B(24.5) + 0.1, 1.3, 7, 0.24, "typing3")
a("sfx_004.mp3", B(26), 0.72, 3, 0.4, "changed")
a("sfx_002.mp3", B(29), 0.57, 4, 0.3, "seam4")
a("sfx_002.mp3", B(30.5), 0.57, 6, 0.3, "slider")
a("sfx_004.mp3", B(32), 0.72, 3, 0.42, "diff")
a("sfx_002.mp3", B(37), 0.57, 4, 0.3, "seam5")
a("sfx_002.mp3", B(42), 0.57, 6, 0.3, "end")
a("sfx_004.mp3", B(42) + 0.3, 0.72, 3, 0.4, "wordmark")
index = f'''<!doctype html>
<html lang="en" data-composition-variables='[
  {{"id":"repo-url","type":"string","label":"Repository","default":"github.com/DarkWorldCoder/arguseye"}}
]'>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1080, height=1350" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      html, body {{ margin: 0; width: 1080px; height: 1350px; overflow: hidden; background: #f4f3fb; }}
      #root {{ position: relative; width: 100%; height: 100%; background: #f4f3fb; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{DUR}" data-width="1080" data-height="1350"
         data-motion-blur="on" data-motion-blur-events="on">
      <div id="launch" class="clip" style="z-index:1" data-composition-id="launch" data-composition-src="compositions/launch.html"
           data-start="0" data-duration="{DUR}" data-track-index="1" data-track-kind="graphics" data-width="1080" data-height="1350"></div>
      <audio id="music" class="clip" src="assets/audio/music.wav" data-start="0" data-duration="{DUR}" data-media-start="12.51"
             data-track-index="2" data-volume="1"
             data-automation='{{"version":1,"lanes":[{{"target":"volume","points":[{{"t":0,"v":0.3}},{{"t":{DUR - 1.5},"v":0.3}},{{"t":{DUR},"v":0}}]}}]}}'></audio>
{chr(10).join(aud)}
    </div>
    <script>
      window.__timelines = window.__timelines || {{}};
      window.__timelines["main"] = gsap.timeline({{ paused: true }});
    </script>
  </body>
</html>
'''
open(os.path.join(root, "index.html"), "w").write(index)
print("built", DUR, "s,", len(aud), "sfx")
