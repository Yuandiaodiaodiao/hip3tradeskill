#!/usr/bin/env bun
/**
 * trade-order.ts — Place limit / stop-loss / take-profit orders.
 *
 * Usage:
 *   bun scripts/trade-order.ts <coin> <buy|sell> <size> <price> [options]
 *
 * Options:
 *   --type <limit|stop-loss|take-profit>   Order type (default: limit)
 *   --trigger <price>                       Trigger price (required for stop-loss/take-profit)
 *   --reduce-only                           Reduce-only order
 *   --tif <Gtc|Ioc|Alo>                     Time-in-force (default: Gtc, limit orders only)
 *   --json                                  JSON output
 *
 * Size is in base asset units (not USDC).
 * Only limit orders are supported. Market orders are not implemented.
 *
 * Examples:
 *   bun scripts/trade-order.ts BTC buy 0.001 100000
 *   bun scripts/trade-order.ts BTC sell 0.001 48000 --type stop-loss --trigger 49000
 *   bun scripts/trade-order.ts BTC sell 0.001 55000 --type take-profit --trigger 54000
 */

import { resolveAssetIndex } from "./lib/api";
import { requirePrivateKey, requireAddress } from "./lib/config";
import { getExchangeClient } from "./lib/exchange";
import { parseArgs, isJson, printJson } from "./lib/format";

const { flags, positional } = parseArgs(process.argv.slice(2));

if (positional.length < 4) {
  console.error(`Usage: bun scripts/trade-order.ts <coin> <buy|sell> <size> <price> [--type limit|stop-loss|take-profit] [--trigger <price>] [--json]

Examples:
  bun scripts/trade-order.ts BTC buy 0.001 100000
  bun scripts/trade-order.ts BTC sell 0.001 48000 --type stop-loss --trigger 49000 --json
  bun scripts/trade-order.ts BTC sell 0.001 55000 --type take-profit --trigger 54000 --json`);
  process.exit(1);
}

const coin = positional[0];
const sideArg = positional[1].toLowerCase();
const sizeArg = positional[2];
const priceArg = positional[3];
const orderType = (flags.type as string) || "limit";
const triggerPx = flags.trigger as string | undefined;
const reduceOnly = flags["reduce-only"] === true;
const tif = ((flags.tif as string) || "Gtc") as "Gtc" | "Ioc" | "Alo";

// Validate side
if (sideArg !== "buy" && sideArg !== "sell") {
  console.error('Error: Side must be "buy" or "sell".');
  process.exit(1);
}
const isBuy = sideArg === "buy";

// Validate size
const size = parseFloat(sizeArg);
if (isNaN(size) || size <= 0) {
  console.error("Error: Size must be a positive number.");
  process.exit(1);
}

// Validate price
const price = parseFloat(priceArg);
if (isNaN(price) || price <= 0) {
  console.error("Error: Price must be a positive number.");
  process.exit(1);
}

// Validate order type
if (!["limit", "stop-loss", "take-profit"].includes(orderType)) {
  console.error('Error: --type must be "limit", "stop-loss", or "take-profit".');
  process.exit(1);
}

// Validate trigger for stop-loss / take-profit
if ((orderType === "stop-loss" || orderType === "take-profit") && !triggerPx) {
  console.error(`Error: --trigger is required for ${orderType} orders.`);
  process.exit(1);
}

if (triggerPx) {
  const t = parseFloat(triggerPx);
  if (isNaN(t) || t <= 0) {
    console.error("Error: Trigger price must be a positive number.");
    process.exit(1);
  }
}

// Resolve asset
const privateKey = requirePrivateKey() as `0x${string}`;
const asset = await resolveAssetIndex(coin);

// Build order type wire format
let orderTypeWire: Record<string, unknown>;
if (orderType === "limit") {
  orderTypeWire = { limit: { tif } };
} else if (orderType === "stop-loss") {
  orderTypeWire = {
    trigger: {
      isMarket: false, // limit execution at specified price
      triggerPx: triggerPx!,
      tpsl: "sl",
    },
  };
} else {
  // take-profit
  orderTypeWire = {
    trigger: {
      isMarket: false,
      triggerPx: triggerPx!,
      tpsl: "tp",
    },
  };
}

// Round size to asset's szDecimals
const roundedSize = parseFloat(size.toFixed(asset.szDecimals));

// Place order via SDK
const client = await getExchangeClient(privateKey);

try {
  const result = await client.order({
    orders: [
      {
        a: asset.index,
        b: isBuy,
        p: price.toString(),
        s: roundedSize.toString(),
        r: reduceOnly,
        t: orderTypeWire as any,
      },
    ],
    grouping: "na",
  });

  if (isJson(flags)) {
    printJson(result);
  } else {
    const statuses = (result as any).response?.data?.statuses || [];
    for (const status of statuses) {
      if (typeof status === "string") {
        console.log(`Order status: ${status}`);
      } else if ("filled" in status) {
        console.log(`Order filled: ${status.filled.totalSz} @ ${status.filled.avgPx}`);
      } else if ("resting" in status) {
        console.log(`Order placed: OID ${status.resting.oid}`);
      } else if ("error" in status) {
        console.error(`Order error: ${status.error}`);
      } else {
        console.log(`Order result: ${JSON.stringify(status)}`);
      }
    }

    console.log(`\n${orderType.toUpperCase()} ${isBuy ? "BUY" : "SELL"} ${roundedSize} ${coin} @ ${price}${triggerPx ? ` (trigger: ${triggerPx})` : ""}`);
  }
} catch (err) {
  if (isJson(flags)) {
    printJson({ error: err instanceof Error ? err.message : String(err) });
  } else {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
  }
  process.exit(1);
}
