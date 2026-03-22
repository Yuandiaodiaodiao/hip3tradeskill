#!/usr/bin/env bun
/**
 * trade-order.ts — Place limit / market / stop-loss / take-profit orders.
 *
 * Usage:
 *   bun scripts/trade-order.ts <coin> <buy|sell> <size-input> [price] [options]
 *
 * Options:
 *   --type <limit|market|stop-loss|take-profit>  Order type (default: limit)
 *   --trigger <price>                            Trigger price (required for stop-loss/take-profit)
 *   --slippage <percent>                         Market-order slippage cap, default 3
 *   --raw-size                                   Treat <size-input> as base-asset size (reduce-only only)
 *   --reduce-only                                Reduce-only order
 *   --tif <Gtc|Ioc|Alo>                          Time-in-force (default: Gtc, limit orders only)
 *   --json                                       JSON output
 *
 * By default, <size-input> is in USDC terms and is converted to base size internally.
 * With --raw-size, <size-input> is interpreted as raw base-asset size, but only for reduce-only orders.
 *
 * Examples:
 *   bun scripts/trade-order.ts BTC buy 1000 100000
 *   bun scripts/trade-order.ts BTC buy 1000 --type market
 *   bun scripts/trade-order.ts BTC buy 1000 103000 --type market
 *   bun scripts/trade-order.ts BTC sell 0.00145 68600 --type limit --reduce-only --raw-size
 *   bun scripts/trade-order.ts BTC sell 0.00145 --type market --reduce-only --raw-size
 *   bun scripts/trade-order.ts BTC sell 0.00145 48000 --type stop-loss --trigger 49000 --reduce-only --raw-size
 *   bun scripts/trade-order.ts BTC sell 0.00145 55000 --type take-profit --trigger 54000 --reduce-only --raw-size
 */

import { resolveAssetIndex, getL2Book } from "./lib/api";
import { requirePrivateKey } from "./lib/config";
import { getExchangeClient } from "./lib/exchange";
import { parseArgs, isJson, printJson } from "./lib/format";
import { formatPrice, formatSize } from "@nktkas/hyperliquid/utils";

type CliOrderType = "limit" | "market" | "stop-loss" | "take-profit";
type LimitTif = "Gtc" | "Ioc" | "Alo";

function printUsage(): void {
  console.error(`Usage: bun scripts/trade-order.ts <coin> <buy|sell> <size-input> [price] [--type limit|market|stop-loss|take-profit] [--trigger <price>] [--slippage <percent>] [--raw-size] [--reduce-only] [--json]

Examples:
  bun scripts/trade-order.ts BTC buy 1000 100000
  bun scripts/trade-order.ts BTC buy 1000 --type market
  bun scripts/trade-order.ts BTC buy 1000 103000 --type market
  bun scripts/trade-order.ts BTC sell 0.00145 68600 --type limit --reduce-only --raw-size
  bun scripts/trade-order.ts BTC sell 0.00145 --type market --reduce-only --raw-size
  bun scripts/trade-order.ts BTC sell 0.00145 48000 --type stop-loss --trigger 49000 --reduce-only --raw-size --json
  bun scripts/trade-order.ts BTC sell 0.00145 55000 --type take-profit --trigger 54000 --reduce-only --raw-size --json`);
}

const { flags, positional } = parseArgs(process.argv.slice(2));

if (positional.length < 3) {
  printUsage();
  process.exit(1);
}

const coin = positional[0];
const sideArg = positional[1].toLowerCase();
const sizeInputArg = positional[2];
const priceArg = positional[3];
const orderType = ((flags.type as string) || "limit") as CliOrderType;
const triggerPx = flags.trigger as string | undefined;
const reduceOnly = flags["reduce-only"] === true;
const rawSizeMode = flags["raw-size"] === true;
const tif = ((flags.tif as string) || "Gtc") as LimitTif;
const slippageArg = flags.slippage as string | undefined;

// Validate side
if (sideArg !== "buy" && sideArg !== "sell") {
  console.error('Error: Side must be "buy" or "sell".');
  process.exit(1);
}
const isBuy = sideArg === "buy";

const sizeInput = parseFloat(sizeInputArg);
if (isNaN(sizeInput) || sizeInput <= 0) {
  console.error(`Error: ${rawSizeMode ? "Raw size" : "Notional"} must be a positive number.`);
  process.exit(1);
}

// Validate order type
if (!["limit", "market", "stop-loss", "take-profit"].includes(orderType)) {
  console.error('Error: --type must be "limit", "market", "stop-loss", or "take-profit".');
  process.exit(1);
}

if (!["Gtc", "Ioc", "Alo"].includes(tif)) {
  console.error('Error: --tif must be "Gtc", "Ioc", or "Alo".');
  process.exit(1);
}

