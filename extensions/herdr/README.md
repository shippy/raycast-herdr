# herdr Raycast extension

Drive the running [herdr](https://herdr.dev) instance from Raycast.

## Commands

- **Ask Claude** — open `claude` in a configured folder and submit a prompt.
- **Run herdr Action** — pick from user-defined actions in `~/.config/raycast-herdr/actions.json`.
- **Focus herdr Workspace** — list and focus an existing herdr workspace.
- **Edit herdr Actions Config** — open the actions JSON in `$EDITOR`.

## Preferences

- `herdrPath` (extension-wide) — override the auto-detected `herdr` CLI path. Leave empty to auto-detect from `/opt/homebrew/bin`, `/usr/local/bin`, then `which herdr` in a login shell.
- `Ask Claude` command: `folder` (default `~/Documents/Claude-Vault`), `placement` (`tab` / `workspace` / `split`), `focus`.

## Action config

`~/.config/raycast-herdr/actions.json` — array of actions. Run **Edit herdr Actions Config** to create or open it.

Example:

```json
[
  {
    "id": "claude-vault",
    "name": "Ask Claude in Vault",
    "cwd": "~/Documents/Claude-Vault",
    "command": "claude",
    "prompt": { "submitVia": "send-text" },
    "placement": "tab"
  },
  {
    "id": "open-projects",
    "name": "Open shell in projects",
    "cwd": "~/projects",
    "command": "zsh",
    "placement": "tab"
  }
]
```

Fields and defaults are documented in [`docs/superpowers/specs/2026-05-23-raycast-herdr-design.md`](../../docs/superpowers/specs/2026-05-23-raycast-herdr-design.md).

## Development

```bash
npm install
npm test       # vitest
npm run lint   # ray lint
npm run build  # ray build
npm run dev    # ray develop — installs into Raycast in dev mode
```
