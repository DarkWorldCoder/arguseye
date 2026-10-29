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
  const any = (await listUsages(file, exportName).catch(() => [] as Usage[])).find((u) => /(^|\/)page\.[jt]sx?:/.test(u.id));
  if (any) return usageFile(any.id);
  if (file.includes(`${path.sep}app${path.sep}`)) return file;
  return defaultRouteFile(root);
}
