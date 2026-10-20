import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// 公開パスは GitHub Pages の `/<リポジトリ名>/`。content/ をそのままサイトのルートに配信する。
export default defineConfig({
  base: "/project-manager-training-6/",
  publicDir: "../content",
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
