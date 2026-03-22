---
name: hyperliquidskill
description: >
  Trade crypto perpetuals, HIP-3 stocks (AAPL, NVDA, TSLA), and commodities (GOLD, SILVER) on Hyperliquid DEX.
  Supports account setup, position tracking, order management, market/limit/stop-loss/take-profit orders, and real-time market data.
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
├── trade-order.ts      # Place market / limit / stop-loss / take-profit orders
└── trade-cancel.ts     # Cancel an order by coin + order-id
```

## Quick Reference

所有脚本默认输出人类可读的表格格式。添加 `--json` 可输出结构化 JSON，适合程序解析。

### 账户设置（仅需执行一次）

```bash
# 只设地址 → 只读模式（查持仓、订单、行情）
bun scripts/account-set.ts <address>

# 设地址 + 私钥 → 可交易（需使用 API wallet 私钥）
bun scripts/account-set.ts <address> <private-key>
```

### 查询（无需私钥）

```bash
# 查看当前持仓（所有 DEX，含 HIP-3）
bun scripts/account-positions.ts [--json]

# 查看当前挂单
bun scripts/account-orders.ts [--json]

# 查看最近成交记录（最多 50 条）
bun scripts/order-history.ts [--json]

# 查看指定币种最新价格
bun scripts/markets-prices.ts <coin1> [coin2] ... [--json]

# 查看指定币种 L2 订单簿（买卖盘深度）
bun scripts/asset-book.ts <coin> [--json]
```

### 交易（需要私钥）

```bash
# 下限价单：买入 1000 USDC 名义金额的 BTC，限价 100000
bun scripts/trade-order.ts BTC buy 1000 100000

# 下市价单：买入 1000 USDC 名义金额的 BTC（自动按盘口 + 3% 滑点保护价提交）
bun scripts/trade-order.ts BTC buy 1000 --type market

# 下市价单：买入 1000 USDC 名义金额的 BTC，显式指定最差成交保护价 103000
bun scripts/trade-order.ts BTC buy 1000 103000 --type market

# 下止损单：卖出 1000 USDC 名义金额的 BTC，触发价 49000，执行价 48000
bun scripts/trade-order.ts BTC sell 1000 48000 --type stop-loss --trigger 49000

# 下止盈单：卖出 1000 USDC 名义金额的 BTC，触发价 54000，执行价 55000
bun scripts/trade-order.ts BTC sell 1000 55000 --type take-profit --trigger 54000

# 可选参数：
#   --type <limit|market|stop-loss|take-profit>
#                                        订单类型，默认 limit
#   --trigger <price>                     触发价（止损/止盈必填）
#   --slippage <percent>                  市价单滑点保护，默认 3
#   --reduce-only                         仅减仓
#   --tif <Gtc|Ioc|Alo>                   有效期策略，默认 Gtc
#   --json                                输出 JSON

# 取消订单：指定币种 + 订单ID
bun scripts/trade-cancel.ts <coin> <order-id> [--json]
```

注意：`trade-order.ts` 的第三个参数默认是 USDC 名义金额，不是币本位数量。用户说的 `1000u`、`1000 usdc`、`1000 usdt` 都按 `1000 USDC` 规模理解。
注意：脚本会按下单价格把 USDC 名义金额换算成币本位数量；因此实际成交的 USDC 金额会随最终成交价有轻微偏差。
注意：市价单底层会以 Hyperliquid `FrontendMarket` 方式提交；若未显式传 price，会读取当前买一/卖一并按 `--slippage` 生成保护价。
注意：若未设置 `HL_TESTNET=1`，交易脚本默认连接 Hyperliquid 主网。

当用户自然语言下单时，默认按 U 本位理解规模，例如：

- `开 1000u 的 BTC 多单` → `bun scripts/trade-order.ts BTC buy 1000 --type market`
- `挂 5000u 的 ETH 空单，限价 4200` → `bun scripts/trade-order.ts ETH sell 5000 4200`

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
git clone https://github.com/Yuandiaodiaodiao/hip3tradeskill.git
cd hip3tradeskill
bun install
```

## Security

- The SDK (`@nktkas/hyperliquid`) is vendored locally at `vendor/hyperliquid-npm/` to prevent supply chain attacks
- Private keys are stored locally in `~/.hyperliquidskill/config.json`
- Without a private key, only info queries work — no trading is possible
- Use an **API wallet** (agent wallet) rather than your main wallet for trading
