export function CommandMenu({ query, items }: { query: string; items: { label: string; hint: string }[] }) {
  return (
    <div className="w-[440px] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl shadow-zinc-400/40">
      <div className="flex h-14 items-center gap-3 border-b border-zinc-200 px-4">
        <span className="text-zinc-400">⌕</span>
        <span className="text-sm">{query}</span>
        <span className="ml-auto rounded-md border border-zinc-200 px-1.5 text-xs text-zinc-500">esc</span>
      </div>
      <ul className="p-2">
        {items.map((item, i) => (
          <li key={item.label} className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-sm ${i === 0 ? "bg-zinc-100" : ""}`}>
            <span>{item.label}</span>
            <span className="text-xs text-zinc-400">{item.hint}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
