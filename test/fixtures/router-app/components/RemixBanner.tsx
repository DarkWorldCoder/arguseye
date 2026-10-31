import { Link, Meta, useLocation } from "@remix-run/react";

/** A Remix v2 component: routing from @remix-run/react, plus a document-only export. */
export function RemixBanner({ text }: { text: string }) {
  const { pathname } = useLocation();
  return (
    <aside>
      <Meta />
      <p>{text}</p>
      <Link to="/pricing">See pricing</Link>
      <small>{pathname}</small>
    </aside>
  );
}
