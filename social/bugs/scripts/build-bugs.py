import json
import os
out_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "compositions", "bugs.html")
def masked(words, cls=lambda w,i:""):
    return "".join(f'<span class="m"><span class="w{(" "+cls(w,i)) if cls(w,i) else ""}">{w}</span></span>' for i,w in enumerate(words))
# bug specs: canvas placement of a stagebox (card coords scaled by s)
bugs = [
 dict(id="b1", n="01", title="One long word.", cmd="render_component NowPlaying.tsx", arg="title: \"Donaudampfschifffahrts…\"",
      broken="bug-np", fixed="fix-np", host=390, s=1.3, left=540-340*1.3/2, top=400, ring=(190,338,226,64),
      chips=[("-","<h3 className=\"text-xl\">"),("+","<h3 className=\"truncate text-xl\">"),("+","min-w-0 flex-1")]),
 dict(id="b2", n="02", title="Empty data crashes it.", cmd="render_component RevenueChart.tsx", arg="points: []",
      broken=None, fixed="fix-chart", host=390, s=2.0, left=540-360*2.0/2, top=470, ring=(8,40,344,150),
      chips=[("+","if (points.length < 2)"),("+","  return <EmptyState />")]),
 dict(id="b3", n="03", title="A pasted link.", cmd="render_component ChatThread.tsx", arg="text: \"https://preview.acme.dev/build/7f3c…\"",
      broken="bug-chat", fixed="fix-chat", host=390, s=2.2, left=540-340*2.2/2, top=470, ring=(150,128,196,62),
      chips=[("+","[overflow-wrap:anywhere]")]),
 dict(id="b4", n="04", title="Cut off on a small phone.", cmd="render_component WeatherCard.tsx", arg="viewport: 320",
      broken="bug-weather", fixed="fix-weather", host=320, s=2.1, left=540-320*2.1/2, top=450, ring=(250,-6,80,316),
      chips=[("-","w-[340px]"),("+","w-full max-w-[340px]")]),
]
B = lambda k: 0.625*k
css = """
#root { position: absolute; inset: 0; overflow: hidden; background: radial-gradient(circle at 12% 8%, rgba(249,115,22,.10), transparent 42%), radial-gradient(circle at 92% 88%, rgba(108,112,201,.16), transparent 46%), linear-gradient(165deg, #ffffff 0%, #f5f7fc 48%, #eceffb 100%); font-family: "Inter", sans-serif; color: #0f172a; }
.mono { font-family: "JetBrains Mono", monospace; }
.title { position: absolute; left: 0; right: 0; text-align: center; font-weight: 700; letter-spacing: -0.02em; z-index: 5; }
.t-big { font-size: 66px; line-height: 1.1; }
.m { display: inline-block; overflow: hidden; vertical-align: top; padding-bottom: 0.08em; margin-bottom: -0.08em; }
.w { display: inline-block; white-space: pre; }
.iris { color: #ea580c; } .ok { color: #15803d; }
#t0 { top: 110px; } #t0b { top: 110px; }
#grid { position: absolute; left: 70px; top: 330px; width: 940px; height: 920px; display: grid; grid-template-columns: 1fr 1fr; gap: 26px; }
.cell { position: relative; border-radius: 26px; background: #ffffff; box-shadow: 0 18px 44px rgba(15,23,42,.10); overflow: hidden; }
.cell .mini { position: absolute; transform-origin: 0 0; }
.cell .cring { position: absolute; border: 5px solid #ea580c; border-radius: 16px; }
.errmini { position: absolute; inset: 60px 24px; border-radius: 18px; background: #0b1222; padding: 24px; font-size: 28px; line-height: 1.5; color: #f87171; }
.bug { position: absolute; inset: 0; opacity: 0; }
.tag { position: absolute; left: 0; right: 0; top: 70px; text-align: center; }
.tag .pill { display: inline-block; padding: 8px 22px; border-radius: 999px; background: #fff1e8; color: #c2410c; font-weight: 800; font-size: 30px; letter-spacing: .08em; }
.btitle { top: 135px; }
.cmd { position: absolute; left: 60px; right: 60px; top: 245px; text-align: center; font-size: 28px; color: #475569; white-space: nowrap; overflow: hidden; }
.cmd .fn { color: #4f46a5; }
.stagebox { position: absolute; transform-origin: 0 0; }
.host { position: absolute; left: 0; top: 0; }
.ring { position: absolute; border: 3px solid #ea580c; border-radius: 12px; }
.vp { position: absolute; left: 0; top: 0; width: 320px; height: 304px; border-right: 2px dashed #ea580c; }
.vplabel { position: absolute; right: 4px; top: -26px; font-size: 14px; color: #c2410c; }
.err { position: absolute; left: 0; top: 0; width: 360px; height: 230px; border-radius: 14px; background: #0b1222; padding: 18px 20px; font-size: 14px; line-height: 1.55; color: #e2e8f0; box-shadow: 0 16px 36px rgba(15,23,42,.25); }
.err .lbl { color: #f59e0b; } .err .red { color: #f87171; } .err .dim { color: #64748b; }
.err .chip { display: inline-block; margin-top: 8px; padding: 2px 10px; border-radius: 999px; background: rgba(248,113,113,.15); color: #fca5a5; }
.chips { position: absolute; left: 60px; right: 60px; bottom: 70px; display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; }
.chip2 { padding: 10px 18px; border-radius: 14px; font-size: 28px; }
.chip2.minus { background: #fee2e2; color: #b91c1c; } .chip2.plus { background: #dcfce7; color: #15803d; }
.check { position: absolute; width: 96px; height: 96px; border-radius: 50%; background: #16a34a; color: #fff; font-size: 60px; font-weight: 800; display: grid; place-items: center; box-shadow: 0 14px 30px rgba(22,163,74,.35); }
#end { position: absolute; inset: 0; opacity: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
#end .mark { width: 150px; height: 150px; }
#end .name { margin-top: 30px; font-size: 104px; font-weight: 800; letter-spacing: -0.04em; }
#end .ch { display: inline-block; }
#end .line { margin-top: 18px; font-size: 44px; font-weight: 700; letter-spacing: -0.01em; max-width: 860px; line-height: 1.2; text-wrap: balance; }
#end .meta { margin-top: 34px; font-size: 30px; color: #64748b; }
#end .url { margin-top: 18px; font-size: 32px; color: #4f46a5; }
"""
html = []
html.append('<div id="root" data-composition-id="bugs" data-width="1080" data-height="1350">')
# hook grid of the four broken states
cells = [
 ('bug-np', 0.62, 30, 0, None),
 (None, 0, 0, 0, 'chart'),
 ('bug-chat', 1.05, 22, 70, None),
 ('bug-weather', 1.2, 33, 50, None),
]
html.append('<div id="grid">')
cring = [(300-30*0.62+0,0,0,0)]
for i,(name,sc,l,t,kind) in enumerate(cells):
    if kind=='chart':
        html.append(f'<div class="cell" id="c{i}"><div class="errmini mono">errors<br/>TypeError: undefined is not iterable<br/><span style="color:#94a3b8">RevenueChart.tsx:35:19</span></div><div class="cring" style="left:24px;top:64px;width:409px;height:190px"></div></div>')
    else:
        ring = {'bug-np':(l+190*sc-6, t+338*sc-6, 226*sc+12, 64*sc+12), 'bug-chat':(l+150*sc-6, t+128*sc-6, 196*sc+12, 62*sc+12), 'bug-weather':(l+250*sc-6, t-6, 80*sc+12, 316*sc)}[name]
        html.append(f'<div class="cell" id="c{i}"><div class="mini" style="left:{l}px;top:{t}px;transform:scale({sc})"><div class="host" data-layout-ignore data-replica="{name}" data-w="{390 if name!="bug-weather" else 320}"></div></div><div class="cring" style="left:{ring[0]:.0f}px;top:{ring[1]:.0f}px;width:{ring[2]:.0f}px;height:{ring[3]:.0f}px"></div></div>')
