import { DiscountProvider } from "@/providers/DiscountProvider";

export default function ShopTemplate({ children }: { children: React.ReactNode }) {
  return <DiscountProvider percent={15}>{children}</DiscountProvider>;
}
