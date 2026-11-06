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
