import { readFileSync } from "node:fs";

/** Identifies the installed build in both source tests and bundled MCP/editor entrypoints. */
export const packageVersion: string = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
