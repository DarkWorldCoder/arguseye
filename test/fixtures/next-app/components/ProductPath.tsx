"use client";
import { useParams, usePathname } from "next/navigation";

export function ProductPath() {
  const pathname = usePathname();
  const { id } = useParams<{ id: string }>();
  return <p>Viewing {pathname} (product {id})</p>;
}
