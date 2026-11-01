import { createContext, useContext } from "react";

// Radix-style compound part: throws when rendered outside its provider, which the same file exports.
const Ctx = createContext<{ delay: number } | null>(null);
export function TipProvider({ children }: { children: React.ReactNode }) { return <Ctx.Provider value={{ delay: 300 }}>{children}</Ctx.Provider>; }
export function Tip({ label = "Copy link" }: { label?: string }) {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("`Tip` must be used within `TipProvider`");
  return <span role="tooltip">{label} (after {ctx.delay} ms)</span>;
}
