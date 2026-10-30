"""Builds compositions/usages.html and index.html for 'Your app already wrote the test data' (4:5, 27.5 s, 96 BPM).

Everything shown is real: the JSX lines are copied from film/demo-app (showcase/page.tsx:13, trips/page.tsx:6-7),
the terminal shows `arguseye usages components/BoardingPass.tsx` (assets/evidence/usages.json, compacted with
elisions marked), and the three cards are `arguseye shot --usage <id>` renders of those call sites."""
import os, re
from html import escape
here = os.path.dirname(os.path.abspath(__file__))
root = os.path.join(here, "..")
B = lambda k: 0.625 * k
DUR = B(44)


def masked(words, cls=lambda w, i: ""):
    return "".join(f'<span class="m"><span class="w{(" " + cls(w, i)) if cls(w, i) else ""}">{w}</span></span>' for i, w in enumerate(words))


def words_of(text):
    parts = text.split(" ")
    return [p + " " for p in parts[:-1]] + [parts[-1]]


def line(id_, text, cls="", hl=()):
    return f'<div class="title {cls}" id="{id_}" data-layout-allow-overflow>{masked(words_of(text), lambda w, i: "vi" if i in hl else "")}</div>'


def jsx(src):
    """Tiny highlighter for one JSX line: component name, attribute names, string values."""
    out = escape(src)
    out = re.sub(r"&lt;([A-Z]\w*)", r'&lt;<b class="tag">\1</b>', out)
    out = re.sub(r'(\w+)=(&quot;.*?&quot;|\{.*?\})', r'<b class="att">\1</b>=<b class="str">\2</b>', out)
    return out


