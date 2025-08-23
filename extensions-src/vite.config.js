import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: resolve(__dirname, "../extensions/product-designer-dev/assets"),
    emptyOutDir: false,
    copyPublicDir: false,
    rollupOptions: {
      input: resolve(__dirname, "index.jsx"),
      output: {
        entryFileNames: "bundle.js",
        format: "iife", // works in Shopify theme
      },
    },
  },
});
