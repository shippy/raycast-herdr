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
    const child = spawn(process.env.SHELL ?? "/bin/zsh", ["-lic", "command -v herdr"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.on("close", () => resolve(out.trim() || null));
    child.on("error", () => resolve(null));
  });
  if (!found) {
    throw new Error("Could not locate the herdr binary. Set it in extension preferences.");
  }
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
