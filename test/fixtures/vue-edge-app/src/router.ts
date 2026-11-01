import { createRouter, createWebHistory } from "vue-router";
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "home", component: () => import("./components/RouteName.vue") },
    { path: "/settings", name: "settings", component: () => import("./components/StoreCounter.vue") },
  ],
});
