import path from "node:path";
import { defaultRouteFile } from "./appContext.js";
import type { Usage } from "../usages/findUsages.js";

/**
 * The page whose layouts and templates should wrap a render of `file`: the usage's page, else a page that uses
 * the component, else the file itself when it lives under app/, else the project's most common route.
 */
export async function routeFor(
  root: string,
  file: string,
  exportName: string | undefined,
  usageId: string | undefined,
  listUsages: (file: string, exportName?: string) => Promise<Usage[]>,
): Promise<string | undefined> {
  const usageFile = (id: string) => path.resolve(root, id.split(":")[0]);
  if (usageId) return usageFile(usageId);
  const usages = await listUsages(file, exportName).catch(() => [] as Usage[]);
  // An App Router page, else a pages-router page (not _app/_document), that renders the component.
  const page = usages.find((u) => /(^|\/)page\.[jt]sx?:/.test(u.id)) ?? usages.find((u) => /(^|\/)pages\/(?!_)[^:]+\.[jt]sx?:/.test(u.id));
  if (page) return usageFile(page.id);
  if (file.includes(`${path.sep}app${path.sep}`)) return file;
  return defaultRouteFile(root);
}

/**
 * The URL a Next page file serves and its sample params: route groups dropped, dynamic segments filled with
 * "1" (catch-alls with "a"), e.g. app/(shop)/cart/[id]/page.tsx → { pathname: "/cart/1", params: { id: "1" } }.
 */
export function routePath(root: string, file: string | undefined): { pathname: string; pattern: string; params: Record<string, string | string[]> } {
  const rel = file ? path.relative(root, file).split(path.sep).join("/").replace(/^src\//, "") : "";
  const app = rel.match(/^app\/(.*?)(?:^|\/)?(page|layout|template)\.[jt]sx?$/);
  const pages = !app && rel.match(/^pages\/(.*?)\.[jt]sx?$/);
  const raw = app ? app[1] : pages ? pages[1].replace(/(^|\/)index$/, "") : "";
  const params: Record<string, string | string[]> = {};
  const kept = raw.split("/").filter((s) => s && !/^\(.*\)$/.test(s) && !s.startsWith("@"));
  const segments = kept.map((s) => {
    const dynamic = s.match(/^\[{1,2}(\.\.\.)?(\w+)\]{1,2}$/);
    if (!dynamic) return s;
    params[dynamic[2]] = dynamic[1] ? ["a"] : "1";
    return dynamic[1] ? "a" : "1";
  });
  return { pathname: "/" + segments.join("/"), pattern: "/" + kept.join("/"), params };
}
