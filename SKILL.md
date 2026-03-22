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

# 限价平仓：按 rawSize 平掉 0.00145 BTC 多单
bun scripts/trade-order.ts BTC sell 0.00145 68600 --type limit --reduce-only --raw-size

# 市价平仓：按 rawSize 平掉 0.00145 BTC 多单
bun scripts/trade-order.ts BTC sell 0.00145 --type market --reduce-only --raw-size

# 止损单：按 rawSize 为现有仓位挂止损，触发价 49000，执行价 48000
bun scripts/trade-order.ts BTC sell 0.00145 48000 --type stop-loss --trigger 49000 --reduce-only --raw-size

# 止盈单：按 rawSize 为现有仓位挂止盈，触发价 54000，执行价 55000
bun scripts/trade-order.ts BTC sell 0.00145 55000 --type take-profit --trigger 54000 --reduce-only --raw-size

# 可选参数：
#   --type <limit|market|stop-loss|take-profit>
#                                        订单类型，默认 limit
#   --trigger <price>                     触发价（止损/止盈必填）
#   --slippage <percent>                  市价单滑点保护，默认 3
#   --raw-size                            把第三个参数解释为币本位 raw size（仅 reduce-only）
#   --reduce-only                         仅减仓
#   --tif <Gtc|Ioc|Alo>                   有效期策略，默认 Gtc
#   --json                                输出 JSON

# 取消订单：指定币种 + 订单ID
bun scripts/trade-cancel.ts <coin> <order-id> [--json]
```

注意：`trade-order.ts` 的第三个参数默认是 USDC 名义金额，不是币本位数量。用户说的 `1000u`、`1000 usdc`、`1000 usdt` 都按 `1000 USDC` 规模理解。
注意：只有 `--reduce-only` 订单才允许加 `--raw-size`，这时第三个参数按原始持仓数量解释，例如 `0.00145 BTC` 或 `70 xyz:CL`。
注意：非 `reduce-only` 订单必须使用 U 本位输入，不能使用 `--raw-size`。
注意：任何平仓动作之前，必须先查询一次当前仓位的 `rawSize`，再据此构造 `--reduce-only --raw-size` 订单；不要假设用户口头描述的数量就是当前持仓数量。
注意：脚本会按下单价格把 USDC 名义金额换算成币本位数量；因此实际成交的 USDC 金额会随最终成交价有轻微偏差。
注意：市价单底层会以 Hyperliquid `FrontendMarket` 方式提交；若未显式传 price，会读取当前买一/卖一并按 `--slippage` 生成保护价。
注意：若未设置 `HL_TESTNET=1`，交易脚本默认连接 Hyperliquid 主网。
注意：查询原始持仓数量请用 `bun scripts/account-positions.ts --json` 或查看表格里的 `Raw Size` 列。

当用户自然语言下单时，默认按 U 本位理解规模，例如：

- `开 1000u 的 BTC 多单` → `bun scripts/trade-order.ts BTC buy 1000 --type market`
- `挂 5000u 的 ETH 空单，限价 4200` → `bun scripts/trade-order.ts ETH sell 5000 4200`
- `把 BTC 多单按当前持仓全平` → 先查 `rawSize`，再用 `bun scripts/trade-order.ts BTC sell <rawSize> --type market --reduce-only --raw-size`
- `给 BTC 多单挂止损，数量按当前持仓` → 先查 `rawSize`，再用 `bun scripts/trade-order.ts BTC sell <rawSize> 48000 --type stop-loss --trigger 49000 --reduce-only --raw-size`

平仓工作流要求：

1. 先运行 `bun scripts/account-positions.ts --json`，读取目标仓位的最新 `rawSize`
2. 再根据该 `rawSize` 构造 `trade-order.ts ... --reduce-only --raw-size`
3. 不要跳过第 1 步，也不要复用旧的 `rawSize`

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
