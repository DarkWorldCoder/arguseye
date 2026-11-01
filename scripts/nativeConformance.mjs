import { createRequire } from "node:module";
import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, mkdtemp, readFile, writeFile, access, rm } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import os from "node:os";

const require = createRequire(import.meta.url);
const yauzl = createRequire(require.resolve("@vscode/vsce"))("yauzl");
const directory = path.resolve("artifacts/native-conformance"), target = `${process.platform}-${process.arch}`;
const archive = path.join(directory, `arguseye-${target}.vsix`);
await mkdir(directory, { recursive: true });
// Outside the checkout, missing packaged dependencies cannot resolve from its ancestor node_modules.
const extracted = await mkdtemp(path.join(os.tmpdir(), "arguseye-vsix-"));
const record = { platform: process.platform, arch: process.arch, node: process.version, os: os.release(), cpu: os.cpus()[0]?.model, target, status: "running", sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], {encoding: "utf8"}).trim(), package: archive, isolatedExtraction: extracted, codingClients: "Not executed; this job validates native rendering, MCP SDK contracts and the actual extracted VS Code extension." };
const run = (command, args, env = process.env) => new Promise((resolve, reject) => {
  const child = spawn(command, args, { stdio: "inherit", env });
  child.on("error", reject); child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`)));
});
try {
  await run(process.execPath, [require.resolve("@vscode/vsce/vsce"), "package", "--target", target, "--allow-missing-repository", "--readme-path", "README.marketplace.md", "--out", archive]);
  const bytes = await readFile(archive); record.bytes = bytes.length; record.sha256 = createHash("sha256").update(bytes).digest("hex");
  await rm(path.join(directory, "extracted"), { recursive: true, force: true });
  await new Promise((resolve, reject) => yauzl.open(archive, { lazyEntries: true }, (error, zip) => {
    if (error) return reject(error);
    zip.on("error", reject); zip.on("end", resolve);
    zip.on("entry", async (entry) => {
      try {
        const destination = path.resolve(extracted, entry.fileName);
        if (!destination.startsWith(extracted + path.sep)) throw new Error(`Unsafe archive path: ${entry.fileName}`);
        await mkdir(path.dirname(destination), { recursive: true });
        if (entry.fileName.endsWith("/")) { await mkdir(destination, { recursive: true }); zip.readEntry(); return; }
        zip.openReadStream(entry, async (error, stream) => {
          if (error) return reject(error);
          try { await pipeline(stream, createWriteStream(destination)); zip.readEntry(); } catch (error) { reject(error); }
        });
      } catch (error) { reject(error); }
    }); zip.readEntry();
  }));
  const extension = path.join(extracted, "extension");
  for (const file of ["dist/extension.cjs", "dist/cli.mjs", "dist/vite-compatibility-worker.mjs", "node_modules/axe-core/package.json", "node_modules/parse5/package.json", "shims/next/navigation.ts"]) await access(path.join(extension, file));
  record.version = JSON.parse(await readFile(path.join(extension, "package.json"), "utf8")).version;
  await run(process.execPath, ["test/vscode/run.mjs"], { ...process.env, NODE_PATH: "", CP_EXTENSION_PATH: extension });
  record.status = "passed";
} catch (error) { record.status = "failed"; record.error = String(error); process.exitCode = 1; }
if (record.status === "passed") await rm(extracted, { recursive: true, force: true });
await writeFile(path.join(directory, "result.json"), JSON.stringify(record, null, 2) + "\n");
