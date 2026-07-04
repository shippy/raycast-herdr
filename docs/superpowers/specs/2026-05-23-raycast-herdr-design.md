# Raycast extension for driving herdr

## Goal

A Raycast extension that exposes a small set of actions against the running
herdr instance — primarily "open `claude` in some folder with an arbitrary
question," plus a configurable list of similar actions and a workspace picker.

The extension shells out to the `herdr` CLI, which already talks to herdr over a
local unix socket. We do not re-implement the socket protocol.

## Commands

The extension ships four Raycast commands.

### 1. Ask Claude (built-in)

A built-in shortcut for the most common case.

- **Arguments:** one text argument, `prompt`.
- **Raycast preferences (per-command):**
  - `folder` (directory picker, default `~/Documents/Claude-Vault`) — cwd for the new pane.
  - `placement` (dropdown: `tab` / `workspace` / `split`, default `tab`).
  - `focus` (checkbox, default on).
- **Extension-wide preferences** (defined once at the extension level, shared by all four commands):
  - `herdrPath` (optional file picker) — overrides the binary lookup.
- **Behavior:** creates the pane per `placement`, runs `claude`, waits for the
  REPL prompt, sends the prompt text + Enter, focuses if configured.

Raycast does not support dynamic command names, so the command title stays
"Ask Claude." The configured folder is reflected in the command's subtitle.

### 2. Run herdr action

A list view backed by `~/.config/raycast-herdr/actions.json`.

- **On mount:** load and validate the config.
- **List rendering:** one item per action, using `name` / `subtitle` / `icon`.
- **On select:**
  - If the action has a `prompt` block, push a form with a single text field
    (configured by `prompt.label` / `placeholder` / `required`). Submit runs
    the action.
  - Otherwise, run the action immediately.
- **Empty / error states:**
  - File missing → empty-state view with a "Create example config" action that
    writes a starter file.
  - File malformed → single error row with the parse/validation error.

### 3. Focus herdr workspace

A list view that picks a herdr workspace and focuses it.

- **On mount:** run `herdr workspace list`, render one row per workspace
  (title: label, subtitle: cwd, accessory: tab count).
- **On select:** `herdr workspace focus <id>` then `open -a Herdr`. Toast on
  failure.
- **Empty state:** "No herdr workspaces" with an action that runs
  `open -a Herdr` to launch it.
- **Search:** Raycast's built-in list filter over title + subtitle.

### 4. Edit actions config

Opens `~/.config/raycast-herdr/actions.json` in `$EDITOR` (falls back to
revealing the file in Finder if `$EDITOR` is unset). Creates the file with a
starter array if it doesn't exist. `$EDITOR` is split on whitespace so values
like `code -w` work correctly.

## Action config schema

File: `~/.config/raycast-herdr/actions.json`. Top-level JSON array.

```json
[
  {
    "id": "claude-vault-ask",
    "name": "Ask Claude in Vault",
    "subtitle": "claude in ~/Documents/Claude-Vault",
    "icon": "💬",
    "cwd": "~/Documents/Claude-Vault",
    "command": "claude",
    "prompt": {
      "required": true,
      "label": "Question",
      "placeholder": "What do you want to ask?",
      "submitVia": "send-text"
    },
    "placement": "tab",
    "focus": true,
    "label": "claude: vault"
  },
  {
    "id": "open-projects",
    "name": "Open shell in projects",
    "cwd": "~/projects",
    "command": "zsh",
    "placement": "tab",
    "focus": true
  }
]
```

### Fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | Stable identifier; React key and debug. |
| `name` | string | yes | List item title. |
| `subtitle` | string | no | List item subtitle. |
| `icon` | string | no | Emoji or Raycast `Icon.*` name. |
| `cwd` | string | yes | Absolute or `~`-prefixed. Expanded before use. |
| `command` | string | yes | Shell command. Supports `{prompt}`. |
| `prompt` | object | no | Omitted → action runs immediately on select. |
| `prompt.required` | bool | no | Form validation. Default `true`. |
| `prompt.label` | string | no | Form field label. Default `"Prompt"`. |
| `prompt.placeholder` | string | no | Form field placeholder. |
| `prompt.submitVia` | `"arg"` \| `"send-text"` | no | Default `"send-text"`. |
| `prompt.readyMatch` | string (regex) | no | Override for the "REPL ready" regex when `submitVia=send-text`. |
| `placement` | `"tab"` \| `"workspace"` \| `"split"` | no | Default `"tab"`. |
| `focus` | bool | no | Default `true`. |
| `label` | string | no | Passed to herdr's `--label` on tab/workspace create. |

Validation uses zod. Unknown fields are rejected (strict parse) so typos
surface immediately.

## Internal module: `herdr.ts`

