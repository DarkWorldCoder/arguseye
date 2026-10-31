import { useEffect, useState } from "react";
export default function DynamicImport() {
  const [label, setLabel] = useState("…");
  useEffect(() => { import("./plans.json").then((m) => setLabel(m.default.plans.join(" / "))); }, []);
  return <p>Plans: {label}</p>;
}
