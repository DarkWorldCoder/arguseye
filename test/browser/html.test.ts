import { expect, it } from "vitest";
import path from "node:path";
import { readFileSync } from "node:fs";
import { createRenderer } from "../../src/agent/createRenderer.js";

const root = path.resolve("test/fixtures/web-components-app"), file = path.join(root, "index.html");

it("renders installed Lit components and shadow DOM without React, with props and fresh instance state", async () => {
  const renderer = await createRenderer({ root });
  try {
    const target = { file, props: { label: "Property input" } };
    const first = await renderer.render(target);
    expect(first.errors).toEqual([]);
    expect(first.snapshot).toContain('heading "Property input"');
    expect(first.snapshot).toContain('button "Count 0"');
    expect(first.complete).toBe(true);
    const clicked = await renderer.render({ ...target, actions: [{ click: { role: "button", name: "Count 0" } }] });
    expect(clicked.snapshot).toContain('button "Count 1"');
    expect((await renderer.diff(first.captureId!)).changedPixels).toBe(0);
    expect((await renderer.render(target)).snapshot).toContain('button "Count 0"');
    const css = path.join(root, "style.css");
    renderer.server.updateBuffer(css, readFileSync(css, "utf8").replace("220, 240, 230", "30, 80, 210"));
    expect((await renderer.diff(first.captureId!)).changedPixels).toBeGreaterThan(0);
    renderer.server.updateBuffer(css, undefined);
    renderer.server.updateBuffer(file, readFileSync(file, "utf8").replace('<html lang="en">', '<html lang="en" style="--card-bg:rgb(0,0,0)">'));
    expect((await renderer.diff(first.captureId!)).changedPixels).toBeGreaterThan(0);
    renderer.server.updateBuffer(file, undefined);
    const script = path.join(root, "card.ts");
    renderer.server.updateBuffer(script, readFileSync(script, "utf8").replace("<h1>", "<h2>").replace("</h1>", "</h2>"));
    const edited = await renderer.render(target);
    expect(edited.errors).toEqual([]);
    expect(edited.snapshot).toContain("[level=2]");
    expect(edited.reloaded).toBe(true);
    const times = [];
    for (let i=0;i<20;i++) times.push((await renderer.render(target)).ms);
    expect(times.sort((a,b)=>a-b)[18]).toBeLessThanOrEqual(100);
  } finally { await renderer.close(); }
});

it("runs inline modules through project import resolution and reports undefined elements and unsupported classic scripts", async () => {
  const renderer = await createRenderer({ root });
  try {
    renderer.server.updateBuffer(file, '<script type="module">import {html, LitElement} from "lit"; customElements.define("inline-card", class extends LitElement {render(){return html`<p>Inline module</p>`}});</script><inline-card></inline-card>');
    const inline = await renderer.render({ file });
    expect(inline.errors).toEqual([]);
    expect(inline.snapshot).toContain("Inline module");
    renderer.server.updateBuffer(file, '<not-registered>Pending custom element</not-registered>');
    const missing = await renderer.render({ file });
    expect(missing.complete).toBe(false);
    expect(missing.warnings.join()).toContain("not-registered");
    renderer.server.updateBuffer(file, '<script>document.write("legacy");</script><p>Static content</p>');
    expect((await renderer.render({ file })).errors.join()).toContain("Classic scripts");
  } finally { await renderer.close(); }
});

it("reports pending animation work inside shadow DOM and does not mistake cancelled callbacks for motion", async () => {
  const renderer = await createRenderer({ root });
  try {
    renderer.server.updateBuffer(file, '<script type="module">customElements.define("moving-box",class extends HTMLElement {connectedCallback(){const root=this.attachShadow({mode:"open"});root.innerHTML="<p>Moving shadow</p>";const tick=()=>{root.querySelector("p").style.opacity=String(Math.random());requestAnimationFrame(tick)};requestAnimationFrame(tick)}});</script><moving-box></moving-box>');
    const moving = await renderer.render({ file });
    expect(moving.errors).toEqual([]);
    expect(moving.complete).toBe(false);
    expect(moving.warnings.join()).toContain("Animation-frame callbacks remain pending");
    renderer.server.updateBuffer(file, '<script type="module">customElements.define("steady-box",class extends HTMLElement {connectedCallback(){this.attachShadow({mode:"open"}).innerHTML="<p>Steady shadow</p>";const id=requestAnimationFrame(()=>{});cancelAnimationFrame(id)}});</script><steady-box></steady-box>');
    const steady = await renderer.render({ file });
    expect(steady.errors).toEqual([]);
    expect(steady.complete).toBe(true);
  } finally { await renderer.close(); }
});
