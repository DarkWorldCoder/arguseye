import { createElement } from "react";

/** Next's pages-router `next/router` outside Next: the component's route with no-op navigation and a quiet event bus. */
const cp = () => (globalThis as any).__CP__ ?? {};
const events = { on: () => {}, off: () => {}, emit: () => {} };
const router = {
  // As in Next: pathname and route are the pattern ("/blog/[slug]"), asPath the URL ("/blog/1").
  get pathname() { return cp().pattern ?? "/"; },
  get asPath() { return cp().pathname ?? "/"; },
  get route() { return cp().pattern ?? "/"; },
  get query() { return cp().params ?? {}; },
  basePath: "",
  locale: undefined, locales: undefined, defaultLocale: undefined,
  isReady: true, isFallback: false, isPreview: false, isLocaleDomain: false,
  push: async () => true, replace: async () => true, reload: () => {}, back: () => {}, forward: () => {},
  prefetch: async () => {}, beforePopState: () => {},
  events,
};
export const useRouter = () => router;
export const withRouter = (Component: any) => (props: any) => createElement(Component, { ...props, router });
export const Router = router;
export default router;
