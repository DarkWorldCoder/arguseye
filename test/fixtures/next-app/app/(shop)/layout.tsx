export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <section id="shop-area" style={{ padding: 40, background: "rgb(240, 253, 244)" }}>
      <h1>Shop</h1>
      <div className="shop-content">{children}</div>
    </section>
  );
}
