import { ResolverFactory } from "oxc-resolver";

/** Resolves imports the way a browser bundler would, including tsconfig `paths`. */
export function createResolver(): ResolverFactory {
  return new ResolverFactory({
    tsconfig: "auto",
    conditionNames: ["browser", "import", "module", "default"],
    mainFields: ["browser", "module", "main"],
    extensions: [".tsx", ".ts", ".jsx", ".js", ".mjs", ".json", ".vue"],
  });
}
