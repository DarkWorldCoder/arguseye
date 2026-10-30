"""Builds compositions/context.html and index.html for 'White on white' (4:5, 19.375 s, 96 BPM).

Real evidence only: film/demo-app/components/Breadcrumbs.tsx is used inside the dark hero of
app/(marketing)/docs/page.tsx:6. `arguseye shot --usage <id>` renders it alone (white text on the light stage,
assets/evidence/card-alone.png, cropped to the text) and `--in-context` renders it inside that parent
(card-context.png). The accessibility line is the CLI's own snapshot output (alone.txt)."""
import os
from html import escape
here = os.path.dirname(os.path.abspath(__file__))
root = os.path.join(here, "..")
B = lambda k: 0.625 * k
DUR = B(31)


def masked(words, cls=lambda w, i: ""):
    return "".join(f'<span class="m"><span class="w{(" " + cls(w, i)) if cls(w, i) else ""}">{w}</span></span>' for i, w in enumerate(words))


def words_of(text):
    parts = text.split(" ")
    return [p + " " for p in parts[:-1]] + [parts[-1]]


def line(id_, text, cls="", hl=()):
    return f'<div class="title {cls}" id="{id_}" data-layout-allow-overflow>{masked(words_of(text), lambda w, i: "vi" if i in hl else "")}</div>'


TERM = [
    ("K0", "cmd", "$ npx @ayushniroula/arguseye shot \\"),
    ("K1", "cmd", "    components/Breadcrumbs.tsx \\"),
    ("K2", "cmd", '    --usage "app/(marketing)/docs/page.tsx:6" \\'),
    ("K3", "cmd", "    --in-context"),
    ("K4", "ok", "Breadcrumbs.png · 702 ms"),
    ("K5", "ok", "errors: none"),
]
CW = 936

css = """
#root { position: absolute; inset: 0; overflow: hidden; font-family: "Inter", sans-serif; color: #0f172a;
  background: radial-gradient(circle at 12% 8%, rgba(139,92,246,.12), transparent 44%), radial-gradient(circle at 92% 88%, rgba(99,102,241,.14), transparent 46%), linear-gradient(165deg, #ffffff 0%, #f5f4fc 55%, #ece9fb 100%); }
.mono { font-family: "JetBrains Mono", monospace; }
.scene { position: absolute; inset: 0; }
.title { position: absolute; left: 70px; right: 70px; font-weight: 800; letter-spacing: -0.03em; line-height: 1.06; z-index: 5; }
.m { display: inline-block; overflow: hidden; vertical-align: top; padding-bottom: 0.1em; margin-bottom: -0.1em; }
.w { display: inline-block; white-space: pre; }
.vi { color: #6d28d9; }
.center { text-align: center; }
.card { position: absolute; left: 60px; width: CWpx; border-radius: 28px; overflow: hidden; box-shadow: 0 30px 70px rgba(30,27,75,.18); }
.card img { display: block; width: CWpx; }
.tag { position: absolute; left: 60px; font-size: 30px; font-weight: 700; padding: 6px 18px; border-radius: 999px; }
/* S1 */
#t1a { top: 150px; font-size: 104px; }
#t1b { top: 270px; font-size: 104px; }
#cardA { top: 640px; background: #f4f5f8; }
#tagA { top: 580px; background: #e2e8f0; color: #334155; }
#ring { position: absolute; left: 200px; top: 670px; width: 660px; height: 200px; border: 5px solid #db2777; border-radius: 22px; }
#a11y { position: absolute; left: 60px; right: 60px; top: 950px; padding: 24px 28px; border-radius: 20px; background: #0d1117; color: #e6edf3; font-size: 30px; line-height: 1.4; white-space: pre-wrap; }
#a11y .k { color: #79c0ff; } #a11y .s { color: #ffcb6b; }
#cap1 { top: 1150px; font-size: 44px; font-weight: 700; color: #334155; }
/* S2 terminal */
#t2 { top: 100px; font-size: 80px; }
#win { position: absolute; left: 50px; right: 50px; top: 380px; border-radius: 22px; background: #0d1117; overflow: hidden; box-shadow: 0 30px 70px rgba(30,27,75,.22); }
#win .bar { height: 56px; display: flex; align-items: center; gap: 10px; padding: 0 22px; background: #161b22; color: #9aa4b2; font-size: 28px; }
#win .bar i { width: 13px; height: 13px; border-radius: 50%; background: #3b434d; display: inline-block; }
#win .bar span { margin-left: 12px; }
#win .code { padding: 22px 28px 26px; font-size: 30px; line-height: 50px; color: #e6edf3; }
#win .tl { white-space: pre; } #win .ok { color: #7ee2a8; }
/* S3 reveal */
#t3 { top: 100px; font-size: 80px; }
#cardB { top: 520px; background: #0f172a; }
#tagB { top: 460px; background: #ede9fe; color: #5b21b6; }
#cap3 { top: 900px; font-size: 44px; font-weight: 700; color: #334155; }
/* END */
#end { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
#end .mark { width: 150px; height: 150px; }
#end .name { margin-top: 28px; font-size: 112px; font-weight: 800; letter-spacing: -0.045em; }
#end .ch { display: inline-block; }
#end .line { margin-top: 16px; font-size: 50px; font-weight: 700; line-height: 1.15; }
#end .meta { margin-top: 34px; font-size: 30px; color: #475569; }
#end .url { margin-top: 18px; font-size: 32px; color: #5b21b6; }
#end .note { position: absolute; left: 80px; right: 80px; bottom: 54px; font-size: 28px; color: #64748b; }
""".replace("CW", str(CW))

