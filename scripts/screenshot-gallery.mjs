// Capture genuine extension-host states; edits remain unsaved and are discarded on exit.
// After build: xvfb-run -a node scripts/screenshot-gallery.mjs [workspace] [file] [old text] [new text]
import { mkdtemp, mkdir, writeFile, readFile, access, copyFile } from "node:fs/promises";
import { readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { _electron as electron } from "playwright-core";

const repo = path.resolve(import.meta.dirname, "..");
const work = await mkdtemp(path.join(os.tmpdir(), "arguseye-gallery-"));
const fixture = path.resolve(process.argv[2] ?? path.join(repo, "test/fixtures/react-app"));
const component = path.resolve(fixture, process.argv[3] ?? "components/ProductCard.tsx");
const oldText = process.argv[4] ?? "Add to cart";
const newText = process.argv[5] ?? "Buy now";
const production = process.argv.length > 2;
const prefix = process.env.CP_GALLERY_PREFIX ?? "vscode";
const single = process.env.CP_GALLERY_SINGLE === "1";
const output = path.join(repo, "docs/assets");
await mkdir(path.join(work, "profile/User"), { recursive: true });
await writeFile(path.join(work, "profile/User/settings.json"), JSON.stringify({
  "workbench.startupEditor": "none", "workbench.colorTheme": "Default Dark Modern",
  "editor.fontSize": 15, "editor.minimap.enabled": false,
  "window.restoreWindows": "none", "workbench.tips.enabled": false,
}));
await writeFile(path.join(work, "suite.cjs"), `
const vscode = require('vscode');
const fs = require('node:fs/promises');
const path = require('node:path');
const work = ${JSON.stringify(work)};
const pause = ms => new Promise(r => setTimeout(r, ms));
async function capture(name, facts) {
  await pause(1000);
  await fs.writeFile(path.join(work, name + '.tmp'), JSON.stringify(facts));
  await fs.rename(path.join(work, name + '.tmp'), path.join(work, name + '.ready'));
  for (let i = 0; i < 600; i++) {
    try { await fs.access(path.join(work, name + '.done')); return; } catch {}
    await pause(100);
  }
  throw new Error('Screenshot timed out: ' + name);
}
exports.run = async function () {
  try {
    const api = await vscode.extensions.getExtension('ayushniroula.arguseye').activate();
    const document = await vscode.workspace.openTextDocument(${JSON.stringify(component)});
    const initialEditor = await vscode.window.showTextDocument(document, vscode.ViewColumn.One);
    const relevant = document.positionAt(Math.max(0, document.getText().indexOf(${JSON.stringify(oldText)})));
    initialEditor.revealRange(new vscode.Range(relevant, relevant.translate(8)), vscode.TextEditorRevealType.InCenter);
    await vscode.commands.executeCommand('componentPreview.open');
    await api.waitForStatus(s => s.status === 'mounted', 90000);
    await vscode.commands.executeCommand('workbench.action.closeAuxiliaryBar');
    await vscode.commands.executeCommand('workbench.action.closeSidebar');
    await vscode.commands.executeCommand('notifications.clearAll');
    if (!${production}) {
      await api.setUsage('app/page.tsx:9');
      await api.waitForStatus(s => s.text.includes('Wireless Headphones'), 10000);
    }
    await capture('desktop', { state: api.state(), status: api.status() });
    if (${single}) return;
    await api.setViewport('mobile');
    if (!${production}) {
      await api.setUsage('app/page.tsx:10');
      await api.waitForStatus(s => s.text.includes('USB-C Cable'), 10000);
    }
    await capture('mobile', { state: api.state(), status: api.status() });
    await api.captureBaseline();
    const editor = await vscode.window.showTextDocument(document, vscode.ViewColumn.One);
    const index = document.getText().indexOf(${JSON.stringify(oldText)});
    if (index < 0) throw new Error('Edit text was not found in the source');
    const at = document.positionAt(index);
    await editor.edit(e => e.replace(new vscode.Range(at, at.translate(0, ${oldText.length})), ${JSON.stringify(newText)}));
    await api.waitForStatus(s => s.text.includes(${JSON.stringify(newText)}), 10000);
    const diff = await api.compareChanges();
    if (diff.changedPixels <= 0) throw new Error('Expected real visual difference');
    await capture('compare', { state: api.state(), status: api.status(), comparison: { status: diff.status, changedPixels: diff.changedPixels, changedPercent: diff.changedPercent, warnings: diff.after.warnings }, unsaved: document.isDirty });
    await fs.writeFile(path.join(work, 'finished'), 'ok');
  } catch (error) { await fs.writeFile(path.join(work, 'error'), String(error.stack)); throw error; }
};
`);
const exe = readdirSync(path.join(repo, ".vscode-test"))
  .filter(name => name.startsWith("vscode-linux-x64-"))
  .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))[0];
const app = await electron.launch({
  executablePath: path.join(repo, ".vscode-test", exe, "code"),
  args: [`--extensionDevelopmentPath=${repo}`, `--extensionTestsPath=${path.join(work, "suite.cjs")}`,
    `--user-data-dir=${path.join(work, "profile")}`, "--disable-extensions", "--disable-workspace-trust",
    "--skip-welcome", "--skip-release-notes", "--no-sandbox", fixture],
});
try {
  const win = await app.firstWindow();
  await win.setViewportSize({ width: 1600, height: 1000 });
  for (const name of (single ? ["desktop"] : ["desktop", "mobile", "compare"])) {
    let facts;
    for (let i = 0; i < 900; i++) {
      try { await access(path.join(work, "error")); throw new Error(await readFile(path.join(work, "error"), "utf8")); }
      catch (error) { if (error.code !== "ENOENT") throw error; }
      try { facts = JSON.parse(await readFile(path.join(work, name + ".ready"), "utf8")); break; }
      catch (error) { if (error.code !== "ENOENT") throw error; }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (!facts) throw new Error("No extension-host state for " + name);
    const typography = [];
    for (const frame of win.frames().filter(frame => frame.url().startsWith("http://127.0.0.1:"))) {
      typography.push(await frame.evaluate(async () => {
        await document.fonts.ready;
        return { body: getComputedStyle(document.body).fontFamily, heading: document.querySelector("h1,h2") ? getComputedStyle(document.querySelector("h1,h2")).fontFamily : null, loaded: [...document.fonts].filter(font => font.status === "loaded").map(font => font.family) };
      }));
    }
    const filename = prefix + "-" + name + ".png";
    await win.screenshot({ path: path.join(output, filename) });
    await copyFile(path.join(output, filename), path.join(repo, "assets", filename));
    await writeFile(path.join(work, name + ".done"), "ok");
    console.log(name, JSON.stringify({ viewport: facts.state.viewport, usage: facts.state.usage, errors: facts.status.errors, comparison: facts.comparison, unsaved: facts.unsaved, typography }));
  }
  console.log("Capture evidence:", work);
} finally { await app.close(); }
