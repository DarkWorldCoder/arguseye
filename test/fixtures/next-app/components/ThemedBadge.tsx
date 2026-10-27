"use client";
import { useTheme } from "@/providers/ThemeProvider";

export function ThemedBadge({ label }: { label: string }) {
  const { accent, density } = useTheme();
  return <span style={{ color: accent }} data-density={density}>{label}</span>;
}
