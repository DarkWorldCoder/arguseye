"use client";
import { useTheme } from "@/providers/ThemeProvider";

type PricingCardProps = {
  plan: string;
  price: number;
  period?: string;
  features: string[];
  highlighted?: boolean;
};

export function PricingCard({ plan, price, period = "month", features, highlighted = false }: PricingCardProps) {
  const { accent } = useTheme();
  return (
    <article className="w-[342px] rounded-3xl border border-zinc-200 bg-white p-7 shadow-xl shadow-zinc-300/40">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">{plan}</h3>
        {highlighted && (
          <span className="rounded-full px-3 py-1 text-xs font-bold text-white" style={{ background: accent }}>
            Popular
          </span>
        )}
      </div>
      <img src="/illustrations/orbit.svg" alt="" className="mt-5 h-28 w-full rounded-2xl object-cover" />
      <p className="mt-6 flex items-baseline gap-1">
        <span className="text-5xl font-bold tracking-tight">${price}</span>
        <span className="text-zinc-500">/{period}</span>
      </p>
      <ul className="mt-5 space-y-2 text-sm text-zinc-600">
        {features.map((feature) => (
          <li key={feature} className="flex gap-2">
            <span style={{ color: accent }}>✓</span>
            {feature}
          </li>
        ))}
      </ul>
      <button
        className="h-11 w-[180px] leading-[40px]
          mt-7 rounded-xl border-2 px-4 text-sm font-bold"
        style={{ borderColor: accent, color: accent }}
      >
        Choose {plan}
      </button>
    </article>
  );
}
