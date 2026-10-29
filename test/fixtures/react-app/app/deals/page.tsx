import { ProductCard } from "@/components/ProductCard";

export default function DealsPage() {
  return (
    <main style={{ background: "rgb(17, 24, 39)", padding: 24 }}>
      <aside className="rail" style={{ width: 320, height: 260, display: "flex" }}>
        <ProductCard title="Deal of the day" price={49} onSale />
      </aside>
    </main>
  );
}