if (rawSizeMode && !reduceOnly) {
  console.error("Error: --raw-size is only allowed for reduce-only orders.");
  process.exit(1);
}

const isTriggerOrder = orderType === "stop-loss" || orderType === "take-profit";
const isMarketOrder = orderType === "market";

if (!isMarketOrder && !priceArg) {
  console.error(`Error: price is required for ${orderType} orders.`);
  process.exit(1);
}

let price: number | undefined;
if (priceArg !== undefined) {
  price = parseFloat(priceArg);
  if (isNaN(price) || price <= 0) {
    console.error("Error: Price must be a positive number.");
    process.exit(1);
  }
}

// Validate trigger for stop-loss / take-profit
if (isTriggerOrder && !triggerPx) {
  console.error(`Error: --trigger is required for ${orderType} orders.`);
  process.exit(1);
}

if (!isTriggerOrder && triggerPx) {
  console.error("Error: --trigger is only valid for stop-loss and take-profit orders.");
  process.exit(1);
}

if (triggerPx) {
  const triggerPrice = parseFloat(triggerPx);
  if (isNaN(triggerPrice) || triggerPrice <= 0) {
    console.error("Error: Trigger price must be a positive number.");
    process.exit(1);
  }
}

if (isMarketOrder && flags.tif !== undefined) {
  console.error("Error: --tif is not used for market orders.");
  process.exit(1);
}

if (!isMarketOrder && slippageArg !== undefined) {
  console.error("Error: --slippage is only valid for market orders.");
  process.exit(1);
}

let slippagePct = 3;
if (slippageArg !== undefined) {
  slippagePct = parseFloat(slippageArg);
  if (isNaN(slippagePct) || slippagePct <= 0 || slippagePct >= 100) {
    console.error("Error: --slippage must be a number between 0 and 100.");
    process.exit(1);
  }
}

if (isMarketOrder && price !== undefined && slippageArg !== undefined) {
  console.error("Error: Pass either an explicit market protection price or --slippage, not both.");
  process.exit(1);
}

// Resolve asset
const privateKey = requirePrivateKey() as `0x${string}`;
const asset = await resolveAssetIndex(coin);

// Build order type wire format
let orderTypeWire: Record<string, unknown>;
if (isMarketOrder) {
  orderTypeWire = { limit: { tif: "FrontendMarket" } };
} else if (orderType === "limit") {
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

// Place order via SDK
const client = await getExchangeClient(privateKey);

try {
  let referencePx: string | undefined;
  let formattedPrice: string;
  let sizeReferencePx: number;
  if (isMarketOrder && price === undefined) {
    const book = await getL2Book(coin);
    const bookSide = isBuy ? book.levels[1] : book.levels[0];
    const topLevel = bookSide[0];

    if (!topLevel) {
      throw new Error(`No ${isBuy ? "ask" : "bid"} liquidity available for ${coin}.`);
    }

    const topPx = parseFloat(topLevel.px);
    const protectedPx = isBuy ? topPx * (1 + slippagePct / 100) : topPx * (1 - slippagePct / 100);

    sizeReferencePx = topPx;
    referencePx = formatPrice(topPx, asset.szDecimals, asset.marketType);
    formattedPrice = formatPrice(protectedPx, asset.szDecimals, asset.marketType);
  } else {
    sizeReferencePx = price!;
    formattedPrice = formatPrice(price!, asset.szDecimals, asset.marketType);
  }

  const baseSize = rawSizeMode ? sizeInput : sizeInput / sizeReferencePx;
  const formattedSize = formatSize(baseSize, asset.szDecimals);

  const result = await client.order({
    orders: [
      {
        a: asset.index,
        b: isBuy,
        p: formattedPrice,
        s: formattedSize,
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

    const orderLabel = isMarketOrder ? "MARKET" : orderType.toUpperCase();
    const sizeLabel = rawSizeMode
      ? `${formattedSize} ${coin} (raw size)`
      : `${sizeInput} USDC of ${coin} (${formattedSize} ${coin})`;
    const summaryParts = [`\n${orderLabel} ${isBuy ? "BUY" : "SELL"} ${sizeLabel}`];

    if (isMarketOrder) {
      summaryParts.push(`${isBuy ? "<=" : ">="} ${formattedPrice}`);
      if (referencePx) {
        summaryParts.push(`(sized from top of book: ${referencePx}, slippage cap: ${slippagePct}%)`);
      }
    } else {
      summaryParts.push(`@ ${formattedPrice}`);
      if (triggerPx) {
        summaryParts.push(`(trigger: ${triggerPx})`);
      }
    }

    console.log(summaryParts.join(" "));
  }
} catch (err) {
  if (isJson(flags)) {
    printJson({ error: err instanceof Error ? err.message : String(err) });
  } else {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
  }
  process.exit(1);
}
