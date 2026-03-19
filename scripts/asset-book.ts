#!/usr/bin/env bun
/**
 * asset-book.ts — Display L2 order book for a specific asset.
 *
 * Usage:
 *   bun scripts/asset-book.ts <coin> [--json]
 */

import { getL2Book } from "./lib/api";
import { parseArgs, isJson, printJson, formatNum } from "./lib/format";

const { flags, positional } = parseArgs(process.argv.slice(2));

if (positional.length === 0) {
  console.error("Usage: bun scripts/asset-book.ts <coin> [--json]");
  console.error("Example: bun scripts/asset-book.ts BTC");
  process.exit(1);
}

const coin = positional[0];
const book = await getL2Book(coin);

const [bids, asks] = book.levels;

if (isJson(flags)) {
  printJson({ coin, bids, asks });
} else {
  console.log(`Order Book: ${coin}`);
  console.log();

  // Show top 15 levels each side
  const depth = 15;
  const topAsks = asks.slice(0, depth).reverse();
  const topBids = bids.slice(0, depth);

  // Header
  console.log(`${"Price".padStart(14)}  ${"Size".padStart(14)}  ${"Orders".padStart(6)}`);
  console.log("─".repeat(40));

  // Asks (high to low)
  for (const ask of topAsks) {
    console.log(`${formatNum(ask.px, 6).padStart(14)}  ${formatNum(ask.sz, 6).padStart(14)}  ${String(ask.n).padStart(6)}  ASK`);
  }

  // Spread
  if (topAsks.length > 0 && topBids.length > 0) {
    const bestAsk = parseFloat(topAsks[topAsks.length - 1].px);
    const bestBid = parseFloat(topBids[0].px);
    const spread = bestAsk - bestBid;
    const spreadPct = ((spread / bestAsk) * 100).toFixed(4);
    console.log(`${"--- spread".padStart(14)}  ${formatNum(spread, 6).padStart(14)}  ${(spreadPct + "%").padStart(6)}`);
  }

  // Bids (high to low)
  for (const bid of topBids) {
    console.log(`${formatNum(bid.px, 6).padStart(14)}  ${formatNum(bid.sz, 6).padStart(14)}  ${String(bid.n).padStart(6)}  BID`);
  }
}