html.append('</div>')
html.append(f'<div class="title t-big" id="t0" data-layout-allow-overflow>{masked(["Your ","agent ","said "])}<span class="m"><span class="w ok">“Done ✓”</span></span></div>')
html.append(f'<div class="title t-big" id="t0b" data-layout-allow-overflow>{masked(["It ","missed "])}<span class="m"><span class="w iris" id="four">4 </span></span>{masked(["bugs."])}</div>')
for b in bugs:
    html.append(f'<div class="bug" id="{b["id"]}">')
    html.append(f'<div class="tag" data-layout-allow-overflow><span class="m"><span class="w"><span class="pill">BUG {b["n"]}</span></span></span></div>')
    html.append(f'<div class="title t-big btitle" data-layout-allow-overflow>{masked([w+" " for w in b["title"].split(" ")[:-1]]+[b["title"].split(" ")[-1]])}</div>')
    html.append(f'<div class="cmd mono"><span class="fn">{b["cmd"].split(" ")[0]}</span> {b["cmd"].split(" ",1)[1]} <span>{b["arg"].replace("<","&lt;")}</span></div>')
    html.append(f'<div class="stagebox" style="left:{b["left"]:.1f}px;top:{b["top"]}px;transform:scale({b["s"]})" data-layout-allow-overflow>')
    if b["broken"]:
        html.append(f'<div class="host broken" data-layout-ignore data-replica="{b["broken"]}" data-w="{b["host"]}"></div>')
    else:
        html.append('<div class="err mono broken"><div class="dim">render_component → result</div><div class="lbl" style="margin-top:6px">errors</div><div class="red">TypeError: undefined is not iterable</div><div class="dim">at RevenueChart (RevenueChart.tsx:35:19)</div><div class="chip">complete: false</div></div>')
    html.append(f'<div class="host fixed" data-layout-ignore data-replica="{b["fixed"]}" data-w="{b["host"]}"></div>')
    if b["id"]=="b4":
        html.append('<div class="vp"><div class="vplabel mono">320 px</div></div>')
    r=b["ring"]
    html.append(f'<div class="ring" style="left:{r[0]}px;top:{r[1]}px;width:{r[2]}px;height:{r[3]}px"></div>')
    html.append('</div>')
    html.append('<div class="chips mono">'+"".join(f'<span class="chip2 {"minus" if s=="-" else "plus"}">{s} {t.replace("<","&lt;")}</span>' for s,t in b["chips"])+'</div>')
    html.append(f'<div class="check" style="left:{b["left"]+ (340 if b["id"]!="b2" else 360)*b["s"]-60:.0f}px;top:{b["top"]-40}px">✓</div>')
    html.append('</div>')
