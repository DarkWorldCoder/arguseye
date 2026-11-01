import { existsSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { createResolver } from "./resolver.js";
import { SHIMS_DIR } from "./shims.js";

const within = (root: string, file: string) => {
  const relative = path.relative(root, file);
  return relative === "" || (relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative));
};

/** A rejected path is an HTTP boundary failure, not a compiler or component error. */
export class FileAccessError extends Error {}

/** Bounds preview reads to selected source, declared packages, runtime shims and explicitly approved roots. */
export function createFileAccess(root: string, additionalRoots: string[] = []) {
  const canonical = (file: string): string => {
    try { return realpathSync.native(file); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      const parent = path.dirname(file);
      if (parent === file) throw error;
      return path.join(canonical(parent), path.basename(file));
    }
  };
  const roots = [root, SHIMS_DIR, ...additionalRoots].map((dir) => canonical(path.resolve(dir)));
  const resolver = createResolver();
  // Workspace and hoisted packages may live outside root. Only declared package roots are approved,
  // not the entire parent node_modules or workspace (which may contain unrelated projects).
  try {
    const manifest = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
    const names = Object.keys({ ...manifest.dependencies, ...manifest.devDependencies, ...manifest.optionalDependencies, ...manifest.peerDependencies });
    for (const name of names) {
      const entry = resolver.resolveFileSync(path.join(root, "package.json"), name).path;
      if (!entry) continue;
      let dir = path.dirname(canonical(entry));
      while (true) {
        const file = path.join(dir, "package.json");
        if (existsSync(file)) {
          try { if (JSON.parse(readFileSync(file, "utf8")).name === name) { roots.push(dir); break; } } catch {}
        }
        const parent = path.dirname(dir); if (parent === dir) break; dir = parent;
      }
    }
  } catch { /* Missing or invalid package metadata is reported by project inspection/rendering. */ }
  const assert = (file: string, publicOnly = false) => {
    if (typeof file !== "string" || !path.isAbsolute(file) || file.includes("\0")) throw new FileAccessError(`Invalid preview file: ${String(file)}`);
    const target = canonical(file);
    const allowed = publicOnly ? [canonical(path.join(root, "public"))] : roots;
    if (!allowed.some((dir) => within(dir, target))) throw new FileAccessError(`File outside allowed preview roots: ${file}`);
  };
  return { assert };
}
