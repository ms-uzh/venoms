import { describe, expect, test, vi } from "vitest";
import { deployProduction, type CommandRunner } from "../scripts/deploy-production.mjs";

describe("production deployment", () => {
  test("promotes the search index only after Wrangler deploy succeeds", () => {
    const run = vi.fn<CommandRunner>();

    deployProduction(run);

    expect(run.mock.calls.map(([command, args]) => [command, args])).toEqual([
      ["npx", ["wrangler", "deploy"]],
      [process.execPath, ["scripts/seed-version.mjs", "--promote-only"]],
    ]);
  });

  test("does not promote when Wrangler deploy fails", () => {
    const error = new Error("deploy failed");
    const run = vi.fn<CommandRunner>(() => {
      throw error;
    });

    expect(() => deployProduction(run)).toThrow(error);
    expect(run).toHaveBeenCalledTimes(1);
  });
});
