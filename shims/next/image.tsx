import type { CSSProperties } from "react";

type StaticImageData = { src: string; width: number; height: number; blurDataURL?: string };

/** Renders the <img> Next's Image renders (same attributes and fill styles), serving the original file. */
export default function Image({
  src, alt = "", width, height, fill, priority, sizes, style, quality, loader, unoptimized, placeholder, blurDataURL,
  onLoadingComplete, overrideSrc, lazyBoundary, lazyRoot, ...rest
}: { src: string | StaticImageData; alt?: string; width?: number | string; height?: number | string; fill?: boolean;
  priority?: boolean; sizes?: string; style?: CSSProperties; [key: string]: unknown }) {
  const data = typeof src === "string" ? undefined : src;
  const fillStyle: CSSProperties = fill ? { position: "absolute", height: "100%", width: "100%", left: 0, top: 0, right: 0, bottom: 0 } : {};
  return (
    <img
      alt={alt}
      src={overrideSrc ?? data?.src ?? (src as string)}
      width={fill ? undefined : width ?? data?.width}
      height={fill ? undefined : height ?? data?.height}
      sizes={fill ? sizes ?? "100vw" : sizes}
      decoding="async"
      data-nimg={fill ? "fill" : "1"}
      {...(priority ? { fetchPriority: "high" as const } : { loading: "lazy" as const })}
      style={{ color: "transparent", ...fillStyle, ...style }}
      {...rest}
    />
  );
}
