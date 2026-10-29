// Opens a fixture component in the test VS Code with the extension, triggers the preview and saves a screenshot.
// Usage: DISPLAY=:99 node scripts/screenshot-vscode.mjs out.png [workspace] [file]   (needs `npm run build` and a prior test:vscode download)
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { _electron as electron } from "playwright-core";

const repo = path.resolve(import.meta.dirname, "..");
const vscodeDir = path.join(repo, ".vscode-test");
const [exe] = (await import("node:fs")).readdirSync(vscodeDir).filter((d) => d.startsWith("vscode-linux")).map((d) => path.join(vscodeDir, d, "code"));
const out = process.argv[2] ?? "vscode-panel.png";
const fixture = path.resolve(process.argv[3] ?? path.join(repo, "test/fixtures/react-app"));
const file = path.resolve(fixture, process.argv[4] ?? "components/ProductCard.tsx");

const app = await electron.launch({
  executablePath: exe,
  args: [
    `--extensionDevelopmentPath=${repo}`, "--disable-extensions", "--disable-workspace-trust", "--skip-welcome", "--skip-release-notes",
    `--user-data-dir=${mkdtempSync(path.join(os.tmpdir(), "cp-vscode-"))}`, "--no-sandbox", fixture, file,
  ],
});
const win = await app.firstWindow();
await win.setViewportSize({ width: 1600, height: 1000 }).catch(() => {});
await win.waitForTimeout(6000);
// Through the command palette, which works regardless of where focus landed after launch.
await win.keyboard.press("F1");
await win.waitForTimeout(800);
await win.keyboard.type("Preview Component");
await win.waitForTimeout(800);
await win.keyboard.press("Enter");
await win.waitForTimeout(Number(process.env.CP_WAIT_MS ?? 8000));
await win.screenshot({ path: out });
console.log("saved", out);
await app.close();
