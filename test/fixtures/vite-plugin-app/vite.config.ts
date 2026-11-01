import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
export default defineConfig({
  plugins: [vue(), {
    name: "fixture-brand",
    resolveId(id) { if (id === "virtual:brand") return "\0fixture-brand"; },
    load(id) { if (id === "\0fixture-brand") return 'export default "Actual plugin output";'; }
  }],
});
