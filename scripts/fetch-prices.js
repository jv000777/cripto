// Node 20 (ESM). Guarda: usd, change_24h, change_7d, market_cap
import fs from "fs/promises";

// --- Lista curada (Top 50 aprox por relevancia/MC) ---
const TOP50_IDS = [
  "bitcoin","ethereum","tether","binancecoin","solana","ripple","usd-coin","staked-ether","cardano","dogecoin",
  "avalanche-2","tron","shiba-inu","wrapped-bitcoin","polkadot","chainlink","polygon","bitcoin-cash","toncoin","uniswap",
  "litecoin","internet-computer","dai","near","ethereum-classic","filecoin","aptos","leo-token","stellar","okb",
  "vechain","render-token","monero","arbitrum","fantom","the-graph","hedera","immutable-x","maker","kaspa",
  "gala","optimism","frax","sei-network","algorand","flow","thorchain","conflux-token","mina-protocol","worldcoin-wld"
];

// --- Tus monedas de billetera (pueden ser id/símbolo/nombre) ---
const WALLET_RAW = [
  "worldcoin", "pol", "bonk", "bome", "official-trump",
  "streamflow", "pengu", "just-a-chill-guy", "goatseus-maximus",
  "optimism", "solana", "ripple"
];

// Overrides (nombre/símbolo ambiguo -> id exacto de CoinGecko)
const ID_OVERRIDES = {
  worldcoin: "worldcoin-wld",
  bome: "book-of-meme",
  pol: "polygon-ecosystem-token" // si preferís MATIC usa "matic-network"
};

// ---------- Utils HTTP ----------
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function fetchJson(url, tries=3){
  let err;
  for (let i=1;i<=tries;i++){
    try{
      const r = await fetch(url, { headers:{ accept:"application/json","user-agent":"gh-actions" }});
      if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`);
      return await r.json();
    }catch(e){ err=e; await sleep(300*i); }
  }
  throw err;
}

// ---------- Resolución de IDs ----------
async function getAllCoinList(){
  return await fetchJson("https://api.coingecko.com/api/v3/coins/list?include_platform=false");
}
function buildLookup(list){
  const byId=new Map(), bySym=new Map(), byName=new Map();
  for (const c of list){
    const id=(c.id||"").toLowerCase(), s=(c.symbol||"").toLowerCase(), n=(c.name||"").toLowerCase();
    if(id) byId.set(id,c);
    if(s){ if(!bySym.has(s)) bySym.set(s,[]); bySym.get(s).push(c); }
    if(n){ if(!byName.has(n)) byName.set(n,[]); byName.get(n).push(c); }
  }
  return {byId,bySym,byName};
}
function resolveEntry(raw, lookup){
  const x = String(raw||"").trim().toLowerCase();
  if(!x) return { raw, resolved:null, reason:"empty" };
  if (ID_OVERRIDES[x]) return { raw, resolved:ID_OVERRIDES[x], via:"override" };
  if (lookup.byId.has(x)) return { raw, resolved:x, via:"id" };
  if (lookup.bySym.has(x)){ const arr=lookup.bySym.get(x); return { raw, resolved:arr[0].id, via:arr.length>1?"symbol-ambiguous":"symbol", candidates:arr.map(i=>i.id) }; }
  if (lookup.byName.has(x)){ const arr=lookup.byName.get(x); return { raw, resolved:arr[0].id, via:arr.length>1?"name-ambiguous":"name", candidates:arr.map(i=>i.id) }; }
  return { raw, resolved:null, reason:"not-found" };
}

// ---------- Markets (incluye 24h y 7d) ----------
async function getMarkets(ids){
  if (!ids.length) return [];
  const url = "https://api.coingecko.com/api/v3/coins/markets"
    + `?vs_currency=usd&ids=${ids.join(",")}&price_change_percentage=24h,7d&per_page=250`;
  return await fetchJson(url);
}

// ---------- Main ----------
async function main(){
  // 1) Resolver ids válidos
  const all = await getAllCoinList();
  const lookup = buildLookup(all);

  const topValid = TOP50_IDS.filter(id => lookup.byId.has(id));
  const walletRes = WALLET_RAW.map(w => resolveEntry(w, lookup));
  const walletValid = walletRes.filter(r => r.resolved).map(r => r.resolved);

  // 2) Unificar y deduplicar
  const wanted = Array.from(new Set([...topValid, ...walletValid]));

  // 3) Descargar markets (1 sola petición)
  const arr = await getMarkets(wanted);

  // 4) Armar assets
  const assets = {};
  for (const c of arr){
    const sym = (c.symbol || c.id || "").toUpperCase();
    assets[sym] = {
      usd: c.current_price ?? null,
      change_24h: c.price_change_percentage_24h_in_currency ?? null, // %
      change_7d:  c.price_change_percentage_7d_in_currency  ?? null, // %
      market_cap: c.market_cap ?? null,
      id: c.id,
      name: c.name,
      source: "coingecko"
    };
  }

  // 5) Meta para debug (qué se incluyó / faltó)
  const missing = walletRes.filter(r=>!r.resolved).map(r=>({raw:r.raw, reason:r.reason}));
  const ambiguous = walletRes.filter(r=>r.candidates && r.candidates.length>1)
    .map(r=>({raw:r.raw, resolved:r.resolved, candidates:r.candidates}));

  // 6) Escribir snapshot
  await fs.mkdir("data", { recursive: true });
  await fs.writeFile("data/snapshot.json", JSON.stringify({
    updated_at: new Date().toISOString(),
    meta: { included_ids: wanted, wallet_resolved: walletRes, missing, ambiguous },
    assets
  }, null, 2));

  console.log(`OK: ${Object.keys(assets).length} activos. missing=${missing.length} ambiguous=${ambiguous.length}`);
}

main().catch(e => { console.error(e); process.exit(1); });