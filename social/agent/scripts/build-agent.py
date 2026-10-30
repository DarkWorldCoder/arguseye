"""Builds compositions/agent.html and index.html for 'One blue check' (4:5, 25.625 s, 96 BPM).

Real evidence only. A headless Claude Code session (claude -p, Opus 5.5, Arguseye MCP built from a5390a8, the 0.0.8
fix) was given one task on a copy of film/demo-app plus app/(app)/team/page.tsx: "Add a small verified badge (a blue
check) right after the person's name in components/ProfileCard.tsx. Before you finish, use the arguseye tools to render
the card at every place the app uses it and check it looks right." The tool steps, timings and quotes below are from
its stream-json transcript (re-typeset); the card images are the PNGs render_usages returned to it, cropped only
(assets/evidence/raw). It took 89.7 s and 15 turns."""
import os
from html import escape
here = os.path.dirname(os.path.abspath(__file__))
root = os.path.join(here, "..")
B = lambda k: 0.625 * k
DUR = B(41)

PROMPT = ("Add a small verified badge (a blue check) right after the person's name in components/ProfileCard.tsx. "
          "Before you finish, use the arguseye tools to render the card at every place the app uses it and check it looks right.")
HL = "render the card at every place the app uses it"


def masked(words, cls=lambda w, i: ""):
    return "".join(f'<span class="m"><span class="w{(" " + cls(w, i)) if cls(w, i) else ""}">{w}</span></span>' for i, w in enumerate(words))


def words_of(text):
    parts = text.split(" ")
    return [p + " " for p in parts[:-1]] + [parts[-1]]


def line(id_, text, cls="", hl=()):
    return f'<div class="title {cls}" id="{id_}" data-layout-allow-overflow>{masked(words_of(text), lambda w, i: "bl" if i in hl else "")}</div>'


# The session's steps in order (tool name, then what came back), from session-2-fixed.jsonl.
STEPS = [
    ("L1", "tool", "● arguseye · list_usages"),
    ("L2", "res", "  ⎿ 3 call sites"),
    ("L3", "res", "   dashboard/page.tsx:11 · team/page.tsx:6 · team/page.tsx:7"),
    ("L4", "say", "Three call sites. Let me capture baselines of each before editing so I can diff afterward."),
    ("L5", "tool", "● arguseye · render_component ×3"),
    ("L6", "res", "  ⎿ baselines in 192 ms · 70 ms · 63 ms"),
    ("L7", "tool", "● Edit components/ProfileCard.tsx"),
    ("L8", "tool", "● arguseye · render_usages"),
    ("L9", "res", "  ⎿ 3 renders"),
]
S2_AT = [8.6, 9.3, 9.8, 10.6, 12.6, 13.3, 14.4, 15.4, 16.1]

