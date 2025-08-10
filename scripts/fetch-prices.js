// Node 20
import fs from "fs/promises";

// ----------------------
// 1) Listas deseadas
// ----------------------

// Top 50 curado (ids CoinGecko válidos)
const TOP50_IDS = [
  "bitcoin","ethereum","tether","binancecoin","solana","ripple","usd-coin","staked-ether","cardano","dogecoin",
  "avalanche-2","tron","shiba-inu","wrapped-bitcoin","polkadot","chainlink","polygon","bitcoin-cash","toncoin","uniswap",
  "litecoin","internet-computer","dai","near","ethereum-classic","filecoin","aptos","leo-token","stellar","okb",
  "vechain","render-token","monero","arbitrum","fantom","the-graph","hedera","immutable-x","maker","kaspa",
  "gala","optimism","frax","sei-network","algorand","flow","thorchain","conflux-token","mina-protocol","worldcoin-wld"
];

// Billetera fría (id/símbolo/nombre; el script resuelve y normaliza)
const WALLET_RAW = [
  "worldcoin", "pol", "bonk", "bome", "official-trump",
  "streamflow", "pengu", "just-a-chill-guy", "goatseus-maximus", "optimism", "solana", "ripple"
];

// Overrides para ambigüedades nombre/símbolo -> id exacto
const ID_OVERRIDES = {
  worldcoin: "worldcoin-wld",
  bome: "book-of-meme",
  pol: "polygon-ecosystem-token" // si prefieres MATIC (histórico), usa "matic-network"
};

