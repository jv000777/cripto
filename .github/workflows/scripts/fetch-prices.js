import fs from "fs/promises";

const COINS = {
  BTC: "bitcoin", ETH: "ethereum", SOL: "solana", XRP: "ripple",
  OP: "optimism", WLD: "worldcoin-wld", LTC: "litecoin",
  RNDR: "render-token", FET: "fetch-ai", BONK: "bonk"
};

const API = "https://api.coingecko.com/api/v3/simple/price";

async function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }

async function fetchWithRetry(url, tries=3){
  let lastErr;
  for (let i=1;i<=tries;i++){
    try{
      const r = await fetch(url, {
        headers: { accept: "application/json", "user-agent": "github-actions" }
      });
      if (!r.ok) {
        // lee el texto para log
        const txt = await r.text().catch(()=> "");
        throw new Error(`HTTP ${r.status} ${r.statusText} ${txt.slice(0,200)}`);
      }
      return await r.json();
    }catch(e){
      lastErr = e;
      console.log(`[attempt ${i}/${tries}] ${e.message}`);
      if (i<tries) await sleep(1200*i); // backoff suave
    }
  }
  throw lastErr;
}

async function fetchPrices() {
  const ids = Object.values(COINS).join(",");
  const url = `${API}?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;
  return fetchWithRetry(url, 3);
}

function buildSnapshot(raw, note=null) {
  const assets = {};
  for (const [symbol, id] of Object.entries(COINS)) {
    const row = raw?.[id] || {};
    assets[symbol] = {
      usd: row.usd ?? null,
      change_24h: row.usd_24h_change != null ? Number(row.usd_24h_change.toFixed(2)) : null,
      source: "coingecko"
    };
  }
  return { updated_at: new Date().toISOString(), note, assets };
}

async function main() {
  let snap;
  try{
    const raw = await fetchPrices();
    snap = buildSnapshot(raw);
  }catch(e){
    console.error("Fetch failed:", e.message);
    // escribe snapshot “vacío” para no romper el workflow
    snap = buildSnapshot(null, `error: ${e.message}`);
  }
  await fs.mkdir("data", { recursive: true });
  await fs.writeFile("data/snapshot.json", JSON.stringify(snap, null, 2));
  console.log("Wrote data/snapshot.json at", snap.updated_at, snap.note?`(${snap.note})`:"");
}

main().catch(e => {
  // no salgas con code 1; dejar registro y terminar ok
  console.error("Unexpected:", e);
});
