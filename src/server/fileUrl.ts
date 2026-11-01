import path from "node:path";

/** One filesystem URL convention for POSIX paths, Windows drive paths and UNC roots. */
export function fileUrl(file: string): string {
  const normalized = file.replaceAll("\\", "/");
  return "/@fs" + (normalized.startsWith("/") ? "" : "/") + encodeURI(normalized).replaceAll("?", "%3F").replaceAll("#", "%23");
}

/** Decodes the filesystem portion after /@fs, preserving the selected host OS's canonical path form. */
export function fileFromUrl(encoded: string): string {
  let file = decodeURIComponent(encoded);
  if (process.platform === "win32") { if (/^\/[a-z]:\//i.test(file)) file = file.slice(1); file = path.normalize(file); }
  return file;
}

/** Runs untranspiled in every page runtime; keep identical to fileUrl above. */
export const browserFileUrl = `(file) => { const normalized = file.replaceAll(String.fromCharCode(92), "/"); return "/@fs" + (normalized.startsWith("/") ? "" : "/") + encodeURI(normalized).replaceAll("?", "%3F").replaceAll("#", "%23"); }`;
