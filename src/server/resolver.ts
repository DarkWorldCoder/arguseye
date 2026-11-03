import { ResolverFactory } from "oxc-resolver";

/** Resolves imports the way a browser bundler would, including tsconfig `paths`. */
export function createResolver(platform: "browser" | "node" = "browser"): ResolverFactory {
  return new ResolverFactory({
    tsconfig: "auto",
    conditionNames: platform === "node" ? ["node", "require", "import", "default"] : ["browser", "import", "module", "default"],
    mainFields: platform === "node" ? ["main", "module"] : ["browser", "module", "main"],
    extensions: [".tsx", ".ts", ".jsx", ".js", ".mjs", ".json", ".vue"],
  });
}
