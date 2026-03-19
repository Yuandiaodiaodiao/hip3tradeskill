#!/usr/bin/env bun
/**
 * order-history.ts — View closed/filled order history (recent fills).
 *
 * Usage:
 *   bun scripts/order-history.ts [--json]
 */

import { getUserFills } from "./lib/api";
import { requireAddress } from "./lib/config";
import { parseArgs, isJson, printJson, printTable, formatNum, formatTimestamp } from "./lib/format";

const { flags } = parseArgs(process.argv.slice(2));
const address = requireAddress();

const fills = await getUserFills(address);

// Sort by time descending (most recent first)
fills.sort((a, b) => b.time - a.time);

if (isJson(flags)) {
  printJson({ account: address, fills });
} else {
  console.log(`Order History for ${address}`);
  console.log();

  if (fills.length === 0) {
    console.log("No order history.");
  } else {
    // Show last 50 fills
    const recent = fills.slice(0, 50);
    printTable(
      ["Time", "Coin", "Side", "Size", "Price", "Fee", "PnL", "OID"],
      recent.map((f) => [
        formatTimestamp(f.time),
        f.coin,
        f.side === "B" ? "Buy" : "Sell",
        f.sz,
        f.px,
        formatNum(f.fee, 4),
        f.closedPnl !== "0" ? formatNum(f.closedPnl, 2) : "-",
        String(f.oid),
      ])
    );
    if (fills.length > 50) {
      console.log(`\n(showing 50 of ${fills.length} fills)`);
    }
  }
}
