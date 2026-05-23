import type { Sh } from "./exec";
import { expandHome } from "./config";
import type { Action } from "./config";

export interface Workspace {
  id: string;
  label: string;
  cwd?: string;
  tabCount?: number;
  focused: boolean;
}

export interface Herdr {
  listWorkspaces(): Promise<Workspace[]>;
  currentWorkspaceId(): Promise<string>;
  focusedPaneId(): Promise<string>;
  focusWorkspace(id: string): Promise<void>;
  runAction(action: Action, prompt?: string): Promise<void>;
}

function shellQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

export function createHerdr({ sh, bin }: { sh: Sh; bin: string }): Herdr {
  async function listWorkspaces(): Promise<Workspace[]> {
    const out = await sh(bin, ["workspace", "list"]);
    const parsed = JSON.parse(out);
    const list = parsed.result?.workspaces ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return list.map((w: any) => ({
      id: String(w.workspace_id),
      label: w.label ?? "",
      cwd: w.cwd,
      tabCount: w.tab_count,
      focused: Boolean(w.focused),
    }));
  }

  async function focusedPaneId(): Promise<string> {
    const out = await sh(bin, ["pane", "list"]);
    const parsed = JSON.parse(out);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const list: any[] = parsed.result?.panes ?? [];
    const focused = list.find((p) => p.focused);
    if (!focused) throw new Error("No focused herdr pane.");
    return String(focused.pane_id);
  }

  async function currentWorkspaceId(): Promise<string> {
    const ws = await listWorkspaces();
    const focused = ws.find((w) => w.focused);
    if (focused) return focused.id;
    const paneId = await focusedPaneId();
    const prefix = paneId.split("-")[0];
    if (!prefix) throw new Error("Could not determine current workspace.");
    return prefix;
  }

  async function focusWorkspace(id: string): Promise<void> {
    await sh(bin, ["workspace", "focus", id]);
  }

  async function runAction(_action: Action, _prompt?: string): Promise<void> {
    void shellQuote;
    void expandHome;
    throw new Error("runAction is implemented in Tasks 5 and 6.");
  }

  return { listWorkspaces, currentWorkspaceId, focusedPaneId, focusWorkspace, runAction };
}
