type RevenueChartProps = {
  label: string;
  value: string;
  delta: string;
  points?: number[];
  months?: string[];
};

export function RevenueChart({
  label,
  value,
  delta,
  points = [12, 18, 15, 24, 22, 31, 29, 38, 35, 46, 44, 55],
  months = ["Jan", "Mar", "May", "Jul", "Sep", "Nov"],
}: RevenueChartProps) {
  const w = 300;
  const h = 120;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const xy = points.map((p, i) => [(i / (points.length - 1)) * w, h - ((p - min) / (max - min || 1)) * (h - 12) - 6]);
  const line = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${w},${h} L0,${h} Z`;
  const [lx, ly] = xy[xy.length - 1];
  return (
    <article className="w-[360px] rounded-[24px] bg-white p-6 shadow-xl shadow-indigo-950/10 ring-1 ring-zinc-200">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-500">{label}</p>
          <p className="mt-1 text-4xl font-bold tracking-tight text-zinc-900">{value}</p>
        </div>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
          ▲ {delta}
        </span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="mt-6 w-full overflow-visible">
        <defs>
          <linearGradient id="rev-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#6366f1" stopOpacity=".35" />
            <stop offset="1" stopColor="#6366f1" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="0" x2={w} y1={h * f} y2={h * f} stroke="#e4e4e7" strokeDasharray="3 4" />
        ))}
        <path d={area} fill="url(#rev-fill)" />
        <path d={line} fill="none" stroke="#6366f1" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={lx} cy={ly} r="9" fill="#6366f1" fillOpacity=".18" />
        <circle cx={lx} cy={ly} r="4.5" fill="#6366f1" stroke="white" strokeWidth="2" />
      </svg>
      <div className="mt-3 flex justify-between text-xs text-zinc-400">
        {months.map((m) => (
          <span key={m}>{m}</span>
        ))}
      </div>
    </article>
  );
}
