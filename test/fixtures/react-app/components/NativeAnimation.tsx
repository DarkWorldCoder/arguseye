import { useEffect, useRef } from "react";

/** Native Web Animations are independent of CSS animation-duration overrides. */
export default function NativeAnimation({ animated = true, loop = false }: { animated?: boolean; loop?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!animated) return;
    const animation = box.current!.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 800, iterations: loop ? Infinity : 1, fill: "forwards" });
    return () => animation.cancel();
  }, [animated, loop]);
  return <div ref={box} style={{ width: 100, height: 100, background: "red" }} />;
}
