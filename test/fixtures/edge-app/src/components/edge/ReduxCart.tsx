import { useSelector } from "react-redux";
import type { RootState } from "@/lib/store";
export default function ReduxCart() { const n = useSelector((s: RootState) => s.cart.items); return <p>Cart has {n} items</p>; }
