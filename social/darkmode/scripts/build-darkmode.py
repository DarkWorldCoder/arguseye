"""Builds compositions/darkmode.html and index.html for 'Two looks' (4:5, 21.875 s, 96 BPM).

Real evidence only. film/demo-app gained components/InvoiceCard.tsx (Tailwind dark: variants) used twice in
app/(app)/billing/page.tsx. Every card image is a PNG from `arguseye shot ... --usage <id> --theme light|dark`
(local build of the unreleased theme option; 0.0.9). The broken state is the same card with `dark:text-white`
removed from the total, rendered on a scratch copy: bug-dark.png, 710 ms, errors none (bug-dark.json).
The fix is that one class; overdue-dark.png is the committed component."""
import os
from html import escape
here = os.path.dirname(os.path.abspath(__file__))
root = os.path.join(here, "..")
B = lambda k: 0.625 * k
DUR = B(35)
K = 1.6
CW, CH = round(360 * K), round(262 * K)


def masked(words, cls=lambda w, i: ""):
    return "".join(f'<span class="m"><span class="w{(" " + cls(w, i)) if cls(w, i) else ""}">{w}</span></span>' for i, w in enumerate(words))


def words_of(text):
    parts = text.split(" ")
    return [p + " " for p in parts[:-1]] + [parts[-1]]


def line(id_, text, cls="", hl=()):
    return f'<div class="title {cls}" id="{id_}" data-layout-allow-overflow>{masked(words_of(text), lambda w, i: "or" if i in hl else "")}</div>'


TERM = [
    ("K0", "cmd", "$ npx @ayushniroula/arguseye shot \\"),
    ("K1", "cmd", "    components/InvoiceCard.tsx \\"),
    ("K2", "cmd", '    --usage "app/(app)/billing/page.tsx:6" \\'),
    ("K3", "cmd hi", "    --theme dark"),
    ("K4", "ok", "InvoiceCard.png · 710 ms"),
    ("K5", "ok", "errors: none"),
]

