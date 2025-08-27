import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@db": path.resolve(import.meta.dirname, "db"),
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port: parseInt(process.env.FRONTEND_DEV_PORT || '8053', 10),
    host: '0.0.0.0',
    strictPort: true,
    proxy: {
      '/api': {
        target: `http://localhost:${process.env.EXPRESS_API_PORT || '8052'}`,
        changeOrigin: true,
        secure: false,
      },
    },
  },
  preview: {
    port: parseInt(process.env.FRONTEND_PROD_PORT || '8054', 10),
    host: '0.0.0.0',
  }
});
