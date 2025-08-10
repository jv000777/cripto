import fs from "fs/promises";

const COINS = {
  BTC: "bitcoin", ETH: "ethereum", SOL: "solana", XRP: "ripple",
  OP: "optimism", WLD: "worldcoin-wld", LTC: "litecoin",
  RNDR: "render-token", FET: "fetch-ai", BONK: "bonk"
};

const API = "https://api.coingecko.com/api/v3/simple/price";

async function fetchPrices() {
  const ids = Object.values(COINS).join(",");
  const url = `${API}?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;
  const r = await fetch(url, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error(`CoinGecko error: ${r.status}`);
  return r.json();
}

function buildSnapshot(raw) {
  const assets = {};
  for (const [symbol, id] of Object.entries(COINS)) {
    const row = raw[id] || {};
    assets[symbol] = {
      usd: row.usd ?? null,
      change_24h: row.usd_24h_change != null ? Number(row.usd_24h_change.toFixed(2)) : null,
      source: "coingecko"
    };
  }
  return { updated_at: new Date().toISOString(), assets };
}

async function main() {
  const raw = await fetchPrices();
  const snap = buildSnapshot(raw);
  await fs.mkdir("data", { recursive: true });
  await fs.writeFile("data/snapshot.json", JSON.stringify(snap, null, 2));
  console.log("Wrote data/snapshot.json at", snap.updated_at);
}
main().catch(e => { console.error(e); process.exit(1); });
