import "./globals.css";
import { ThemeProvider } from "@/providers/ThemeProvider";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="bg-zinc-50 text-zinc-900 antialiased">
        <ThemeProvider accent="rgb(10, 20, 30)">
          <main id="page">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
