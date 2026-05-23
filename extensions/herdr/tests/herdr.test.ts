import { describe, it, expect, vi } from "vitest";
import { createHerdr } from "../src/herdr";

function makeShStub(responses: Record<string, string>) {
  const calls: Array<{ bin: string; args: string[] }> = [];
  const sh = vi.fn(async (bin: string, args: string[]) => {
    calls.push({ bin, args });
    const key = [bin, ...args].join(" ");
    for (const k of Object.keys(responses)) {
      if (key.startsWith(k)) return responses[k];
    }
    return "";
  });
  return { sh, calls };
}

describe("listWorkspaces", () => {
  it("parses workspace list JSON", async () => {
    const { sh } = makeShStub({
      "herdr workspace list": JSON.stringify({
        result: { workspaces: [{ workspace_id: "1", label: "a", focused: true, cwd: "/x", tab_count: 2 }] },
      }),
    });
    const h = createHerdr({ sh, bin: "herdr" });
    const out = await h.listWorkspaces();
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("1");
    expect(out[0].focused).toBe(true);
  });
});

describe("currentWorkspaceId", () => {
  it("returns the focused workspace id", async () => {
    const { sh } = makeShStub({
      "herdr workspace list": JSON.stringify({
        result: {
          workspaces: [
            { workspace_id: "1", label: "a", focused: false, cwd: "/x", tab_count: 1 },
            { workspace_id: "2", label: "b", focused: true, cwd: "/y", tab_count: 1 },
          ],
        },
      }),
    });
    const h = createHerdr({ sh, bin: "herdr" });
    expect(await h.currentWorkspaceId()).toBe("2");
  });

  it("falls back to focused pane prefix when no focused workspace flag", async () => {
    const { sh } = makeShStub({
      "herdr workspace list": JSON.stringify({
        result: { workspaces: [{ workspace_id: "3", label: "x", cwd: "/", tab_count: 1 }] },
      }),
      "herdr pane list": JSON.stringify({
        result: { panes: [{ pane_id: "3-2", focused: true }] },
      }),
    });
    const h = createHerdr({ sh, bin: "herdr" });
    expect(await h.currentWorkspaceId()).toBe("3");
  });
});

describe("focusedPaneId", () => {
  it("returns the focused pane id", async () => {
    const { sh } = makeShStub({
      "herdr pane list": JSON.stringify({
        result: {
          panes: [
            { pane_id: "1-1", focused: false },
            { pane_id: "1-2", focused: true },
          ],
        },
      }),
    });
    const h = createHerdr({ sh, bin: "herdr" });
    expect(await h.focusedPaneId()).toBe("1-2");
  });
});

describe("focusWorkspace", () => {
  it("calls workspace focus with the id", async () => {
    const { sh, calls } = makeShStub({});
    const h = createHerdr({ sh, bin: "herdr" });
    await h.focusWorkspace("2");
    expect(calls).toContainEqual({ bin: "herdr", args: ["workspace", "focus", "2"] });
  });
});

import type { Action } from "../src/config";

function actionDefaults(overrides: Partial<Action> = {}): Action {
  return {
    id: "t",
    name: "T",
    cwd: "/abs/path",
    command: "echo hi",
    placement: "tab",
    focus: true,
    ...overrides,
  } as Action;
}

