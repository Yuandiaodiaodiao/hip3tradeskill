/**
 * Exchange client factory for Hyperliquid.
 * Uses @nktkas/hyperliquid SDK for EIP-712 signing (Bun auto-installs).
 */

/**
 * Get a configured ExchangeClient for trading operations.
 */
export async function getExchangeClient(privateKey: `0x${string}`) {
  const { HttpTransport, ExchangeClient } = await import("@nktkas/hyperliquid");
  const { privateKeyToAccount } = await import("viem/accounts");

  const isTestnet = process.env.HL_TESTNET === "1";
  const transport = new HttpTransport({ isTestnet });
  const account = privateKeyToAccount(privateKey);
  return new ExchangeClient({ transport, wallet: account });
}
