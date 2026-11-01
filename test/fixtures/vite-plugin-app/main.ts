import { createApp } from "vue";
import Card from "./Card.vue";
import brand from "virtual:brand";
const app = createApp(Card);
app.provide("brand", brand as string);
app.mount("#app");
