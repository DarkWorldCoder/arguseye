/** Equivalent lossless PNG/WebP media below the fold, including an SVG foreignObject phone screen. */
export default function ImagePage({ images = true, broken = false }: { images?: boolean; broken?: boolean }) {
  const panel = <img src={broken ? "/missing.webp" : images ? "/panel.webp" : "/panel.png"} loading="lazy" decoding={images ? "async" : "sync"} width={320} height={160} style={{ display: "block" }} alt="Generated colour panel" />;
  return <main style={{ width: 320, background: "white" }}>
    <header style={{ height: 900, background: "#edf3fa" }} />
    {panel}
    <svg width={320} height={160} style={{ display: "block" }}><foreignObject width={320} height={160}>{panel}</foreignObject></svg>
  </main>;
}
