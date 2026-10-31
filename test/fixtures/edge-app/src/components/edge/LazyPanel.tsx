import { lazy, Suspense } from "react";
const Heavy = lazy(() => import("./HeavyChart"));
export default function LazyPanel() { return <Suspense fallback={<p>Loading panel…</p>}><Heavy /></Suspense>; }
