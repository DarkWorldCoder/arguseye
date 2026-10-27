import Link from "next/link";
import Image from "next/image";
import badge from "./badge.svg";

export function Nav() {
  return (
    <nav data-env={process.env.NODE_ENV}>
      <Link href="/pricing" prefetch={false} className="font-bold">Pricing</Link>
      <Link href={{ pathname: "/docs", query: { v: "2" } }}>Docs</Link>
      <Image src={badge} alt="Badge" priority />
      <div style={{ position: "relative", width: 48, height: 24 }}>
        <Image src="/dot.svg" alt="Dot" fill style={{ objectFit: "cover" }} />
      </div>
    </nav>
  );
}
