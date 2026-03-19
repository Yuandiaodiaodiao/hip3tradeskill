#!/usr/bin/env bun
/**
 * account-positions.ts — View open positions across all dexes (main + HIP-3).
 *
 * Usage:
 *   bun scripts/account-positions.ts [--json]
 */

import { getAllPositions } from "./lib/api";
import { requireAddress } from "./lib/config";
import { parseArgs, isJson, printJson, printTable, formatNum, formatPnl, formatSide } from "./lib/format";

const { flags } = parseArgs(process.argv.slice(2));
const address = requireAddress();

const allDexStates = await getAllPositions(address);

const positions: Array<{
  coin: string;
  side: string;
  entryPx: string;
  markValue: string;
  unrealizedPnl: string;
  roe: string;
  marginUsed: string;
}> = [];

for (const { dex, state } of allDexStates) {
  for (const ap of state.assetPositions) {
    const p = ap.position;
    if (parseFloat(p.szi) === 0) continue;
    positions.push({
      coin: p.coin,
      side: formatSide(p.szi),
      entryPx: formatNum(p.entryPx, 4),
      markValue: formatNum(p.positionValue, 2),
      unrealizedPnl: formatPnl(p.unrealizedPnl),
      roe: `${(parseFloat(p.returnOnEquity) * 100).toFixed(2)}%`,
      marginUsed: formatNum(p.marginUsed, 2),
    });
  }
}

if (isJson(flags)) {
  // Include account summary in JSON output
  const mainState = allDexStates.find((d) => d.dex === "main")?.state;
  printJson({
    account: address,
    summary: mainState
      ? {
          accountValue: mainState.marginSummary.accountValue,
          totalNtlPos: mainState.marginSummary.totalNtlPos,
          totalMarginUsed: mainState.marginSummary.totalMarginUsed,
          withdrawable: mainState.withdrawable,
        }
      : null,
    positions,
  });
} else {
  // Print account summary
  const mainState = allDexStates.find((d) => d.dex === "main")?.state;
  if (mainState) {
    console.log(`闲置资金: $${formatNum(mainState.withdrawable)}`);
    console.log();
  }

  if (positions.length === 0) {
    console.log("No open positions.");
  } else {
    printTable(
      ["Coin", "Side", "Entry", "Value", "PnL", "ROE", "Margin"],
      positions.map((p) => [p.coin, p.side, p.entryPx, p.markValue, p.unrealizedPnl, p.roe, p.marginUsed])
    );
  }
}
