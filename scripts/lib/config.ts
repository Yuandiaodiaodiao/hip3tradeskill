/**
 * Account config storage.
 * Stores address + optional private key in ~/.hyperliquidskill/config.json
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const CONFIG_DIR = join(homedir(), ".hyperliquidskill");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

export interface AccountConfig {
  address: string;
  privateKey?: string; // hex with 0x prefix
}

function ensureDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
}

export function loadConfig(): AccountConfig | null {
  if (!existsSync(CONFIG_FILE)) return null;
  try {
    const raw = readFileSync(CONFIG_FILE, "utf-8");
    return JSON.parse(raw) as AccountConfig;
  } catch {
    return null;
  }
}

export function saveConfig(config: AccountConfig): void {
  ensureDir();
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + "\n", {
    mode: 0o600, // owner-only read/write
  });
}

export function requireAddress(): string {
  const cfg = loadConfig();
  if (!cfg?.address) {
    console.error("No account configured. Run: bun scripts/account-set.ts <address> [private-key]");
    process.exit(1);
  }
  return cfg.address;
}

export function requirePrivateKey(): string {
  const cfg = loadConfig();
  if (!cfg?.privateKey) {
    console.error("No private key configured. Trading requires a private key.");
    console.error("Run: bun scripts/account-set.ts <address> <private-key>");
    process.exit(1);
  }
  return cfg.privateKey;
}

export function hasPrivateKey(): boolean {
  const cfg = loadConfig();
  return !!cfg?.privateKey;
}
