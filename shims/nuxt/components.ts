/** Nuxt's built-in components outside Nuxt: links are anchors, client-only content renders, page outlets are empty. */
import { defineComponent, h } from "vue";

const href = (to: any) => (typeof to === "string" ? to : to?.path ?? "/");
export const NuxtLink = defineComponent({
  name: "NuxtLink",
  props: { to: [String, Object], href: [String, Object], external: Boolean, target: String, rel: String },
  setup: (props, { slots, attrs }) => () => h("a", { ...attrs, href: href(props.to ?? props.href), target: props.target, rel: props.rel }, slots.default?.()),
});
export const ClientOnly = defineComponent({ name: "ClientOnly", setup: (_, { slots }) => () => slots.default?.() });
export const DevOnly = ClientOnly;
export const NuxtPage = defineComponent({ name: "NuxtPage", setup: () => () => null });
export const NuxtLayout = defineComponent({ name: "NuxtLayout", setup: (_, { slots }) => () => slots.default?.() });
export const NuxtLoadingIndicator = defineComponent({ name: "NuxtLoadingIndicator", setup: () => () => null });
export const NuxtRouteAnnouncer = NuxtLoadingIndicator;
export const NuxtWelcome = NuxtLoadingIndicator;
export const NuxtErrorBoundary = defineComponent({ name: "NuxtErrorBoundary", setup: (_, { slots }) => () => slots.default?.() });
export const NuxtImg = defineComponent({
  name: "NuxtImg",
  props: { src: String, alt: String, width: [String, Number], height: [String, Number] },
  setup: (props, { attrs }) => () => h("img", { ...attrs, src: props.src, alt: props.alt, width: props.width, height: props.height }),
});
export const NuxtPicture = NuxtImg;
export const Title = defineComponent({ name: "Title", setup: () => () => null });
export const Meta = Title;
export const Head = Title;
export const Link = Title;
export const Body = defineComponent({ name: "Body", setup: (_, { slots }) => () => slots.default?.() });
export const Html = Body;