// ----------------------
// 2) Helpers HTTP
// ----------------------
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function fetchJson(url, tries=3){
  let err;
  for(let i=1;i<=tries;i++){
    try{
      const r = await fetch(url, { headers:{accept:"application/json","user-agent":"gh-actions"} });
      if(!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`);
      return await r.json();
    }catch(e){ err=e; await sleep(350*i); }
  }
  throw err;
}

// ----------------------
// 3) Resolver IDs contra CG
// ----------------------
async function getAllCoinList(){
  return await fetchJson("https://api.coingecko.com/api/v3/coins/list?include_platform=false");
}
function buildLookup(list){
  const byId=new Map(), bySymbol=new Map(), byName=new Map();
  for(const c of list){
    const id=(c.id||"").toLowerCase(), sym=(c.symbol||"").toLowerCase(), nam=(c.name||"").toLowerCase();
    if(id) byId.set(id,c);
    if(sym){ if(!bySymbol.has(sym)) bySymbol.set(sym,[]); bySymbol.get(sym).push(c); }
    if(nam){ if(!byName.has(nam)) byName.set(nam,[]); byName.get(nam).push(c); }
  }
  return {byId,bySymbol,byName};
}
function resolveWalletEntry(entry, lookup){
  const raw=String(entry||"").trim().toLowerCase();
  if(!raw) return {raw:entry, resolved:null, reason:"empty"};
  if(ID_OVERRIDES[raw]) return {raw:entry, resolved:ID_OVERRIDES[raw], via:"override"};

  if(lookup.byId.has(raw)) return {raw:entry, resolved:raw, via:"id"};
  if(lookup.bySymbol.has(raw)){
    const arr=lookup.bySymbol.get(raw);
    return {raw:entry, resolved:arr[0].id, via:arr.length>1?"symbol-ambiguous":"symbol", candidates:arr.map(x=>x.id)};
  }
  if(lookup.byName.has(raw)){
    const arr=lookup.byName.get(raw);
    return {raw:entry, resolved:arr[0].id, via:arr.length>1?"name-ambiguous":"name", candidates:arr.map(x=>x.id)};
  }
  return {raw:entry, resolved:null, reason:"not-found"};
}

// ----------------------
// 4) Datos de mercado
// ----------------------
// markets: precio, market_cap, % 24h/7d/30d
async function getMarkets(ids){
  if(!ids.length) return [];
  const url = "https://api.coingecko.com/api/v3/coins/markets"
    + `?vs_currency=usd&ids=${ids.join(",")}&price_change_percentage=24h,7d,30d&per_page=250`;
  return await fetchJson(url);
}

// 4h: se calcula con histórico horario (último vs hace ~4h)
async function getChange4h(id){
  // 1 día, intervalo hourly -> precios [[ts, price], ...]
  const url = `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=1&interval=hourly`;
  const j = await fetchJson(url);
  const prices = j?.prices || [];
  if(prices.length < 5) return null;
  const last = prices[prices.length-1][1];
  const prev = prices[prices.length-5][1]; // ~4 horas atrás
  if(!last || !prev) return null;
  return ((last - prev) / prev) * 100;
}

// ejecución limitada en paralelo para no chocar rate limit
async function mapLimit(arr, limit, fn){
  const ret = new Array(arr.length);
  let i = 0;
  const exec = async () => {
    while(i < arr.length){
      const idx = i++;
      try { ret[idx] = await fn(arr[idx], idx); }
      catch(e){ ret[idx] = null; }
    }
  };
  const workers = Array.from({length: Math.min(limit, arr.length)}, exec);
  await Promise.all(workers);
  return ret;
}

// ----------------------
// 5) Main
// ----------------------
async function main(){
  // 5.1 Resolver listas
  const all = await getAllCoinList();
  const lookup = buildLookup(all);

  const top50Valid = TOP50_IDS.filter(id => lookup.byId.has(id));
  const walletRes = WALLET_RAW.map(x => resolveWalletEntry(x, lookup));
  const walletValid = walletRes.filter(r => r.resolved).map(r => r.resolved);

  const wanted = Array.from(new Set([...top50Valid, ...walletValid]));

  // 5.2 markets
  const markets = await getMarkets(wanted);

  // 5.3 assets base (+24h,7d,30d, market_cap)
  const assets = {};
  for(const c of markets){
    const sym = (c.symbol || c.id || "").toUpperCase();
    assets[sym] = {
      usd: c.current_price ?? null,
      change_24h: c.price_change_percentage_24h_in_currency ?? null,
      change_7d: c.price_change_percentage_7d_in_currency ?? null,
      change_30d: c.price_change_percentage_30d_in_currency ?? null,
      market_cap: c.market_cap ?? null,
      id: c.id, name: c.name, source: "coingecko"
    };
  }

  // 5.4 calcular 4h para top-20 por market_cap (si existe)
  const ranked = Object.entries(assets)
    .filter(([,v]) => v.market_cap != null)
    .sort((a,b)=> b[1].market_cap - a[1].market_cap)
    .slice(0,20);
  const idsTop20 = ranked.map(([,v]) => v.id);

  const changes4h = await mapLimit(idsTop20, 4, async (id) => ({ id, v: await getChange4h(id) }));
  for(const {id, v} of changes4h.filter(Boolean)){
    const entry = Object.entries(assets).find(([,x]) => x.id === id);
    if(entry){ entry[1].change_4h = v; }
  }

  // 5.5 meta
  const missing = walletRes.filter(r=>!r.resolved).map(r=>({raw:r.raw,reason:r.reason}));
  const ambiguous = walletRes.filter(r=>r.candidates && r.candidates.length>1)
    .map(r=>({raw:r.raw,resolved:r.resolved,candidates:r.candidates}));

  // 5.6 escribir snapshot
  await fs.mkdir("data",{recursive:true});
  await fs.writeFile("data/snapshot.json", JSON.stringify({
    updated_at: new Date().toISOString(),
    meta: { included_ids: wanted, wallet_resolved: walletRes, missing, ambiguous },
    assets
  }, null, 2));

  console.log(`OK: ${Object.keys(assets).length} activos. 4h calc=${changes4h.filter(x=>x && x.v!=null).length}`);
}

main().catch(e => { console.error(e); process.exit(1); });