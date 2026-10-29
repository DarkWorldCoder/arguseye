export function Toast({ title, detail, tone = "success" }: { title: string; detail: string; tone?: "success" | "error" }) {
  const color = tone === "success" ? "#16a34a" : "#dc2626";
  return (
    <div className="flex w-[400px] items-start gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl shadow-zinc-300/50">
      <span className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: color }}>
        {tone === "success" ? "✓" : "!"}
      </span>
      <div>
        <p className="text-sm font-bold">{title}</p>
        <p className="mt-0.5 text-sm text-zinc-500">{detail}</p>
      </div>
      <span className="ml-auto text-xs text-zinc-400">now</span>
    </div>
  );
}