One public function:

```ts
runAction(action: Action, prompt?: string): Promise<void>
```

### Pseudocode

```ts
async function runAction(a: Action, prompt?: string) {
  const cwd = expandHome(a.cwd);
  const focusFlag = a.focus ? [] : ["--no-focus"];
  const labelArgs = a.label ? ["--label", a.label] : [];

  let paneId: string;
  switch (a.placement) {
    case "workspace": {
      const out = await sh("herdr", ["workspace", "create", "--cwd", cwd, ...focusFlag, ...labelArgs]);
      paneId = JSON.parse(out).result.root_pane.pane_id;
      break;
    }
    case "tab": {
      const wsId = await currentWorkspaceId();
      const out = await sh("herdr", ["tab", "create", "--workspace", wsId, ...focusFlag, ...labelArgs]);
      paneId = JSON.parse(out).result.root_pane.pane_id;
      await sh("herdr", ["pane", "run", paneId, `cd ${shellQuote(cwd)}`]);
      break;
    }
    case "split": {
      const focused = await focusedPaneId();
      const out = await sh("herdr", ["pane", "split", focused, "--direction", "right", ...focusFlag]);
      paneId = JSON.parse(out).result.pane.pane_id;
      await sh("herdr", ["pane", "run", paneId, `cd ${shellQuote(cwd)}`]);
      break;
    }
  }

  const useArg = a.prompt?.submitVia === "arg" && prompt !== undefined;
  const cmd = useArg
    ? a.command.replace("{prompt}", shellQuote(prompt!))
    : a.command;
  await sh("herdr", ["pane", "run", paneId, cmd]);

  if (a.prompt?.submitVia === "send-text" && prompt !== undefined) {
    try {
      await sh("herdr", ["wait", "output", paneId, "--match", a.prompt.readyMatch ?? DEFAULT_READY_MATCH, "--regex", "--timeout", "15000"]);
    } catch {
      await sleep(500); // fall back: best-effort delay
    }
    await sh("herdr", ["pane", "send-text", paneId, prompt]);
    await sh("herdr", ["pane", "send-keys", paneId, "Enter"]);
  }

  if (a.focus) await sh("open", ["-a", "Herdr"]);
}
```

### Specifics

- **Binary discovery.** Raycast spawns commands with a minimal PATH. Resolve
  `herdr` in order: `preferences.herdrPath`, `/opt/homebrew/bin/herdr`,
  `/usr/local/bin/herdr`, then `which herdr` via a login shell. Cached for the
  process lifetime.
- **`DEFAULT_READY_MATCH`** — a permissive regex `>|\$\s*$|❯`. Actions can
  override via `prompt.readyMatch`.
- **`tab create` has no `--cwd`.** Verified against the herdr CLI: workspace
  create supports `--cwd`; tab create and pane split do not. We `cd` after
  creating the pane.
- **Current workspace resolution.** Use `herdr workspace list` and pick the
  entry whose `focused` flag is set. If that field is not exposed, fall back
  to `pane list` → focused pane → derive workspace id from the pane id prefix
  (`1-2` → workspace `1`).
- **Errors.** `sh` rejects on non-zero exit with stderr captured. Top-level
  command handlers catch and call `showToast({ style: Failure, ... })`. No
  retries.

## Testing

1. **Unit tests on `herdr.ts`** with `child_process.spawn` stubbed. One happy-
   path test per placement × per `submitVia` mode. Asserts the exact argv
   passed to `herdr`.
2. **Schema tests** — zod fixtures: a valid example, a missing-`command`
   example, a bad-`placement` example.
3. **Manual smoke test** — checklist in this spec:
   - Ask Claude with default folder: pane opens, prompt is sent.
   - Run herdr action with a `submitVia: arg` action.
   - Run herdr action with a promptless action.
   - Focus herdr workspace picks the right workspace.
   - Edit actions config opens the file.

No mocking of the herdr socket. We trust the CLI.

## Out of scope

- Inline action editing in Raycast (the JSON file is the source of truth).
- Syncing actions to herdr's own state.
- Multiple prompt fields per action.
- Favorites / recents (Raycast handles command-level recency).
- Re-implementing the herdr socket protocol in TS.

## Directory layout

```
extensions/herdr/
  package.json          # Raycast extension manifest (commands, prefs)
  tsconfig.json
  src/
    ask-claude.tsx      # command 1
    run-action.tsx      # command 2 (list + form)
    focus-workspace.tsx # command 3
    edit-config.ts      # command 4 (no-view)
    herdr.ts            # CLI wrapper, runAction, binary discovery
    config.ts           # zod schema, load/save, expandHome
  assets/
    icon.png
  tests/
    herdr.test.ts
    config.test.ts
```
