import "./globals.css";
import { ThemeProvider } from "@/providers/ThemeProvider";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <ThemeProvider accent="#6c70c9">{children}</ThemeProvider>
      </body>
    </html>
  );
}
