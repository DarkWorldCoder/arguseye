import { expect, it } from "vitest";
import path from "node:path";
import { readFileSync } from "node:fs";
import { createRenderer } from "../../src/agent/createRenderer.js";

const root = path.resolve("test/fixtures/widget-app"), widget = path.join(root, "widget.js"), embed = path.join(root, "embed.html");

it("runs a classic embed script in a fresh page per render and captures what it mounts in a shadow root", async () => {
  const renderer = await createRenderer({ root });
  try {
    const first = await renderer.render({ file: widget });
    expect(first.errors).toEqual([]);
    expect(first.snapshot).toContain('heading "Support"');
    expect(first.snapshot).toContain("How can we help?");
    expect(first.snapshot).toContain('button "Open chat"');
    expect(first.snapshot).toContain("Script: widget.js");
    expect(first.snapshot).toContain("Loaded 1 time(s)");
    expect(first.propsSource).toBe("none");
    expect(first.complete).toBe(true);
    // The capture is the widget in the bottom-right corner, not the empty page above it.
    const width = first.png.readUInt32BE(16), height = first.png.readUInt32BE(20);
    expect(width).toBeLessThan(400);
    expect(height).toBeLessThan(400);
    // The second render runs the script again on a clean page: no global, no "already loaded" guard leaks over.
    const second = await renderer.render({ file: widget, props: { title: "Sales", "data-greeting": "Hi there" } });
    expect(second.errors).toEqual([]);
    expect(second.snapshot).toContain("Loaded 1 time(s)");
    expect(second.snapshot).toContain('heading "Sales"');
    expect(second.snapshot).toContain("Hi there");
    expect(second.propsSource).toBe("given");
    expect((await renderer.diff(first.captureId!)).changedPixels).toBe(0);
  } finally { await renderer.close(); }
});

it("runs classic scripts in .html files in document order, with currentScript attributes and document.write", async () => {
  const renderer = await createRenderer({ root });
  try {
    const first = await renderer.render({ file: embed });
    expect(first.errors).toEqual([]);
    expect(first.snapshot).toContain('heading "Pricing"');
    expect(first.snapshot).toContain('heading "Sales"');
    expect(first.snapshot).toContain("Hi from the embed snippet");
    expect(first.snapshot).toContain("Loaded 1 time(s)");
    expect((await renderer.render({ file: embed })).snapshot).toContain("Loaded 1 time(s)");
    renderer.server.updateBuffer(embed, '<script>document.write("<p>Written by script</p>");</script><p>Static content</p>');
    const written = await renderer.render({ file: embed });
    expect(written.errors).toEqual([]);
    expect(written.snapshot).toMatch(/Written by script[\s\S]*Static content/);
  } finally { await renderer.close(); }
});

it("returns classic script failures as structured errors with the script's location", async () => {
  const renderer = await createRenderer({ root });
  try {
    const source = readFileSync(widget, "utf8");
    renderer.server.updateBuffer(widget, source.replace('var script = document.currentScript;', 'var script = document.currentScript;\n  throw new Error("Widget config missing: siteId");'));
    const thrown = await renderer.render({ file: widget });
    expect(thrown.errors.join()).toContain("Widget config missing: siteId");
    expect(thrown.errorLocations?.[0]?.generated).toMatchObject({ file: widget, line: 4 });
    renderer.server.updateBuffer(widget, "(function () { var = 1; })();");
    const syntax = await renderer.render({ file: widget });
    expect(syntax.errors.join()).toContain("SyntaxError");
    expect(syntax.errorLocations?.[0]?.generated.file).toBe(widget);
    renderer.server.updateBuffer(widget, undefined);
    renderer.server.updateBuffer(embed, '<script src="missing.js"></script><p>Host</p>');
    const missing = await renderer.render({ file: embed });
    expect(missing.errors.join()).toContain("missing.js");
    renderer.server.updateBuffer(embed, undefined);
    renderer.server.updateBuffer(widget, source.replace('mode: "open"', 'mode: "closed"'));
    const closed = await renderer.render({ file: widget });
    expect(closed.errors).toEqual([]);
    expect(closed.warnings.join()).toContain("1 closed shadow root");
    expect(closed.complete).toBe(false);
  } finally { await renderer.close(); }
});
