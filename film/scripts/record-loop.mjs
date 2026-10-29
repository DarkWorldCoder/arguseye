// Records the film's agent loop with Arguseye's real renderer, so every line of tool output on screen is real:
// render the Pro pricing card from its call site, apply the agent's edit to its JSX as an unsaved buffer (no file is written),
// render again (changes), apply the fix, render a third time. Writes film/assets/loop/*.json and *.png.
import { createJiti } from "jiti";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const repo = path.resolve(import.meta.dirname, "../..");
const root = path.join(repo, "film/demo-app");
const file = path.join(root, "components/PricingCard.tsx");
const out = path.join(repo, "film/assets/loop");
await mkdir(out, { recursive: true });
const jiti = createJiti(import.meta.url);
const { createRenderer } = await jiti.import(path.join(repo, "src/agent/createRenderer.ts"));
const renderer = await createRenderer({ root });
const original = await readFile(file, "utf8");
const request = { file: path.join(root, "components/PricingCard.tsx"), exportName: "PricingCard", usage: "app/(marketing)/pricing/page.tsx:7", viewport: { width: 390, height: 844 } };
const steps = [
  ["before", original],
  ["broken", original.replace("Choose {plan}", "Choose {plan}, save 20% yearly")],
  ["fixed", original.replace("Choose {plan}", "Save 20% on {plan}")],
];
for (const [name, source] of steps) {
  if (source !== original) renderer.server.updateBuffer(file, source);
  const result = await renderer.render(request);
  await writeFile(path.join(out, `${name}.png`), result.png);
  const { png, ...facts } = result;
  await writeFile(path.join(out, `${name}.json`), JSON.stringify(facts, null, 2));
  console.log(name, JSON.stringify({ errors: facts.errors, changes: facts.changes, ms: facts.ms, layouts: facts.layoutsApplied }));
}
await renderer.close();
