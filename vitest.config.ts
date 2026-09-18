import { defineConfig } from "vitest/config";
import path from "node:path";
import { realpathSync } from "node:fs";

// On Windows, the shell may use e: while Node resolves pnpm links under E:.
// Use the filesystem's canonical root so Vite and CommonJS share one React.
const projectRoot = realpathSync.native(__dirname);
// Mock IDs also depend on cwd: canonicalizing root alone splits vi.mock IDs
// from the modules they replace. Keep both paths aligned before workers start.
process.chdir(projectRoot);

export default defineConfig({
  root: projectRoot,
  resolve: {
    alias: {
      "@": path.resolve(projectRoot, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: [path.join(projectRoot, "vitest.setup.ts")],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
