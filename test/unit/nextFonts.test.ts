import { afterEach, expect, it } from "vitest";
import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createPreviewServer, type PreviewServer } from "../../src/server/createPreviewServer.js";

let server: PreviewServer | undefined;
let root: string | undefined;
afterEach(async () => { await server?.close(); if (root) rmSync(root, { recursive: true, force: true }); });

it("serves cached Next font faces and reconstructs imported root font classes without unrelated built CSS", async () => {
  const fixture = path.resolve("test/fixtures/react-app");
  root = mkdtempSync(path.join(tmpdir(), "arguseye-fonts-"));
  cpSync(fixture, root, { recursive: true, filter: (file) => !/node_modules|\.arguseye/.test(path.relative(fixture, file)) });
  symlinkSync(path.join(fixture, "node_modules"), path.join(root, "node_modules"), "dir");
  writeFileSync(path.join(root, "app/fonts.ts"), 'import { Nunito } from "next/font/google"; const heading = Nunito({variable:"--font-heading", subsets:["latin"]}); export const fonts = `${heading.variable}`;');
  writeFileSync(path.join(root, "app/layout.tsx"), 'import {fonts} from "./fonts"; export default ({children}) => <html className={`${fonts} antialiased`}><body>{children}</body></html>;');
  mkdirSync(path.join(root, ".next/static/css"), { recursive: true });
  writeFileSync(path.join(root, ".next/static/css/fonts.css"), '@font-face{font-family:Nunito;src:url(../media/nunito.woff2) format("woff2");font-weight:200 1000}.nunito_variable{--font-heading:"Nunito"}.nunito_class{font-family:Nunito}body{background:red}');
  server = await createPreviewServer({ root });
  const target = { file: path.join(root, "components/ProductCard.tsx"), exportName: "ProductCard" };
  const html = await fetch(new URL(server.pageUrl(target), server.url)).then(r => r.text());
  expect(html).toContain('class="nunito_variable antialiased"');
  const fontUrl = server.context().globalCssUrls.find(url => url.startsWith("/@next-fonts"));
  expect(fontUrl).toBeDefined();
  const cssModule = await fetch(new URL(fontUrl!, server.url)).then(r => r.text());
  expect(cssModule).toContain("@font-face");
  expect(cssModule).toContain(`/@fs${root}/.next/static/media/nunito.woff2?raw`);
  expect(cssModule).not.toContain("background:red");
  expect(server.warnings().join()).not.toContain("runtime html className");
  expect(server.warnings().join()).not.toContain("Runtime provider input omitted: className");

  // An unknown font remains visibly incomplete instead of silently substituting another family.
  server.updateBuffer(path.join(root, "app/fonts.ts"), 'import { Manrope } from "next/font/google"; const body = Manrope({variable:"--font-body"}); export const fonts = `${body.variable}`;');
  expect(server.context().htmlClass).toBeUndefined();
  expect(server.warnings().join()).toContain("runtime html className");
});
