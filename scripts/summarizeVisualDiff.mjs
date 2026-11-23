import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

// Only explicit identifiers and counters enter the Markdown; project diagnostics remain in JSON artifacts.
const directory = process.argv[2];
if (!directory) throw new Error("Pass the visual evidence directory.");
await mkdir(directory, { recursive: true });
const read = async (name) => { try { return JSON.parse(await readFile(path.join(directory, name), "utf8")); } catch { return undefined; } };
const base = await read("base/matrix.json"), head = await read("head/matrix.json");
const sha = (value) => /^[a-f0-9]{40,64}$/.test(value ?? "") ? value : "unavailable";
const count = (value) => Number.isSafeInteger(value) && value >= 0 ? value : 0;
const identities = (report) => report?.cells?.flatMap((cell) => {
  const render = cell.diff?.after ?? cell.render;
  return render?.environment ? [{ environment: render.environment, build: render.build }] : [];
}) ?? [];
const revision = { base: sha(process.env.BASE_SHA), head: sha(process.env.HEAD_SHA) };
let planSha256;
try { planSha256 = createHash("sha256").update(await readFile(path.join(directory, "plan.json"))).digest("hex"); } catch { /* Missing base plans remain explicitly unbaselined. */ }
await writeFile(path.join(directory, "run.json"), JSON.stringify({
  version: 1, revision, plan: { file: "base/test/fixtures/react-app/arguseye-matrix.json", sha256: planSha256 ?? null },
  base: base ? { status: base.status, coverage: base.coverage, identities: identities(base) } : { status: "not-captured" },
  head: head ? { status: head.status, coverage: head.coverage, identities: identities(head) } : { status: "not-compared" },
  artifacts: ["plan.json", "base/matrix.json", "head/matrix.json", "base-command.json", "head-command.json"],
}, null, 2));
console.log(`## Component visual comparison\n\nBase: \`${revision.base}\`\n\nHead: \`${revision.head}\`\n\nPlan: base revision's React fixture matrix. All registered cases run; automatic changed-component discovery is not implemented.\n`);
console.log("| Revision | Requested | Executed | Compared | Changed | Failed | Incomplete | Not run | Not compared |\n| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
for (const [label, report] of [["Base", base], ["Head", head]]) {
  const c = report?.coverage ?? {};
  console.log(`| ${label} | ${["requested", "executed", "compared", "changed", "failed", "incomplete", "notRun", "notCompared"].map((key) => count(c[key])).join(" | ")} |`);
}
if (!base || !head) console.log("\nEvidence is missing. This run does not establish an unchanged UI. See the failed job step.");
console.log("\nDownload **component-visual-diffs** for run.json, matrix.json, per-case capture.json and available before/after/diff PNGs. Accessibility text differences are change evidence, not an accessibility compliance verdict.");
