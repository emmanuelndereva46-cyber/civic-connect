import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },

  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;

          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) {
            return "react-vendor";
          }

          if (id.includes("node_modules/lucide-react/")) {
            return "icons";
          }

          if (id.includes("node_modules/react-router-dom/")) {
            return "router";
          }

          if (id.includes("node_modules/axios/")) {
            return "api";
          }

          return "vendor";
        },
      },
    },
  },
});
