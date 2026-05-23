import { describe, it, expect } from "vitest";
import { parseActions, expandHome } from "../src/config";

describe("parseActions", () => {
  it("parses a valid action with prompt", () => {
    const json = JSON.stringify([
      {
        id: "a",
        name: "Ask Claude",
        cwd: "~/foo",
        command: "claude",
        prompt: { submitVia: "send-text" },
      },
    ]);
    const result = parseActions(json);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.actions[0].placement).toBe("tab");
      expect(result.actions[0].focus).toBe(true);
    }
  });

  it("parses a promptless action", () => {
    const json = JSON.stringify([
      { id: "b", name: "Shell", cwd: "~/projects", command: "zsh" },
    ]);
    const result = parseActions(json);
    expect(result.ok).toBe(true);
  });

  it("rejects missing command", () => {
    const json = JSON.stringify([{ id: "c", name: "x", cwd: "~/" }]);
    const result = parseActions(json);
    expect(result.ok).toBe(false);
  });

  it("rejects bad placement", () => {
    const json = JSON.stringify([
      { id: "d", name: "x", cwd: "~/", command: "ls", placement: "elsewhere" },
    ]);
    const result = parseActions(json);
    expect(result.ok).toBe(false);
  });

  it("rejects unknown fields (strict)", () => {
    const json = JSON.stringify([
      { id: "e", name: "x", cwd: "~/", command: "ls", extra: true },
    ]);
    const result = parseActions(json);
    expect(result.ok).toBe(false);
  });

  it("returns an error message for malformed JSON", () => {
    const result = parseActions("not json");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/JSON/);
  });
});

describe("expandHome", () => {
  it("replaces leading ~ with HOME", () => {
    process.env.HOME = "/Users/test";
    expect(expandHome("~/foo")).toBe("/Users/test/foo");
  });

  it("leaves absolute paths alone", () => {
    expect(expandHome("/abs/path")).toBe("/abs/path");
  });
});
