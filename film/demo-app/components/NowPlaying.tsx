type NowPlayingProps = {
  title: string;
  artist: string;
  album: string;
  elapsed: string;
  duration: string;
  progress: number;
};

export function NowPlaying({ title, artist, album, elapsed, duration, progress }: NowPlayingProps) {
  return (
    <article className="w-[340px] rounded-[28px] bg-zinc-950 p-5 text-white shadow-2xl shadow-black/40 ring-1 ring-white/10">
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-[conic-gradient(from_200deg_at_30%_70%,#f472b6,#8b5cf6,#22d3ee,#f59e0b,#f472b6)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_25%,rgba(255,255,255,.45),transparent_45%)]" />
        <div className="absolute bottom-4 left-4 rounded-full bg-black/35 px-3 py-1 text-[11px] font-semibold tracking-wide backdrop-blur">
          {album}
        </div>
      </div>
      <div className="mt-5 flex items-end justify-between">
        <div>
          <h3 className="text-xl font-bold">{title}</h3>
          <p className="text-sm text-zinc-400">{artist}</p>
        </div>
        <div className="flex h-6 items-end gap-[3px]" aria-hidden>
          {[10, 18, 13, 22, 15].map((h, i) => (
            <span key={i} className="w-[4px] rounded-full bg-emerald-400" style={{ height: h }} />
          ))}
        </div>
      </div>
      <div className="mt-5 h-1.5 rounded-full bg-white/15">
        <div className="relative h-full rounded-full bg-white" style={{ width: `${progress}%` }}>
          <span className="absolute -right-1.5 -top-1 h-3.5 w-3.5 rounded-full bg-white shadow" />
        </div>
      </div>
      <div className="mt-2 flex justify-between text-xs text-zinc-400">
        <span>{elapsed}</span>
        <span>{duration}</span>
      </div>
      <div className="mt-4 flex items-center justify-center gap-8">
        <svg viewBox="0 0 24 24" className="h-7 w-7 fill-white/90"><path d="M6 5h2v14H6zM20 5v14L9 12z" /></svg>
        <button className="grid h-14 w-14 place-items-center rounded-full bg-white text-zinc-950 shadow-lg shadow-white/10" aria-label="Pause">
          <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" /></svg>
        </button>
        <svg viewBox="0 0 24 24" className="h-7 w-7 fill-white/90"><path d="M16 5h2v14h-2zM4 5v14l11-7z" /></svg>
      </div>
    </article>
  );
}
