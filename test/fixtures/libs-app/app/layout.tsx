import "./globals.css";
import "@mantine/core/styles.css";
import { Providers } from "./providers";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-white text-zinc-900">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