css = """
#root { position: absolute; inset: 0; overflow: hidden; font-family: "Inter", sans-serif; color: #0f172a;
  background: radial-gradient(circle at 88% 6%, rgba(59,130,246,.13), transparent 44%), radial-gradient(circle at 6% 92%, rgba(14,165,233,.12), transparent 46%), linear-gradient(170deg, #ffffff 0%, #f4f7fd 55%, #e9effb 100%); }
.mono { font-family: "JetBrains Mono", monospace; }
.scene { position: absolute; inset: 0; }
.title { position: absolute; left: 66px; right: 66px; font-weight: 800; letter-spacing: -0.03em; line-height: 1.06; z-index: 5; }
.m { display: inline-block; overflow: hidden; vertical-align: top; padding-bottom: 0.1em; margin-bottom: -0.1em; }
.w { display: inline-block; white-space: pre; }
.bl { color: #1d4ed8; }
.center { text-align: center; }
.win { position: absolute; left: 50px; right: 50px; border-radius: 22px; background: #0d1117; overflow: hidden; box-shadow: 0 30px 70px rgba(15,23,42,.22); }
.win .bar { height: 54px; display: flex; align-items: center; gap: 10px; padding: 0 22px; background: #161b22; color: #9aa4b2; font-size: 24px; }
.win .bar i { width: 13px; height: 13px; border-radius: 50%; background: #3b434d; display: inline-block; }
.win .bar span { margin-left: 12px; }
.stage { position: absolute; border-radius: 28px; background: #f4f5f8; box-shadow: 0 24px 60px rgba(15,23,42,.14), inset 0 0 0 1px rgba(15,23,42,.06); }
.stage .lbl { position: absolute; font-size: 26px; color: #475569; }
#st4 .lbl { font-size: 22px; }
.stage img { position: absolute; display: block; }
.quote { position: absolute; left: 66px; right: 66px; padding: 22px 28px; border-radius: 22px; background: #0d1117; color: #e6edf3; box-shadow: 0 20px 50px rgba(15,23,42,.18); }
.quote .who { font-size: 22px; color: #d97757; font-weight: 700; margin-bottom: 6px; }
.quote .say { font-size: 34px; line-height: 1.3; font-weight: 600; }
/* S1 */
#t1a { top: 120px; font-size: 100px; }
#t1b { top: 236px; font-size: 100px; }
#pw { top: 470px; }
#pw .code { padding: 26px 30px 30px; font-size: 30px; line-height: 46px; color: #e6edf3; white-space: pre-wrap; }
#pw .gt { color: #d97757; }
#pw mark { background: rgba(250,204,21,.22); color: #fde68a; border-radius: 6px; padding: 0 4px; }
#cap1 { top: 980px; font-size: 44px; font-weight: 700; color: #334155; }
/* S2 */
#t2 { top: 92px; font-size: 76px; }
#tw { top: 330px; }
#tw .code { padding: 22px 16px 28px; font-size: 26px; line-height: 42px; color: #e6edf3; }
#tw .tl { white-space: pre; }
#tw .tool { color: #e6edf3; } #tw .tool b { color: #7ee2a8; font-weight: 400; }
#tw .res { color: #9aa4b2; }
#tw .say { font-family: "Inter", sans-serif; font-size: 27px; line-height: 38px; white-space: normal; margin: 8px 0 10px; color: #f0f3f6; }
/* S3 */
#t3a { top: 96px; font-size: 84px; }
#t3b { top: 192px; font-size: 84px; }
#st3 { left: 55px; top: 330px; width: 970px; height: 504px; }
#ln1, #ln2 { position: absolute; left: 70px; width: 940px; height: 0; border-top: 4px dashed #db2777; z-index: 3; }
#gap { position: absolute; right: 74px; z-index: 4; padding: 4px 14px; border-radius: 999px; background: #db2777; color: #fff; font-size: 26px; font-weight: 800; }
#q3 { top: 880px; }
#cap3 { top: 1110px; font-size: 42px; font-weight: 700; color: #334155; }
/* S4 */
#t4a { top: 96px; font-size: 84px; }
#t4b { top: 192px; font-size: 84px; }
#chip { position: absolute; left: 66px; top: 360px; padding: 14px 22px; border-radius: 16px; background: #0d1117; color: #e6edf3; font-size: 25px; }
#chip .k { color: #ff7b72; } #chip .a { color: #79c0ff; } #chip .s { color: #a5d6ff; }
#st4 { left: 46px; top: 470px; width: 988px; height: 336px; }
#q4 { top: 860px; }
#cap4 { top: 1080px; font-size: 40px; font-weight: 700; color: #334155; }
/* END */
#end { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
#end .mark { width: 150px; height: 150px; }
#end .name { margin-top: 28px; font-size: 112px; font-weight: 800; letter-spacing: -0.045em; }
#end .ch { display: inline-block; }
#end .line { margin-top: 16px; font-size: 50px; font-weight: 700; line-height: 1.15; }
#end .meta { margin-top: 34px; font-size: 30px; color: #475569; }
#end .url { margin-top: 18px; font-size: 32px; color: #1d4ed8; }
#end .note { position: absolute; left: 70px; right: 70px; bottom: 46px; font-size: 28px; line-height: 1.35; color: #64748b; }
"""

# S3 geometry: two real renders at 1.3x inside the stage; Follow button centres are y=269 (wrapped) and y=241 (Li Wei).
K3, CARD_TOP3 = 1.3, 330 + 28 + 40
ln1_y, ln2_y = CARD_TOP3 + round(241 * K3), CARD_TOP3 + round(269 * K3)
K4 = 0.88

prompt_html = escape(PROMPT).replace(escape(HL), f"<mark>{escape(HL)}</mark>")
steps = "".join(
    (f'<div class="tl say" id="{i}">{escape(t)}</div>' if c == "say" else
     f'<div class="tl {c}" id="{i}">' + (f'<b>●</b>{escape(t[1:])}' if c == "tool" else escape(t)) + '</div>')
    for i, c, t in STEPS)

