import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  server: {
    port: 8080,
  },
  plugins: [
    tsconfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    // Keep TanStack Start's bundled server entry redirected to src/server.ts
    // (the SSR error wrapper).
    tanstackStart({ server: { entry: "server" } }),
    viteReact(),
  ],
});