html.append('<div id="end"><img class="mark" src="assets/brand/icon.svg" alt="Arguseye" /><div class="name" id="wordmark" data-layout-allow-overflow>'+"".join(f'<span class="ch">{c}</span>' for c in "Arguseye")+'</div>'
            f'<div class="line" id="endline" data-layout-allow-overflow>{masked("Catch |them |before |your |users |do.".split("|"))}</div>'
            '<div class="meta">Renders React, Next.js and Vue components · no dev server</div><div class="url mono" data-var-text="repo-url">github.com/DarkWorldCoder/arguseye</div></div>')
html.append('</div>')
js = r"""
(function () {
  const tl = gsap.timeline({ paused: true });
  const B = (k) => 0.625 * k;
  const R = window.__REPLICAS;
  document.querySelectorAll("[data-replica]").forEach((h) => { const r = mountReplica(h, R[h.dataset.replica], Number(h.dataset.w)); r.extra.textContent = ".r-html,.r-body{background:transparent !important}"; });
  const W = (sel) => Array.from(document.querySelectorAll(sel + " .w"));
  function rise(sel, t, gap = 0.06) { W(sel).forEach((w, i) => { gsap.set(w, { yPercent: 115 }); tl.to(w, { yPercent: 0, duration: 0.55, ease: "expo.out" }, t + i * gap); }); }
  function sink(sel, t, gap = 0.025) { W(sel).forEach((w, i) => { tl.to(w, { yPercent: -115, duration: 0.28, ease: "power3.in" }, t - 0.28 + i * gap); tl.set(w, { opacity: 0 }, t + i * gap + 0.01); }); }
  function exitLeft(sel, t) { tl.to(sel, { x: -130, duration: 0.3, ease: "power4.in" }, t - 0.3); tl.to(sel, { opacity: 0, duration: 0.22, ease: "none" }, t - 0.24); }
  function enterLeft(sel, t) { tl.set(sel, { x: 130, opacity: 0.35 }, t); tl.to(sel, { x: 0, duration: 0.34, ease: "power4.out" }, t); tl.to(sel, { opacity: 1, duration: 0.2, ease: "none" }, t); }
  const draw = (sel, t) => { gsap.set(sel, { clipPath: "inset(0 100% 100% 0 round 12px)" }); tl.to(sel, { clipPath: "inset(0 0% 0% 0 round 12px)", duration: 0.38, ease: "power2.out" }, t); };

  // HOOK: frame 0 = the four broken renders + "Your agent said “Done ✓”"
  gsap.set("#t0b .w", { yPercent: 115 });
  document.querySelectorAll("#grid .cring").forEach((r, i) => draw(r, B(1.5) + i * 0.12));
  sink("#t0", B(3.2));
  rise("#t0b", B(3.2) + 0.02);
  tl.fromTo("#four", { scale: 1.8 }, { scale: 1, duration: 0.5, ease: "expo.out", immediateRender: false }, B(3.2) + 0.08);
  sink("#t0b", B(6));
  exitLeft("#grid", B(6));

  // four bugs, 7 beats each: tag + title rise, the call types, ring draws, rack-focus swap to the real fix
  const ids = ["b1", "b2", "b3", "b4"];
  ids.forEach((id, k) => {
    const S = B(6 + 7 * k), q = "#" + id;
    enterLeft(q, S);
    rise(q + " .tag", S + 0.02); rise(q + " .btitle", S + 0.1);
    gsap.set(q + " .cmd", { clipPath: "inset(0 100% 0 0)" });
    tl.to(q + " .cmd", { clipPath: "inset(0 0% 0 0)", duration: 0.5, ease: "none" }, S + B(1));
    gsap.set(q + " .fixed", { opacity: 0 });
    draw(q + " .ring", S + B(2));
    // rack-focus: blur spike on the stage hides a one-frame swap (cut-the-curve §5)
    tl.to(q + " .stagebox", { filter: "blur(10px)", scale: "+=0", duration: 0.18, ease: "power2.in" }, S + B(3.5) - 0.18);
    tl.set(q + " .broken", { opacity: 0 }, S + B(3.5));
    tl.set(q + " .fixed", { opacity: 1 }, S + B(3.5));
    tl.set(q + " .ring", { opacity: 0 }, S + B(3.5));
    if (id === "b4") tl.set(q + " .vp", { borderRightColor: "#16a34a" }, S + B(3.5));
    tl.to(q + " .stagebox", { filter: "blur(0px)", duration: 0.22, ease: "power2.out" }, S + B(3.5));
    gsap.set(q + " .chip2", { opacity: 0, y: 18 });
    tl.to(q + " .chip2", { opacity: 1, y: 0, duration: 0.4, stagger: 0.08, ease: "expo.out" }, S + B(3.5) + 0.1);
    gsap.set(q + " .check", { scale: 0, opacity: 0 });
    tl.to(q + " .check", { scale: 1, opacity: 1, duration: 0.45, ease: "back.out(1.7)" }, S + B(4.5));
    if (k < 3) exitLeft(q, B(6 + 7 * (k + 1)));
  });

  // END: inverse zoom-through arrival, wordmark letter by letter
  tl.to("#b4", { scale: 0.8, duration: 0.2, ease: "power3.in" }, B(34) - 0.2);
  tl.to("#b4", { opacity: 0, duration: 0.2, ease: "none" }, B(34) - 0.2);
  tl.set("#end", { scale: 1.25, opacity: 0.15 }, B(34));
  tl.to("#end", { scale: 1, opacity: 1, duration: 0.55, ease: "expo.out" }, B(34));
  document.querySelectorAll("#wordmark .ch").forEach((c, i) => { gsap.set(c, { opacity: 0, y: 34, filter: "blur(6px)" }); tl.to(c, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.4, ease: "expo.out" }, B(34) + 0.15 + i * 0.035); });
  rise("#endline", B(35) + 0.1, 0.06);
  gsap.set("#end .meta", { opacity: 0 }); tl.to("#end .meta", { opacity: 1, duration: 0.3, ease: "none" }, B(36));
  gsap.set("#end .url", { clipPath: "inset(0 100% 0 0)" }); tl.to("#end .url", { clipPath: "inset(0 0% 0 0)", duration: 0.6, ease: "none" }, B(36) + 0.3);

  window.__timelines = window.__timelines || {};
  window.__timelines["bugs"] = tl;
})();
"""
doc = "<template>\n  <style>" + css + "  </style>\n  " + "\n  ".join(html) + "\n  <script>" + js + "  </script>\n</template>\n"
open(out_path, "w").write(doc)
print("written", len(doc))