h = ['<div id="root" data-composition-id="agent" data-width="1080" data-height="1350">']
h.append('<div class="scene" id="s1">' + line("t1a", "I asked Claude Code") + line("t1b", "for one blue check.", hl=(2, 3))
         + '<div class="win mono" id="pw"><div class="bar"><i></i><i></i><i></i><span>claude · acme-web</span></div>'
         f'<div class="code"><span class="gt">&gt; </span>{prompt_html}</div></div>'
         + line("cap1", "Then let it look.", "center") + '</div>')
h.append('<div class="scene" id="s2">' + line("t2", "It found every place the card is used.", hl=(2, 3))
         + '<div class="win mono" id="tw"><div class="bar"><i></i><i></i><i></i><span>claude · acme-web</span></div><div class="code">' + steps + '</div></div></div>')
h.append('<div class="scene" id="s3">' + line("t3a", "One long name") + line("t3b", "broke the row.", hl=(1, 2))
         + f'<div class="stage" id="st3"><span class="lbl mono" style="left:28px;top:26px">team/page.tsx:6</span><span class="lbl mono" style="left:497px;top:26px">team/page.tsx:7</span>'
         f'<img id="c3a" src="assets/evidence/card-wrapped.png" alt="" style="left:28px;top:68px;width:{round(342*K3)}px" />'
         f'<img id="c3b" src="assets/evidence/card-li-first.png" alt="" style="left:497px;top:68px;width:{round(342*K3)}px" /></div>'
         f'<div id="ln1" style="top:{ln1_y}px"></div><div id="ln2" style="top:{ln2_y}px"></div>'
         f'<div id="gap" style="top:{(ln1_y + ln2_y) // 2 - 22}px">28 px</div>'
         + '<div class="quote" id="q3"><div class="who">Claude Code</div><div class="say">The long name now wraps onto two lines.</div></div>'
         + line("cap3", "The Follow buttons stopped lining up.", "center") + '</div>')
cards4 = [("dashboard/page.tsx:11", "final-maya.png"), ("team/page.tsx:6", "final-oluwaseun.png"), ("team/page.tsx:7", "final-li.png")]
st4 = "".join(f'<span class="lbl mono" style="left:{24 + i * (round(342*K4) + 16)}px;top:22px">{escape(u)}</span>'
              f'<img id="c4{i}" src="assets/evidence/{f}" alt="" style="left:{24 + i * (round(342*K4) + 16)}px;top:58px;width:{round(342*K4)}px" />' for i, (u, f) in enumerate(cards4))
h.append('<div class="scene" id="s4">' + line("t4a", "It fixed it.") + line("t4b", "Then looked again.", hl=(1, 2))
         + '<div id="chip" class="mono">&lt;<span class="k">span</span> <span class="a">className</span>=<span class="s">"truncate"</span> <span class="a">title</span>={name}&gt;</div>'
         + f'<div class="stage" id="st4">{st4}</div>'
         + '<div class="quote" id="q4"><div class="who">Claude Code</div><div class="say">Rendering surfaced one problem, which I fixed.</div></div>'
         + line("cap4", "3 call sites · 0 render errors · 90 s", "center") + '</div>')
h.append('<div id="end"><img class="mark" src="assets/brand/icon.svg" alt="Arguseye" /><div class="name" id="wordmark" data-layout-allow-overflow>' + "".join(f'<span class="ch">{c}</span>' for c in "Arguseye") + '</div>'
         + f'<div class="line" id="endline" data-layout-allow-overflow>{masked(words_of("Let your agent look before it says done."))}</div>'
         '<div class="meta">VS Code extension · MCP server · free and open source (MIT)</div><div class="url mono" data-var-text="repo-url">github.com/DarkWorldCoder/arguseye</div>'
         '<div class="note">Real Claude Code session on a demo app. Transcript re-typeset, renders unedited.</div></div>')
h.append('</div>')