css = """
#root { position: absolute; inset: 0; overflow: hidden; font-family: "Inter", sans-serif; color: #0f172a;
  background: radial-gradient(circle at 10% 6%, rgba(234,88,12,.10), transparent 42%), radial-gradient(circle at 94% 90%, rgba(99,102,241,.13), transparent 46%), linear-gradient(168deg, #ffffff 0%, #f6f5f3 55%, #ecebf2 100%); }
.mono { font-family: "JetBrains Mono", monospace; }
.scene { position: absolute; inset: 0; }
.title { position: absolute; left: 66px; right: 66px; font-weight: 800; letter-spacing: -0.03em; line-height: 1.06; z-index: 5; }
.m { display: inline-block; overflow: hidden; vertical-align: top; padding-bottom: 0.1em; margin-bottom: -0.1em; }
.w { display: inline-block; white-space: pre; }
.or { color: #c2410c; }
.center { text-align: center; }
.card { position: absolute; display: block; border-radius: 38px; box-shadow: 0 34px 80px rgba(15,23,42,.22); }
.tag { position: absolute; font-size: 28px; font-weight: 700; padding: 6px 18px; border-radius: 999px; }
.tag.l { background: #ffffff; color: #334155; box-shadow: inset 0 0 0 2px #e2e8f0; }
.tag.d { background: #18181b; color: #f4f4f5; }
/* S1 */
#t1a { top: 120px; font-size: 104px; }
#t1b { top: 238px; font-size: 104px; }
#c1l, #c1d { left: CXpx; top: 470px; }
#t1l { left: CXpx; top: 410px; } #t1d { left: CXpx; top: 410px; }
#cap1 { top: 1010px; font-size: 52px; font-weight: 800; }
/* S2 terminal */
#t2 { top: 100px; font-size: 80px; }
#win { position: absolute; left: 50px; right: 50px; top: 400px; border-radius: 22px; background: #0d1117; overflow: hidden; box-shadow: 0 30px 70px rgba(15,23,42,.24); }
#win .bar { height: 56px; display: flex; align-items: center; gap: 10px; padding: 0 22px; background: #161b22; color: #9aa4b2; font-size: 28px; }
#win .bar i { width: 13px; height: 13px; border-radius: 50%; background: #3b434d; display: inline-block; }
#win .bar span { margin-left: 12px; }
#win .code { padding: 24px 26px 28px; font-size: 30px; line-height: 50px; color: #e6edf3; }
#win .tl { white-space: pre; } #win .ok { color: #7ee2a8; } #win .hi { color: #fdba74; }
/* S3 the bug */
#t3 { top: 100px; font-size: 92px; }
#c3 { left: CXpx; top: 360px; }
#ring { position: absolute; left: RXpx; top: RYpx; width: RWpx; height: RHpx; border: 6px solid #f97316; border-radius: 24px; }
#cap3 { top: 860px; font-size: 44px; font-weight: 700; color: #334155; }
#chip3 { position: absolute; left: 50%; transform: translateX(-50%); top: 950px; padding: 14px 24px; border-radius: 16px; background: #0d1117; color: #e6edf3; font-size: 30px; white-space: nowrap; }
#chip3 .s { color: #a5d6ff; }
/* S4 the fix */
#t4 { top: 100px; font-size: 92px; }
#fix { position: absolute; left: 50%; transform: translateX(-50%); top: 250px; padding: 14px 24px; border-radius: 16px; background: #0d1117; color: #e6edf3; font-size: 30px; white-space: nowrap; }
#fix .s { color: #a5d6ff; } #fix .add { color: #7ee2a8; }
#c4l, #c4d { top: 470px; width: 456px; border-radius: 30px; }
#c4l { left: 60px; } #c4d { left: 564px; }
#tg4l { left: 60px; top: 410px; } #tg4d { left: 564px; top: 410px; }
#cap4 { top: 830px; font-size: 44px; font-weight: 700; color: #334155; }
#mcp { position: absolute; left: 50%; transform: translateX(-50%); top: 920px; padding: 14px 24px; border-radius: 16px; background: #0d1117; color: #e6edf3; font-size: 30px; white-space: nowrap; }
#mcp .k { color: #79c0ff; } #mcp .s { color: #fdba74; }
/* END */
#end { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
#end .mark { width: 150px; height: 150px; }
#end .name { margin-top: 28px; font-size: 112px; font-weight: 800; letter-spacing: -0.045em; }
#end .ch { display: inline-block; }
#end .line { margin-top: 16px; font-size: 52px; font-weight: 700; line-height: 1.15; }
#end .meta { margin-top: 34px; font-size: 30px; color: #475569; }
#end .url { margin-top: 18px; font-size: 32px; color: #c2410c; }
#end .note { position: absolute; left: 70px; right: 70px; bottom: 46px; font-size: 28px; line-height: 1.35; color: #64748b; }
"""
cx = (1080 - CW) // 2
# The total sits at y 105-150 of the 262 px render (x 25-230); ring it with some room.
css = (css.replace("CX", str(cx)).replace("RX", str(cx + round(14 * K))).replace("RY", str(360 + round(92 * K)))
       .replace("RW", str(round(232 * K))).replace("RH", str(round(52 * K))))
css += f".card#c1l, .card#c1d, .card#c3 {{ width: {CW}px; }}\n"

term = "".join(f'<div class="tl {c}" id="{i}">{escape(t)}</div>' for i, c, t in TERM)
img = lambda id_, f, cls="card": f'<img class="{cls}" id="{id_}" src="assets/evidence/{f}" alt="" />'
h = ['<div id="root" data-composition-id="darkmode" data-width="1080" data-height="1350">']
h.append('<div class="scene" id="s1">' + line("t1a", "Your invoice card") + line("t1b", "has two looks.", hl=(1, 2))
         + '<span class="tag l" id="t1l">light</span><span class="tag d" id="t1d">dark</span>'
         + img("c1l", "overdue-light.png") + img("c1d", "overdue-dark.png")
         + line("cap1", "You checked one.", "center") + '</div>')
h.append('<div class="scene" id="s2">' + line("t2", "Check the other with one flag.", hl=(4, 5))
         + '<div id="win" class="mono"><div class="bar"><i></i><i></i><i></i><span>zsh · demo-app</span></div><div class="code">' + term + '</div></div></div>')
h.append('<div class="scene" id="s3">' + line("t3", "The total is gone.", hl=(1, 2))
         + img("c3", "bug-dark.png") + '<div id="ring"></div>'
         + line("cap3", "Dark text on a dark card.", "center")
         + '<div id="chip3" class="mono">className=<span class="s">"text-4xl font-bold text-zinc-900"</span></div></div>')
