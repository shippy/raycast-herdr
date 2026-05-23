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
