import { cache } from "react";

const label = cache((n: number) => `cached ${n}`);

export function Cached() {
  return <b>{label(7)}</b>;
}
