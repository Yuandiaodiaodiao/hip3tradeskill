/**
 * Native HTTP client for Hyperliquid /info endpoint.
 * No dependencies — uses Bun's native fetch.
 */

const MAINNET_URL = "https://api.hyperliquid.xyz";
const TESTNET_URL = "https://api.hyperliquid-testnet.xyz";

function getBaseUrl(): string {
  return process.env.HL_TESTNET === "1" ? TESTNET_URL : MAINNET_URL;
}

async function post<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${getBaseUrl()}/info`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

// ─── Types ───────────────────────────────────────────────────────────────

export interface PerpMeta {
  name: string;
  szDecimals: number;
  maxLeverage: number;
}

export interface PerpDexMeta {
  universe: PerpMeta[];
  name?: string;
}

export interface SpotMeta {
  universe: Array<{ name: string; tokens: number[]; index: number }>;
  tokens: Array<{ name: string; szDecimals: number; weiDecimals: number; index: number }>;
}

export interface Position {
  coin: string;
  szi: string;
  leverage: { type: string; value: number };
  entryPx: string;
  positionValue: string;
  unrealizedPnl: string;
  returnOnEquity: string;
  liquidationPx: string | null;
  marginUsed: string;
  maxLeverage: number;
  cumFunding: { allTime: string; sinceOpen: string; sinceChange: string };
}

export interface AssetPosition {
  type: string;
  position: Position;
}

export interface MarginSummary {
  accountValue: string;
  totalNtlPos: string;
  totalRawUsd: string;
  totalMarginUsed: string;
}

export interface ClearinghouseState {
  marginSummary: MarginSummary;
  crossMarginSummary: MarginSummary;
  withdrawable: string;
  assetPositions: AssetPosition[];
}

export interface OpenOrder {
  coin: string;
  side: string;
  limitPx: string;
  sz: string;
  oid: number;
  timestamp: number;
  orderType?: string;
  triggerPx?: string;
  tpsl?: string;
  reduceOnly?: boolean;
}

export interface Fill {
  coin: string;
  px: string;
  sz: string;
  side: string;
  time: number;
  startPosition: string;
  dir: string;
  closedPnl: string;
  hash: string;
  oid: number;
  crossed: boolean;
  fee: string;
  feeToken: string;
}

export interface L2Level {
  px: string;
  sz: string;
  n: number;
}

export interface L2Book {
  levels: [L2Level[], L2Level[]]; // [bids, asks]
}

// ─── API Calls ───────────────────────────────────────────────────────────

export async function getAllMids(): Promise<Record<string, string>> {
  return post<Record<string, string>>({ type: "allMids" });
}

export async function getMeta(): Promise<{ universe: PerpMeta[] }> {
  return post<{ universe: PerpMeta[] }>({ type: "meta" });
}

export async function getAllPerpMetas(): Promise<PerpDexMeta[]> {
  return post<PerpDexMeta[]>({ type: "allPerpMetas" });
}

export async function getSpotMeta(): Promise<SpotMeta> {
  return post<SpotMeta>({ type: "spotMeta" });
}

export async function getClearinghouseState(user: string, dex?: string): Promise<ClearinghouseState> {
  return post<ClearinghouseState>({
    type: "clearinghouseState",
    user,
    ...(dex !== undefined ? { dex } : {}),
  });
}

export async function getOpenOrders(user: string): Promise<OpenOrder[]> {
  return post<OpenOrder[]>({
    type: "frontendOpenOrders",
    user,
  });
}

export async function getUserFills(user: string): Promise<Fill[]> {
  return post<Fill[]>({
    type: "userFills",
    user,
  });
}

export async function getL2Book(coin: string): Promise<L2Book> {
  return post<L2Book>({
    type: "l2Book",
    coin,
  });
}

/**
 * Resolve a coin name to its asset index, searching across all perp dexes and spot.
 * Supports HIP-3 builder-deployed perps (asset ID = 100000 + dex_index * 10000 + index).
 */
export async function resolveAssetIndex(
  coin: string,
): Promise<{ index: number; szDecimals: number; marketType: "perp" | "spot"; dexName?: string }> {
  const allPerps = await getAllPerpMetas();

  for (let dexIndex = 0; dexIndex < allPerps.length; dexIndex++) {
    const dex = allPerps[dexIndex];
    const marketIndex = dex.universe.findIndex((a) => a.name === coin);
    if (marketIndex !== -1) {
      const meta = dex.universe[marketIndex];
      if (dexIndex === 0) {
        return { index: marketIndex, szDecimals: meta.szDecimals, marketType: "perp" };
      }
      // HIP-3 builder perp
      return {
        index: 100000 + dexIndex * 10000 + marketIndex,
        szDecimals: meta.szDecimals,
        marketType: "perp",
        dexName: extractDexPrefix(meta.name) || undefined,
      };
    }
  }

  // Check spot
  const spotMeta = await getSpotMeta();
  const spotIndex = spotMeta.universe.findIndex((a) => a.name === coin);
  if (spotIndex !== -1) {
    const tokenIndex = spotMeta.universe[spotIndex].tokens[0];
    const token = spotMeta.tokens.find((t) => t.index === tokenIndex);
    return {
      index: 10000 + spotIndex,
      szDecimals: token?.szDecimals ?? 2,
      marketType: "spot",
    };
  }

  throw new Error(`Unknown coin: ${coin}. Run 'bun scripts/markets-prices.ts' to see available markets.`);
}

/**
 * Extract dex prefix from a HIP-3 coin name (e.g. "xyz:TSLA" → "xyz").
 */
function extractDexPrefix(coinName: string): string | null {
  const idx = coinName.indexOf(":");
  return idx > 0 ? coinName.slice(0, idx) : null;
}

/**
 * Get all positions across all dexes (main + HIP-3).
 */
export async function getAllPositions(user: string): Promise<{ dex: string; state: ClearinghouseState }[]> {
  const results: { dex: string; state: ClearinghouseState }[] = [];

  // Main perp dex
  const mainState = await getClearinghouseState(user);
  results.push({ dex: "main", state: mainState });

  // HIP-3 builder dexes — discover from allPerpMetas, derive dex name from coin prefix
  try {
    const allPerps = await getAllPerpMetas();
    for (let i = 1; i < allPerps.length; i++) {
      const dex = allPerps[i];
      const firstCoin = dex.universe[0]?.name;
      const dexPrefix = firstCoin ? extractDexPrefix(firstCoin) : null;
      const dexName = dexPrefix || `dex-${i}`;
      try {
        const state = await getClearinghouseState(user, dexName);
        if (state.assetPositions.length > 0) {
          results.push({ dex: dexName, state });
        }
      } catch {
        // Some dexes may not have positions or may error — skip
      }
    }
  } catch {
    // If allPerpMetas fails, we at least have the main dex
  }

  return results;
}
