/** Solid, offset pixels make crop coordinates and offscreen coverage unambiguous. */
export default function CaptureProbe({ color, height, width = 340, offset = 17 }: { color: string; height: number; width?: number; offset?: number }) {
  return <div style={{ marginLeft: offset, width, height, background: color }} />;
}
