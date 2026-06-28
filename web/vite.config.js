import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";
import path from "path";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // Derive the backend origin from VITE_API_BASE (strip the trailing /api) so that
  // root-relative asset URLs like /data/<topic>/images/... can be proxied to the
  // Go server during development. In production both are served from one origin.
  const apiBase = env.VITE_API_BASE || "/api";
  let backendOrigin = "";
  try {
    backendOrigin = new URL(apiBase).origin;
  } catch {
    backendOrigin = "";
  }

  return {
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
      proxy: backendOrigin
        ? {
            // Proxy generated research assets (chapter images) to the Go backend
            // so root-relative /data URLs resolve during development.
            "/data": {
              target: backendOrigin,
              changeOrigin: true,
            },
          }
        : {},
    },
  };
});
