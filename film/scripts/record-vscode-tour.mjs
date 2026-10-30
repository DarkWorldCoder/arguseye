// Records a real VS Code tour with the Arguseye extension on the film's demo app: the preview follows each component
// file as it opens (weather, music, chart, boarding pass, chat), then a live gradient edit on the weather card. Nothing is saved.
// Usage (from the repo root, after `npm run build` and a prior `npm run test:vscode` download):
//   xvfb-run -a -s "-screen 0 1920x1080x24" node film/scripts/record-vscode-tour.mjs film/renders/vscode-tour
import { mkdirSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { _electron as electron } from "playwright-core";

const repo = path.resolve(import.meta.dirname, "../..");
const outDir = path.resolve(process.argv[2] ?? path.join(repo, "film/renders/vscode-tour"));
mkdirSync(outDir, { recursive: true });
const vscodeDir = path.join(repo, ".vscode-test");
const [exe] = readdirSync(vscodeDir).filter((d) => d.startsWith("vscode-linux")).map((d) => path.join(vscodeDir, d, "code"));
const project = path.join(repo, "film/demo-app");
const file = path.join(project, "components/WeatherCard.tsx");

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
  "editor.wordWrap": "on",
  "workbench.editor.enablePreview": false,
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
await app.evaluate(({ BrowserWindow }) => { BrowserWindow.getAllWindows()[0]?.setBounds({ x: 0, y: 0, width: 1920, height: 1080 }); return true; }).catch((e) => console.log("resize skipped", e.message));
await win.waitForTimeout(5000);
await win.keyboard.press("Escape");

async function command(label) {
  await win.keyboard.press("F1");
  await win.waitForTimeout(500);
  await win.keyboard.type(label);
  await win.waitForTimeout(500);
  await win.keyboard.press("Enter");
  await win.waitForTimeout(600);
}
async function open(name) {
  await win.keyboard.press("Control+P");
  await win.waitForTimeout(450);
  await win.keyboard.type(name, { delay: 45 });
  await win.waitForTimeout(450);
  await win.keyboard.press("Enter");
}

await win.keyboard.press("Control+B");
await command("Notifications: Clear All Notifications");
mark("open-preview");
await command("Preview Component");
await win.waitForTimeout(Number(process.env.CP_WAIT_MS ?? 9000));
let panel;
for (let i = 0; i < 30 && !panel; i++) {
  for (const f of win.frames()) { try { if (await f.$("#viewport")) { panel = f; break; } } catch {} }
  if (!panel) await win.waitForTimeout(500);
}
if (panel) { await panel.selectOption("#viewport", "mobile"); console.log("mobile set"); } else console.log("panel frame not found");
await win.waitForTimeout(3500);

mark("weather");
await win.waitForTimeout(2500);
for (const name of ["NowPlaying", "RevenueChart", "BoardingPass", "ChatThread"]) {
  mark("open " + name);
  await open(name + ".tsx");
  await win.waitForTimeout(3200);
}
mark("back to weather");
await open("WeatherCard.tsx");
await win.waitForTimeout(2800);

mark("edit gradient");
await win.keyboard.press("Control+G");
await win.waitForTimeout(350);
await win.keyboard.type("51:93");
await win.keyboard.press("Enter");
await win.waitForTimeout(400);
for (let i = 0; i < 39; i++) await win.keyboard.press("Shift+ArrowRight");
await win.waitForTimeout(600);
await win.keyboard.type("from-orange-400 via-rose-500 to-fuchsia-600", { delay: 70 });
await win.waitForTimeout(3500);
mark("done");

await win.screenshot({ path: path.join(outDir, "last-frame.png") });
writeFileSync(path.join(outDir, "marks.json"), JSON.stringify(marks, null, 1));
await app.close();
console.log("video in", outDir);
