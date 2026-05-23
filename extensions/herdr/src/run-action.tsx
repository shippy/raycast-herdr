import { useEffect, useState } from "react";
import {
  Action,
  ActionPanel,
  Form,
  Icon,
  List,
  getPreferenceValues,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
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

type State =
  | { kind: "loading" }
  | { kind: "ok"; actions: HerdrAction[] }
  | { kind: "missing"; path: string }
  | { kind: "error"; message: string; path: string };

export default function Command() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    loadActions().then((r) => {
      if (r.ok) setState({ kind: "ok", actions: r.actions });
      else if (r.missing) setState({ kind: "missing", path: r.path });
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
