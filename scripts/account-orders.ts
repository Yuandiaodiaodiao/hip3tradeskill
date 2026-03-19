#!/usr/bin/env bun
/**
 * account-orders.ts — View open orders.
 *
 * Usage:
 *   bun scripts/account-orders.ts [--json]
 */

import { getOpenOrders } from "./lib/api";
import { requireAddress } from "./lib/config";
import { parseArgs, isJson, printJson, printTable, formatNum, formatTimestamp } from "./lib/format";

const { flags } = parseArgs(process.argv.slice(2));
const address = requireAddress();

const orders = await getOpenOrders(address);

if (isJson(flags)) {
  printJson({ account: address, openOrders: orders });
} else {
  console.log(`Open Orders for ${address}`);
  console.log();

  if (orders.length === 0) {
    console.log("No open orders.");
  } else {
    printTable(
      ["OID", "Coin", "Side", "Size", "Price", "Type", "Trigger", "Time"],
      orders.map((o) => [
        String(o.oid),
        o.coin,
        o.side === "B" ? "Buy" : "Sell",
        o.sz,
        o.limitPx,
        o.orderType || "Limit",
        o.triggerPx || "-",
        formatTimestamp(o.timestamp),
      ])
    );
  }
}
