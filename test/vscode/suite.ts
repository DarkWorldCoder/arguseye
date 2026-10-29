import * as assert from "node:assert/strict";
import * as path from "node:path";
import * as vscode from "vscode";
import type { PreviewApi } from "../../src/extension/extension.js";

const root = process.env.CP_FIXTURE_ROOT!;
const card = path.join(root, "components/ProductCard.tsx");

/** Entry point for @vscode/test-electron: runs the checks and throws on the first failure. */
export async function run(): Promise<void> {
  const extension = vscode.extensions.getExtension("ayushniroula.arguseye");
  assert.ok(extension, "extension is installed in the test host");
  const api: PreviewApi = await extension.activate();

  // Opening a component file and running the command shows it, rendered, beside the editor.
  const document = await vscode.workspace.openTextDocument(card);
  await vscode.window.showTextDocument(document);
  await vscode.commands.executeCommand("componentPreview.open");
  const shown = await api.waitForStatus((s) => s.status === "mounted", 20000);
  assert.equal(shown.file, card);
  assert.deepEqual(shown.errors, []);
  // The first mount takes the first usage the index lists (by path, so app/deals/page.tsx comes before
  // app/page.tsx); check that it is a real usage and that its props are what rendered, whichever it is.
  const first = api.state()!;
  assert.equal(first.exportName, "ProductCard");
  assert.equal(first.propsSource, "usage", "first mount uses real props; got " + JSON.stringify({ status: shown, state: first }));
  assert.ok(first.usage && first.usages.some((u) => u.id === first.usage), "first mount names its usage; got " + JSON.stringify(first));
  assert.ok(shown.text.includes(String(first.props.title)), `shown with the props of ${first.usage}; got ${JSON.stringify(shown.text)}`);
  assert.match(shown.text, /Add to cart \(0\)/);

  // The panel knows the component's props (from its type) and lets the caller pick which usage renders.
  assert.deepEqual(first.schema.map((p) => `${p.name}${p.required ? "" : "?"}:${p.kind}`), ["title:string", "price:number", "tags?:array", "onSale?:boolean"]);
  assert.ok(first.usages.some((u) => u.id === "app/page.tsx:9"), "app/page.tsx:9 is indexed; got " + JSON.stringify(first.usages.map((u) => u.id)));
  await api.setUsage("app/page.tsx:9");
  const headphones = await api.waitForStatus((s) => /Wireless Headphones/.test(s.text), 5000);
  assert.deepEqual(headphones.errors, []);
  assert.match(headphones.text, /Add to cart \(0\)/);
  const state = api.state()!;
  assert.equal(state.usage, "app/page.tsx:9");
  assert.deepEqual(state.props, { title: "Wireless Headphones", price: 99, tags: ["audio", "bluetooth"], onSale: true });
  await api.setUsage("app/page.tsx:10");
  await api.waitForStatus((s) => /USB-C Cable/.test(s.text), 5000);
  await api.setViewport("mobile");
  assert.equal(api.state()!.viewport, "mobile");
  await api.setUsage("app/page.tsx:9");
  await api.setProps({ ...state.props, title: "Desk Lamp", price: 12.5 });
  const edited = await api.waitForStatus((s) => /Desk Lamp/.test(s.text) && /\$12\.50/.test(s.text), 5000);
  assert.deepEqual(edited.errors, []);

  const baseline = await api.captureBaseline();
  assert.ok(baseline.captureId);

  // Typing in the editor (no save) updates the preview.
  const editor = await vscode.window.showTextDocument(document, vscode.ViewColumn.One);
  const at = document.positionAt(document.getText().indexOf("Add to cart"));
  await editor.edit((e) => e.replace(new vscode.Range(at, at.translate(0, "Add to cart".length)), "Buy now"));
  const updated = await api.waitForStatus((s) => /Buy now \(0\)/.test(s.text) && /Desk Lamp/.test(s.text), 5000);
  assert.deepEqual(updated.errors, []);
  const diff = await api.compareChanges();
  assert.equal(diff.status, "changed");
  assert.ok(diff.after.snapshot.includes("Buy now"));
  assert.ok(diff.changedPixels > 0);

  // Switching to another component file follows along.
  const page = path.join(root, "app/page.tsx");
  await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(page));
  const followed = await api.waitForStatus((s) => s.file === page && s.status === "mounted", 10000);
  assert.match(followed.text, /Hi Ayush/);
  console.log("SUITE OK:", JSON.stringify({ first: `${first.usage}: ${shown.text.slice(0, 40)}`, headphones: headphones.text.slice(0, 40), updated: updated.text.slice(0, 40), followed: followed.text.slice(0, 20) }));

  // For screenshots: keep the window up after the checks (CP_HOLD_MS=15000 npm run test:vscode).
  if (process.env.CP_HOLD_MS) await new Promise((r) => setTimeout(r, Number(process.env.CP_HOLD_MS)));
}
