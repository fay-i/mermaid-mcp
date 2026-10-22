import { defineConfig } from "vitest/config";

const TRANSPORT_TESTS = "tests/behavior/transport/**/*.test.ts";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    projects: [
      {
        extends: true,
        test: {
          name: "behavior",
          include: ["tests/**/*.test.ts"],
          exclude: [TRANSPORT_TESTS],
          sequence: { groupOrder: 0 },
        },
      },
      {
        // These tests deliberately drive many concurrent renders. Running them
        // after the rest, one file at a time, keeps that load from starving
        // timing-sensitive tests elsewhere in the suite.
        extends: true,
        test: {
          name: "transport",
          include: [TRANSPORT_TESTS],
          fileParallelism: false,
          sequence: { groupOrder: 1 },
        },
      },
    ],
  },
});
