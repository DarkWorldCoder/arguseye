/** Solid, offset pixels make crop coordinates and offscreen coverage unambiguous. */
export default function CaptureProbe({ color, height }: { color: string; height: number }) {
  return <div style={{ marginLeft: 17, width: 340, height, background: color }} />;
}
