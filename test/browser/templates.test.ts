import { expect, it } from "vitest";
import path from "node:path";
import { createRenderer } from "../../src/agent/createRenderer.js";

it("renders native Django inheritance and includes from a Python-only project, with replayable data", async () => {
  const root = path.resolve("test/fixtures/python-templates");
  const renderer = await createRenderer({ root });
  try {
    const result = await renderer.render({ file: path.join(root, "card.html"), props: { name: "Ada", items: ["Tea", "Coffee"] } });
    expect(result.errors).toEqual([]);
    expect(result.snapshot).toContain('heading "Hello Ada"');
    expect(result.snapshot).toContain("Tea");
    expect((result as any).template).toMatchObject({ engine: "django", runtime: "python" });
    const diff = await renderer.diff(result.captureId!);
    expect(diff.changedPixels).toBe(0);
  } finally { await renderer.close(); }
});

it("renders the project's Handlebars package and partials, with unsaved dependency edits", async () => {
  const root = path.resolve("test/fixtures/template-app");
  const renderer = await createRenderer({ root });
  try {
    const file = path.join(root, "card.hbs");
    const before = await renderer.render({ file, props: { name: "Ada", items: ["Tea", "Coffee"] } });
    expect(before.errors).toEqual([]);
    expect(before.snapshot).toContain('heading "Hello Ada"');
    expect(before.snapshot).toContain("Tea");
    expect(before.template).toMatchObject({ engine: "handlebars", runtime: "node" });
    renderer.server.updateBuffer(path.join(root, "items.hbs"), '<p>Updated {{items.[0]}}</p>');
    const diff = await renderer.diff(before.captureId!);
    expect(diff.after.errors).toEqual([]);
    expect(diff.after.snapshot).toContain("Updated Tea");
    expect(diff.after.sourceRevision).not.toBe(before.sourceRevision);
    expect(diff.changedPixels).toBeGreaterThan(0);
  } finally { await renderer.close(); }
});

for (const [engine, suffix] of [["mustache", "mustache"], ["ejs", "ejs"], ["pug", "pug"], ["nunjucks", "njk"], ["liquidjs", "liquid"], ["eta", "eta"], ["dot", "dot"], ["jinja2", "jinja"]]) {
  it(`renders native ${engine} output with escaped data and real dependencies`, async () => {
    const root = path.resolve(engine === "jinja2" ? "test/fixtures/python-templates" : "test/fixtures/template-app");
    const renderer = await createRenderer({ root });
    try {
      const result = await renderer.render({ file: path.join(root, "card." + suffix), props: { name: "<Ada>", items: ["Tea", "Coffee"] } });
      expect(result.errors).toEqual([]);
      expect(result.snapshot).toContain('heading "Hello <Ada>"');
      expect(result.snapshot).toContain("Coffee");
      expect(result.template?.engine).toBe(engine);
      if (engine !== "dot") expect(result.template!.dependencies.length).toBeGreaterThan(1);
    } finally { await renderer.close(); }
  });
}

for (const [engine, suffix] of [["twig", "twig"], ["blade", "blade.php"], ["smarty", "smarty"], ["latte", "latte"], ["php", "php"]]) {
  it(`renders ${engine} through the project's PHP environment`, async () => {
    const root = path.resolve("test/fixtures/php-templates"), renderer = await createRenderer({ root });
    try {
      const result = await renderer.render({ file: path.join(root, "card." + suffix), props: { name: "<Ada>", items: ["Tea", "Coffee"] } });
      expect(result.errors).toEqual([]);
      expect(result.snapshot).toContain('heading "Hello <Ada>"');
      expect(result.snapshot).toContain("Coffee");
      expect(result.template).toMatchObject({ engine, runtime: "php" });
    } finally { await renderer.close(); }
  });
}

