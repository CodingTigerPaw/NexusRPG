import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => ({
  server: {
    port: 5173,
  },
  plugins: [sveltekit()],
  resolve:
    mode === "test"
      ? {
          conditions: ["browser"],
        }
      : undefined,
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,js}"],
    reporters: ["verbose"],
    setupFiles: ["src/test/setup.ts"],
  },
}));
