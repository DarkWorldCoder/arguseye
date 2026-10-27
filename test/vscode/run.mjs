import path from "node:path";
import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";
import { runTests } from "@vscode/test-electron";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../..");

// The suite runs inside VS Code's extension host, which loads CommonJS, so bundle it first.
const bundle = await rolldown({ input: path.join(here, "suite.ts"), platform: "node", external: ["vscode"] });
await bundle.write({ dir: path.join(repo, "dist-test"), format: "cjs", entryFileNames: "suite.cjs" });
await bundle.close();

await runTests({
  extensionDevelopmentPath: process.env.CP_EXTENSION_PATH ?? repo,
  extensionTestsPath: path.join(repo, "dist-test/suite.cjs"),
  extensionTestsEnv: { CP_FIXTURE_ROOT: path.join(repo, "test/fixtures/react-app"), CP_HOLD_MS: process.env.CP_HOLD_MS },
  launchArgs: [path.join(repo, "test/fixtures/react-app"), "--disable-extensions", "--disable-workspace-trust"],
});
