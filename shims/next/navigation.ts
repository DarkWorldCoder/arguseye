/** Next's app-router hooks for a page that is not inside Next: a static route with no-op navigation. */
const router = {
  push: () => {}, replace: () => {}, back: () => {}, forward: () => {}, refresh: () => {}, prefetch: () => Promise.resolve(),
};
export const useRouter = () => router;
export const usePathname = () => "/";
export const useSearchParams = () => new URLSearchParams();
export const useParams = () => ({});
export const useSelectedLayoutSegment = () => null;
export const useSelectedLayoutSegments = () => [];
export const useServerInsertedHTML = () => {};
export const redirect = (url: string): never => { throw new Error(`redirect(${url}) called in a preview`); };
export const permanentRedirect = redirect;
export const notFound = (): never => { throw new Error("notFound() called in a preview"); };
export const forbidden = notFound;
export const unauthorized = notFound;
export class ReadonlyURLSearchParams extends URLSearchParams {}
