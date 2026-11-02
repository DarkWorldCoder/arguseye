import { imported, viaGlobal } from "uses-node-buffer";

export function TokenBadge() {
  return <p>{imported}, {viaGlobal}</p>;
}