describe("runAction placement", () => {
  it("workspace placement: workspace create + pane run", async () => {
    const { sh, calls } = makeShStub({
      "herdr workspace create": JSON.stringify({ result: { root_pane: { pane_id: "5-1" } } }),
    });
    const h = createHerdr({ sh, bin: "herdr" });
    await h.runAction(actionDefaults({ placement: "workspace", label: "vault" }));
    expect(calls[0]).toEqual({
      bin: "herdr",
      args: ["workspace", "create", "--cwd", "/abs/path", "--label", "vault"],
    });
    expect(calls[1]).toEqual({ bin: "herdr", args: ["pane", "run", "5-1", "echo hi"] });
  });

  it("tab placement: workspace list + tab create + cd + pane run", async () => {
    const { sh, calls } = makeShStub({
      "herdr workspace list": JSON.stringify({
        result: { workspaces: [{ workspace_id: "1", label: "x", focused: true, cwd: "/", tab_count: 1 }] },
      }),
      "herdr tab create": JSON.stringify({ result: { root_pane: { pane_id: "1-3" } } }),
    });
    const h = createHerdr({ sh, bin: "herdr" });
    await h.runAction(actionDefaults({ placement: "tab" }));
    expect(calls).toContainEqual({ bin: "herdr", args: ["tab", "create", "--workspace", "1"] });
    expect(calls).toContainEqual({ bin: "herdr", args: ["pane", "run", "1-3", "cd '/abs/path'"] });
    expect(calls).toContainEqual({ bin: "herdr", args: ["pane", "run", "1-3", "echo hi"] });
  });

  it("split placement: pane list + split + cd + pane run", async () => {
    const { sh, calls } = makeShStub({
      "herdr pane list": JSON.stringify({ result: { panes: [{ pane_id: "2-1", focused: true }] } }),
      "herdr pane split": JSON.stringify({ result: { pane: { pane_id: "2-2" } } }),
    });
    const h = createHerdr({ sh, bin: "herdr" });
    await h.runAction(actionDefaults({ placement: "split" }));
    expect(calls).toContainEqual({ bin: "herdr", args: ["pane", "split", "2-1", "--direction", "right"] });
    expect(calls).toContainEqual({ bin: "herdr", args: ["pane", "run", "2-2", "cd '/abs/path'"] });
    expect(calls).toContainEqual({ bin: "herdr", args: ["pane", "run", "2-2", "echo hi"] });
  });

  it("focus=false adds --no-focus to create/split calls", async () => {
    const { sh, calls } = makeShStub({
      "herdr workspace create": JSON.stringify({ result: { root_pane: { pane_id: "9-1" } } }),
    });
    const h = createHerdr({ sh, bin: "herdr" });
    await h.runAction(actionDefaults({ placement: "workspace", focus: false }));
    expect(calls[0].args).toContain("--no-focus");
  });

  it("expands ~ in cwd", async () => {
    process.env.HOME = "/Users/test";
    const { sh, calls } = makeShStub({
      "herdr workspace create": JSON.stringify({ result: { root_pane: { pane_id: "1-1" } } }),
    });
    const h = createHerdr({ sh, bin: "herdr" });
    await h.runAction(actionDefaults({ placement: "workspace", cwd: "~/foo" }));
    expect(calls[0].args).toEqual(["workspace", "create", "--cwd", "/Users/test/foo"]);
  });
});

