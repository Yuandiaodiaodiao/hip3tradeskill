---
name: hyperliquidskill
description: >
  Trade crypto perpetuals, HIP-3 stocks (AAPL, NVDA, TSLA), and commodities (GOLD, SILVER) on Hyperliquid DEX.
  Supports account setup, position tracking, order management, limit/stop-loss/take-profit orders, and real-time market data.
  Use this skill whenever the user mentions Hyperliquid trading, perp positions, HIP-3 assets, order placement, or DEX market data.
---

# Hyperliquid Trading Skill

A CLI toolkit for Hyperliquid DEX — TypeScript + Bun, zero package.json, native fetch for read-only queries, git-submodule-locked SDK for signed exchange operations.

## Directory Layout

```
scripts/
├── lib/
│   ├── api.ts          # Native HTTP client for /info endpoint
│   ├── config.ts       # Account config read/write (~/.hyperliquidskill/config.json)
│   ├── exchange.ts     # EIP-712 signing + /exchange endpoint (uses SDK submodule)
│   └── format.ts       # Table/JSON output formatting
├── account-set.ts      # Set address + optional private key
├── account-positions.ts# View positions (perp + HIP-3)
├── account-orders.ts   # View open orders
├── order-history.ts    # View closed/filled orders
├── markets-prices.ts   # All market mid-prices
├── asset-book.ts       # L2 order book for a specific asset
├── trade-order.ts      # Place limit / stop-loss / take-profit orders
└── trade-cancel.ts     # Cancel an order by coin + order-id
```

## Quick Reference

```bash
# Account setup (address only = read-only; with key = full trading)
bun scripts/account-set.ts <address> [private-key]

# Read-only queries (no private key needed)
bun scripts/account-positions.ts [--json]
bun scripts/account-orders.ts [--json]
bun scripts/order-history.ts [--json]
bun scripts/markets-prices.ts [--json]
bun scripts/asset-book.ts <coin> [--json]

# Trading (requires private key)
bun scripts/trade-order.ts <coin> <buy|sell> <size-usdc> <price> [--type limit|stop-loss|take-profit] [--trigger <price>] [--json]
bun scripts/trade-cancel.ts <coin> <order-id> [--json]
```

## HIP-3 Support

HIP-3 builder-deployed perps (stocks, commodities) use a different asset ID scheme: `100000 + dex_index * 10000 + asset_index`. The tool auto-resolves coin names across all perp dexes via `allPerpMetas`.

HIP-3 markets have isolated margin. Users may need to enable "HIP-3 Dex Abstraction" at https://app.hyperliquid.xyz (Settings → disable "Disable HIP-3 Dex Abstraction") to share margin from their main account.

## RWA / TradeFi 交易对索引

当交易 RWA（Real World Assets）或 TradeFi 资产（如股票、大宗商品等）时，需要先通过以下文档查询可用的交易对名称和参数：

https://github.com/Yuandiaodiaodiao/hip3-tradefi-skill/blob/main/skill.md

该文档包含所有 HIP-3 TradeFi 交易对的完整列表，包括币对名称、精度等信息。请在下单前先查阅此索引确认正确的交易对名称。

## Source Repository

This skill's source code is hosted at:

```
https://github.com/Yuandiaodiaodiao/hip3tradeskill
```

To clone and set up locally:

```bash
git clone --recurse-submodules https://github.com/Yuandiaodiaodiao/hip3tradeskill.git
cd hip3tradeskill
bun install
```

The repository contains a git submodule at `vendor/hyperliquid` pointing to `https://github.com/nktkas/hyperliquid.git` (the `@nktkas/hyperliquid` SDK). The `--recurse-submodules` flag is required to fetch it.

## Security

- The SDK (`@nktkas/hyperliquid`) is pinned via git submodule to prevent supply chain attacks
- Private keys are stored locally in `~/.hyperliquidskill/config.json`
- Without a private key, only info queries work — no trading is possible
- Use an **API wallet** (agent wallet) rather than your main wallet for trading
