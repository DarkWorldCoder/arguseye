export const base = "";
export const assets = "";
export const resolveRoute = (id, params = {}) => id.replace(/\[(?:\.\.\.)?(\w+)\]/g, (_, key) => params[key] ?? "");
export const resolve = resolveRoute;
export const asset = (file) => file;
