const saved = typeof window !== "undefined" ? window.localStorage.getItem("name") : null;
export default function StorageGreeting() { return <p>Hello {saved ?? "guest"} ({window.innerWidth > 500 ? "wide" : "narrow"})</p>; }
