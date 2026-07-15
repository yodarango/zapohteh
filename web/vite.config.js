import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";
import path from "path";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // Load the root .env so TANJREEN_API_KEY can be used by the frontend build.
  const rootEnv = loadEnv(mode, path.resolve(__dirname, ".."), "TANJREEN_");
  // Derive the backend origin from VITE_API_BASE (strip the trailing /api) so that
  // root-relative asset URLs like /data/<topic>/images/... can be proxied to the
  // Go server during development. In production both are served from one origin.
  const apiBase = env.VITE_API_BASE || "/api";
  let backendOrigin = "";
  try {
    backendOrigin = new URL(apiBase).origin;
  } catch {
    // If VITE_API_BASE is a root-relative path, default to the local Go backend.
    backendOrigin = "http://localhost:8014";
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
    define: {
      "import.meta.env.TANJREEN_API_URL": JSON.stringify(
        rootEnv.TANJREEN_API_URL || "https://tanjreen.shrood.app/api/transform",
      ),
      "import.meta.env.TANJREEN_API_KEY": JSON.stringify(
        rootEnv.TANJREEN_API_KEY || "",
      ),
    },
    server: {
      proxy: backendOrigin
        ? {
            // Proxy API requests to the Go backend during development.
            "/api": {
              target: backendOrigin,
              changeOrigin: true,
            },
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
