import adapter from "@sveltejs/adapter-auto";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: { adapter: adapter(), alias: { $icons: "src/icons" } },
};
export default config;
