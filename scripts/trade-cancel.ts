#!/usr/bin/env bun
/**
 * trade-cancel.ts — Cancel an order by coin + order-id.
 *
 * Usage:
 *   bun scripts/trade-cancel.ts <coin> <order-id> [--json]
 */

import { resolveAssetIndex } from "./lib/api";
import { requirePrivateKey } from "./lib/config";
import { getExchangeClient } from "./lib/exchange";
import { parseArgs, isJson, printJson } from "./lib/format";

const { flags, positional } = parseArgs(process.argv.slice(2));

if (positional.length < 2) {
  console.error("Usage: bun scripts/trade-cancel.ts <coin> <order-id> [--json]");
  console.error("Example: bun scripts/trade-cancel.ts BTC 123456789");
  process.exit(1);
}

const coin = positional[0];
const orderIdStr = positional[1];

const orderId = parseInt(orderIdStr, 10);
if (isNaN(orderId) || orderId <= 0) {
  console.error("Error: Order ID must be a positive integer.");
  process.exit(1);
}

const privateKey = requirePrivateKey() as `0x${string}`;
const asset = await resolveAssetIndex(coin);
const client = await getExchangeClient(privateKey);

try {
  const result = await client.cancel({
    cancels: [{ a: asset.index, o: orderId }],
  });

  if (isJson(flags)) {
    printJson(result);
  } else {
    console.log(`Order ${orderId} cancelled (${coin}).`);
  }
} catch (err) {
  if (isJson(flags)) {
    printJson({ error: err instanceof Error ? err.message : String(err) });
  } else {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
  }
  process.exit(1);
}
