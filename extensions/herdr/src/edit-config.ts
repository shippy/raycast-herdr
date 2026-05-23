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

  spawn("open", ["-R", path], { detached: true, stdio: "ignore" }).unref();
  await showToast({ style: Toast.Style.Success, title: "Revealed in Finder", message: path });
}
