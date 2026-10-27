import * as assert from "node:assert/strict";
import * as path from "node:path";
import * as vscode from "vscode";
import type { PreviewApi } from "../../src/extension/extension.js";

const root = process.env.CP_FIXTURE_ROOT!;
const card = path.join(root, "components/ProductCard.tsx");

/** Entry point for @vscode/test-electron: runs the checks and throws on the first failure. */
export async function run(): Promise<void> {
  const extension = vscode.extensions.getExtension("ayushniroula.component-preview");
  assert.ok(extension, "extension is installed in the test host");
  const api: PreviewApi = await extension.activate();

  // Opening a component file and running the command shows it, rendered, beside the editor.
  const document = await vscode.workspace.openTextDocument(card);
  await vscode.window.showTextDocument(document);
  await vscode.commands.executeCommand("componentPreview.open");
  const shown = await api.waitForStatus((s) => s.status === "mounted", 20000);
  assert.equal(shown.file, card);
  assert.deepEqual(shown.errors, []);
  assert.match(shown.text, /Wireless Headphones/, "shown with the real props from app/page.tsx");
  assert.match(shown.text, /Add to cart \(0\)/);

  // Typing in the editor (no save) updates the preview.
  const editor = vscode.window.activeTextEditor!;
  const at = document.positionAt(document.getText().indexOf("Add to cart"));
  await editor.edit((e) => e.replace(new vscode.Range(at, at.translate(0, "Add to cart".length)), "Buy now"));
  const updated = await api.waitForStatus((s) => /Buy now \(0\)/.test(s.text), 5000);
  assert.deepEqual(updated.errors, []);

  // Switching to another component file follows along.
  const page = path.join(root, "app/page.tsx");
  await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(page));
  const followed = await api.waitForStatus((s) => s.file === page && s.status === "mounted", 10000);
  assert.match(followed.text, /Hi Ayush/);
  console.log("SUITE OK:", JSON.stringify({ first: shown.text.slice(0, 60), updated: updated.text.slice(0, 40), followed: followed.text.slice(0, 20) }));
}
