import { useEffect, useState } from "react";
export default function LiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 50); return () => clearInterval(id); }, []);
  return <time>Clock {now.getFullYear() > 2000 ? "running" : "?"}</time>;
}
