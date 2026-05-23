import { LaunchProps, getPreferenceValues, showToast, Toast } from "@raycast/api";
import { spawn } from "child_process";
import { createHerdr } from "./herdr";
import { findHerdr, sh } from "./exec";

interface Prefs {
  folder?: string;
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
  const focus = prefs.focus ?? true;

  try {
    const bin = await findHerdr(prefs.herdrPath);
    const h = createHerdr({ sh, bin });
    await h.runClaude({ folder, prompt: props.arguments.prompt, focus });
    if (focus) await bringHerdrToFront();
    await showToast({ style: Toast.Style.Success, title: "Asked Claude", message: folder });
  } catch (err) {
    await showToast({ style: Toast.Style.Failure, title: "Failed to ask Claude", message: (err as Error).message });
  }
}
