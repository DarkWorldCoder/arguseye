import { Inter, Roboto_Mono } from "next/font/google";
import localFont from "next/font/local";

// Fonts defined outside the root layout, as many apps do in lib/fonts.ts.
const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const mono = Roboto_Mono({ subsets: ["latin"] });
const brand = localFont({ src: "../public/fonts/Brand.woff2", variable: "--font-brand" });

export function FontTitle() {
  return (
    <h1 className={`${inter.variable} ${brand.variable}`} style={{ fontFamily: "var(--font-sans)" }}>
      Fonts <code className={mono.className}>mono</code>
    </h1>
  );
}
