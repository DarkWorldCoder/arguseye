import { createContext } from "preact";
import { useContext } from "preact/hooks";
import type { ComponentChildren } from "preact";

const Theme = createContext("light");
export function ThemeProvider({ children }: { children: ComponentChildren }) {
  return <Theme.Provider value="ocean">{children}</Theme.Provider>;
}
export const useTheme = () => useContext(Theme);
