import { cpSync, existsSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";

/**
 * Fixture-local packages (`test/fixtures/<app>/packages/<name>`) become real entries in that app's
 * node_modules (copied, not linked), so they are bundled like any npm package.
 */
export default function setup() {
  const fixtures = path.resolve("test/fixtures");
  for (const app of readdirSync(fixtures)) {
    const packages = path.join(fixtures, app, "packages");
    if (!existsSync(packages)) continue;
    for (const name of readdirSync(packages)) {
      const target = path.join(fixtures, app, "node_modules", name);
      rmSync(target, { recursive: true, force: true });
      cpSync(path.join(packages, name), target, { recursive: true });
    }
  }
}
