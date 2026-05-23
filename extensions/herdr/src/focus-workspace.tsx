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

type State =
  | { kind: "loading" }
  | { kind: "ok"; workspaces: Workspace[] }
  | { kind: "error"; message: string };

export default function Command() {
  const [state, setState] = useState<State>({ kind: "loading" });

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
              <Action title="Launch Herdr" onAction={() => bringHerdrToFront()} />
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
                    await showToast({
                      style: Toast.Style.Failure,
                      title: "Focus failed",
                      message: (err as Error).message,
                    });
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
