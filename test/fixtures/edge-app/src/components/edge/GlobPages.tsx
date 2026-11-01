import { lazy, Suspense } from "react";

// Vite's import.meta.glob, eager with a named import and lazy (as routers and i18n loaders use it).
const pages = import.meta.glob<React.ComponentType>("./glob/*.tsx", { eager: true, import: "default" });
const lazyPages = import.meta.glob("./glob/*.tsx");
const LazyTwo = lazy(lazyPages["./glob/Two.tsx"] as () => Promise<{ default: React.ComponentType }>);

export default function GlobPages() {
  return (
    <ul>
      {Object.entries(pages).map(([key, Page]) => <Page key={key} />)}
      <Suspense fallback={<li>…</li>}><LazyTwo /></Suspense>
      <li>{Object.keys(lazyPages).join(" ")}</li>
    </ul>
  );
}
