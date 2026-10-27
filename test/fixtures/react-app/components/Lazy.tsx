import { lazy, Suspense } from "react";

const ProductCard = lazy(() => import("./ProductCard"));

export async function priceLabel(price: number) {
  const { formatPrice } = await import("./format");
  return formatPrice(price);
}

export function Lazy() {
  return <Suspense fallback="loading"><ProductCard title="Lazy" price={1} /></Suspense>;
}
