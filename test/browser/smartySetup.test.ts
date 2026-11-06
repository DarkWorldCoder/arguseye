import { expect, it } from "vitest";
import path from "node:path";
import { createRenderer } from "../../src/agent/createRenderer.js";

it("uses project-owned Smarty configuration and replays unsaved helper edits", async () => {
  const root = path.resolve("test/fixtures/php-templates"), renderer = await createRenderer({ root });
  try {
    renderer.server.updateBuffer(path.join(root, "arguseye.templates.json"), JSON.stringify({ version: 1, setup: { smarty: "setup.php" } }));
    renderer.server.updateBuffer(path.join(root, "configured.smarty"), '<h1>{$name|greet|escape}</h1>');
    const setup = '<?php return fn($engine) => ["configure" => function($smarty) { $smarty->registerPlugin("modifier", "greet", fn($name) => "Hello " . $name); }];';
    renderer.server.updateBuffer(path.join(root, "setup.php"), setup);
    const before = await renderer.render({ file: path.join(root, "configured.smarty"), props: { name: "<Ada>" } });
    expect(before.errors).toEqual([]);
    expect(before.snapshot).toContain('heading "Hello <Ada>"');
    renderer.server.updateBuffer(path.join(root, "setup.php"), setup.replace('"Hello "', '"Updated "'));
    const diff = await renderer.diff(before.captureId!);
    expect(diff.after.errors).toEqual([]);
    expect(diff.after.snapshot).toContain('heading "Updated <Ada>"');
    expect(diff.after.template?.dependencies).toContain("setup.php");
  } finally { await renderer.close(); }
});

it("keeps Smarty source timestamps stable across slow compilation and unsaved include edits", async () => {
  const root = path.resolve("test/fixtures/php-templates"), renderer = await createRenderer({ root });
  try {
    renderer.server.updateBuffer(path.join(root, "arguseye.templates.json"), JSON.stringify({ version: 1, setup: { smarty: "setup.php" } }));
    renderer.server.updateBuffer(path.join(root, "slow.smarty"), '<h1>{$name|escape}</h1>{include file="items.smarty"}');
    // Real project compiler filters can span a second; reading a template must not advance its modification time.
    renderer.server.updateBuffer(path.join(root, "setup.php"), '<?php return fn($engine) => ["configure" => function($smarty) { $smarty->registerFilter("pre", function($source) { usleep(1100000); return $source; }); }];');
    const before = await renderer.render({ file: path.join(root, "slow.smarty"), props: { name: "Ada", items: ["Tea"] } });
    expect(before.errors).toEqual([]);
    expect(before.snapshot).toContain('heading "Ada"');
    expect(before.snapshot).toContain("Tea");
    renderer.server.updateBuffer(path.join(root, "items.smarty"), '<p>Updated {$items[0]|escape}</p>');
    const diff = await renderer.diff(before.captureId!);
    expect(diff.after.errors).toEqual([]);
    expect(diff.after.snapshot).toContain("Updated Tea");
    expect(diff.after.sourceRevision).not.toBe(before.sourceRevision);
  } finally { await renderer.close(); }
});
