import { createContext, useContext } from "react";
const Theme = createContext({ accent: "rebeccapurple" });
export default function ThemedNoProvider() { const t = useContext(Theme); return <p style={{ color: t.accent }}>Default context accent</p>; }
