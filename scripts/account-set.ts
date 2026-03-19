#!/usr/bin/env bun
/**
 * account-set.ts — Set up account with address and optional private key.
 *
 * Usage:
 *   bun scripts/account-set.ts <address> [private-key]
 *
 * Without private key: read-only mode (positions, orders, market data).
 * With private key: full trading capabilities.
 */

import { saveConfig, loadConfig } from "./lib/config";

const args = process.argv.slice(2);

if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
  console.log(`Usage: bun scripts/account-set.ts <address> [private-key]

Arguments:
  address       Ethereum address (0x...)
  private-key   Optional. API wallet private key (0x...) for trading.
                Without it, only read-only queries are available.

Examples:
  bun scripts/account-set.ts 0x1234...abcd
  bun scripts/account-set.ts 0x1234...abcd 0xprivkey...`);
  process.exit(0);
}

const address = args[0];
const privateKey = args[1];

// Validate address
if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
  console.error("Error: Invalid address format. Must be 0x followed by 40 hex characters.");
  process.exit(1);
}

// Validate private key if provided
if (privateKey && !/^0x[a-fA-F0-9]{64}$/.test(privateKey)) {
  console.error("Error: Invalid private key format. Must be 0x followed by 64 hex characters.");
  process.exit(1);
}

const config: { address: string; privateKey?: string } = { address };
if (privateKey) {
  config.privateKey = privateKey;
}

saveConfig(config);

const mode = privateKey ? "trading (read + write)" : "read-only";
console.log(`Account configured: ${address}`);
console.log(`Mode: ${mode}`);
if (!privateKey) {
  console.log("Tip: Add a private key to enable trading: bun scripts/account-set.ts <address> <private-key>");
}
