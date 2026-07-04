# Raycast extension for herdr — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a Raycast extension at `extensions/herdr/` with four commands that drive the running herdr instance via its CLI: "Ask Claude" (built-in), "Run herdr action" (user-defined actions from JSON), "Focus herdr workspace" (picker), and "Edit actions config".

**Architecture:** A factory `createHerdr({ sh, bin })` wraps the `herdr` CLI so commands stay declarative and unit tests can stub the child-process layer. Action definitions live in `~/.config/raycast-herdr/actions.json`, validated by zod. Each Raycast command file is a thin React/Node shell over the wrapper.

**Tech Stack:** TypeScript, `@raycast/api`, `@raycast/utils`, zod, vitest, Node `child_process`.

**Spec:** [`docs/superpowers/specs/2026-05-23-raycast-herdr-design.md`](../specs/2026-05-23-raycast-herdr-design.md)

---

## File structure

```
extensions/herdr/
  package.json
  tsconfig.json
  vitest.config.ts
  .gitignore
  assets/
    command-icon.png
  src/
    exec.ts             # sh() + findHerdr()
    herdr.ts            # createHerdr() factory: runAction, listWorkspaces, focusWorkspace, currentWorkspaceId, focusedPaneId
    config.ts           # zod schema, loadActions, expandHome, getConfigPath, writeStarterConfig
    ask-claude.tsx      # command 1
    run-action.tsx      # command 2
    focus-workspace.tsx # command 3
    edit-config.ts      # command 4
  tests/
    config.test.ts
    exec.test.ts
    herdr.test.ts
```

`config.ts` is pure (parse, validate, paths). `exec.ts` is the only file that spawns processes. `herdr.ts` takes `sh` as a dep so its tests don't spawn anything. Command files glue these to Raycast.

---

## Task 1: Bootstrap extension scaffold

**Files:**
- Create: `extensions/herdr/package.json`
- Create: `extensions/herdr/tsconfig.json`
- Create: `extensions/herdr/vitest.config.ts`
- Create: `extensions/herdr/.gitignore`
- Create: `extensions/herdr/src/ask-claude.tsx` (placeholder)
- Create: `extensions/herdr/src/run-action.tsx` (placeholder)
- Create: `extensions/herdr/src/focus-workspace.tsx` (placeholder)
- Create: `extensions/herdr/src/edit-config.ts` (placeholder)
- Create: `extensions/herdr/assets/command-icon.png` (any 512x512 PNG; copy from another extension or generate solid color)

- [ ] **Step 1: Create `extensions/herdr/package.json`**

```json
{
  "$schema": "https://www.raycast.com/schemas/extension.json",
  "name": "herdr",
  "title": "herdr",
  "description": "Drive the running herdr instance from Raycast.",
  "icon": "command-icon.png",
  "author": "simon",
  "categories": ["Developer Tools", "Productivity"],
  "license": "MIT",
  "preferences": [
    {
      "name": "herdrPath",
      "title": "herdr binary path",
      "description": "Override the auto-detected herdr CLI path.",
      "type": "textfield",
      "required": false,
      "default": ""
    }
  ],
  "commands": [
    {
      "name": "ask-claude",
      "title": "Ask Claude",
      "subtitle": "herdr",
      "description": "Open claude in a configured folder and submit a prompt.",
      "mode": "no-view",
      "arguments": [
        {
          "name": "prompt",
          "placeholder": "What do you want to ask?",
          "type": "text",
          "required": true
        }
      ],
      "preferences": [
        {
          "name": "folder",
          "title": "Folder",
          "description": "Directory to run claude in.",
          "type": "directory",
          "required": false,
          "default": "~/Documents/Claude-Vault"
        },
        {
          "name": "placement",
          "title": "Placement",
          "description": "Where to put the new pane.",
          "type": "dropdown",
          "required": false,
          "default": "tab",
          "data": [
            { "title": "New tab in focused workspace", "value": "tab" },
            { "title": "New workspace", "value": "workspace" },
            { "title": "Split focused pane", "value": "split" }
          ]
        },
        {
          "name": "focus",
          "title": "Focus",
          "label": "Focus the new pane and bring herdr to the front",
          "type": "checkbox",
          "required": false,
          "default": true
        }
      ]
    },
    {
      "name": "run-action",
      "title": "Run herdr Action",
      "subtitle": "herdr",
      "description": "Pick and run an action from ~/.config/raycast-herdr/actions.json.",
      "mode": "view"
    },
    {
      "name": "focus-workspace",
      "title": "Focus herdr Workspace",
      "subtitle": "herdr",
      "description": "Pick a herdr workspace and focus it.",
      "mode": "view"
    },
    {
      "name": "edit-config",
      "title": "Edit herdr Actions Config",
      "subtitle": "herdr",
      "description": "Open ~/.config/raycast-herdr/actions.json in $EDITOR.",
      "mode": "no-view"
    }
  ],
  "dependencies": {
    "@raycast/api": "^1.78.0",
    "@raycast/utils": "^1.17.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.0.0",
    "react": "^18.0.0",
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  },
  "scripts": {
    "build": "ray build",
    "dev": "ray develop",
    "lint": "ray lint",
    "test": "vitest run"
  }
}
```

