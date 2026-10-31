import { create } from "zustand";
export const useBadge = create<{ count: number; bump: () => void }>((set) => ({ count: 7, bump: () => set((s) => ({ count: s.count + 1 })) }));
