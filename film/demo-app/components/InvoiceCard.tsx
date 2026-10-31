export function InvoiceCard({ customer, amount, due, status }: { customer: string; amount: number; due: string; status: "paid" | "due" | "overdue" }) {
  const badge = {
    paid: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
    due: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
    overdue: "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300",
  }[status];
  return (
    <article className="w-[360px] rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-300/40 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/40">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Invoice</p>
        <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${badge}`}>{status}</span>
      </div>
      <p className="mt-3 text-lg font-bold text-zinc-900 dark:text-zinc-50">{customer}</p>
      <p className="mt-4 text-4xl font-bold tracking-tight text-zinc-900 dark:text-white">${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Due {due}</p>
      <button className="mt-6 h-11 w-full rounded-xl bg-zinc-900 text-sm font-bold text-white dark:bg-white dark:text-zinc-900">Send reminder</button>
    </article>
  );
}
