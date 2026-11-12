import { useState } from "react";

/** A real responsive component with caller-provided content and local interactive state. */
export function MatrixCard({ title = "Starter", fail = false }: { title?: string; fail?: boolean }) {
  const [count, setCount] = useState(0);
  if (fail) throw new Error("MatrixCard requested failure");
  return <article className="matrix-card">
    <style>{`.matrix-card{width:100%;box-sizing:border-box;padding:24px;background:white;color:#111}.dark .matrix-card{background:#111;color:white}@media(max-width:500px){.matrix-card{padding:8px}}`}</style>
    <h1>{title}</h1><button onClick={() => setCount(count + 1)}>Count {count}</button>
  </article>;
}
