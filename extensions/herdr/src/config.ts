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
    return {
      ok: false,
      error: result.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; "),
    };
  }
  return { ok: true, actions: result.data };
}

function home(): string {
  return process.env.HOME ?? homedir();
}

export function expandHome(p: string): string {
  if (p.startsWith("~/")) return join(home(), p.slice(2));
  if (p === "~") return home();
  return p;
}

export function getConfigPath(): string {
  return join(homedir(), ".config", "raycast-herdr", "actions.json");
}

export type LoadResult = ParseResult & { path: string; missing?: boolean };

export async function loadActions(): Promise<LoadResult> {
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
