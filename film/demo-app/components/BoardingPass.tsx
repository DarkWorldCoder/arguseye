type BoardingPassProps = {
  passenger: string;
  from: string;
  fromCity: string;
  to: string;
  toCity: string;
  flight: string;
  gate: string;
  seat: string;
  boarding: string;
};

export function BoardingPass({ passenger, from, fromCity, to, toCity, flight, gate, seat, boarding }: BoardingPassProps) {
  const bars = [3, 1, 2, 1, 3, 2, 1, 1, 3, 1, 2, 3, 1, 2, 1, 3, 1, 1, 2, 3, 1, 2, 1, 3, 2, 1, 1, 3, 1, 2];
  return (
    <article className="w-[340px] overflow-hidden rounded-[24px] bg-white shadow-xl shadow-slate-900/15 ring-1 ring-slate-200">
      <div className="bg-gradient-to-r from-slate-900 to-slate-700 px-6 py-4 text-white">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
          <span>Boarding pass</span>
          <span>{flight}</span>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div>
            <p className="text-4xl font-bold tracking-tight">{from}</p>
            <p className="text-xs text-white/70">{fromCity}</p>
          </div>
          <div className="flex flex-1 items-center px-3">
            <span className="h-px flex-1 border-t border-dashed border-white/40" />
            <svg viewBox="0 0 24 24" className="mx-2 h-6 w-6 rotate-90 fill-amber-300">
              <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5Z" />
            </svg>
            <span className="h-px flex-1 border-t border-dashed border-white/40" />
          </div>
          <div className="text-right">
            <p className="text-4xl font-bold tracking-tight">{to}</p>
            <p className="text-xs text-white/70">{toCity}</p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-y-3 px-6 py-5 text-sm">
        <div className="col-span-3">
          <p className="text-xs text-slate-400">Passenger</p>
          <p className="font-semibold text-slate-900">{passenger}</p>
        </div>
        {[["Gate", gate], ["Seat", seat], ["Boarding", boarding]].map(([k, v]) => (
          <div key={k}>
            <p className="text-xs text-slate-400">{k}</p>
            <p className="text-lg font-bold text-slate-900">{v}</p>
          </div>
        ))}
      </div>
      <div className="relative border-t-2 border-dashed border-slate-200 px-6 py-5">
        <span className="absolute -left-3 -top-3 h-6 w-6 rounded-full bg-[#f4f5f8]" />
        <span className="absolute -right-3 -top-3 h-6 w-6 rounded-full bg-[#f4f5f8]" />
        <div className="flex h-12 items-stretch justify-center gap-[2px]" aria-hidden>
          {bars.map((b, i) => (
            <span key={i} className="bg-slate-900" style={{ width: b * 2 }} />
          ))}
        </div>
      </div>
    </article>
  );
}
