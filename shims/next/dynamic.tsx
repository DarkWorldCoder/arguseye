import { createElement, lazy, Suspense, type ComponentType } from "react";

type Loader<P> = () => Promise<ComponentType<P> | { default: ComponentType<P> }>;

/** `next/dynamic`: React.lazy with the `loading` component as the Suspense fallback; `ssr: false` changes nothing in a browser. */
export default function dynamic<P = {}>(loader: Loader<P> | { loader: Loader<P> }, options: { loading?: ComponentType<any>; ssr?: boolean } = {}) {
  const load = typeof loader === "function" ? loader : loader.loader;
  const Lazy = lazy(async () => {
    const mod: any = await load();
    return { default: mod?.default ?? mod };
  });
  const Loading = options.loading;
  return function Dynamic(props: P & {}) {
    return createElement(Suspense, { fallback: Loading ? createElement(Loading, { isLoading: true, pastDelay: true, error: null }) : null }, createElement(Lazy as any, props));
  };
}