for (const [engine, suffix] of [["erb", "erb"], ["haml", "haml"], ["slim", "slim"], ["liquid", "liquid"]]) {
  it(`renders native Ruby ${engine} with explicit data`, async () => {
    const root = path.resolve("test/fixtures/ruby-templates"), renderer = await createRenderer({ root });
    try {
      const result = await renderer.render({ file: path.join(root, "card." + suffix), props: { name: "Ada", items: ["Tea", "Coffee"] } });
      expect(result.errors).toEqual([]);
      expect(result.snapshot).toContain('heading "Hello Ada"');
      expect(result.snapshot).toContain("Coffee");
      expect(result.template).toMatchObject({ engine, runtime: "ruby" });
    } finally { await renderer.close(); }
  });
}

for (const engine of ["mako", "tornado"]) {
  it(`renders native ${engine} includes with explicit context`, async () => {
    const root = path.resolve("test/fixtures/python-templates"), renderer = await createRenderer({ root });
    try {
      const result = await renderer.render({ file: path.join(root, "card." + engine), props: { name: "Ada", items: ["Tea", "Coffee"] } });
      expect(result.errors).toEqual([]);
      expect(result.snapshot).toContain('heading "Hello Ada"');
      expect(result.snapshot).toContain("Coffee");
      expect(result.template).toMatchObject({ engine, runtime: "python", stateReset: true });
      expect(result.warnings.join(" ")).toContain("lookup tracing is unavailable");
    } finally { await renderer.close(); }
  });
}

for (const [fixture, suffix, partial, source] of [
  ["python-templates", "html", "items.html", "<p>Changed {{name}}</p>"],
  ["python-templates", "jinja", "items.html", "<p>Changed {{name}}</p>"],
  ["template-app", "mustache", "items.mustache", "<p>Changed {{name}}</p>"],
  ["template-app", "ejs", "items.ejs", "<p>Changed <%= name %></p>"],
  ["template-app", "pug", "items.pug", "p Changed #{name}"],
  ["template-app", "njk", "items.njk", "<p>Changed {{name}}</p>"],
  ["php-templates", "twig", "items.twig", "<p>Changed {{name}}</p>"],
  ["php-templates", "blade.php", "items.blade.php", "<p>Changed {{ $name }}</p>"],
  ["php-templates", "smarty", "items.smarty", "<p>Changed {$name}</p>"],
  ["php-templates", "latte", "items.latte", "<p>Changed {$name}</p>"],
]) {
  it(`invalidates unsaved ${suffix} dependencies and replays baseline data`, async () => {
    const root = path.resolve("test/fixtures", fixture), renderer = await createRenderer({ root });
    try {
      const before = await renderer.render({ file: path.join(root, "card." + suffix), props: { name: "Ada", items: ["Tea"] } });
      expect(before.errors).toEqual([]);
      renderer.server.updateBuffer(path.join(root, partial), source);
      const diff = await renderer.diff(before.captureId!);
      expect(diff.after.errors).toEqual([]);
      expect(diff.after.snapshot).toContain("Changed Ada");
      expect(diff.changedPixels).toBeGreaterThan(0);
      expect(diff.after.sourceRevision).not.toBe(before.sourceRevision);
      expect(diff.after.template?.stateReset).toBe(true);
    } finally { await renderer.close(); }
  });
}

it("keeps missing context and native syntax failures visible and recovers on edit", async () => {
  const root = path.resolve("test/fixtures/python-templates"), renderer = await createRenderer({ root });
  try {
    const file = path.join(root, "card.html");
    const missing = await renderer.render({ file });
    expect(missing.unresolved).toContain("name");
    expect(missing.complete).toBe(false);
    renderer.server.updateBuffer(file, "{% unknown_tag %}");
    const broken = await renderer.render({ file });
    expect(broken.errors.join(" ")).toContain("card.html");
    expect(broken.errors.join(" ")).toContain("unknown_tag");
    renderer.server.updateBuffer(file, "<h1>Recovered {{name}}</h1>");
    const recovered = await renderer.render({ file, props: { name: "Ada" } });
    expect(recovered.errors).toEqual([]);
    expect(recovered.snapshot).toContain("Recovered Ada");
  } finally { await renderer.close(); }
});

