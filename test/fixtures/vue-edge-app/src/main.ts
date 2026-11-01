import { createApp } from "vue";
import { createPinia } from "pinia";
import ElementPlus from "element-plus";
import "element-plus/dist/index.css";
import App from "./App.vue";
import { router } from "./router";
import { i18n } from "./i18n";
import "./style.scss";

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.use(i18n);
app.use(ElementPlus);
app.provide("theme", { accent: "rgb(14, 116, 144)" });
app.directive("focus", { mounted: (el) => el.focus() });
app.mount("#app");
