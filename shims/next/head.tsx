import { useEffect, type ReactNode } from "react";

/** `next/head`: the <title> it sets is applied to the document; nothing renders in place. */
export default function Head({ children }: { children?: ReactNode }) {
  useEffect(() => {
    const list = Array.isArray(children) ? children : [children];
    const title = list.find((c: any) => c?.type === "title") as any;
    if (title) document.title = [].concat(title.props.children).join("");
  });
  return null;
}