describe("runAction prompt delivery", () => {
  it("submitVia=arg substitutes {prompt} (shell-quoted) into command", async () => {
    const { sh, calls } = makeShStub({
      "herdr workspace create": JSON.stringify({ result: { root_pane: { pane_id: "1-1" } } }),
    });
    const h = createHerdr({ sh, bin: "herdr" });
    await h.runAction(
      actionDefaults({
        placement: "workspace",
        command: "claude {prompt}",
        prompt: { submitVia: "arg", required: true, label: "Prompt" },
      }),
      "what's up?",
    );
    expect(calls).toContainEqual({ bin: "herdr", args: ["pane", "run", "1-1", `claude 'what'\\''s up?'`] });
  });

  it("submitVia=send-text waits for ready, sends text, presses Enter", async () => {
    const { sh, calls } = makeShStub({
      "herdr workspace create": JSON.stringify({ result: { root_pane: { pane_id: "1-1" } } }),
    });
    const h = createHerdr({ sh, bin: "herdr" });
    await h.runAction(
      actionDefaults({
        placement: "workspace",
        command: "claude",
        prompt: { submitVia: "send-text", required: true, label: "Prompt" },
      }),
      "hello",
    );
    const cmds = calls.map((c) => c.args.join(" "));
    const waitIdx = cmds.findIndex((s) => s.startsWith("wait output 1-1"));
    const sendIdx = cmds.findIndex((s) => s.startsWith("pane send-text 1-1"));
    const enterIdx = cmds.findIndex((s) => s.startsWith("pane send-keys 1-1 Enter"));
    expect(waitIdx).toBeGreaterThan(-1);
    expect(sendIdx).toBeGreaterThan(waitIdx);
    expect(enterIdx).toBeGreaterThan(sendIdx);
  });

  it("submitVia=send-text falls back to delay when wait output errors", async () => {
    const calls: Array<{ bin: string; args: string[] }> = [];
    const sh = vi.fn(async (bin: string, args: string[]) => {
      calls.push({ bin, args });
      const key = [bin, ...args].join(" ");
      if (key.startsWith("herdr workspace create")) {
        return JSON.stringify({ result: { root_pane: { pane_id: "1-1" } } });
      }
      if (key.startsWith("herdr wait output")) {
        throw new Error("timeout");
      }
      return "";
    });
    const h = createHerdr({ sh, bin: "herdr" });
    await h.runAction(
      actionDefaults({
        placement: "workspace",
        command: "claude",
        prompt: { submitVia: "send-text", required: true, label: "Prompt" },
      }),
      "x",
    );
    const cmds = calls.map((c) => c.args.join(" "));
    expect(cmds.some((s) => s.startsWith("pane send-text 1-1"))).toBe(true);
    expect(cmds.some((s) => s.startsWith("pane send-keys 1-1 Enter"))).toBe(true);
  });

  it("uses prompt.readyMatch when provided", async () => {
    const { sh, calls } = makeShStub({
      "herdr workspace create": JSON.stringify({ result: { root_pane: { pane_id: "1-1" } } }),
    });
    const h = createHerdr({ sh, bin: "herdr" });
    await h.runAction(
      actionDefaults({
        placement: "workspace",
        command: "claude",
        prompt: { submitVia: "send-text", required: true, label: "Prompt", readyMatch: "❯❯" },
      }),
      "x",
    );
    const waitCall = calls.find((c) => c.args[0] === "wait" && c.args[1] === "output");
    expect(waitCall?.args).toContain("❯❯");
  });
});

