import { useBadge } from "@/lib/useBadge";
export default function ZustandBadge() { const c = useBadge((s) => s.count); return <span>Badge {c}</span>; }
