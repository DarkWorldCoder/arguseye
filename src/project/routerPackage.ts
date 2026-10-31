import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

export type RouterPackage = "react-router" | "react-router-dom";

/**
 * The package the project's routing components come from, when it can create a data router (React Router 6.4+
 * or 7; Remix v2 renders with react-router-dom). Read from the project's own dependencies, so the preview's
 * router and the components' Link and hooks share one copy of the router contexts.
 */
export function routerPackage(root: string): RouterPackage | undefined {
  let declared: Record<string, string> = {};
  try {
    const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
    declared = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies };
  } catch {
    return undefined;
  }
  const candidates: RouterPackage[] =
    "react-router-dom" in declared || "@remix-run/react" in declared ? ["react-router-dom", "react-router"] : "react-router" in declared ? ["react-router"] : [];
  const require = createRequire(path.join(root, "package.json"));
  for (const name of candidates) {
    try {
      const { version } = JSON.parse(readFileSync(require.resolve(`${name}/package.json`), "utf8"));
      const [major, minor] = String(version).split(".").map(Number);
      if (major > 6 || (major === 6 && minor >= 4)) return name;
    } catch {}
  }
  return undefined;
}
