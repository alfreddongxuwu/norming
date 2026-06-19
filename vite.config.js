import { defineConfig } from "vite";

export default defineConfig({
  base: "/norming/",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});

