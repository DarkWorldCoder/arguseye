import { useState } from "react";

export function Menu({ items }: { items: string[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const theme = typeof localStorage !== "undefined" ? localStorage.getItem("theme") ?? "light" : "light";
  return (
    <div data-theme={theme} style={{ background: theme === "dark" ? "rgb(17, 17, 17)" : "rgb(255, 255, 255)" }}>
      <button onClick={() => setOpen((o) => !o)}>{open ? "Close" : "Open"} menu</button>
      {open && (
        <div role="menu">
          <input aria-label="Filter" value={query} onChange={(e) => setQuery(e.target.value)} />
          {items.filter((i) => i.toLowerCase().includes(query.toLowerCase())).map((i) => <div role="menuitem" key={i}>{i}</div>)}
        </div>
      )}
    </div>
  );
}
