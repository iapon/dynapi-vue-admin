import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// Stable output names: the site template references /static/admin.js and
// /static/admin.css, and the static files are pushed to the site with those
// exact paths (flowctl files push).
export default defineConfig({
  plugins: [vue()],
  build: {
    outDir: "dist",
    rollupOptions: {
      input: "src/main.ts",
      output: {
        entryFileNames: "admin.js",
        assetFileNames: "admin.[ext]",
        format: "es",
      },
    },
  },
});