js = r"""
(function () {
  const tl = gsap.timeline({ paused: true });
  const B = (k) => 0.625 * k;
  const W = (sel) => Array.from(document.querySelectorAll(sel + " .w"));
  function rise(sel, t, gap = 0.06) { W(sel).forEach((w, i) => { gsap.set(w, { yPercent: 115, opacity: 0 }); tl.set(w, { opacity: 1 }, t + i * gap); tl.to(w, { yPercent: 0, duration: 0.55, ease: "expo.out" }, t + i * gap); }); }
  function seam(out, inn, t) {
    tl.to(out, { x: -130, duration: 0.34, ease: "power4.in" }, t - 0.34);
    tl.to(out, { opacity: 0, duration: 0.2, ease: "none" }, t - 0.2);
    tl.set(inn, { x: 130, opacity: 0.35 }, t);
    tl.to(inn, { x: 0, duration: 0.42, ease: "power4.out" }, t);
    tl.to(inn, { opacity: 1, duration: 0.18, ease: "none" }, t);
  }
  function up(sel, t, d = 0.55, y = 40) { gsap.set(sel, { opacity: 0, y }); tl.to(sel, { opacity: 1, y: 0, duration: d, ease: "expo.out" }, t); }
  function type(sel, t, d) { const el = document.querySelector(sel); const n = el.textContent.length; gsap.set(el, { clipPath: "inset(0 100% 0 0)" }); tl.to(el, { clipPath: "inset(0 0% 0 0)", duration: d, ease: "steps(" + Math.min(n, 60) + ")" }, t); }
  ["#s2", "#s3", "#s4", "#end"].forEach((s) => gsap.set(s, { opacity: 0 }));

  // S1 (0 - B8): line one reads on frame 0; the real prompt is pasted in; the ask to look gets its highlight
  rise("#t1b", B(0.8), 0.07);
  up("#pw", B(1.6), 0.6, 60);
  gsap.set("#pw mark", { backgroundColor: "rgba(250,204,21,0)" });
  tl.to("#pw mark", { backgroundColor: "rgba(250,204,21,.22)", duration: 0.3, ease: "none" }, B(3.4));
  rise("#cap1", B(4), 0.07);
  seam("#s1", "#s2", B(8));

  // S2 (B8 - B18): the session's own steps, one per beat
  rise("#t2", B(8) + 0.08, 0.05);
  const at = __S2_AT__;
  __S2_IDS__.forEach((id, i) => { gsap.set(id, { opacity: 0, y: 12 }); tl.to(id, { opacity: 1, y: 0, duration: 0.3, ease: "expo.out" }, B(at[i])); });
  seam("#s2", "#s3", B(18));

  // S3 (B18 - B28): the long-name card wrapped; its Follow button sits 28 px below the next card's
  rise("#t3a", B(18) + 0.08, 0.06); rise("#t3b", B(18.6), 0.06);
  gsap.set(["#c3a", "#c3b"], { opacity: 0, y: 50 });
  tl.to(["#c3a", "#c3b"], { opacity: 1, y: 0, duration: 0.6, ease: "expo.out", stagger: 0.12 }, B(18.4));
  up("#q3", B(20.4), 0.5, 30);
  type("#q3 .say", B(20.6), 0.9);
  ["#ln1", "#ln2"].forEach((s, i) => { gsap.set(s, { scaleX: 0, transformOrigin: "0% 50%" }); tl.to(s, { scaleX: 1, duration: 0.5, ease: "power3.out" }, B(22.5) + i * 0.16); });
  gsap.set("#gap", { opacity: 0, scale: 1.6 }); tl.set("#gap", { opacity: 1 }, B(23.3)); tl.to("#gap", { scale: 1, duration: 0.4, ease: "expo.out" }, B(23.3));
  rise("#cap3", B(24), 0.05);
  seam("#s3", "#s4", B(28));

  // S4 (B28 - B35): the fix, then all three real renders again
  rise("#t4a", B(28) + 0.08, 0.06); rise("#t4b", B(28.6), 0.06);
  gsap.set("#chip", { clipPath: "inset(0 100% 0 0)" }); tl.to("#chip", { clipPath: "inset(0 0% 0 0)", duration: 0.5, ease: "power2.out" }, B(29));
  ["#c40", "#c41", "#c42"].forEach((s, i) => { gsap.set(s, { opacity: 0, y: 60 }); tl.set(s, { opacity: 1 }, B(29.6) + i * 0.13); tl.to(s, { y: 0, duration: 0.45, ease: "power4.out" }, B(29.6) + i * 0.13); });
  up("#q4", B(30.6), 0.5, 30);
  type("#q4 .say", B(30.8), 0.9);
  rise("#cap4", B(31.6), 0.05);

  // END (B35): inverse zoom-through arrival
  tl.to("#s4", { scale: 0.8, duration: 0.2, ease: "power3.in" }, B(35) - 0.2);
  tl.to("#s4", { opacity: 0, duration: 0.2, ease: "none" }, B(35) - 0.2);
  tl.set("#end", { scale: 1.25, opacity: 0.15 }, B(35));
  tl.to("#end", { scale: 1, opacity: 1, duration: 0.55, ease: "expo.out" }, B(35));
  document.querySelectorAll("#wordmark .ch").forEach((c, i) => { gsap.set(c, { opacity: 0, y: 34, filter: "blur(6px)" }); tl.to(c, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.4, ease: "expo.out" }, B(35) + 0.15 + i * 0.035); });
  rise("#endline", B(36) + 0.1, 0.06);
  gsap.set("#end .meta", { opacity: 0 }); tl.to("#end .meta", { opacity: 1, duration: 0.3, ease: "none" }, B(35) + 0.6);
  gsap.set("#end .url", { clipPath: "inset(0 100% 0 0)" }); tl.to("#end .url", { clipPath: "inset(0 0% 0 0)", duration: 0.6, ease: "none" }, B(36) + 0.7);
  gsap.set("#end .note", { opacity: 0 }); tl.to("#end .note", { opacity: 1, duration: 0.3, ease: "none" }, B(35) + 0.4);

  window.__timelines = window.__timelines || {};
  window.__timelines["agent"] = tl;
})();
""".replace("__S2_AT__", str(S2_AT)).replace("__S2_IDS__", str(["#" + s[0] for s in STEPS]))
open(os.path.join(root, "compositions", "agent.html"), "w").write("<template>\n  <style>" + css + "  </style>\n  " + "\n  ".join(h) + "\n  <script>" + js + "  </script>\n</template>\n")

