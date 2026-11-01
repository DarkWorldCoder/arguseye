/** Nuxt's runtime composables for a component rendered outside Nuxt: no server, so data calls resolve empty. */
import { computed, reactive, ref } from "vue";

const route = reactive({ path: "/", fullPath: "/", name: "index", params: {} as Record<string, string>, query: {} as Record<string, string>, hash: "", meta: {} as Record<string, unknown>, matched: [] as unknown[] });
const router = { push: async () => {}, replace: async () => {}, back: () => {}, forward: () => {}, go: () => {}, beforeEach: () => () => {}, afterEach: () => () => {}, resolve: (to: any) => ({ href: typeof to === "string" ? to : to?.path ?? "/" }), currentRoute: computed(() => route) };
const states = new Map<string, ReturnType<typeof ref>>();

/** useFetch / useAsyncData: no backend in a preview, so data is the `default()` option (or null) and status "success". */
const asyncData = (options: any = {}) => {
  const data = ref(typeof options.default === "function" ? options.default() : null);
  const result = { data, pending: ref(false), status: ref("success"), error: ref(null), refresh: async () => {}, execute: async () => {}, clear: () => { data.value = null; } };
  // Callers both `await useFetch()` and use it without await.
  return Object.assign(Promise.resolve(result), result);
};
export const useFetch = (_url?: unknown, options?: any) => asyncData(options);
export const useLazyFetch = useFetch;
export const useAsyncData = (key?: unknown, _handler?: unknown, options?: any) => asyncData(typeof key === "string" ? options : _handler);
export const useLazyAsyncData = useAsyncData;
export const $fetch = Object.assign(async () => null, { raw: async () => ({ _data: null }), create: () => $fetch });
export const refreshNuxtData = async () => {};
export const clearNuxtData = () => {};
export const useState = <T>(key: string, init?: () => T) => {
  if (!states.has(key)) states.set(key, ref(init ? init() : undefined));
  return states.get(key)!;
};
export const clearNuxtState = () => states.clear();
export const useRoute = () => route;
export const useRouter = () => router;
export const navigateTo = async () => {};
export const abortNavigation = () => {};
export const addRouteMiddleware = () => {};
export const defineNuxtRouteMiddleware = (fn: unknown) => fn;
export const definePageMeta = () => {};
export const useHead = () => {};
export const useSeoMeta = () => {};
export const useServerSeoMeta = () => {};
export const useHeadSafe = () => {};
export const useRuntimeConfig = () => ({ public: {}, app: { baseURL: "/", buildAssetsDir: "/_nuxt/" } });
export const useAppConfig = () => ({});
export const useCookie = (name: string, options: any = {}) => useState("cookie:" + name, () => (typeof options.default === "function" ? options.default() : null));
export const useRequestHeaders = () => ({});
export const useRequestEvent = () => undefined;
export const useRequestURL = () => new URL("/", location.origin);
export const useNuxtApp = () => ({ $router: router, $config: useRuntimeConfig(), isHydrating: false, payload: { data: {}, state: {} }, hook: () => () => {}, callHook: async () => {}, provide: () => {} });
export const useError = () => ref(null);
export const createError = (input: any) => Object.assign(new Error(typeof input === "string" ? input : input?.message ?? "Error"), typeof input === "object" ? input : {});
export const showError = (input: any) => { throw createError(input); };
export const clearError = async () => {};
export const onNuxtReady = (fn: () => void) => { queueMicrotask(fn); };
export const callOnce = async (keyOrFn: unknown, fn?: () => unknown) => { await (typeof keyOrFn === "function" ? (keyOrFn as () => unknown)() : fn?.()); };
export const defineNuxtComponent = (component: unknown) => component;
export const defineNuxtPlugin = (plugin: unknown) => plugin;
export const isPrerendered = () => false;
export const prerenderRoutes = () => {};
export const preloadComponents = async () => {};
export const prefetchComponents = async () => {};
export const reloadNuxtApp = () => {};
export const setPageLayout = () => {};
export const useLoadingIndicator = () => ({ progress: ref(0), isLoading: ref(false), start: () => {}, finish: () => {}, clear: () => {} });
export const usePreviewMode = () => ({ enabled: ref(false), state: reactive({}) });
export const isNuxtError = (error: unknown) => error instanceof Error && "statusCode" in (error as object);
export const refreshCookie = () => {};
export const useNuxtData = () => ({ data: ref(null) });
export const tryUseNuxtApp = useNuxtApp;
export const definePayloadPlugin = defineNuxtPlugin;
export const defineAppConfig = (config: unknown) => config;
export const updateAppConfig = () => {};
export const useHydration = () => {};
export const useId = () => "preview-id";
export const useScript = () => ({ status: ref("loaded"), load: async () => {}, proxy: {} });
export const defineNuxtLink = () => ({});
