import { useLayoutEffect } from "react";

/** Solid, offset pixels make crop coordinates and offscreen coverage unambiguous. */
export default function CaptureProbe({ color, height, width = 340, offset = 17, blockCanvasEncoding = false }: { color: string; height: number; width?: number; offset?: number; blockCanvasEncoding?: boolean }) {
  useLayoutEffect(() => {
    if (!blockCanvasEncoding) return;
    const original = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = () => { throw new Error("Application canvas encoding is disabled"); };
    return () => { HTMLCanvasElement.prototype.toDataURL = original; };
  }, [blockCanvasEncoding]);
  return <div style={{ marginLeft: offset, width, height, background: color }} />;
}
