import { ProductCard } from "@/components/ProductCard";

const user = { name: "Ayush" };

export default function Page() {
  return (
    <main>
      <h1>Hi {user.name}</h1>
      <ProductCard title="Wireless Headphones" price={99} tags={["audio", "bluetooth"]} onSale />
      <ProductCard title="USB-C Cable" price={9.5} />
    </main>
  );
}
