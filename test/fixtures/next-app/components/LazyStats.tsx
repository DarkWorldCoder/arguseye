import dynamic from "next/dynamic";

const HeavyStats = dynamic(() => import("./HeavyStats"), { loading: () => <p>Loading stats…</p>, ssr: false });

export function LazyStats() {
  return <section><HeavyStats /></section>;
}
