import { expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createPreviewServer, type PreviewServer } from "../../src/server/createPreviewServer.js";

it("serves CSS using the configured plugin's installed PostCSS when the project has no top-level PostCSS", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "cp-nested-postcss-"));
  const plugin = path.join(root, "node_modules/project-css-plugin");
  mkdirSync(plugin, { recursive: true });
  writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "nested-postcss-app", dependencies: { "project-css-plugin": "1.0.0" } }));
  writeFileSync(path.join(plugin, "package.json"), JSON.stringify({ name: "project-css-plugin", version: "1.0.0", main: "index.cjs" }));
  writeFileSync(path.join(plugin, "index.cjs"), 'module.exports = () => ({postcssPlugin:"project-colour", Declaration(decl){if(decl.value === "project-colour") decl.value="rgb(12, 34, 56)"}});');
  // The installed PostCSS and its dependencies are visible only from this plugin, as in pnpm's strict layout.
  symlinkSync(path.resolve("test/fixtures/tw3-app/node_modules"), path.join(plugin, "node_modules"), "junction");
  writeFileSync(path.join(root, "postcss.config.cjs"), 'module.exports={plugins:{"project-css-plugin":{}}};');
  const file = path.join(root, "style.css");
  writeFileSync(file, ".card { color: project-colour; }");
  let server: PreviewServer | undefined;
  try {
    server = await createPreviewServer({ root });
    const response = await fetch(server.url + server.moduleUrl(file));
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("rgb(12, 34, 56)");
  } finally { await server?.close(); rmSync(root, { recursive: true, force: true }); }
});
