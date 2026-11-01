<script setup lang="ts">
// A Nuxt component: no imports, Nuxt composables and built-in components.
const route = useRoute();
const config = useRuntimeConfig();
const cart = useCart();
const { data: product } = await useFetch("/api/products/1", { default: () => ({ name: "Desk lamp", price: 49 }) });
useHead({ title: "Product" });
</script>
<template>
  <article>
    <h3>{{ product?.name }}</h3>
    <PriceBadge :amount="product?.price ?? 0" />
    <ClientOnly><span>Cart {{ cart.items }}</span></ClientOnly>
    <NuxtLink to="/cart">View cart</NuxtLink>
    <NuxtImg src="/lamp.png" alt="Lamp photo" width="40" />
    <Icon name="mdi:star">starred</Icon>
    <small>route {{ route.path }}</small>
  </article>
</template>
