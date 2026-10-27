import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const TYPES: Record<string, string> = {
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".gif": "image/gif", ".webp": "image/webp", ".avif": "image/avif", ".ico": "image/x-icon",
  ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".otf": "font/otf",
  ".mp4": "video/mp4", ".webm": "video/webm", ".json": "application/json", ".txt": "text/plain",
};

export const contentType = (file: string) => TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream";

/** URL that serves a project file's raw bytes (images, fonts, videos). */
export const rawUrl = (file: string) => `/@fs${file}?raw`;

/** True for projects whose static image imports return `{ src, width, height }` (Next.js) instead of a URL string. */
export function importsImagesAsObjects(root: string): boolean {
  if (["next.config.js", "next.config.mjs", "next.config.ts"].some((f) => existsSync(path.join(root, f)))) return true;
  try {
    const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
    return Boolean(pkg.dependencies?.next ?? pkg.devDependencies?.next);
  } catch {
    return false;
  }
}

/** An imported asset as a JS module, shaped the way the project's framework shapes it. */
export function assetModule(file: string, asObject: boolean): string {
  const src = JSON.stringify(rawUrl(file));
  if (!asObject || !/\.(svg|png|jpe?g|gif|webp|avif)$/i.test(file)) return `export default ${src};`;
  const { width, height } = imageSize(file);
  return `export default { src: ${src}, width: ${width}, height: ${height}, blurDataURL: ${src} };`;
}

/** Reads intrinsic size from the file header (PNG, GIF, JPEG, WebP, SVG); 0 when unknown. */
function imageSize(file: string): { width: number; height: number } {
  const buf = readFileSync(file);
  const ext = path.extname(file).toLowerCase();
  if (ext === ".png") return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  if (ext === ".gif") return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  if (ext === ".webp" && buf.toString("ascii", 12, 16) === "VP8X") {
    return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
  }
  if (ext === ".jpg" || ext === ".jpeg") {
    for (let i = 2; i < buf.length - 9; ) {
      const marker = buf[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      }
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }
  if (ext === ".svg") {
    const svg = buf.toString("utf8", 0, 2000);
    const num = (name: string) => Number(svg.match(new RegExp(`\\b${name}="([\\d.]+)`))?.[1] ?? 0);
    const viewBox = svg.match(/viewBox="[\d.\s-]+?\s([\d.]+)\s([\d.]+)"/);
    return { width: num("width") || Number(viewBox?.[1] ?? 0), height: num("height") || Number(viewBox?.[2] ?? 0) };
  }
  return { width: 0, height: 0 };
}

/** Points relative `url()`s in a stylesheet at served files, as the app's bundler would. */
export function rewriteCssUrls(css: string, cssFile: string): string {
  return css.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/g, (match, _quote, ref: string) => {
    if (/^(data:|https?:|\/\/|#|\/)/.test(ref)) return match;
    const file = path.resolve(path.dirname(cssFile), ref.split(/[?#]/)[0]);
    return `url("${rawUrl(file)}")`;
  });
}
