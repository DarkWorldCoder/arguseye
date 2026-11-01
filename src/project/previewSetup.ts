import { existsSync } from "node:fs";
import path from "node:path";

/** Finds opt-in browser setup files; project code is read and executed only by the preview engine. */
export function previewSetup(root: string) {
  const find = (names: string[]) => names.map((name) => path.join(root, name)).find((file) => existsSync(file));
  return {
    jsx: find(["arguseye.setup.tsx", "arguseye.setup.jsx", "arguseye.setup.ts", "arguseye.setup.js"]),
    vue: find(["arguseye.setup.vue.ts", "arguseye.setup.vue.js"]),
  };
}
