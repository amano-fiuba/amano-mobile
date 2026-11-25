import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Proxy de desarrollo: mismo trazado que frontend/nginx.conf en producción
  // (T005 de specs/001-user-registration/tasks.md; D9 de research.md).
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: false,
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./vitest.setup.js",
    coverage: {
      provider: "v8",
      include: ["src/**/*.{js,jsx}"],
      exclude: ["src/main.jsx"],
      reporter: ["text", "html"],
      thresholds: {
        lines: 85,
        statements: 85,
      },
    },
  },
});
