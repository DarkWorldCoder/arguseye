import { afterAll, beforeAll, describe, expect, it } from "vitest";
import path from "node:path";
import { createRenderer, type Renderer } from "../../src/agent/createRenderer.js";

/**
 * Every kind of component an agent is likely to point Arguseye at, in one Vite + React app with real libraries:
 * each must render with no props from the agent, no errors, and its content in the snapshot.
 */
const root = path.resolve("test/fixtures/edge-app");
const at = (f: string) => path.join(root, "src/components/edge", f);
let renderer: Renderer;
beforeAll(async () => { renderer = await createRenderer({ root }); });
afterAll(async () => renderer?.close());

const CASES: Array<[string, string | undefined, string]> = [
  ["MemoCard.tsx", "MemoCard", "Memo card"],
  ["ForwardInput.tsx", undefined, "typed"],
  ["ClassCounter.tsx", undefined, "Class count"],
  ["FragmentList.tsx", undefined, "Third"],
  ["PlainText.tsx", undefined, "Just a string"],
  ["WithHoc.tsx", undefined, "HOC label"],
  ["LazyPanel.tsx", undefined, "Lazy content loaded"],
  ["ThemedNoProvider.tsx", undefined, "Default context accent"],
  ["FetchOnMount.tsx", undefined, "user"],
  ["StorageGreeting.tsx", undefined, "Hello guest"],
  ["LiveClock.tsx", undefined, "Clock running"],
  ["Spinner.tsx", undefined, "Loading"],
  ["FadeIn.tsx", undefined, "Faded in with Framer Motion"],
  ["SalesChart.tsx", undefined, "Feb"],
  ["VirtualRows.tsx", undefined, "Row 3"],
  ["LegacyJsx.js", undefined, "Hello world from .js"],
  ["ViteAlias.tsx", undefined, "Alias from vite.config"],
  ["EnvBanner.tsx", undefined, "Edge Store v2.4.1"],
  ["ScssCard.tsx", undefined, "SCSS module card"],
  ["JsonPlans.tsx", undefined, "Team"],
  ["QueryUser.tsx", undefined, "Query user"],
  ["ReduxCart.tsx", undefined, "Cart has 3 items"],
  ["ZustandBadge.tsx", undefined, "Badge 7"],
  ["Greeting.tsx", undefined, "Welcome back, Asha"],
  ["FixedToast.tsx", undefined, "Saved!"],
  ["TallPage.tsx", undefined, "Top of tall page"],
  ["CustomElement.tsx", undefined, "Shadow chip"],
  ["GenericList.tsx", "GenericList", ""],
  ["LodashTitle.tsx", undefined, "Lodash Start Case Works"],
  ["CycleA.tsx", undefined, "Label via cycle A"],
  ["SvgLogo.tsx", undefined, "Edge logo"],
  ["DynamicImport.tsx", undefined, "Free / Pro / Team"],
  ["FontAwait.tsx", undefined, "Serif headline"],
];

describe("edge cases: every kind of component renders", () => {
  it.each(CASES)("%s", async (file, exportName, text) => {
    const result = await renderer.render({ file: at(file), exportName });
    expect(result.errors).toEqual([]);
    expect(result.snapshot).toContain(text);
  });

  it("a component that renders nothing says so instead of returning a blank image silently", async () => {
    const result = await renderer.render({ file: at("NothingHere.tsx") });
    expect(result.errors).toEqual([]);
    expect(result.warnings.join("\n")).toMatch(/nothing visible/i);
    const empty = await renderer.render({ file: at("EmptyBox.tsx") });
    expect(empty.warnings.join("\n")).toMatch(/nothing visible/i);
  });

  it("a component that throws comes back as a structured error with the message", async () => {
    const result = await renderer.render({ file: at("Thrower.tsx") });
    expect(result.errors.join("\n")).toContain("Thrower exploded on purpose");
  });
});
