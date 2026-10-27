import { useState } from "react";
import clsx from "clsx";
import { formatPrice } from "@/components/format";
import "./ProductCard.css";

export type ProductCardProps = {
  title: string;
  price: number;
  tags?: string[];
  onSale?: boolean;
};

export function ProductCard({ title, price, tags = [], onSale = false }: ProductCardProps) {
  const [count, setCount] = useState(0);
  return (
    <article className={clsx("card", onSale && "card--sale")}>
      <h2 className="card__title">{title}</h2>
      <p className="card__price">{formatPrice(price)}</p>
      <ul>{tags.map((t) => <li key={t}>{t}</li>)}</ul>
      <button onClick={() => setCount((c) => c + 1)}>Add to cart ({count})</button>
    </article>
  );
}

export default ProductCard;
