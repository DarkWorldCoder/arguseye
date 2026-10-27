import { ProductCard, Notice, Greet } from "@/components";

export default function ShopPage() {
  return (
    <section>
      <Notice title="Sale ends soon" tone="danger" />
      <ProductCard title="Standing Desk" price={499} />
      <Greet name="Shopper" />
    </section>
  );
}
