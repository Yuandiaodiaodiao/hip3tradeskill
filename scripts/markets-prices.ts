#!/usr/bin/env bun
/**
 * markets-prices.ts — Display all market mid-prices.
 *
 * Usage:
 *   bun scripts/markets-prices.ts [--json]
 */

import { getAllMids } from "./lib/api";
import { parseArgs, isJson, printJson, printTable, formatNum } from "./lib/format";

const { flags } = parseArgs(process.argv.slice(2));

const mids = await getAllMids();

if (isJson(flags)) {
  printJson(mids);
} else {
  const entries = Object.entries(mids).sort(([a], [b]) => a.localeCompare(b));

  printTable(
    ["Coin", "Mid Price"],
    entries.map(([coin, price]) => [coin, formatNum(price, 6)])
  );
  console.log(`\nTotal: ${entries.length} markets`);
}