it("isolates concurrent contexts and freezes profile data in a baseline", async () => {
  const root = path.resolve("test/fixtures/template-app"), renderer = await createRenderer({ root });
  try {
    const file = path.join(root, "card.hbs");
    const [ada, grace] = await Promise.all([renderer.render({ file, profile: "ada" }), renderer.render({ file, props: { name: "Grace", items: ["Cake"] } })]);
    expect(ada.snapshot).toContain("Hello Ada");
    expect(grace.snapshot).toContain("Hello Grace");
    expect(grace.snapshot).not.toContain("Coffee");
    renderer.server.updateBuffer(path.join(root, "arguseye.templates.json"), JSON.stringify({ version: 1, profiles: { ada: { name: "Changed profile" } } }));
    const diff = await renderer.diff(ada.captureId!);
    expect(diff.after.target.props).toEqual(ada.target.props);
    expect(diff.after.snapshot).toContain("Hello Ada");
  } finally { await renderer.close(); }
});

it("keeps warm native template rendering within p95 100 ms over 20 renders", async () => {
  const root = path.resolve("test/fixtures/template-app"), renderer = await createRenderer({ root });
  try {
    const target = { file: path.join(root, "card.hbs"), profile: "ada" };
    const first = await renderer.render(target);
    expect(first.errors).toEqual([]); expect(first.complete).toBe(true);
    const samples = [];
    for (let i = 0; i < 20; i++) samples.push((await renderer.render(target)).ms);
    const p95 = [...samples].sort((a,b) => a-b)[18];
    console.log("Template warm render", JSON.stringify({ p95, samples }));
    expect(p95).toBeLessThanOrEqual(100);
  } finally { await renderer.close(); }
});

it("applies unsaved native setup code instead of fingerprinting an edit it did not execute", async () => {
  const root = path.resolve("test/fixtures/template-app"), renderer = await createRenderer({ root });
  try {
    renderer.server.updateBuffer(path.join(root, "arguseye.templates.json"), JSON.stringify({ version: 1, setup: { handlebars: "setup.mjs" } }));
    const target = { file: path.join(root, "helpers.hbs"), props: { name: "Ada" } };
    const before = await renderer.render(target); expect(before.errors).toEqual([]); expect(before.snapshot).toContain("Hello Ada");
    renderer.server.updateBuffer(path.join(root, "setup.mjs"), 'export default () => ({ helpers: { greet: name => "Updated " + name } });');
    const diff = await renderer.diff(before.captureId!);
    expect(diff.after.errors).toEqual([]); expect(diff.after.snapshot).toContain("Updated Ada");
  } finally { await renderer.close(); }
});

for (const [fixture, engine, file, setup, source] of [
  ["python-templates", "jinja2", "helpers.jinja", "setup.py", 'def setup(engine):\n    return {"filters": {"greet": lambda name: "Updated " + name}}\n'],
  ["php-templates", "twig", "helpers.twig", "setup.php", '<?php return fn($engine) => ["filters" => ["greet" => fn($name) => "Updated " . $name]];'],
  ["ruby-templates", "erb", "helpers.erb", "setup.rb", '->(engine) { {"modules" => [Module.new { define_method(:greet) { |name| "Updated " + name } }]} }'],
]) {
  it(`executes unsaved ${engine} setup through its real native runtime`, async () => {
    const root = path.resolve("test/fixtures", fixture), renderer = await createRenderer({ root });
    try {
      renderer.server.updateBuffer(path.join(root, "arguseye.templates.json"), JSON.stringify({ version: 1, setup: { [engine]: setup } }));
      const target = { file: path.join(root, file), props: { name: "Ada" } };
      const before = await renderer.render(target); expect(before.errors).toEqual([]); expect(before.snapshot).toContain("Hello Ada");
      renderer.server.updateBuffer(path.join(root, setup), source);
      const diff = await renderer.diff(before.captureId!);
      expect(diff.after.errors).toEqual([]); expect(diff.after.snapshot).toContain("Updated Ada");
    } finally { await renderer.close(); }
  });
}

