"use client";
import { createContext, useContext, type ReactNode } from "react";

const ThemeContext = createContext({ accent: "rgb(0, 0, 0)", density: "normal" });

export const useTheme = () => useContext(ThemeContext);

export function ThemeProvider({ accent, children }: { accent: string; children: ReactNode }) {
  return <ThemeContext.Provider value={{ accent, density: "compact" }}><div className="theme-root">{children}</div></ThemeContext.Provider>;
}
