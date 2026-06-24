import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface SuperTalkConfig {
  name: string;
  channels: string[];
  url: string;
}

/** The `.super-talk` dir at the project root (CLAUDE_PROJECT_DIR, else the process cwd). */
export function configDir(base = process.env.CLAUDE_PROJECT_DIR || process.cwd()): string {
  return join(base, ".super-talk");
}

export function readConfig(dir = configDir()): SuperTalkConfig | null {
  const p = join(dir, "config.json");
  if (!existsSync(p)) return null;
  try {
    const cfg = JSON.parse(readFileSync(p, "utf8"));
    if (cfg && typeof cfg.name === "string") {
      return {
        name: cfg.name,
        channels: Array.isArray(cfg.channels) ? cfg.channels : [],
        url: cfg.url,
      };
    }
  } catch {}
  return null;
}

export function writeConfig(cfg: SuperTalkConfig, dir = configDir()): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "config.json"), `${JSON.stringify(cfg, null, 2)}\n`);
}
