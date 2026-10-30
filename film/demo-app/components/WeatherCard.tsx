type Hour = { time: string; temp: number; icon: "sun" | "cloud" | "rain" };

type WeatherCardProps = {
  city: string;
  temp: number;
  condition: string;
  high: number;
  low: number;
  hours?: Hour[];
};

function Icon({ kind, className }: { kind: Hour["icon"]; className?: string }) {
  if (kind === "sun")
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="4.5" fill="currentColor" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
          <line key={a} x1="12" y1="1.8" x2="12" y2="4.2" transform={`rotate(${a} 12 12)`} strokeLinecap="round" />
        ))}
      </svg>
    );
  if (kind === "rain")
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M7 15a4.5 4.5 0 1 1 1.3-8.8A5.5 5.5 0 0 1 18.5 9a3 3 0 0 1-.5 6Z" fill="currentColor" fillOpacity=".25" />
        <path d="M9 18l-1 2.5M13 18l-1 2.5M17 18l-1 2.5" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M7 18a5 5 0 1 1 1.4-9.8A6 6 0 0 1 19.5 11 3.5 3.5 0 0 1 19 18Z" fillOpacity=".9" />
    </svg>
  );
}

export function WeatherCard({
  city,
  temp,
  condition,
  high,
  low,
  hours = [
    { time: "Now", temp: 24, icon: "sun" },
    { time: "3 PM", temp: 25, icon: "sun" },
    { time: "4 PM", temp: 23, icon: "cloud" },
    { time: "5 PM", temp: 21, icon: "cloud" },
    { time: "6 PM", temp: 19, icon: "rain" },
  ],
}: WeatherCardProps) {
  return (
    <article className="relative w-[340px] overflow-hidden rounded-[28px] bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-600 p-6 text-white shadow-2xl shadow-blue-900/30">
      <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-amber-300/70 blur-2xl" />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-white/80">{city}</p>
          <p className="mt-1 text-7xl font-bold tracking-tighter">{temp}°</p>
          <p className="mt-1 text-sm text-white/90">{condition}</p>
          <p className="text-sm text-white/70">H:{high}°  L:{low}°</p>
        </div>
        <Icon kind="sun" className="h-16 w-16 text-amber-200 drop-shadow" />
      </div>
      <div className="relative mt-6 grid grid-cols-5 gap-2 rounded-2xl bg-white/15 p-3 ring-1 ring-white/20 backdrop-blur">
        {hours.map((h) => (
          <div key={h.time} className="flex flex-col items-center gap-1.5 text-xs">
            <span className="text-white/80">{h.time}</span>
            <Icon kind={h.icon} className="h-6 w-6" />
            <span className="font-semibold">{h.temp}°</span>
          </div>
        ))}
      </div>
    </article>
  );
}
