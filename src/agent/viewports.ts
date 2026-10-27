/** Shared CSS-pixel sizes keep editor previews, agent renders and comparisons reproducible. */
export const VIEWPORTS = { mobile: { width: 390, height: 844 }, tablet: { width: 820, height: 1180 }, desktop: { width: 1280, height: 800 } } as const;

/** Resolves a named preset or a bounded explicit size with an actionable input error. */
export function parseViewport(value = "desktop"): { width: number; height: number } {
  if (value in VIEWPORTS) return { ...VIEWPORTS[value as keyof typeof VIEWPORTS] };
  const [width, height] = value.split("x").map(Number);
  if (!/^\d+x\d+$/.test(value) || ![width, height].every((n) => Number.isInteger(n) && n > 0 && n <= 8192)) throw new Error(`Unknown viewport "${value}"; use mobile, tablet, desktop or WIDTHxHEIGHT (1–8192).`);
  return { width, height };
}