- [ ] **Step 2: Create `extensions/herdr/tsconfig.json`**

```json
{
  "compilerOptions": {
    "lib": ["ES2022"],
    "module": "commonjs",
    "target": "ES2022",
    "strict": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "jsx": "react-jsx",
    "moduleResolution": "node",
    "skipLibCheck": true
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

- [ ] **Step 3: Create `extensions/herdr/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
```

- [ ] **Step 4: Create `extensions/herdr/.gitignore`**

```
node_modules/
dist/
.DS_Store
```

- [ ] **Step 5: Create placeholder source files**

`extensions/herdr/src/ask-claude.tsx`:
```ts
export default async function Command() {
  // Implemented in Task 7.
}
```

`extensions/herdr/src/run-action.tsx`:
```tsx
export default function Command() {
  // Implemented in Task 8.
  return null;
}
```

`extensions/herdr/src/focus-workspace.tsx`:
```tsx
export default function Command() {
  // Implemented in Task 9.
  return null;
}
```

`extensions/herdr/src/edit-config.ts`:
```ts
export default async function Command() {
  // Implemented in Task 10.
}
```

- [ ] **Step 6: Install deps and verify lint passes**

```bash
cd extensions/herdr && npm install && npm run lint
```

Expected: exit 0, no lint errors. If `ray lint` complains about missing `command-icon.png`, copy any 512×512 PNG to `extensions/herdr/assets/command-icon.png` and re-run.

- [ ] **Step 7: Commit**

```bash
git add extensions/herdr/
git commit -m "feat(herdr): scaffold raycast extension"
```

---

## Task 2: Config schema, loader, and path helpers

**Files:**
- Create: `extensions/herdr/src/config.ts`
- Create: `extensions/herdr/tests/config.test.ts`

- [ ] **Step 1: Write the failing tests**

`extensions/herdr/tests/config.test.ts`:
```ts
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
      expect(result.actions[0].placement).toBe("tab"); // default
      expect(result.actions[0].focus).toBe(true); // default
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd extensions/herdr && npm test
```

Expected: FAIL — `config.ts` does not yet export `parseActions` or `expandHome`.

- [ ] **Step 3: Implement `config.ts`**

`extensions/herdr/src/config.ts`:
```ts
import { z } from "zod";
import { homedir } from "os";
import { join } from "path";
import { promises as fs } from "fs";

const PromptSchema = z
  .object({
    required: z.boolean().default(true),
    label: z.string().default("Prompt"),
    placeholder: z.string().optional(),
    submitVia: z.enum(["arg", "send-text"]).default("send-text"),
    readyMatch: z.string().optional(),
  })
  .strict();

const ActionSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    subtitle: z.string().optional(),
    icon: z.string().optional(),
    cwd: z.string().min(1),
    command: z.string().min(1),
    prompt: PromptSchema.optional(),
    placement: z.enum(["tab", "workspace", "split"]).default("tab"),
    focus: z.boolean().default(true),
    label: z.string().optional(),
  })
  .strict();

export type Action = z.infer<typeof ActionSchema>;

export type ParseResult =
  | { ok: true; actions: Action[] }
  | { ok: false; error: string };

export function parseActions(raw: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    return { ok: false, error: `Invalid JSON: ${(err as Error).message}` };
  }
  const result = z.array(ActionSchema).safeParse(data);
  if (!result.success) {
    return { ok: false, error: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  }
  return { ok: true, actions: result.data };
}

export function expandHome(p: string): string {
  if (p.startsWith("~/")) return join(homedir(), p.slice(2));
  if (p === "~") return homedir();
  return p;
}

export function getConfigPath(): string {
  return join(homedir(), ".config", "raycast-herdr", "actions.json");
}

