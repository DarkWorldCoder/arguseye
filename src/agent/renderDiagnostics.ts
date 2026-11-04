/** Recovery advice grounded in observed render evidence, without editing application state. */
export type RenderDiagnostic = {
  code: string;
  severity: "error" | "warning";
  phase: "render" | "inputs" | "context" | "assets";
  /** Render target; the original error/warning retains any more specific source location. */
  file: string;
  message: string;
  recovery: string;
};

/** Adds bounded next steps while retaining the original errors and warnings as authoritative evidence. */
export function renderDiagnostics(result: { target: { file: string }; propsSource: string; unresolved: string[]; errors: string[]; warnings: string[] }): RenderDiagnostic[] {
  const file = result.target.file;
  const diagnostics: RenderDiagnostic[] = [];
  for (const error of result.errors.slice(0, 10)) diagnostics.push({ code: "RENDER_ERROR", severity: "error", phase: "render", file, message: error.split("\n")[0], recovery: "Read the original error and source stack. Use inspect_project to check installed packages and setup; repair the named source or supply explicit preview setup when application context is required." });
  if (result.unresolved.length) diagnostics.push({ code: "UNRESOLVED_INPUTS", severity: "warning", phase: "inputs", file, message: result.unresolved.join("; "), recovery: "Supply explicit props or a native template JSON profile for the named inputs. Runtime expressions are not application data and will not be evaluated automatically." });
  if (result.propsSource === "sample") diagnostics.push({ code: "SAMPLED_PROPS", severity: "warning", phase: "inputs", file, message: "The render uses generated sample props.", recovery: "Call list_usages for this file, then render_component with a returned usage, or supply explicit props. Samples do not establish application fidelity." });
  for (const warning of result.warnings) {
    if (warning.startsWith("Sample props were generated") || warning.startsWith("Runtime usage inputs were not evaluated")) continue;
    const assets = warning.startsWith("Assets did not settle:");
    const wrapper = warning.includes("Skipped inferred wrapper");
    diagnostics.push({ code: assets ? "ASSETS_UNSETTLED" : wrapper ? "INFERRED_CONTEXT_INCOMPLETE" : "CONTEXT_WARNING", severity: "warning", phase: assets ? "assets" : "context", file, message: warning,
      recovery: assets ? "Check the named font/image URLs, files and browser loading errors, then render again. A fallback or unfinished asset does not establish fidelity."
        : wrapper ? "Author explicit project preview setup with the required provider inputs, or render a discovered usage with explicit props. Do not invent authentication or backend context."
        : "Review this warning and inspect_project diagnostics. Supply the missing project context or choose a supported render path before treating the evidence as complete." });
    if (diagnostics.length >= 32) break;
  }
  return diagnostics;
}
