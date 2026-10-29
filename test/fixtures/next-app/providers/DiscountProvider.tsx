"use client";
import { createContext, useContext, type ReactNode } from "react";

const DiscountContext = createContext({ percent: 0 });
export const useDiscount = () => useContext(DiscountContext);

export function DiscountProvider({ percent, children }: { percent: number; children: ReactNode }) {
  return <DiscountContext.Provider value={{ percent }}>{children}</DiscountContext.Provider>;
}