export async function loadActions(): Promise<ParseResult & { path: string; missing?: boolean }> {
  const path = getConfigPath();
  let raw: string;
  try {
    raw = await fs.readFile(path, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { ok: false, error: "Config file not found.", path, missing: true };
    }
    return { ok: false, error: (err as Error).message, path };
  }
  return { ...parseActions(raw), path };
}

const STARTER: Action[] = [
  {
    id: "claude-vault-ask",
    name: "Ask Claude in Vault",
    subtitle: "claude in ~/Documents/Claude-Vault",
    icon: "💬",
    cwd: "~/Documents/Claude-Vault",
    command: "claude",
    prompt: {
      required: true,
      label: "Question",
      placeholder: "What do you want to ask?",
      submitVia: "send-text",
    },
    placement: "tab",
    focus: true,
    label: "claude: vault",
  },
];

export async function writeStarterConfig(): Promise<string> {
  const path = getConfigPath();
  await fs.mkdir(join(path, ".."), { recursive: true });
  await fs.writeFile(path, JSON.stringify(STARTER, null, 2) + "\n", "utf8");
  return path;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd extensions/herdr && npm test
```

Expected: all `parseActions` and `expandHome` tests pass.

- [ ] **Step 5: Commit**

```bash
git add extensions/herdr/src/config.ts extensions/herdr/tests/config.test.ts
git commit -m "feat(herdr): action config schema and loader"
```

---

## Task 3: `exec.ts` — sh helper and binary discovery

**Files:**
- Create: `extensions/herdr/src/exec.ts`
- Create: `extensions/herdr/tests/exec.test.ts`

- [ ] **Step 1: Write the failing tests**

`extensions/herdr/tests/exec.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { existsSync, statSync } from "fs";
import { mkdtempSync, writeFileSync, chmodSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { resolveHerdrFromCandidates } from "../src/exec";

describe("resolveHerdrFromCandidates", () => {
  it("returns the preference path when it exists and is executable", () => {
    const dir = mkdtempSync(join(tmpdir(), "herdr-test-"));
    const bin = join(dir, "herdr");
    writeFileSync(bin, "#!/bin/sh\nexit 0\n");
    chmodSync(bin, 0o755);
    expect(resolveHerdrFromCandidates(bin, [])).toBe(bin);
  });

  it("ignores an empty preference and falls back to candidates", () => {
    const dir = mkdtempSync(join(tmpdir(), "herdr-test-"));
    const bin = join(dir, "herdr");
    writeFileSync(bin, "#!/bin/sh\nexit 0\n");
    chmodSync(bin, 0o755);
    expect(resolveHerdrFromCandidates("", [bin])).toBe(bin);
  });

  it("returns the first existing candidate", () => {
    const dir = mkdtempSync(join(tmpdir(), "herdr-test-"));
    const a = join(dir, "herdr-a");
    const b = join(dir, "herdr-b");
    writeFileSync(a, ""); chmodSync(a, 0o755);
    writeFileSync(b, ""); chmodSync(b, 0o755);
    expect(resolveHerdrFromCandidates("", [a, b])).toBe(a);
  });

  it("returns null when nothing matches", () => {
    expect(resolveHerdrFromCandidates("", ["/nope/never"])).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd extensions/herdr && npm test
```

Expected: FAIL — `exec.ts` does not exist.

- [ ] **Step 3: Implement `exec.ts`**

`extensions/herdr/src/exec.ts`:
```ts
import { spawn } from "child_process";
import { existsSync, statSync } from "fs";

const DEFAULT_CANDIDATES = ["/opt/homebrew/bin/herdr", "/usr/local/bin/herdr"];

export function resolveHerdrFromCandidates(prefPath: string, candidates: string[]): string | null {
  const all = [prefPath, ...candidates].filter((p) => p && p.length > 0);
  for (const p of all) {
    try {
      if (existsSync(p) && statSync(p).isFile()) return p;
    } catch {
      // ignore
    }
  }
  return null;
}

let cached: string | null = null;

export async function findHerdr(prefPath?: string): Promise<string> {
  if (cached) return cached;
  const resolved = resolveHerdrFromCandidates(prefPath ?? "", DEFAULT_CANDIDATES);
  if (resolved) {
    cached = resolved;
    return resolved;
  }
  // Last resort: ask a login shell.
  const found = await new Promise<string | null>((resolve) => {
    const child = spawn(process.env.SHELL ?? "/bin/zsh", ["-lic", "command -v herdr"], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.on("close", () => resolve(out.trim() || null));
    child.on("error", () => resolve(null));
  });
  if (!found) throw new Error("Could not locate the herdr binary. Set it in extension preferences.");
  cached = found;
  return found;
}

export type Sh = (bin: string, args: string[]) => Promise<string>;

export const sh: Sh = (bin, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`${bin} ${args.join(" ")} exited ${code}: ${stderr.trim()}`));
    });
  });
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd extensions/herdr && npm test
```

Expected: PASS for `resolveHerdrFromCandidates` cases.

- [ ] **Step 5: Commit**

```bash
git add extensions/herdr/src/exec.ts extensions/herdr/tests/exec.test.ts
git commit -m "feat(herdr): exec helper and binary discovery"
```

---

## Task 4: `herdr.ts` factory + workspace/pane helpers

**Files:**
- Create: `extensions/herdr/src/herdr.ts`
- Create: `extensions/herdr/tests/herdr.test.ts`

- [ ] **Step 1: Write the failing tests**

`extensions/herdr/tests/herdr.test.ts`:
```ts
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
        result: { workspaces: [
          { workspace_id: "1", label: "a", focused: false, cwd: "/x", tab_count: 1 },
          { workspace_id: "2", label: "b", focused: true, cwd: "/y", tab_count: 1 },
        ] },
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
        result: { panes: [
          { pane_id: "1-1", focused: false },
          { pane_id: "1-2", focused: true },
        ] },
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd extensions/herdr && npm test
```

Expected: FAIL — `herdr.ts` does not exist.

- [ ] **Step 3: Implement `herdr.ts` (factory + helpers; `runAction` stub for now)**

`extensions/herdr/src/herdr.ts`:
```ts
import type { Sh } from "./exec";
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

export function createHerdr({ sh, bin }: { sh: Sh; bin: string }): Herdr {
  async function listWorkspaces(): Promise<Workspace[]> {
    const out = await sh(bin, ["workspace", "list"]);
    const parsed = JSON.parse(out);
    const list = parsed.result?.workspaces ?? [];
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
    const list: any[] = parsed.result?.panes ?? [];
    const focused = list.find((p) => p.focused);
    if (!focused) throw new Error("No focused herdr pane.");
    return String(focused.pane_id);
  }

  async function currentWorkspaceId(): Promise<string> {
    const ws = await listWorkspaces();
    const focused = ws.find((w) => w.focused);
    if (focused) return focused.id;
    // Fallback: derive from focused pane.
    const paneId = await focusedPaneId();
    const prefix = paneId.split("-")[0];
    if (!prefix) throw new Error("Could not determine current workspace.");
    return prefix;
  }

  async function focusWorkspace(id: string): Promise<void> {
    await sh(bin, ["workspace", "focus", id]);
  }

  async function runAction(_action: Action, _prompt?: string): Promise<void> {
    throw new Error("runAction is implemented in Tasks 5 and 6.");
  }

  return { listWorkspaces, currentWorkspaceId, focusedPaneId, focusWorkspace, runAction };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd extensions/herdr && npm test
```

Expected: PASS for the four `listWorkspaces`/`currentWorkspaceId`/`focusedPaneId`/`focusWorkspace` test groups.

- [ ] **Step 5: Commit**

```bash
git add extensions/herdr/src/herdr.ts extensions/herdr/tests/herdr.test.ts
git commit -m "feat(herdr): wrapper factory with workspace and pane helpers"
```

---

## Task 5: `runAction` — placement branches

**Files:**
- Modify: `extensions/herdr/src/herdr.ts`
- Modify: `extensions/herdr/tests/herdr.test.ts`

- [ ] **Step 1: Add failing tests for all three placements (no prompt)**

Append to `extensions/herdr/tests/herdr.test.ts`:
```ts
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
    expect(calls[0]).toEqual({ bin: "herdr", args: ["workspace", "create", "--cwd", "/abs/path", "--label", "vault"] });
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd extensions/herdr && npm test
```

Expected: FAIL — `runAction` still throws.

- [ ] **Step 3: Implement placements in `herdr.ts`**

Replace the `runAction` stub in `extensions/herdr/src/herdr.ts` with:
```ts
import { expandHome } from "./config";

function shellQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

// Inside createHerdr({ sh, bin }):
async function runAction(action: Action, prompt?: string): Promise<void> {
  const cwd = expandHome(action.cwd);
  const focusFlag = action.focus ? [] : ["--no-focus"];
  const labelArgs = action.label ? ["--label", action.label] : [];

  let paneId: string;
  if (action.placement === "workspace") {
    const out = await sh(bin, ["workspace", "create", "--cwd", cwd, ...focusFlag, ...labelArgs]);
    paneId = String(JSON.parse(out).result.root_pane.pane_id);
  } else if (action.placement === "tab") {
    const wsId = await currentWorkspaceId();
    const out = await sh(bin, ["tab", "create", "--workspace", wsId, ...focusFlag, ...labelArgs]);
    paneId = String(JSON.parse(out).result.root_pane.pane_id);
    await sh(bin, ["pane", "run", paneId, `cd ${shellQuote(cwd)}`]);
  } else {
    const focused = await focusedPaneId();
    const out = await sh(bin, ["pane", "split", focused, "--direction", "right", ...focusFlag]);
    paneId = String(JSON.parse(out).result.pane.pane_id);
    await sh(bin, ["pane", "run", paneId, `cd ${shellQuote(cwd)}`]);
  }

  await sh(bin, ["pane", "run", paneId, action.command]);
  // Prompt delivery added in Task 6.
}
```

Note: place `function shellQuote` at the top of the file (outside `createHerdr`) and add the `import { expandHome } from "./config";` line near the existing imports.

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd extensions/herdr && npm test
```

Expected: PASS for all placement tests.

- [ ] **Step 5: Commit**

```bash
git add extensions/herdr/src/herdr.ts extensions/herdr/tests/herdr.test.ts
git commit -m "feat(herdr): runAction placement branches"
```

---

## Task 6: `runAction` — prompt delivery (arg + send-text)

**Files:**
- Modify: `extensions/herdr/src/herdr.ts`
- Modify: `extensions/herdr/tests/herdr.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `extensions/herdr/tests/herdr.test.ts`:
```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd extensions/herdr && npm test
```

Expected: FAIL — prompt delivery not yet implemented.

- [ ] **Step 3: Extend `runAction` with prompt delivery**

Edit `extensions/herdr/src/herdr.ts`. Add the constant near the top of the file (outside `createHerdr`):
```ts
const DEFAULT_READY_MATCH = ">|\\$\\s*$|❯";
```

Then replace the closing of `runAction` so the final `await sh(bin, ["pane", "run", paneId, action.command]);` line is followed by:
```ts
const useArg = action.prompt?.submitVia === "arg" && prompt !== undefined;
const cmd = useArg ? action.command.replace("{prompt}", shellQuote(prompt!)) : action.command;
await sh(bin, ["pane", "run", paneId, cmd]);

if (action.prompt?.submitVia === "send-text" && prompt !== undefined) {
  const match = action.prompt.readyMatch ?? DEFAULT_READY_MATCH;
  try {
    await sh(bin, ["wait", "output", paneId, "--match", match, "--regex", "--timeout", "15000"]);
  } catch {
    await new Promise((r) => setTimeout(r, 500));
  }
  await sh(bin, ["pane", "send-text", paneId, prompt]);
  await sh(bin, ["pane", "send-keys", paneId, "Enter"]);
}
```

Note: the earlier `await sh(bin, ["pane", "run", paneId, action.command]);` from Task 5 must be **removed** when adding this block — it's replaced by the `cmd` logic above. Re-read the function to make sure `pane run` is only called once with `cmd`.

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd extensions/herdr && npm test
```

Expected: PASS for all prompt-delivery tests, and all earlier placement tests still pass.

- [ ] **Step 5: Commit**

```bash
git add extensions/herdr/src/herdr.ts extensions/herdr/tests/herdr.test.ts
git commit -m "feat(herdr): prompt delivery via arg or send-text"
```

---

## Task 7: `ask-claude` command

**Files:**
- Modify: `extensions/herdr/src/ask-claude.tsx`

- [ ] **Step 1: Implement the command**

`extensions/herdr/src/ask-claude.tsx`:
```ts
import { LaunchProps, getPreferenceValues, showToast, Toast } from "@raycast/api";
import { spawn } from "child_process";
import { createHerdr } from "./herdr";
import { findHerdr, sh } from "./exec";
import type { Action } from "./config";

interface Prefs {
  folder?: string;
  placement?: "tab" | "workspace" | "split";
  focus?: boolean;
}

interface ExtPrefs {
  herdrPath?: string;
}

function bringHerdrToFront() {
  return new Promise<void>((resolve) => {
    const child = spawn("open", ["-a", "Herdr"], { stdio: "ignore" });
    child.on("close", () => resolve());
    child.on("error", () => resolve());
  });
}

export default async function Command(props: LaunchProps<{ arguments: { prompt: string } }>) {
  const prefs = getPreferenceValues<Prefs & ExtPrefs>();
  const folder = prefs.folder ?? "~/Documents/Claude-Vault";
  const placement = prefs.placement ?? "tab";
  const focus = prefs.focus ?? true;

  try {
    const bin = await findHerdr(prefs.herdrPath);
    const h = createHerdr({ sh, bin });
    const action: Action = {
      id: "ask-claude-builtin",
      name: "Ask Claude",
      cwd: folder,
      command: "claude",
      prompt: { required: true, label: "Prompt", submitVia: "send-text" },
      placement,
      focus,
    };
    await h.runAction(action, props.arguments.prompt);
    if (focus) await bringHerdrToFront();
    await showToast({ style: Toast.Style.Success, title: "Asked Claude", message: folder });
  } catch (err) {
    await showToast({ style: Toast.Style.Failure, title: "Failed to ask Claude", message: (err as Error).message });
  }
}
```

- [ ] **Step 2: Type-check**

```bash
cd extensions/herdr && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Lint**

```bash
cd extensions/herdr && npm run lint
```

Expected: no errors.

- [ ] **Step 4: Manual smoke (defer to Task 11 if herdr is not running locally)**

With herdr running, in Raycast: trigger "Ask Claude", type a prompt, hit Enter. Verify a new tab appears in the focused workspace at `~/Documents/Claude-Vault`, `claude` launches, and the prompt is submitted.

- [ ] **Step 5: Commit**

```bash
git add extensions/herdr/src/ask-claude.tsx
git commit -m "feat(herdr): ask-claude command"
```

---

## Task 8: `run-action` command (list + form)

**Files:**
- Modify: `extensions/herdr/src/run-action.tsx`

- [ ] **Step 1: Implement the command**

`extensions/herdr/src/run-action.tsx`:
```tsx
import { useEffect, useState } from "react";
import { Action, ActionPanel, Form, Icon, List, getPreferenceValues, showToast, Toast, useNavigation } from "@raycast/api";
import { spawn } from "child_process";
import { loadActions, writeStarterConfig } from "./config";
import type { Action as HerdrAction } from "./config";
import { createHerdr } from "./herdr";
import { findHerdr, sh } from "./exec";

interface ExtPrefs {
  herdrPath?: string;
}

function bringHerdrToFront() {
  return new Promise<void>((resolve) => {
    const child = spawn("open", ["-a", "Herdr"], { stdio: "ignore" });
    child.on("close", () => resolve());
    child.on("error", () => resolve());
  });
}

export default function Command() {
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "ok"; actions: HerdrAction[] }
    | { kind: "missing"; path: string }
    | { kind: "error"; message: string; path: string }
  >({ kind: "loading" });

  useEffect(() => {
    loadActions().then((r) => {
      if (r.ok) setState({ kind: "ok", actions: r.actions });
      else if ("missing" in r && r.missing) setState({ kind: "missing", path: r.path });
      else setState({ kind: "error", message: r.error, path: r.path });
    });
  }, []);

  if (state.kind === "loading") return <List isLoading />;
  if (state.kind === "missing") {
    return (
      <List>
        <List.EmptyView
          title="No actions config"
          description={`Create ${state.path} to define actions.`}
          actions={
            <ActionPanel>
              <Action
                title="Create Example Config"
                onAction={async () => {
                  const p = await writeStarterConfig();
                  await showToast({ style: Toast.Style.Success, title: "Created", message: p });
                  const r = await loadActions();
                  if (r.ok) setState({ kind: "ok", actions: r.actions });
                }}
              />
            </ActionPanel>
          }
        />
      </List>
    );
  }
  if (state.kind === "error") {
    return (
      <List>
        <List.Item title={`Config error: ${state.message}`} subtitle={state.path} icon={Icon.ExclamationMark} />
      </List>
    );
  }

  return (
    <List>
      {state.actions.map((a) => (
        <List.Item
          key={a.id}
          title={a.name}
          subtitle={a.subtitle}
          icon={a.icon ?? Icon.Terminal}
          actions={
            <ActionPanel>
              <RunActionMenu action={a} />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}

function RunActionMenu({ action }: { action: HerdrAction }) {
  const { push } = useNavigation();
  if (action.prompt) {
    return <Action title="Run" onAction={() => push(<PromptForm action={action} />)} />;
  }
  return <Action title="Run" onAction={() => runActionAndToast(action)} />;
}

function PromptForm({ action }: { action: HerdrAction }) {
  const { pop } = useNavigation();
  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Run"
            onSubmit={async (values: { prompt: string }) => {
              await runActionAndToast(action, values.prompt);
              pop();
            }}
          />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="prompt"
        title={action.prompt?.label ?? "Prompt"}
        placeholder={action.prompt?.placeholder}
      />
    </Form>
  );
}

async function runActionAndToast(action: HerdrAction, prompt?: string) {
  const prefs = getPreferenceValues<ExtPrefs>();
  try {
    const bin = await findHerdr(prefs.herdrPath);
    const h = createHerdr({ sh, bin });
    await h.runAction(action, prompt);
    if (action.focus) await bringHerdrToFront();
    await showToast({ style: Toast.Style.Success, title: `Ran ${action.name}` });
  } catch (err) {
    await showToast({ style: Toast.Style.Failure, title: "Action failed", message: (err as Error).message });
  }
}
```

- [ ] **Step 2: Type-check and lint**

```bash
cd extensions/herdr && npx tsc --noEmit && npm run lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add extensions/herdr/src/run-action.tsx
git commit -m "feat(herdr): run-action command (list and form)"
```

---

## Task 9: `focus-workspace` command

**Files:**
- Modify: `extensions/herdr/src/focus-workspace.tsx`

- [ ] **Step 1: Implement the command**

`extensions/herdr/src/focus-workspace.tsx`:
```tsx
import { useEffect, useState } from "react";
import { Action, ActionPanel, Icon, List, getPreferenceValues, showToast, Toast } from "@raycast/api";
import { spawn } from "child_process";
import { createHerdr } from "./herdr";
import type { Workspace } from "./herdr";
import { findHerdr, sh } from "./exec";

interface ExtPrefs {
  herdrPath?: string;
}

function bringHerdrToFront() {
  spawn("open", ["-a", "Herdr"], { stdio: "ignore" });
}

export default function Command() {
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "ok"; workspaces: Workspace[] }
    | { kind: "error"; message: string }
  >({ kind: "loading" });

  useEffect(() => {
    (async () => {
      const prefs = getPreferenceValues<ExtPrefs>();
      try {
        const bin = await findHerdr(prefs.herdrPath);
        const h = createHerdr({ sh, bin });
        const workspaces = await h.listWorkspaces();
        setState({ kind: "ok", workspaces });
      } catch (err) {
        setState({ kind: "error", message: (err as Error).message });
      }
    })();
  }, []);

  if (state.kind === "loading") return <List isLoading />;
  if (state.kind === "error") {
    return (
      <List>
        <List.EmptyView
          title="No herdr workspaces"
          description={state.message}
          actions={
            <ActionPanel>
              <Action title="Launch herdr" onAction={() => bringHerdrToFront()} />
            </ActionPanel>
          }
        />
      </List>
    );
  }

  return (
    <List>
      {state.workspaces.map((w) => (
        <List.Item
          key={w.id}
          title={w.label || `workspace ${w.id}`}
          subtitle={w.cwd}
          accessories={w.tabCount !== undefined ? [{ text: `${w.tabCount} tab${w.tabCount === 1 ? "" : "s"}` }] : []}
          icon={w.focused ? Icon.CircleFilled : Icon.Circle}
          actions={
            <ActionPanel>
              <Action
                title="Focus Workspace"
                onAction={async () => {
                  const prefs = getPreferenceValues<ExtPrefs>();
                  try {
                    const bin = await findHerdr(prefs.herdrPath);
                    const h = createHerdr({ sh, bin });
                    await h.focusWorkspace(w.id);
                    bringHerdrToFront();
                  } catch (err) {
                    await showToast({ style: Toast.Style.Failure, title: "Focus failed", message: (err as Error).message });
                  }
                }}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
```

- [ ] **Step 2: Type-check and lint**

```bash
cd extensions/herdr && npx tsc --noEmit && npm run lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add extensions/herdr/src/focus-workspace.tsx
git commit -m "feat(herdr): focus-workspace picker command"
```

---

## Task 10: `edit-config` command

**Files:**
- Modify: `extensions/herdr/src/edit-config.ts`

- [ ] **Step 1: Implement the command**

`extensions/herdr/src/edit-config.ts`:
```ts
import { showToast, Toast } from "@raycast/api";
import { promises as fs } from "fs";
import { spawn } from "child_process";
import { getConfigPath, writeStarterConfig } from "./config";

export default async function Command() {
  let path = getConfigPath();
  try {
    await fs.access(path);
  } catch {
    path = await writeStarterConfig();
  }

  const editor = (process.env.EDITOR ?? "").trim();
  if (editor) {
    const parts = editor.split(/\s+/);
    const [bin, ...args] = parts;
    const child = spawn(bin, [...args, path], { detached: true, stdio: "ignore" });
    child.unref();
    await showToast({ style: Toast.Style.Success, title: "Opened in $EDITOR", message: path });
    return;
  }

  // Fall back: reveal in Finder.
  spawn("open", ["-R", path], { detached: true, stdio: "ignore" }).unref();
  await showToast({ style: Toast.Style.Success, title: "Revealed in Finder", message: path });
}
```

- [ ] **Step 2: Type-check and lint**

```bash
cd extensions/herdr && npx tsc --noEmit && npm run lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add extensions/herdr/src/edit-config.ts
git commit -m "feat(herdr): edit-config command"
```

---

## Task 11: Manual smoke test + finalize

**Files:**
- Modify: `extensions/herdr/README.md` (create if absent — extension-level README, not the repo's)

- [ ] **Step 1: Run the full test suite**

```bash
cd extensions/herdr && npm test
```

Expected: all tests pass.

- [ ] **Step 2: Run lint and build**

```bash
cd extensions/herdr && npm run lint && npm run build
```

Expected: both exit 0.

- [ ] **Step 3: Develop-mode smoke test**

Open a terminal:
```bash
cd extensions/herdr && npm run dev
```

This installs the extension into Raycast in development mode. In Raycast, run each command and verify:

- [ ] **Ask Claude** — with herdr running and a focused workspace, invoke `Ask Claude` with a question. Verify a new tab opens at `~/Documents/Claude-Vault`, `claude` launches, the question is submitted, and herdr comes to the front.
- [ ] **Run herdr Action** — first invocation shows "No actions config" with a "Create Example Config" action. Trigger it; verify the file is created at `~/.config/raycast-herdr/actions.json` and the example "Ask Claude in Vault" appears. Select it; the form appears; submit a prompt; verify the same end state as Ask Claude.
- [ ] **Run herdr Action — promptless** — add a `{ "id": "ls", "name": "List home", "cwd": "~", "command": "ls" }` entry to the JSON, re-run the command, select it; verify a new tab opens at `~` and `ls` runs.
- [ ] **Run herdr Action — `submitVia=arg`** — add an action with `"command": "echo {prompt}"` and `"prompt": { "submitVia": "arg" }`. Verify the prompt is interpolated and `echo` outputs it.
- [ ] **Focus herdr Workspace** — open the command, verify all workspaces are listed with the focused one marked, select a different workspace, verify focus moves and herdr comes to the front.
- [ ] **Edit herdr Actions Config** — with `$EDITOR=vim` (or your editor), verify the file opens. With `$EDITOR` unset, verify the file is revealed in Finder.

- [ ] **Step 4: Create extension README**

`extensions/herdr/README.md`:
```markdown
# herdr Raycast extension

Drive the running [herdr](https://herdr.dev) instance from Raycast.

## Commands

- **Ask Claude** — open `claude` in a configured folder and submit a prompt.
- **Run herdr Action** — pick from user-defined actions in `~/.config/raycast-herdr/actions.json`.
- **Focus herdr Workspace** — list and focus an existing herdr workspace.
- **Edit herdr Actions Config** — open the actions JSON in `$EDITOR`.

## Preferences

- `herdrPath` (extension-wide) — override the auto-detected `herdr` CLI path.
- `Ask Claude` command: `folder`, `placement` (tab / workspace / split), `focus`.

## Action config

See `~/.config/raycast-herdr/actions.json`. Example:

\`\`\`json
[
  {
    "id": "claude-vault",
    "name": "Ask Claude in Vault",
    "cwd": "~/Documents/Claude-Vault",
    "command": "claude",
    "prompt": { "submitVia": "send-text" },
    "placement": "tab"
  }
]
\`\`\`

Fields and defaults are documented in [`docs/superpowers/specs/2026-05-23-raycast-herdr-design.md`](../../docs/superpowers/specs/2026-05-23-raycast-herdr-design.md).
```

(Replace `\`\`\`` with triple backticks when committing — the escaped version is only to keep this plan document valid markdown.)

- [ ] **Step 5: Commit**

```bash
git add extensions/herdr/README.md
git commit -m "docs(herdr): extension README"
```
