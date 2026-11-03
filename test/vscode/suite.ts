import * as assert from "node:assert/strict";
import * as path from "node:path";
import * as vscode from "vscode";
import type { PreviewApi } from "../../src/extension/extension.js";

const root = process.env.CP_FIXTURE_ROOT!;
const card = vscode.Uri.file(path.join(root, "components/ProductCard.tsx")).fsPath;

/** Entry point for @vscode/test-electron: runs the checks and throws on the first failure. */
export async function run(): Promise<void> {
  const extension = vscode.extensions.getExtension("ayushniroula.arguseye");
  assert.ok(extension, "extension is installed in the test host");
  const api: PreviewApi = await extension.activate();

  // Opening a component file and running the command shows it, rendered, beside the editor.
  const document = await vscode.workspace.openTextDocument(card);
  // Context menus pass the clicked URI, which need not be the active editor.
  await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(path.join(root, "app/page.tsx")));
  await vscode.commands.executeCommand("componentPreview.open", vscode.Uri.file(card));
  const shown = await api.waitForStatus((s) => s.status === "mounted", 20000);
  assert.equal(shown.file, card);
  assert.deepEqual(shown.errors, []);
  for (const menu of ["editor/context", "editor/title/context", "explorer/context"]) {
    assert.ok(extension.packageJSON.contributes.menus[menu]?.some((item: any) => item.command === "componentPreview.open"), `${menu} exposes Preview Component`);
  }
  // Exercise the keyboard/Command Palette fallback before editing this document below.
  await vscode.window.showTextDocument(document);
  await vscode.commands.executeCommand("componentPreview.open");
  await api.waitForStatus((s) => s.file === card && s.status === "mounted", 10000);
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
  await api.setTheme("dark");
  assert.equal(api.state()!.theme, "dark");
  await api.setTheme("auto");
  assert.equal(api.state()!.theme, "auto");
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
  const page = vscode.Uri.file(path.join(root, "app/page.tsx")).fsPath;
  await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(page));
  const followed = await api.waitForStatus((s) => s.file === page && s.status === "mounted", 10000);
  assert.match(followed.text, /Hi Ayush/);

  // An inferred authenticated shell must not blank its target; an unsaved layout repair restores the shell.
  const nextRoot = path.resolve(root, "../next-app");
  const layout = await vscode.workspace.openTextDocument(path.join(nextRoot, "app/(shop)/layout.tsx"));
  const replaceLayout = async (source: string) => {
    const edit = new vscode.WorkspaceEdit();
    edit.replace(layout.uri, new vscode.Range(layout.positionAt(0), layout.positionAt(layout.getText().length)), source);
    assert.ok(await vscode.workspace.applyEdit(edit));
  };
  const shell = 'import { TenantShell } from "@/components/TenantShell"; export default function Layout({ children }) { return ';
  await replaceLayout(shell + '<TenantShell tenant={authenticatedTenant}>{children}</TenantShell>; }');
  const deal = path.join(nextRoot, "components/DealBadge.tsx");
  await vscode.commands.executeCommand("componentPreview.open", vscode.Uri.file(deal));
  const isolated = await api.waitForStatus((s) => s.file === deal && s.status === "mounted" && !!s.warnings?.some((w) => w.includes("Skipped inferred wrapper TenantShell")), 20000);
  assert.deepEqual(isolated.errors, []);
  assert.match(isolated.text, /15% off/);
  await replaceLayout(shell + '<TenantShell tenant={{ logo_key: "North" }}>{children}</TenantShell>; }');
  await api.waitForStatus((s) => s.file === deal && s.status === "mounted" && !s.warnings?.some((w) => w.includes("Skipped inferred wrapper")), 10000);
  console.log("SUITE OK:", JSON.stringify({ first: `${first.usage}: ${shown.text.slice(0, 40)}`, headphones: headphones.text.slice(0, 40), updated: updated.text.slice(0, 40), followed: followed.text.slice(0, 20) }));

  // Native templates use the same URI command, JSON data, baseline and unsaved-dependency path.
  const templates = process.env.CP_TEMPLATE_ROOT!;
  const templateFile = vscode.Uri.file(path.join(templates, "card.hbs")).fsPath;
  const partial = await vscode.workspace.openTextDocument(path.join(templates, "items.hbs"));
  const earlyEdit = new vscode.WorkspaceEdit();
  earlyEdit.replace(partial.uri, new vscode.Range(partial.positionAt(0), partial.positionAt(partial.getText().length)), '<p>Before-open {{name}}</p>');
  assert.ok(await vscode.workspace.applyEdit(earlyEdit));
  await new Promise((resolve) => setTimeout(resolve, 100));
  await vscode.commands.executeCommand("componentPreview.open", vscode.Uri.file(templateFile));
  await api.waitForStatus((s) => s.file === templateFile && s.status === "mounted", 10000);
  await api.setTemplate("handlebars", "ada");
  await api.waitForStatus((s) => s.file === templateFile && /Hello Ada/.test(s.text), 10000);
  await api.waitForStatus((s) => /Before-open Ada/.test(s.text), 5000);
  assert.equal(api.state()!.engine, "handlebars");
  assert.ok(api.state()!.profiles?.includes("ada"));
  const templateBaseline = await api.captureBaseline();
  assert.equal(templateBaseline.template?.engine, "handlebars");
  const templateEdit = new vscode.WorkspaceEdit();
  templateEdit.replace(partial.uri, new vscode.Range(partial.positionAt(0), partial.positionAt(partial.getText().length)), '<p>Unsaved {{name}} partial</p>');
  assert.ok(await vscode.workspace.applyEdit(templateEdit));
  const templateUpdated = await api.waitForStatus((s) => s.file === templateFile && /Unsaved Ada partial/.test(s.text), 10000);
  assert.deepEqual(templateUpdated.errors, []);
  const templateDiff = await api.compareChanges();
  assert.equal(templateDiff.status, "changed", JSON.stringify({ before: templateDiff.before.warnings, after: templateDiff.after.warnings, unresolved: templateDiff.after.unresolved }));
  assert.ok(templateDiff.changedPixels > 0);
  console.log("TEMPLATE SUITE OK:", JSON.stringify({ text: templateUpdated.text, engine: api.state()!.engine }));

  // For screenshots: keep the window up after the checks (CP_HOLD_MS=15000 npm run test:vscode).
  if (process.env.CP_HOLD_MS) await new Promise((r) => setTimeout(r, Number(process.env.CP_HOLD_MS)));
}