term = "".join(f'<div class="tl {c}" id="{i}">{escape(t)}</div>' for i, c, t in TERM)
h = ['<div id="root" data-composition-id="context" data-width="1080" data-height="1350">']
h.append('<div class="scene" id="s1">' + line("t1a", "Zero errors.") + line("t1b", "Zero pixels you can read.", hl=(1, 2, 3, 4))
         + '<span class="tag" id="tagA">Rendered alone</span><div class="card" id="cardA"><img src="assets/evidence/card-alone.png" alt="" /></div><div id="ring"></div>'
         + '<div id="a11y" class="mono"><span class="k">- navigation</span> <span class="s">"Breadcrumb"</span>: Docs / Agents / Render evidence</div>'
         + line("cap1", "The accessibility tree has it. White on white.", "center") + '</div>')
h.append('<div class="scene" id="s2">' + line("t2", "Render it where it lives.", hl=(3, 4))
         + '<div id="win" class="mono"><div class="bar"><i></i><i></i><i></i><span>zsh · demo-app</span></div><div class="code">' + term + '</div></div></div>')
h.append('<div class="scene" id="s3">' + line("t3", "Inside its real parent.", hl=(2, 3))
         + '<span class="tag" id="tagB">In context</span><div class="card" id="cardB"><img src="assets/evidence/card-context.png" alt="" /></div>'
         + line("cap3", "The dark hero from docs/page.tsx.", "center") + '</div>')
