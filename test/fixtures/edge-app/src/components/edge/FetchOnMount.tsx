import { useEffect, useState } from "react";
export default function FetchOnMount() {
  const [state, setState] = useState("Loading user…");
  useEffect(() => { fetch("/api/user").then((r) => r.json()).then((u) => setState(u.name)).catch(() => setState("Could not load user")); }, []);
  return <p>{state}</p>;
}
