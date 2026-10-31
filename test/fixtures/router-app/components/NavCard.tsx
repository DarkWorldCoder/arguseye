import { Link, NavLink, useLocation, useNavigate } from "react-router";

/** Uses the router's own Link, NavLink and hooks, which throw outside a router. */
export function NavCard({ title }: { title: string }) {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <nav aria-label={title}>
      <h2>{title}</h2>
      <Link to="/docs">Docs</Link>
      <NavLink to="/" end>Home</NavLink>
      <p data-path>{location.pathname}</p>
      <button onClick={() => navigate("/settings")}>Settings</button>
    </nav>
  );
}
