/**
 * Output formatting utilities.
 */

export function parseArgs(args: string[]): { flags: Record<string, string | boolean>; positional: string[] } {
  const flags: Record<string, string | boolean> = {};
  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }

  return { flags, positional };
}

export function isJson(flags: Record<string, string | boolean>): boolean {
  return flags.json === true;
}

export function printJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

export function printTable(headers: string[], rows: string[][]): void {
  if (rows.length === 0) {
    console.log("(no data)");
    return;
  }

  // Calculate column widths
  const widths = headers.map((h, i) => {
    const maxRow = Math.max(...rows.map((r) => (r[i] || "").length));
    return Math.max(h.length, maxRow);
  });

  // Header
  const headerLine = headers.map((h, i) => h.padEnd(widths[i])).join("  ");
  const separator = widths.map((w) => "─".repeat(w)).join("──");

  console.log(headerLine);
  console.log(separator);

  // Rows
  for (const row of rows) {
    const line = row.map((cell, i) => (cell || "").padEnd(widths[i])).join("  ");
    console.log(line);
  }
}

export function formatNum(value: string | number, decimals = 2): string {
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(n)) return String(value);
  return n.toFixed(decimals);
}

export function formatPnl(value: string | number): string {
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(n)) return String(value);
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}`;
}

export function formatSide(szi: string): string {
  const n = parseFloat(szi);
  return n >= 0 ? "LONG" : "SHORT";
}

export function formatSize(szi: string): string {
  const n = Math.abs(parseFloat(szi));
  return n.toString();
}

export function formatTimestamp(ts: number): string {
  return new Date(ts).toISOString().replace("T", " ").slice(0, 19);
}
