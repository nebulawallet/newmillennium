import { defineConfig } from "vite";
import { contentPlugin } from "./scripts/vite/contentPlugin.ts";

export default defineConfig({
  plugins: [contentPlugin()],
  server: { port: 5173, strictPort: true },
  build: { target: "es2022", chunkSizeWarningLimit: 2000 },
});