h.append('<div id="end"><img class="mark" src="assets/brand/icon.svg" alt="Arguseye" /><div class="name" id="wordmark" data-layout-allow-overflow>' + "".join(f'<span class="ch">{c}</span>' for c in "Arguseye") + '</div>'
         + f'<div class="line" id="endline" data-layout-allow-overflow>{masked(words_of("See it where it lives."))}</div>'
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
  function type(sel, t, d) { const el = document.querySelector(sel); const n = el.textContent.length; gsap.set(el, { clipPath: "inset(0 100% 0 0)" }); tl.to(el, { clipPath: "inset(0 0% 0 0)", duration: d, ease: "steps(" + n + ")" }, t); }
  ["#s2", "#s3", "#end"].forEach((s) => gsap.set(s, { opacity: 0 }));

  // S1 (0 - B11): line one reads on frame 0; the blank-looking render; the ring finds the text; the snapshot proves it
  gsap.set("#t1b .w", { yPercent: 115, opacity: 0 });
  W("#t1b").forEach((w, i) => { tl.set(w, { opacity: 1 }, B(1.5) + i * 0.07); tl.to(w, { yPercent: 0, duration: 0.55, ease: "expo.out" }, B(1.5) + i * 0.07); });
  gsap.set(["#cardA", "#tagA"], { opacity: 0, y: 40 });
  tl.to(["#tagA", "#cardA"], { opacity: 1, y: 0, duration: 0.55, ease: "expo.out", stagger: 0.08 }, B(0.5));
  gsap.set("#ring", { opacity: 0, scale: 1.6, transformOrigin: "50% 50%" });
  tl.set("#ring", { opacity: 1 }, B(4));
  tl.to("#ring", { scale: 1, duration: 0.45, ease: "expo.out" }, B(4));
  gsap.set("#a11y", { opacity: 0, y: 40 });
  tl.to("#a11y", { opacity: 1, y: 0, duration: 0.55, ease: "expo.out" }, B(5.5));
  rise("#cap1", B(6.5), 0.05);
  seam("#s1", "#s2", B(11));

  // S2 (B11 - B19): the real command with --in-context
  rise("#t2", B(11) + 0.08, 0.06);
  ["#K4", "#K5"].forEach((s) => gsap.set(s, { opacity: 0 }));
  type("#K0", B(11.6), 0.45); type("#K1", B(12.4), 0.4); type("#K2", B(13.1), 0.55); type("#K3", B(14.1), 0.3);
  tl.set("#K4", { opacity: 1 }, B(15)); tl.set("#K5", { opacity: 1 }, B(15) + 0.12);
  seam("#s2", "#s3", B(19));

  // S3 (B19 - B25): the in-context render lands with a wipe
  rise("#t3", B(19) + 0.08, 0.06);
  gsap.set("#tagB", { opacity: 0, y: 30 });
  tl.to("#tagB", { opacity: 1, y: 0, duration: 0.45, ease: "expo.out" }, B(19.5));
  gsap.set("#cardB", { clipPath: "inset(0 100% 0 0)" });
  tl.to("#cardB", { clipPath: "inset(0 0% 0 0)", duration: 0.8, ease: "power3.inOut" }, B(19.6));
  rise("#cap3", B(21), 0.04);

  // END (B25): inverse zoom-through arrival
  tl.to("#s3", { scale: 0.8, duration: 0.2, ease: "power3.in" }, B(25) - 0.2);
  tl.to("#s3", { opacity: 0, duration: 0.2, ease: "none" }, B(25) - 0.2);
  tl.set("#end", { scale: 1.25, opacity: 0.15 }, B(25));
  tl.to("#end", { scale: 1, opacity: 1, duration: 0.55, ease: "expo.out" }, B(25));
  document.querySelectorAll("#wordmark .ch").forEach((c, i) => { gsap.set(c, { opacity: 0, y: 34, filter: "blur(6px)" }); tl.to(c, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.4, ease: "expo.out" }, B(25) + 0.15 + i * 0.035); });
  rise("#endline", B(26) + 0.1, 0.07);
  gsap.set("#end .meta", { opacity: 0 }); tl.to("#end .meta", { opacity: 1, duration: 0.3, ease: "none" }, B(26) + 0.3);
  gsap.set("#end .url", { clipPath: "inset(0 100% 0 0)" }); tl.to("#end .url", { clipPath: "inset(0 0% 0 0)", duration: 0.6, ease: "none" }, B(26) + 0.6);
  gsap.set("#end .note", { opacity: 0 }); tl.to("#end .note", { opacity: 1, duration: 0.3, ease: "none" }, B(25) + 0.4);

  window.__timelines = window.__timelines || {};
  window.__timelines["context"] = tl;
})();
"""
open(os.path.join(root, "compositions", "context.html"), "w").write("<template>\n  <style>" + css + "  </style>\n  " + "\n  ".join(h) + "\n  <script>" + js + "  </script>\n</template>\n")

peak = {"sfx_002.mp3": 0.161, "sfx_004.mp3": 0.119, "sfx_003.mp3": 0.455, "sfx_001.mp3": 0.051}
aud = []
def a(src, ev, d, track, vol, name):
    st = max(0.0, ev - peak[src] + 0.033)
    aud.append(f'      <audio id="sfx-{name}" class="clip" src="assets/audio/{src}" data-start="{st:.3f}" data-duration="{d}" data-track-index="{track}" data-volume="{vol}"></audio>')
a("sfx_004.mp3", B(1.5), 0.72, 3, 0.45, "hook")
a("sfx_001.mp3", B(4), 0.36, 5, 0.4, "ring")
a("sfx_001.mp3", B(5.5), 0.36, 6, 0.35, "a11y")
a("sfx_002.mp3", B(11), 0.57, 4, 0.3, "seam1")
a("sfx_003.mp3", B(11.6) + 0.1, 1.3, 7, 0.24, "typing1")
a("sfx_003.mp3", B(13.1) + 0.1, 1.3, 8, 0.22, "typing2")
a("sfx_004.mp3", B(15), 0.72, 3, 0.4, "ok")
a("sfx_002.mp3", B(19), 0.57, 4, 0.3, "seam2")
a("sfx_002.mp3", B(19.6), 0.57, 6, 0.3, "wipe")
a("sfx_002.mp3", B(25), 0.57, 4, 0.3, "end")
a("sfx_004.mp3", B(25) + 0.3, 0.72, 3, 0.4, "wordmark")
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
      html, body {{ margin: 0; width: 1080px; height: 1350px; overflow: hidden; background: #f5f4fc; }}
      #root {{ position: relative; width: 100%; height: 100%; background: #f5f4fc; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{DUR}" data-width="1080" data-height="1350"
         data-motion-blur="on" data-motion-blur-events="on">
      <div id="context" class="clip" style="z-index:1" data-composition-id="context" data-composition-src="compositions/context.html"
           data-start="0" data-duration="{DUR}" data-track-index="1" data-track-kind="graphics" data-width="1080" data-height="1350"></div>
      <audio id="music" class="clip" src="assets/audio/music.wav" data-start="0" data-duration="{DUR}" data-media-start="27.51"
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
