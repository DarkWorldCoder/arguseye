// Captures a real component, rendered by Arguseye's own preview server, as a self-contained 1:1 replica:
// its DOM plus every CSS rule that applies at the capture width (media queries resolved), with fonts and
// images downloaded next to it. The film then animates the real markup and real CSS instead of a screenshot.
//
// node film/scripts/capture-live.mjs <appRoot> <componentFile> <routeFile|-> <width>x<height> <outName> [exportName] [propsJSON]
import { createJiti } from "jiti";
import { chromium } from "playwright-core";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

const [appRootArg, file, routeFile, size, outName, exportName = "default", propsJson = "{}"] = process.argv.slice(2);
const appRoot = path.resolve(appRootArg);
const [width, height] = size.split("x").map(Number);
const repo = path.resolve(import.meta.dirname, "../..");
const outDir = path.join(repo, "film/assets/live");
const resDir = path.join(outDir, "res");
await mkdir(resDir, { recursive: true });

const jiti = createJiti(import.meta.url);
const { createPreviewServer } = await jiti.import(path.join(repo, "src/server/createPreviewServer.ts"));
const server = await createPreviewServer({ root: appRoot });
const target = { file: path.resolve(appRoot, file), exportName, props: JSON.parse(propsJson), ...(routeFile !== "-" ? { route: path.resolve(appRoot, routeFile) } : {}) };
await server.prepare(target.file, undefined, target.route);

const browser = await chromium.launch({ channel: "chromium-headless-shell" }).catch(() => chromium.launch());
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
await page.goto(new URL(server.pageUrl(target, { live: false }), server.url).href);
await page.waitForFunction(() => ["mounted", "error"].includes(window.__CP__?.status), null, { timeout: 120000 });
const status = await page.evaluate(() => ({ status: window.__CP__.status, errors: window.__CP__.errors }));
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(outDir, `${outName}.reference.png`), fullPage: true });

const captured = await page.evaluate(() => {
  const keep = [];
  const fontFaces = [];
  const walk = (rules) => {
    for (const rule of rules) {
      if (rule instanceof CSSFontFaceRule) fontFaces.push(rule.cssText);
      else if (rule instanceof CSSMediaRule) { if (matchMedia(rule.conditionText).matches) walk(rule.cssRules); }
      else if (rule instanceof CSSSupportsRule) { if (CSS.supports(rule.conditionText)) walk(rule.cssRules); }
      else if (rule instanceof CSSImportRule) { if (rule.styleSheet) walk(rule.styleSheet.cssRules); }
      else keep.push(rule.cssText);
    }
  };
  for (const sheet of document.styleSheets) {
    try { walk(sheet.cssRules); } catch { /* cross-origin sheet: skipped */ }
  }
  const root = document.getElementById("root");
  return {
    css: keep.join("\n"),
    fontFaces: fontFaces.join("\n"),
    html: root.innerHTML,
    htmlClass: document.documentElement.className,
    bodyClass: document.body.className,
    bodyStyle: document.body.getAttribute("style") ?? "",
    base: location.href,
    size: { width: root.scrollWidth, height: root.scrollHeight },
  };
});

// Download every url(...) and <img src> the replica needs, and point them at local copies.
const cache = new Map();
async function localize(url) {
  if (!url || url.startsWith("data:") || url.startsWith("#")) return url;
  const abs = new URL(url, captured.base).href;
  if (cache.has(abs)) return cache.get(abs);
  const res = await page.request.get(abs).catch(() => null);
  if (!res || !res.ok()) { cache.set(abs, url); return url; }
  const body = await res.body();
  const ext = (path.extname(new URL(abs).pathname).split("?")[0] || ".bin").slice(0, 8);
  const name = createHash("sha1").update(abs).digest("hex").slice(0, 16) + ext;
  await writeFile(path.join(resDir, name), body);
  const local = `assets/live/res/${name}`;
  cache.set(abs, local);
  return local;
}
async function rewriteCss(css) {
  const urls = [...css.matchAll(/url\((['"]?)([^'")]+)\1\)/g)].map((m) => m[2]);
  for (const u of new Set(urls)) css = css.split(u).join(await localize(u));
  return css;
}
let html = captured.html;
for (const m of new Set([...html.matchAll(/\s(?:src|href)="([^"]+)"/g)].map((x) => x[1]))) {
  if (/\.(png|jpe?g|webp|gif|svg|avif)(\?|$)/i.test(m) || m.startsWith("/@fs/") || m.startsWith("/_next/")) {
    html = html.split(`"${m}"`).join(`"${await localize(m.replaceAll("&amp;", "&"))}"`);
  }
}
html = html.replace(/\ssrcset="[^"]*"/g, "");
const out = {
  source: { appRoot, file, routeFile, width, height, status, capturedWith: "Arguseye preview server (src/server/createPreviewServer.ts)" },
  htmlClass: captured.htmlClass,
  bodyClass: captured.bodyClass,
  bodyStyle: captured.bodyStyle,
  size: captured.size,
  fontFaces: await rewriteCss(captured.fontFaces),
  css: await rewriteCss(captured.css),
  html,
};
await writeFile(path.join(outDir, `${outName}.json`), JSON.stringify(out));
console.log(JSON.stringify({ outName, status, size: captured.size, cssBytes: out.css.length, htmlBytes: html.length, resources: cache.size }));
await browser.close();
await server.close();
