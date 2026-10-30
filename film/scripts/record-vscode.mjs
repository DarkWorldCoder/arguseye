// Records a real VS Code session with the Arguseye extension on the film's demo app: open PricingCard.tsx, run
// Preview Component, type an edit that breaks the button on the preview, then type the fix. Nothing is saved.
// Usage (from the repo root, after `npm run build` and a prior `npm run test:vscode` download):
//   xvfb-run -a -s "-screen 0 1920x1080x24" node film/scripts/record-vscode.mjs film/renders/vscode-raw
import { mkdirSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { _electron as electron } from "playwright-core";

const repo = path.resolve(import.meta.dirname, "../..");
const outDir = path.resolve(process.argv[2] ?? path.join(repo, "film/renders/vscode-raw"));
mkdirSync(outDir, { recursive: true });
const vscodeDir = path.join(repo, ".vscode-test");
const [exe] = readdirSync(vscodeDir).filter((d) => d.startsWith("vscode-linux")).map((d) => path.join(vscodeDir, d, "code"));
const project = path.join(repo, "film/demo-app");
const file = path.join(project, "components/PricingCard.tsx");

const userData = mkdtempSync(path.join(os.tmpdir(), "arguseye-rec-"));
mkdirSync(path.join(userData, "User"), { recursive: true });
writeFileSync(path.join(userData, "User/settings.json"), JSON.stringify({
  "window.zoomLevel": 1,
  "editor.fontSize": 16,
  "editor.renderValidationDecorations": "off",
  "typescript.validate.enable": false,
  "javascript.validate.enable": false,
  "problems.decorations.enabled": false,
  "workbench.editor.decorations.badges": false,
  "workbench.editor.decorations.colors": false,
  "window.title": "${activeEditorShort}${separator}${rootName}",
  "workbench.secondarySideBar.defaultVisibility": "hidden",
  "chat.disableAIFeatures": true,
  "workbench.layoutControl.enabled": false,
  "editor.minimap.enabled": false,
  "editor.cursorBlinking": "solid",
  "workbench.startupEditor": "none",
  "workbench.tips.enabled": false,
  "workbench.activityBar.location": "hidden",
  "window.commandCenter": false,
  "breadcrumbs.enabled": false,
  "files.autoSave": "off",
  "security.workspace.trust.enabled": false,
  "update.mode": "none",
  "telemetry.telemetryLevel": "off",
  "chat.commandCenter.enabled": false,
}));

const marks = [];
const t0 = Date.now();
const mark = (label) => { marks.push({ label, t: (Date.now() - t0) / 1000 }); console.log(label, marks.at(-1).t); };

const app = await electron.launch({
  executablePath: exe,
  args: [
    `--extensionDevelopmentPath=${repo}`, "--disable-extensions", "--disable-workspace-trust", "--skip-welcome",
    "--skip-release-notes", `--user-data-dir=${userData}`, "--no-sandbox", project, file,
  ],
  recordVideo: { dir: outDir, size: { width: 1920, height: 1080 } },
});
const win = await app.firstWindow();
await win.waitForTimeout(2500);
await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; w?.setBounds({ x: 0, y: 0, width: 1920, height: 1080 }); return true; }).catch((e) => console.log("resize skipped", e.message));
await win.waitForTimeout(5000);
await win.keyboard.press("Escape");

async function goTo(line, col) {
  await win.keyboard.press("Control+G");
  await win.waitForTimeout(400);
  await win.keyboard.type(`${line}:${col}`);
  await win.keyboard.press("Enter");
  await win.waitForTimeout(300);
}

mark("open-preview");
await win.keyboard.press("F1");
await win.waitForTimeout(600);
await win.keyboard.type("Preview Component");
await win.waitForTimeout(500);
await win.keyboard.press("Enter");
await win.waitForTimeout(Number(process.env.CP_WAIT_MS ?? 9000));
// Hide the explorer so code and preview share the frame.
await win.keyboard.press("Control+B");
for (const command of ["View: Close Secondary Side Bar", "Notifications: Clear All Notifications"]) {
  await win.keyboard.press("F1");
  await win.waitForTimeout(500);
  await win.keyboard.type(command);
  await win.waitForTimeout(500);
  await win.keyboard.press("Enter");
  await win.waitForTimeout(600);
}
// The panel is a webview: pick the Pro card's real usage and the phone viewport through its own controls.
let panel;
for (let i = 0; i < 30 && !panel; i++) {
  for (const f of win.frames()) { try { if (await f.$("#viewport")) { panel = f; break; } } catch {} }
  if (!panel) await win.waitForTimeout(500);
}
if (panel) {
  const options = await panel.$$eval("#usage option", (os) => os.map((o) => ({ v: o.value, t: o.textContent })));
  const pro = options.find((o) => /page\.tsx:7/.test(o.t ?? ""));
  if (pro) await panel.selectOption("#usage", pro.v);
  await win.waitForTimeout(2500);
  await panel.selectOption("#viewport", "mobile");
  await win.waitForTimeout(3000);
  console.log("panel set", pro?.t);
} else console.log("panel frame not found");
// Put the cursor on the label so the scroll position is stable before the edits.
await goTo(42, 22);
await win.waitForTimeout(1500);

mark("edit-label");
await win.keyboard.type(", save 20% yearly", { delay: 85 });
await win.waitForTimeout(2600);
mark("label-broken");

mark("edit-width");
await goTo(38, 25);
for (let i = 0; i < 9; i++) await win.keyboard.press("Shift+ArrowRight");
await win.waitForTimeout(500);
await win.keyboard.type("w-full", { delay: 110 });
await win.waitForTimeout(2800);
mark("width-fixed");

mark("edit-shape");
await goTo(39, 16);
for (let i = 0; i < 10; i++) await win.keyboard.press("Shift+ArrowRight");
await win.waitForTimeout(400);
await win.keyboard.type("rounded-full", { delay: 100 });
await win.waitForTimeout(2800);
mark("shape-done");

await win.screenshot({ path: path.join(outDir, "last-frame.png") });
writeFileSync(path.join(outDir, "marks.json"), JSON.stringify(marks, null, 1));
await app.close();
console.log("video in", outDir);
