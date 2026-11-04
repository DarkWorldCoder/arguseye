import { useEffect, useRef, useState } from "react";

export default function Observed({ nested = false }: { nested?: boolean }) {
  const container = useRef<HTMLDivElement>(null), target = useRef<HTMLElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setSeen(true);
    }, { root: nested ? container.current : null });
    observer.observe(target.current!);
    return () => observer.disconnect();
  }, [nested]);
  return <div data-scroll-area ref={container} style={nested ? { height: 240, overflow: "auto" } : {}}>
    <div style={{ height: 900 }}>Above the fold</div>
    <section ref={target} style={{ height: 100, opacity: seen ? 1 : 0, background: "#1e7a46", color: "white" }}>Revealed by a real observer</section>
    <div style={{ height: 200 }}>Bottom</div>
  </div>;
}
