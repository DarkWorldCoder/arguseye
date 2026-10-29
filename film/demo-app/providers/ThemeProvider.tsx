"use client";
import { createContext, useContext, type ReactNode } from "react";

const ThemeContext = createContext({ accent: "#111827" });

export const useTheme = () => useContext(ThemeContext);

export function ThemeProvider({ accent, children }: { accent: string; children: ReactNode }) {
  return <ThemeContext.Provider value={{ accent }}>{children}</ThemeContext.Provider>;
}
