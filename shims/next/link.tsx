import { cloneElement, isValidElement, type ReactNode } from "react";

type Url = string | { pathname?: string | null; query?: Record<string, unknown> | string | null; hash?: string | null };

/** Renders the same anchor Next's Link renders, minus client-side navigation. */
export default function Link({
  href, as, prefetch, replace, scroll, shallow, locale, passHref, legacyBehavior, onNavigate, children, ...rest
}: { href?: Url; as?: Url; children?: ReactNode; [key: string]: unknown }) {
  const url = formatUrl(as ?? href);
  if (legacyBehavior && isValidElement(children)) return cloneElement(children as any, { href: url, ...rest });
  return <a href={url} {...rest}>{children}</a>;
}

function formatUrl(url: Url | undefined): string | undefined {
  if (url == null) return undefined; // Next warns here; the preview still shows the element
  if (typeof url === "string") return url;
  const query = url.query == null ? "" : typeof url.query === "string" ? url.query : new URLSearchParams(
    Object.entries(url.query).flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => [k, String(x)]) : v == null ? [] : [[k, String(v)]])),
  ).toString();
  return `${url.pathname ?? ""}${query ? `?${query}` : ""}${url.hash ? (url.hash.startsWith("#") ? url.hash : `#${url.hash}`) : ""}`;
}
