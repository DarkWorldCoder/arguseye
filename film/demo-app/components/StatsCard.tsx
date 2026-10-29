"use client";
import { useTheme } from "@/providers/ThemeProvider";

export function StatsCard({ label, value, change, points }: { label: string; value: string; change: string; points: number[] }) {
  const { accent } = useTheme();
  const max = Math.max(...points), min = Math.min(...points);
  const path = points.map((p, i) => `${i ? "L" : "M"}${(i / (points.length - 1)) * 300},${70 - ((p - min) / (max - min || 1)) * 60}`).join(" ");
  return (
    <div className="w-[360px] rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-300/40">
      <p className="text-sm text-zinc-500">{label}</p>
      <div className="mt-1 flex items-baseline gap-3">
        <span className="text-4xl font-bold tracking-tight">{value}</span>
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">{change}</span>
      </div>
      <svg viewBox="0 0 300 80" className="mt-4 h-20 w-full">
        <path d={path} fill="none" stroke={accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