it("uses explicitly registered partial aliases and native Handlebars partial blocks", async () => {
  const root = path.resolve("test/fixtures/template-app"), renderer = await createRenderer({ root });
  try {
    renderer.server.updateBuffer(path.join(root, "arguseye.templates.json"), JSON.stringify({ version: 1, options: { handlebars: { partials: { branded: "_frame.hbs" } } } }));
    const result = await renderer.render({ file: path.join(root, "block.hbs"), props: { name: "Ada" } });
    expect(result.errors).toEqual([]); expect(result.snapshot).toContain('heading "Ada"'); expect(result.snapshot).toContain("Block Ada");
    expect(result.template?.dependencies).toContain("_frame.hbs");
  } finally { await renderer.close(); }
});

it("reports only the current target's dependencies when reusing a compiled partial", async () => {
  const root = path.resolve("test/fixtures/template-app"), renderer = await createRenderer({ root });
  try {
    await renderer.render({ file: path.join(root, "card.hbs"), props: { name: "Ada", items: ["Tea"] } });
    const file = path.join(root, "other.hbs");
    renderer.server.updateBuffer(file, "<article>{{> items}}</article>");
    const result = await renderer.render({ file, props: { items: ["Coffee"] } });
    expect(result.errors).toEqual([]);
    expect(result.snapshot).toContain("Coffee");
    expect(result.template?.dependencies.sort()).toEqual(["items.hbs", "other.hbs"]);
  } finally { await renderer.close(); }
});

it("loads real project fonts and keeps failed font faces visible in render evidence", async () => {
  const root = path.resolve("test/fixtures/template-app"), renderer = await createRenderer({ root });
  try {
    const file = path.join(root, "fonts.hbs"), target = { file, props: { name: "Ada" } };
    const loaded = await renderer.render(target);
    expect(loaded.errors).toEqual([]);
    expect(loaded.snapshot).toContain("Font loaded");
    expect(loaded.complete).toBe(true);
    const unchanged = await renderer.diff(loaded.captureId!);
    expect(unchanged.after.snapshot).toContain("Font loaded");
    expect(unchanged.changedPixels).toBe(0);
    renderer.server.updateBuffer(file, '<style>@font-face{font-family:"Missing Template Font";src:url(/missing-template-font.woff2)}h1{font-family:"Missing Template Font",sans-serif}</style><h1>Hello {{name}}</h1>');
    const failed = await renderer.render(target);
    expect(failed.warnings.join(" ")).toContain('Missing Template Font');
    expect(failed.complete).toBe(false);
    renderer.server.updateBuffer(file, '<style>@font-face{font-family:"Corrupt Template Font";src:url(data:font/woff2;base64,aW52YWxpZA==)}h1{font-family:"Corrupt Template Font",sans-serif}</style><h1>Hello {{name}}</h1>');
    const corrupt = await renderer.render(target);
    expect(corrupt.warnings.join(" ")).toContain('Corrupt Template Font');
    expect(corrupt.complete).toBe(false);
    expect((await renderer.diff(failed.captureId!)).status).toBe("incomplete");
  } finally { await renderer.close(); }
});

it("preserves PHP view file locations when rendering unsaved native source", async () => {
  const root = path.resolve("test/fixtures/php-templates"), renderer = await createRenderer({ root });
  try {
    const file = path.join(root, "location.php");
    const saved = await renderer.render({ file, props: { name: "Ada" } });
    expect(saved.errors).toEqual([]);
    expect(saved.snapshot).toContain("location.php");
    expect(saved.snapshot).toContain("Included Ada");
    renderer.server.updateBuffer(file, '<?php declare(strict_types=1); require __DIR__ . "/location-items.php"; ?><p>Unsaved <?= basename(__FILE__) ?></p>');
    const changed = await renderer.diff(saved.captureId!);
    expect(changed.after.errors).toEqual([]);
    expect(changed.after.snapshot).toContain("Unsaved location.php");
    expect(changed.after.snapshot).toContain("Included Ada");
    expect(changed.changedPixels).toBeGreaterThan(0);
  } finally { await renderer.close(); }
});