describe("runClaude", () => {
  it("reuses an existing workspace matching cwd and creates a tab in it", async () => {
    process.env.HOME = "/Users/test";
    const { sh, calls } = makeShStub({
      "herdr workspace list": JSON.stringify({
        result: {
          workspaces: [
            { workspace_id: "1", label: "other", focused: true, cwd: "/Users/test/other", tab_count: 1 },
            { workspace_id: "2", label: "Vault", focused: false, cwd: "/Users/test/Vault", tab_count: 1 },
          ],
        },
      }),
      "herdr tab create": JSON.stringify({ result: { root_pane: { pane_id: "2-2" } } }),
    });
    const h = createHerdr({ sh, bin: "herdr" });
    await h.runClaude({ folder: "~/Vault", prompt: "hi", focus: true });
    expect(calls).toContainEqual({ bin: "herdr", args: ["workspace", "focus", "2"] });
    expect(calls).toContainEqual({
      bin: "herdr",
      args: ["tab", "create", "--workspace", "2", "--label", "Vault"],
    });
    expect(calls).toContainEqual({ bin: "herdr", args: ["pane", "run", "2-2", "cd '/Users/test/Vault'"] });
    expect(calls).toContainEqual({ bin: "herdr", args: ["pane", "run", "2-2", "claude"] });
    expect(calls).toContainEqual({ bin: "herdr", args: ["pane", "send-text", "2-2", "hi"] });
    expect(calls).toContainEqual({ bin: "herdr", args: ["pane", "send-keys", "2-2", "Enter"] });
  });

  it("creates a new workspace with --cwd when no match exists", async () => {
    process.env.HOME = "/Users/test";
    const { sh, calls } = makeShStub({
      "herdr workspace list": JSON.stringify({ result: { workspaces: [] } }),
      "herdr workspace create": JSON.stringify({ result: { root_pane: { pane_id: "5-1" } } }),
    });
    const h = createHerdr({ sh, bin: "herdr" });
    await h.runClaude({ folder: "~/NewFolder", prompt: "q", focus: true });
    expect(calls).toContainEqual({
      bin: "herdr",
      args: ["workspace", "create", "--cwd", "/Users/test/NewFolder", "--label", "NewFolder"],
    });
    expect(calls.find((c) => c.args[3]?.startsWith("cd "))).toBeUndefined();
    expect(calls).toContainEqual({ bin: "herdr", args: ["pane", "run", "5-1", "claude"] });
    expect(calls).toContainEqual({ bin: "herdr", args: ["pane", "send-text", "5-1", "q"] });
  });

  it("dismisses claude's first-run trust prompt before submitting the question", async () => {
    process.env.HOME = "/Users/test";
    const calls: Array<{ bin: string; args: string[] }> = [];
    const sh = vi.fn(async (bin: string, args: string[]) => {
      calls.push({ bin, args });
      const key = [bin, ...args].join(" ");
      if (key.startsWith("herdr workspace list")) {
        return JSON.stringify({ result: { workspaces: [] } });
      }
      if (key.startsWith("herdr workspace create")) {
        return JSON.stringify({ result: { root_pane: { pane_id: "9-1" } } });
      }
      if (key.startsWith("herdr pane read")) {
        return "Do you trust the files in this folder?\n  /Users/test/x\n1. Yes, proceed (default)\n2. No, exit\n❯ 1";
      }
      return "";
    });
    const h = createHerdr({ sh, bin: "herdr" });
    await h.runClaude({ folder: "~/x", prompt: "ask me anything", focus: true });

    const seq = calls.map((c) => c.args.join(" "));
    const claudeIdx = seq.indexOf("pane run 9-1 claude");
    const readIdx = seq.findIndex((s) => s.startsWith("pane read 9-1"));
    const trustEnterIdx = seq.findIndex((s, i) => i > readIdx && s === "pane send-keys 9-1 Enter");
    const sendTextIdx = seq.findIndex((s) => s.startsWith("pane send-text 9-1 ask me anything"));
    const finalEnterIdx = seq.findIndex((s, i) => i > sendTextIdx && s === "pane send-keys 9-1 Enter");
    expect(claudeIdx).toBeGreaterThan(-1);
    expect(readIdx).toBeGreaterThan(claudeIdx);
    expect(trustEnterIdx).toBeGreaterThan(readIdx);
    expect(sendTextIdx).toBeGreaterThan(trustEnterIdx);
    expect(finalEnterIdx).toBeGreaterThan(sendTextIdx);
  });

  it("skips the trust-prompt Enter when pane read shows no trust prompt", async () => {
    process.env.HOME = "/Users/test";
    const calls: Array<{ bin: string; args: string[] }> = [];
    const sh = vi.fn(async (bin: string, args: string[]) => {
      calls.push({ bin, args });
      const key = [bin, ...args].join(" ");
      if (key.startsWith("herdr workspace list")) {
        return JSON.stringify({ result: { workspaces: [] } });
      }
      if (key.startsWith("herdr workspace create")) {
        return JSON.stringify({ result: { root_pane: { pane_id: "1-1" } } });
      }
      if (key.startsWith("herdr pane read")) {
        return "Welcome to claude\n❯ ";
      }
      return "";
    });
    const h = createHerdr({ sh, bin: "herdr" });
    await h.runClaude({ folder: "~/x", prompt: "q", focus: true });

    const seq = calls.map((c) => c.args.join(" "));
    const claudeIdx = seq.indexOf("pane run 1-1 claude");
    const sendTextIdx = seq.findIndex((s) => s.startsWith("pane send-text 1-1 q"));
    // Between claude launch and sending the user's text, there should be exactly one
    // pane read and no send-keys Enter (only the final Enter after send-text).
    const enterBeforeText = seq
      .slice(claudeIdx, sendTextIdx)
      .filter((s) => s === "pane send-keys 1-1 Enter");
    expect(enterBeforeText).toHaveLength(0);
  });

  it("passes --no-focus when focus is false", async () => {
    process.env.HOME = "/Users/test";
    const { sh, calls } = makeShStub({
      "herdr workspace list": JSON.stringify({ result: { workspaces: [] } }),
      "herdr workspace create": JSON.stringify({ result: { root_pane: { pane_id: "1-1" } } }),
    });
    const h = createHerdr({ sh, bin: "herdr" });
    await h.runClaude({ folder: "~/x", prompt: "p", focus: false });
    const createCall = calls.find((c) => c.args[0] === "workspace" && c.args[1] === "create");
    expect(createCall?.args).toContain("--no-focus");
  });
});
