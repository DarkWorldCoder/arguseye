"use client";
import { useDiscount } from "@/providers/DiscountProvider";

export function DealBadge({ label }: { label: string }) {
  const { percent } = useDiscount();
  return <span className="deal">{label}: {percent}% off</span>;
}
