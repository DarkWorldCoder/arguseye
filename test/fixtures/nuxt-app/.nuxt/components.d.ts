import type { DefineComponent, SlotsType } from 'vue'
type HydrationStrategies = {}
interface _GlobalComponents {
      'PriceBadge': typeof import("../components/PriceBadge.vue")['default']
    'ProductCard': typeof import("../components/ProductCard.vue")['default']
    'NuxtLink': typeof import("../node_modules/nuxt/dist/app/components/nuxt-link")['default']
    'ClientOnly': typeof import("../node_modules/nuxt/dist/app/components/client-only")['default']
    'NuxtImg': typeof import("../node_modules/@nuxt/image/dist/runtime/components/NuxtImg.vue")['default']
    'NuxtPage': typeof import("../node_modules/nuxt/dist/pages/runtime/page")['default']
    'Icon': typeof import("../node_modules/@nuxt/icon/dist/runtime/components/index")['default']
}
declare module 'vue' {
  export interface GlobalComponents extends _GlobalComponents { }
}
export {}
