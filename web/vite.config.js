import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // @ds alias for the components directory
  resolve: {
    alias: {
      "@components": path.resolve(__dirname, "./src/components"),
      "@images": path.resolve(__dirname, "./src/assets/images"),
      "@constants": path.resolve(__dirname, "./src/constants"),
      "@context": path.resolve(__dirname, "./src/context"),
      "@assets": path.resolve(__dirname, "./src/assets"),
      "@views": path.resolve(__dirname, "./src/views"),
      "@utils": path.resolve(__dirname, "./src/utils"),
      "@ds": path.resolve(__dirname, "./src/ds"),
    },
  },
  server: {
    proxy: {
      // Add development proxies here when needed
    },
  },
});