peak = {"sfx_002.mp3": 0.161, "sfx_004.mp3": 0.119, "sfx_003.mp3": 0.455, "sfx_001.mp3": 0.051}
aud = []
def a(src, ev, d, track, vol, name):
    st = max(0.0, ev - peak[src] + 0.033)
    aud.append(f'      <audio id="sfx-{name}" class="clip" src="assets/audio/{src}" data-start="{st:.3f}" data-duration="{d}" data-track-index="{track}" data-volume="{vol}"></audio>')
a("sfx_004.mp3", B(0.8), 0.72, 3, 0.45, "hook")
a("sfx_002.mp3", B(1.6), 0.57, 4, 0.28, "paste")
a("sfx_002.mp3", B(8), 0.57, 4, 0.3, "seam1")
for i, k in enumerate([S2_AT[0], S2_AT[4], S2_AT[6], S2_AT[7]]):
    a("sfx_001.mp3", B(k), 0.36, 5 + i % 2, 0.32, f"step{i}")
a("sfx_002.mp3", B(18), 0.57, 4, 0.3, "seam2")
a("sfx_003.mp3", B(20.6) + 0.1, 1.0, 7, 0.22, "typing1")
a("sfx_001.mp3", B(22.5), 0.36, 5, 0.38, "line")
a("sfx_004.mp3", B(23.3), 0.72, 3, 0.4, "gap")
a("sfx_002.mp3", B(28), 0.57, 4, 0.3, "seam3")
a("sfx_001.mp3", B(29.6), 0.36, 6, 0.35, "cards")
a("sfx_003.mp3", B(30.8) + 0.1, 1.0, 8, 0.22, "typing2")
a("sfx_002.mp3", B(35), 0.57, 4, 0.3, "end")
a("sfx_004.mp3", B(35) + 0.3, 0.72, 3, 0.4, "wordmark")
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
      html, body {{ margin: 0; width: 1080px; height: 1350px; overflow: hidden; background: #f4f7fd; }}
      #root {{ position: relative; width: 100%; height: 100%; background: #f4f7fd; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{DUR}" data-width="1080" data-height="1350"
         data-motion-blur="on" data-motion-blur-events="on">
      <div id="agent" class="clip" style="z-index:1" data-composition-id="agent" data-composition-src="compositions/agent.html"
           data-start="0" data-duration="{DUR}" data-track-index="1" data-track-kind="graphics" data-width="1080" data-height="1350"></div>
      <audio id="music" class="clip" src="assets/audio/music.wav" data-start="0" data-duration="{DUR}" data-media-start="55.01"
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