h.append('<div class="scene" id="s4">' + line("t4", "One class later.", hl=(1, 2))
         + '<div id="fix" class="mono"><span class="s">"text-zinc-900 </span><span class="add">dark:text-white</span><span class="s">"</span></div>'
         + '<span class="tag l" id="tg4l">light</span><span class="tag d" id="tg4d">dark</span>'
         + img("c4l", "overdue-light.png") + img("c4d", "overdue-dark.png")
         + line("cap4", "Coding agents get the same switch.", "center")
         + '<div id="mcp" class="mono">render_component <span class="k">{ theme:</span> <span class="s">"dark"</span> <span class="k">}</span></div></div>')
h.append('<div id="end"><img class="mark" src="assets/brand/icon.svg" alt="Arguseye" /><div class="name" id="wordmark" data-layout-allow-overflow>' + "".join(f'<span class="ch">{c}</span>' for c in "Arguseye") + '</div>'
         + f'<div class="line" id="endline" data-layout-allow-overflow>{masked(words_of("Check both themes before you ship."))}</div>'
         '<div class="meta">VS Code extension · MCP server · free and open source (MIT)</div><div class="url mono" data-var-text="repo-url">github.com/DarkWorldCoder/arguseye</div>'
         '<div class="note">Demo app. Real CLI output and renders.</div></div>')
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
  function type(sel, t, d) { const el = document.querySelector(sel); const n = el.textContent.length; gsap.set(el, { clipPath: "inset(0 100% 0 0)" }); tl.to(el, { clipPath: "inset(0 0% 0 0)", duration: d, ease: "steps(" + n + ")" }, t); }
  ["#s2", "#s3", "#s4", "#end"].forEach((s) => gsap.set(s, { opacity: 0 }));

  // S1 (0 - B8): line one reads on frame 0; the light card lands; a wipe flips it to its dark look and back
  rise("#t1b", B(0.8), 0.07);
  up("#c1l", B(1.4), 0.6, 60); up("#t1l", B(1.6), 0.45, 20);
  gsap.set("#c1d", { clipPath: "inset(0 100% 0 0)" }); gsap.set("#t1d", { opacity: 0 });
  tl.to("#c1d", { clipPath: "inset(0 0% 0 0)", duration: 0.5, ease: "power3.inOut" }, B(3));
  tl.set("#t1d", { opacity: 1 }, B(3.4)); tl.set("#t1l", { opacity: 0 }, B(3.4));
  tl.to("#c1d", { clipPath: "inset(0 0% 0 100%)", duration: 0.5, ease: "power3.inOut" }, B(4.6));
  tl.set("#t1d", { opacity: 0 }, B(5)); tl.set("#t1l", { opacity: 1 }, B(5));
  rise("#cap1", B(5.4), 0.07);
  seam("#s1", "#s2", B(8));

  // S2 (B8 - B15): the real command with --theme dark
  rise("#t2", B(8) + 0.08, 0.05);
  ["#K4", "#K5"].forEach((s) => gsap.set(s, { opacity: 0 }));
  type("#K0", B(8.6), 0.45); type("#K1", B(9.4), 0.35); type("#K2", B(10), 0.55); type("#K3", B(11), 0.3);
  tl.set("#K4", { opacity: 1 }, B(12)); tl.set("#K5", { opacity: 1 }, B(12) + 0.12);
  seam("#s2", "#s3", B(15));

  // S3 (B15 - B22): the dark render, the missing total ringed
  rise("#t3", B(15) + 0.08, 0.06);
  up("#c3", B(15.4), 0.6, 50);
  gsap.set("#ring", { opacity: 0, scale: 1.5, transformOrigin: "50% 50%" });
  tl.set("#ring", { opacity: 1 }, B(17)); tl.to("#ring", { scale: 1, duration: 0.45, ease: "expo.out" }, B(17));
  rise("#cap3", B(17.8), 0.05);
  gsap.set("#chip3", { opacity: 0 }); tl.to("#chip3", { opacity: 1, duration: 0.3, ease: "none" }, B(18.2));
  seam("#s3", "#s4", B(22));

  // S4 (B22 - B29): the one-class fix, both themes side by side, the MCP switch
  rise("#t4", B(22) + 0.08, 0.06);
  type("#fix .add", B(22.8), 0.5);
  ["#c4l", "#c4d"].forEach((s, i) => { gsap.set(s, { opacity: 0, y: 60 }); tl.set(s, { opacity: 1 }, B(23.6) + i * 0.13); tl.to(s, { y: 0, duration: 0.45, ease: "power4.out" }, B(23.6) + i * 0.13); });
  up(["#tg4l", "#tg4d"], B(23.9), 0.4, 20);
  rise("#cap4", B(25.4), 0.05);
  gsap.set("#mcp", { opacity: 0 }); tl.to("#mcp", { opacity: 1, duration: 0.3, ease: "none" }, B(26.2));

  // END (B29): inverse zoom-through arrival
  tl.to("#s4", { scale: 0.8, duration: 0.2, ease: "power3.in" }, B(29) - 0.2);
  tl.to("#s4", { opacity: 0, duration: 0.2, ease: "none" }, B(29) - 0.2);
  tl.set("#end", { scale: 1.25, opacity: 0.15 }, B(29));
  tl.to("#end", { scale: 1, opacity: 1, duration: 0.55, ease: "expo.out" }, B(29));
  document.querySelectorAll("#wordmark .ch").forEach((c, i) => { gsap.set(c, { opacity: 0, y: 34, filter: "blur(6px)" }); tl.to(c, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.4, ease: "expo.out" }, B(29) + 0.15 + i * 0.035); });
  rise("#endline", B(30) + 0.1, 0.06);
  gsap.set("#end .meta", { opacity: 0 }); tl.to("#end .meta", { opacity: 1, duration: 0.3, ease: "none" }, B(29) + 0.6);
  gsap.set("#end .url", { clipPath: "inset(0 100% 0 0)" }); tl.to("#end .url", { clipPath: "inset(0 0% 0 0)", duration: 0.6, ease: "none" }, B(30) + 0.7);
  gsap.set("#end .note", { opacity: 0 }); tl.to("#end .note", { opacity: 1, duration: 0.3, ease: "none" }, B(29) + 0.4);

  window.__timelines = window.__timelines || {};
  window.__timelines["darkmode"] = tl;
})();
"""
open(os.path.join(root, "compositions", "darkmode.html"), "w").write("<template>\n  <style>" + css + "  </style>\n  " + "\n  ".join(h) + "\n  <script>" + js + "  </script>\n</template>\n")

peak = {"sfx_002.mp3": 0.161, "sfx_004.mp3": 0.119, "sfx_003.mp3": 0.455, "sfx_001.mp3": 0.051}
aud = []
def a(src, ev, d, track, vol, name):
    st = max(0.0, ev - peak[src] + 0.033)
    aud.append(f'      <audio id="sfx-{name}" class="clip" src="assets/audio/{src}" data-start="{st:.3f}" data-duration="{d}" data-track-index="{track}" data-volume="{vol}"></audio>')
a("sfx_004.mp3", B(0.8), 0.72, 3, 0.45, "hook")
a("sfx_002.mp3", B(3), 0.57, 4, 0.3, "flip")
a("sfx_002.mp3", B(4.6), 0.57, 5, 0.26, "flipback")
a("sfx_002.mp3", B(8), 0.57, 4, 0.3, "seam1")
a("sfx_003.mp3", B(8.6) + 0.1, 1.3, 7, 0.24, "typing1")
a("sfx_003.mp3", B(10) + 0.1, 1.3, 8, 0.22, "typing2")
a("sfx_004.mp3", B(12), 0.72, 3, 0.4, "ok")
a("sfx_002.mp3", B(15), 0.57, 4, 0.3, "seam2")
a("sfx_001.mp3", B(17), 0.36, 5, 0.4, "ring")
a("sfx_002.mp3", B(22), 0.57, 4, 0.3, "seam3")
a("sfx_003.mp3", B(22.8) + 0.1, 0.8, 7, 0.22, "typing3")
a("sfx_001.mp3", B(23.6), 0.36, 6, 0.35, "cards")
a("sfx_002.mp3", B(29), 0.57, 4, 0.3, "end")
a("sfx_004.mp3", B(29) + 0.3, 0.72, 3, 0.4, "wordmark")
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
      html, body {{ margin: 0; width: 1080px; height: 1350px; overflow: hidden; background: #f6f5f3; }}
      #root {{ position: relative; width: 100%; height: 100%; background: #f6f5f3; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{DUR}" data-width="1080" data-height="1350"
         data-motion-blur="on" data-motion-blur-events="on">
      <div id="darkmode" class="clip" style="z-index:1" data-composition-id="darkmode" data-composition-src="compositions/darkmode.html"
           data-start="0" data-duration="{DUR}" data-track-index="1" data-track-kind="graphics" data-width="1080" data-height="1350"></div>
      <audio id="music" class="clip" src="assets/audio/music.wav" data-start="0" data-duration="{DUR}" data-media-start="0.01"
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
