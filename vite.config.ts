import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, open: true },
  // Never inline assets as data: URIs; the Content-Security-Policy only allows same-origin fonts.
  build: { assetsInlineLimit: 0 },
});
