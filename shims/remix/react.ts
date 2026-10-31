/**
 * Remix v2's @remix-run/react outside a Remix server: the routing API comes from the project's own React Router
 * (Link, Form, useLoaderData, useNavigate...), and the document-only components render nothing.
 */
export * from "@arguseye/router";
export const Meta = () => null;
export const Links = () => null;
export const Scripts = () => null;
export const ScrollRestoration = () => null;
export const LiveReload = () => null;
export const PrefetchPageLinks = () => null;
