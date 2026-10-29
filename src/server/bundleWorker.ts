import { DepBundler } from "./depBundler.js";

/**
 * Builds a dependency bundle in its own process and exits: Rolldown's working memory (over 1 GB for a large
 * union of packages) goes back to the OS instead of staying in the long-lived preview server. The parent
 * then reads the finished bundle from the on-disk cache.
 */
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", async () => {
  const { root, specs } = JSON.parse(input) as { root: string; specs: string[] };
  const deps = new DepBundler(root);
  for (const spec of specs) deps.add(spec);
  try {
    await deps.ensureBuilt({ inProcess: true });
    process.exit(0);
  } catch (error) {
    process.stderr.write(String((error as Error).message ?? error));
    process.exit(1);
  }
});
