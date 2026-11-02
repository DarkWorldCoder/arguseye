# Scroll and image capture fixture

`Landing.tsx` mirrors the GSAP `matchMedia` / `ScrollTrigger` entrance pattern used by the real HYVE landing page. The feature starts below the viewport. Respecting the browser's reduced-motion preference must give it the same pixels as the component's explicit static state.

`ImagePage.tsx` puts equivalent lossless PNG and WebP images below the viewport, as normal HTML and inside SVG `foreignObject` content. The PNG is the synchronous-decoding reference; the async WebP must produce the same pixels. Small single-colour images decode too quickly to reproduce this case.

The 1536 by 1024 assets are original deterministic test patterns, not product screenshots or third-party artwork. Starting with `seed = 1`, for each pixel `(x, y)` in row-major order:

- `seed = (1664525 * seed + 1013904223) & 0xffffffff`
- RGB is `(255 if seed & 1 else 0, (seed >> 16) & 255, (x + y) & 255)`.

The same RGB buffer was saved as PNG and lossless WebP. The reference pixels come from that fixture buffer; they are independent of Arguseye's settling implementation.
