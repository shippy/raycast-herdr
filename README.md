# raycast-herdr

Private Raycast extension for driving the running [herdr](https://herdr.dev) instance from Raycast.

The extension lives in [`extensions/herdr/`](extensions/herdr/). See its [README](extensions/herdr/README.md) for command list, preferences, and action config format.

## Commands

- **Ask Claude** — open `claude` in a configured folder and submit a prompt. Reuses or creates a herdr workspace matching the folder.
- **Run herdr Action** — pick and run a user-defined action from `~/.config/raycast-herdr/actions.json`.
- **Focus herdr Workspace** — list and switch between herdr workspaces.
- **Edit herdr Actions Config** — open the actions JSON in `$EDITOR`.

## Design docs

- [Spec](docs/superpowers/specs/2026-05-23-raycast-herdr-design.md)
- [Implementation plan](docs/superpowers/plans/2026-05-23-raycast-herdr.md)

## Development

```bash
cd extensions/herdr
npm install
npm test          # vitest
npm run lint      # ray lint
npm run build     # ray build
npm run dev       # ray develop — installs into Raycast in dev mode
```

## Publishing

The `.github/workflows/extensions_build_publish.yml` GitHub Action publishes to your private Raycast store on push to `main`. It requires a `RAYCAST_ORGANIZATION_TOKEN` repository secret — get it with `ray token -C` and paste into repo settings.

Alternatively, push to a branch and open a PR to get automatic validation via status checks; merge to `main` publishes.
