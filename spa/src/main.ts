import { createApp } from "vue";
import App from "./App.vue";

// Theme boot: same convention as the platform (localStorage 'dynamica-theme',
// fallback prefers-color-scheme). App.vue styles key off data-theme.
try {
  const stored = localStorage.getItem("dynamica-theme");
  const dark =
    stored === "dynamica-dark" ||
    (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.setAttribute("data-theme", dark ? "dynamica-dark" : "dynamica-light");
} catch {
  document.documentElement.setAttribute("data-theme", "dynamica-light");
}

createApp(App).mount("#app");
