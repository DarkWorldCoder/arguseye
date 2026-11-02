import { useLayoutEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/** Mirrors a real landing page whose below-fold content reveals only when motion is permitted. */
export default function Landing({ animated = true }: { animated?: boolean }) {
  useLayoutEffect(() => {
    if (!animated) return;
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from(".scroll-card", { opacity: 0, y: 28, duration: .7, clearProps: "all", scrollTrigger: { trigger: ".scroll-card", start: "top 90%", once: true } });
    });
    return () => media.revert();
  }, [animated]);
  return <main style={{ width: 320, background: "white" }}>
    <header style={{ height: 900, background: "#edf3fa" }}>Landing hero</header>
    <article className="scroll-card" style={{ height: 160, background: "#ffcc33" }}><h2 style={{ margin: 0 }}>Below-fold feature</h2><p>Visible without requiring animation.</p></article>
  </main>;
}