SHOWCASE = [
    (12, '<RevenueChart label="Monthly revenue" value="$48,210" delta="18.4%" />', False),
    (13, '<BoardingPass passenger="Maya Chen" from="KTM" fromCity="Kathmandu" to="SFO" toCity="San Francisco" flight="AX 204" gate="B12" seat="14A" boarding="09:35" />', True),
]
TRIPS = [
    (6, '<BoardingPass passenger="Arjun Shrestha" from="KTM" fromCity="Kathmandu" to="DEL" toCity="New Delhi" flight="AX 112" gate="A3" seat="2C" boarding="07:05" />', True),
    (7, '<BoardingPass passenger="Maximiliana Featherstonehaugh" from="SFO" fromCity="San Francisco" to="NRT" toCity="Tokyo Narita" flight="AX 880" gate="G98" seat="41K" boarding="10:50" />', True),
]
TERM = [
    ("J0", "cmd", "$ npx @ayushniroula/arguseye usages \\"),
    ("J0b", "cmd", "    components/BoardingPass.tsx"),
    ("J1", "", "["),
    ("J2", "", '  { "id": "app/(app)/showcase/page.tsx:13",'),
    ("J3", "", '    "props": { "passenger": "Maya Chen", … } },'),
    ("J4", "", '  { "id": "app/(app)/trips/page.tsx:6",'),
    ("J5", "", '    "props": { "passenger": "Arjun Shrestha", … } },'),
    ("J6", "", '  { "id": "app/(app)/trips/page.tsx:7",'),
    ("J7", "", '    "props": { "passenger": "Maximiliana Featherstonehaugh", … } }'),
    ("J8", "", "]"),
]
CARDS = [("card-showcase-13.png", "showcase/page.tsx:13"), ("card-trips-6.png", "trips/page.tsx:6"), ("card-trips-7.png", "trips/page.tsx:7")]
S, STEP = 1.6, 620
cw, chh = round(340 * S), round(338 * S)
CL = (1080 - cw) // 2

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
/* S1 */
#t1a { top: 470px; font-size: 100px; text-align: center; }
#t1b { top: 580px; font-size: 100px; text-align: center; }
#chip { position: absolute; left: 90px; right: 90px; top: 820px; padding: 22px 28px; border-radius: 20px; background: #0f172a; color: #e2e8f0; font-size: 30px; white-space: pre; overflow: hidden; box-shadow: 0 24px 60px rgba(30,27,75,.22); }
/* code windows */
.win { position: absolute; left: 50px; right: 50px; border-radius: 22px; background: #0d1117; overflow: hidden; box-shadow: 0 30px 70px rgba(30,27,75,.22); }
.win .bar { height: 56px; display: flex; align-items: center; gap: 10px; padding: 0 22px; background: #161b22; color: #9aa4b2; font-size: 28px; }
.win .bar i { width: 13px; height: 13px; border-radius: 50%; background: #3b434d; display: inline-block; }
.win .bar span { margin-left: 12px; }
.code { position: relative; padding: 18px 0 22px; font-size: 28px; line-height: 46px; color: #e6edf3; }
.code .ln { position: relative; display: flex; white-space: pre; padding-left: 22px; }
.code .ln .no { width: 56px; color: #6e7681; flex: none; text-align: right; margin-right: 22px; }
.code .ln.hl::before { content: ""; position: absolute; inset: 0; background: rgba(139,92,246,.22); border-left: 6px solid #a78bfa; transform-origin: 0 50%; transform: scaleX(var(--hl, 0)); }
.code .ln > * { position: relative; }
.code .fade { position: absolute; top: 0; right: 0; bottom: 0; width: 160px; background: linear-gradient(to right, rgba(13,17,23,0), #0d1117 80%); }
b { font-weight: 400; } .tag { color: #7ee2a8; } .att { color: #79c0ff; } .str { color: #ffcb6b; } .dimln { opacity: .7; }
#t2 { top: 100px; font-size: 76px; }
#winA { top: 290px; } #winB { top: 640px; }
#cap2 { top: 1010px; font-size: 40px; font-weight: 600; color: #475569; }
/* S3 terminal */
#t3 { top: 100px; font-size: 76px; }
#term { top: 300px; }
#term .code { padding-left: 26px; }
#term .tl { white-space: pre; color: #e6edf3; }
#term .cmd { color: #e6edf3; }
#term #J0b { margin-bottom: 8px; }
#count { position: absolute; left: 0; right: 0; top: 1040px; text-align: center; font-size: 64px; font-weight: 800; letter-spacing: -0.03em; }
#count .roll { display: inline-block; height: 1.1em; overflow: hidden; vertical-align: top; color: #6d28d9; }
#count .roll .col { display: block; }
#count .roll .col span { display: block; height: 1.1em; line-height: 1.1em; }
/* S4 cards */
#t4 { top: 96px; font-size: 64px; }
#strip { position: absolute; left: 0; top: 330px; width: 2400px; height: 760px; }
.slot { position: absolute; top: 0; width: CWpx; }
.slot .card { width: CWpx; height: CHpx; border-radius: CRpx; overflow: hidden; box-shadow: 0 34px 80px rgba(30,27,75,.20); background: #fff; }
.slot .card img { width: CWpx; height: CHpx; display: block; }
.slot .lab { margin-top: 30px; text-align: center; font-size: 32px; color: #5b21b6; }
#decklabs { position: absolute; left: 0; right: 0; top: 0; }
#decklabs span { position: absolute; top: 880px; width: 300px; margin-left: -150px; text-align: center; font-size: 28px; color: #5b21b6; }
/* END */
#end { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
#end .mark { width: 150px; height: 150px; }
#end .name { margin-top: 28px; font-size: 112px; font-weight: 800; letter-spacing: -0.045em; }
#end .ch { display: inline-block; }
#end .line { margin-top: 16px; font-size: 50px; font-weight: 700; line-height: 1.15; }
#end .meta { margin-top: 34px; font-size: 30px; color: #475569; }
#end .url { margin-top: 18px; font-size: 32px; color: #5b21b6; }
#end .note { position: absolute; left: 80px; right: 80px; bottom: 54px; font-size: 28px; color: #64748b; }
""".replace("CW", str(cw)).replace("CH", str(chh)).replace("CR", str(round(24 * S)))


def win(id_, path, rows):
    lines = "".join(f'<div class="ln{" hl" if hl else " dimln"}" id="{id_}-{no}"><span class="no">{no}</span><span>{jsx(src)}</span></div>' for no, src, hl in rows)
    return f'<div class="win mono" id="{id_}"><div class="bar"><i></i><i></i><i></i><span>{path}</span></div><div class="code" data-layout-allow-overflow>{lines}<div class="fade"></div></div></div>'


h = ['<div id="root" data-composition-id="usages" data-width="1080" data-height="1350">']
h.append('<div class="scene" id="s1">' + line("t1a", "Your app already") + line("t1b", "wrote the test data.", hl=(2, 3))
         + '<div id="chip" class="mono"><span id="chipcode" style="display:inline-block">' + jsx('<BoardingPass passenger="Maya Chen" … />') + '</span></div></div>')
h.append('<div class="scene" id="s2">' + line("t2", "It's in your JSX.", hl=(3,))
         + win("winA", "app/(app)/showcase/page.tsx", SHOWCASE) + win("winB", "app/(app)/trips/page.tsx", TRIPS)
         + line("cap2", "Three call sites. Three sets of real props.", "center") + '</div>')
term = "".join(f'<div class="tl {c}" id="{i}">{escape(t)}</div>' for i, c, t in TERM)
h.append('<div class="scene" id="s3">' + line("t3", "One command finds them.", hl=(1,))
         + '<div class="win mono" id="term"><div class="bar"><i></i><i></i><i></i><span>zsh · demo-app</span></div><div class="code" data-layout-allow-overflow>' + term + '<div class="fade"></div></div></div>'
         + '<div id="count" data-layout-allow-overflow><span class="roll"><span class="col" id="col"><span>0</span><span>1</span><span>2</span><span>3</span></span></span> call sites found</div></div>')
slots = "".join(f'<div class="slot" style="left:{CL + STEP * i}px"><div class="card"><img src="assets/evidence/{f}" alt="" /></div><div class="lab mono">{lab}</div></div>' for i, (f, lab) in enumerate(CARDS))
h.append('<div class="scene" id="s4">' + line("t4", "Each rendered with the props its page passes.", hl=(4,))
         + f'<div id="strip">{slots}</div>'
         + '<div id="decklabs" class="mono">' + "".join(f'<span style="left:{540 + (i - 1) * 341}px">{lab.replace("/page.tsx", "")}</span>' for i, (_, lab) in enumerate(CARDS)) + '</div></div>')
h.append('<div id="end"><img class="mark" src="assets/brand/icon.svg" alt="Arguseye" /><div class="name" id="wordmark" data-layout-allow-overflow>' + "".join(f'<span class="ch">{c}</span>' for c in "Arguseye") + '</div>'
         + f'<div class="line" id="endline" data-layout-allow-overflow>{masked(words_of("Real props from your own code."))}</div>'
         '<div class="meta">VS Code extension · MCP server · free and open source (MIT)</div><div class="url mono" data-var-text="repo-url">github.com/DarkWorldCoder/arguseye</div>'
         '<div class="note">Demo app. Real CLI output and renders.</div></div>')
h.append('</div>')

js = r"""
(function () {
  const tl = gsap.timeline({ paused: true });
  const B = (k) => 0.625 * k;
  const W = (sel) => Array.from(document.querySelectorAll(sel + " .w"));
  function rise(sel, t, gap = 0.06) { W(sel).forEach((w, i) => { gsap.set(w, { yPercent: 115, opacity: 0 }); tl.set(w, { opacity: 1 }, t + i * gap); tl.to(w, { yPercent: 0, duration: 0.55, ease: "expo.out" }, t + i * gap); }); }
  function sink(sel, t, gap = 0.02) { W(sel).forEach((w, i) => { tl.to(w, { yPercent: -115, duration: 0.28, ease: "power3.in" }, t - 0.3 + i * gap); tl.set(w, { opacity: 0 }, t + i * gap + 0.01); }); }
  function seam(out, inn, t) {
    tl.to(out, { x: -130, duration: 0.34, ease: "power4.in" }, t - 0.34);
    tl.to(out, { opacity: 0, duration: 0.2, ease: "none" }, t - 0.2);
    tl.set(inn, { x: 130, opacity: 0.35 }, t);
    tl.to(inn, { x: 0, duration: 0.42, ease: "power4.out" }, t);
    tl.to(inn, { opacity: 1, duration: 0.18, ease: "none" }, t);
  }
  function type(sel, t, d) { const el = document.querySelector(sel); const n = el.textContent.length; gsap.set(el, { clipPath: "inset(0 100% 0 0)" }); tl.to(el, { clipPath: "inset(0 0% 0 0)", duration: d, ease: "steps(" + n + ")" }, t); }
  ["#s2", "#s3", "#s4", "#end"].forEach((s) => gsap.set(s, { opacity: 0 }));

  // S1 (0 - B7): line one reads on frame 0, line two lands on the beat, the JSX types in
  gsap.set("#t1b .w", { yPercent: 115, opacity: 0 });
  W("#t1b").forEach((w, i) => { tl.set(w, { opacity: 1 }, B(0.5) + i * 0.07); tl.to(w, { yPercent: 0, duration: 0.55, ease: "expo.out" }, B(0.5) + i * 0.07); });
  gsap.set("#chip", { opacity: 0, y: 40 });
  tl.to("#chip", { opacity: 1, y: 0, duration: 0.5, ease: "expo.out" }, B(2.2));
  type("#chipcode", B(2.5), 1.1);
  seam("#s1", "#s2", B(7));

  // S2 (B7 - B17): the two real files; each BoardingPass line lights up on a beat
  rise("#t2", B(7) + 0.08, 0.06);
  [["#winA", B(7.2)], ["#winB", B(8)]].forEach(([s, t]) => { gsap.set(s, { opacity: 0, y: 70 }); tl.to(s, { opacity: 1, y: 0, duration: 0.55, ease: "expo.out" }, t); });
  [["#winA-13", B(9.5)], ["#winB-6", B(11)], ["#winB-7", B(12.5)]].forEach(([s, t]) => { gsap.set(s, { "--hl": 0 }); tl.to(s, { "--hl": 1, duration: 0.4, ease: "power2.out" }, t); });
  rise("#cap2", B(13), 0.05);
  seam("#s2", "#s3", B(17));

  // S3 (B17 - B25): one command; each usage row ticks the counter
  rise("#t3", B(17) + 0.08, 0.06);
  type("#J0", B(17.4), 0.5); type("#J0b", B(18.3), 0.4);
  ["#J1", "#J2", "#J3", "#J4", "#J5", "#J6", "#J7", "#J8"].forEach((s) => gsap.set(s, { opacity: 0 }));
  tl.set("#J1", { opacity: 1 }, B(19));
  [[["#J2", "#J3"], B(19.4)], [["#J4", "#J5"], B(20.4)], [["#J6", "#J7", "#J8"], B(21.4)]].forEach(([rows, t], k) => {
    rows.forEach((r, j) => tl.set(r, { opacity: 1 }, t + j * 0.08));
    if (k > 0) tl.to("#col", { yPercent: -25 * (k + 1), duration: 0.32, ease: "back.out(1.5)" }, t);
  });
  gsap.set("#col", { yPercent: -25 });
  gsap.set("#count", { opacity: 0, y: 30 });
  tl.to("#count", { opacity: 1, y: 0, duration: 0.45, ease: "expo.out" }, B(19.4));
  seam("#s3", "#s4", B(25));

  // S4 (B25 - B37): a carousel through the three renders, then the camera pulls back on all three
  rise("#t4", B(25) + 0.08, 0.05);
  gsap.set("#strip", { x: 0, transformOrigin: "CENTERpx 300px" });
  tl.to("#strip", { x: -STEP, duration: 0.7, ease: "power4.inOut" }, B(28.5));
  tl.to("#strip", { x: -2 * STEP, duration: 0.7, ease: "power4.inOut" }, B(31.5));
  tl.to("#strip", { x: -STEP, scale: 0.55, y: 40, duration: 0.9, ease: "expo.inOut" }, B(34.5));
  gsap.set(".slot .lab", { opacity: 1 });
  tl.to(".slot .lab", { opacity: 0, duration: 0.2, ease: "none" }, B(34.5));
  gsap.set("#decklabs span", { opacity: 0, y: 20 });
  tl.to("#decklabs span", { opacity: 1, y: 0, duration: 0.45, ease: "expo.out", stagger: 0.08 }, B(34.5) + 0.7);

  // END (B37): inverse zoom-through arrival
  tl.to("#s4", { scale: 0.8, duration: 0.2, ease: "power3.in" }, B(37) - 0.2);
  tl.to("#s4", { opacity: 0, duration: 0.2, ease: "none" }, B(37) - 0.2);
  tl.set("#end", { scale: 1.25, opacity: 0.15 }, B(37));
  tl.to("#end", { scale: 1, opacity: 1, duration: 0.55, ease: "expo.out" }, B(37));
  document.querySelectorAll("#wordmark .ch").forEach((c, i) => { gsap.set(c, { opacity: 0, y: 34, filter: "blur(6px)" }); tl.to(c, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.4, ease: "expo.out" }, B(37) + 0.15 + i * 0.035); });
  rise("#endline", B(38) + 0.1, 0.07);
  gsap.set("#end .meta", { opacity: 0 }); tl.to("#end .meta", { opacity: 1, duration: 0.3, ease: "none" }, B(38) + 0.3);
  gsap.set("#end .url", { clipPath: "inset(0 100% 0 0)" }); tl.to("#end .url", { clipPath: "inset(0 0% 0 0)", duration: 0.6, ease: "none" }, B(38) + 0.6);
  gsap.set("#end .note", { opacity: 0 }); tl.to("#end .note", { opacity: 1, duration: 0.3, ease: "none" }, B(37) + 0.4);

  window.__timelines = window.__timelines || {};
  window.__timelines["usages"] = tl;
})();
""".replace("CENTER", str(CL + STEP + cw // 2)).replace("STEP", str(STEP))
open(os.path.join(root, "compositions", "usages.html"), "w").write("<template>\n  <style>" + css + "  </style>\n  " + "\n  ".join(h) + "\n  <script>" + js + "  </script>\n</template>\n")

peak = {"sfx_002.mp3": 0.161, "sfx_004.mp3": 0.119, "sfx_003.mp3": 0.455, "sfx_001.mp3": 0.051}
aud = []
def a(src, ev, d, track, vol, name):
    st = max(0.0, ev - peak[src] + 0.033)
    aud.append(f'      <audio id="sfx-{name}" class="clip" src="assets/audio/{src}" data-start="{st:.3f}" data-duration="{d}" data-track-index="{track}" data-volume="{vol}"></audio>')
a("sfx_004.mp3", B(0.5), 0.72, 3, 0.45, "hook")
a("sfx_003.mp3", B(2.5) + 0.1, 1.3, 7, 0.24, "typing1")
a("sfx_002.mp3", B(7), 0.57, 4, 0.3, "seam1")
for i, t in enumerate((B(9.5), B(11), B(12.5))):
    a("sfx_001.mp3", t, 0.36, 5 if i % 2 == 0 else 6, 0.35, f"hl{i}")
a("sfx_002.mp3", B(17), 0.57, 4, 0.3, "seam2")
a("sfx_003.mp3", B(17.4) + 0.1, 1.3, 7, 0.24, "typing2")
for i, t in enumerate((B(19.4), B(20.4), B(21.4))):
    a("sfx_004.mp3", t, 0.72, 3 if i % 2 == 0 else 8, 0.38, f"count{i}")
a("sfx_002.mp3", B(25), 0.57, 4, 0.3, "seam3")
a("sfx_002.mp3", B(28.5), 0.57, 6, 0.28, "card2")
a("sfx_002.mp3", B(31.5), 0.57, 4, 0.28, "card3")
a("sfx_002.mp3", B(34.5), 0.57, 6, 0.3, "pull")
a("sfx_002.mp3", B(37), 0.57, 4, 0.3, "end")
a("sfx_004.mp3", B(37) + 0.3, 0.72, 3, 0.4, "wordmark")
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
      <div id="usages" class="clip" style="z-index:1" data-composition-id="usages" data-composition-src="compositions/usages.html"
           data-start="0" data-duration="{DUR}" data-track-index="1" data-track-kind="graphics" data-width="1080" data-height="1350"></div>
      <audio id="music" class="clip" src="assets/audio/music.wav" data-start="0" data-duration="{DUR}" data-media-start="40.01"
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
