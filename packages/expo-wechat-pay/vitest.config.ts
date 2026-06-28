import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "expo-modules-core": resolve(__dirname, "src/test-expo-modules-core.ts") } },
  test: { environment: "node" },
});
