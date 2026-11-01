import { createContext, useContext, type ParentProps } from "solid-js";

const Theme = createContext("light");
export function ThemeProvider(props: ParentProps) {
  return <Theme.Provider value="forest">{props.children}</Theme.Provider>;
}
export const useTheme = () => useContext(Theme);
