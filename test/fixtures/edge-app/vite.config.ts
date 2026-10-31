import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// "~ui" is only in the Vite config, not in tsconfig: previews must read it from here.
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "src"), "~ui": path.resolve(__dirname, "src/components/ui") } },
  define: { __APP_VERSION__: JSON.stringify("2.4.1") },
});
