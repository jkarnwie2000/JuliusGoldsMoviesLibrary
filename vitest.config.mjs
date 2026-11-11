import { defineConfig } from "vitest/config";

// Vitest runs the unit tests for shared logic and the Vercel serverless functions
// (tests/**). React component tests live in src/ and run with React Testing
// Library via `npm test` (Create React App's Jest runner).
export default defineConfig({
  test: {
    include: ["tests/**/*.test.mjs"],
    environment: "node",
    restoreMocks: true,
    unstubGlobals: true,
    unstubEnvs: true,
  },
});
