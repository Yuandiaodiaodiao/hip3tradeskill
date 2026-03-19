#!/usr/bin/env bun
/**
 * markets-prices.ts — Query mid-prices for specified trading pairs.
 *
 * Usage:
 *   bun scripts/markets-prices.ts <coin1> [coin2] [coin3] ... [--json]
 *
 * Examples:
 *   bun scripts/markets-prices.ts BTC
 *   bun scripts/markets-prices.ts BTC ETH SOL
 *   bun scripts/markets-prices.ts BTC ETH --json
 */

import { getAllMids } from "./lib/api";
import { parseArgs, isJson, printJson, printTable, formatNum } from "./lib/format";

const { flags, positional } = parseArgs(process.argv.slice(2));

if (positional.length === 0) {
  console.error("Usage: bun scripts/markets-prices.ts <coin1> [coin2] ... [--json]");
  console.error("Example: bun scripts/markets-prices.ts BTC ETH SOL");
  process.exit(1);
}

const mids = await getAllMids();
const coins = positional.map((c) => c.toUpperCase());
const results: Record<string, string> = {};

for (const coin of coins) {
  if (coin in mids) {
    results[coin] = mids[coin];
  } else {
    // Try case-insensitive match
    const match = Object.keys(mids).find((k) => k.toUpperCase() === coin);
    if (match) {
      results[match] = mids[match];
    } else {
      results[coin] = "N/A";
    }
  }
}

if (isJson(flags)) {
  printJson(results);
} else {
  printTable(
    ["Coin", "Mid Price"],
    Object.entries(results).map(([coin, price]) => [coin, price === "N/A" ? "N/A" : formatNum(price, 6)])
  );
}
