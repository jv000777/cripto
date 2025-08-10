// Node 20
import fs from "fs/promises";

//
// 1) LISTAS DESEADAS
//

// Top 50 (curado): ids de CoinGecko en minúsculas
const TOP50_IDS = [
  "bitcoin","ethereum","tether","binancecoin","solana","ripple","usd-coin","staked-ether","cardano","dogecoin",
  "avalanche-2","tron","shiba-inu","wrapped-bitcoin","polkadot","chainlink","polygon","bitcoin-cash","toncoin","uniswap",
  "litecoin","internet-computer","dai","near","ethereum-classic","filecoin","aptos","leo-token","stellar","okb",
  "vechain","render-token","monero","arbitrum","fantom","the-graph","hedera","immutable-x","maker","kaspa",
  "gala","optimism","frax","sei-network","algorand","flow","thorchain","conflux-token","mina-protocol"
];

// Billetera fría (poné aquí lo que tengas, en ID, símbolo o nombre).
// Si conocés el ID exacto, mejor. Si no, escribe símbolo/nombre y el script intenta resolver.
const WALLET_RAW = [
  "worldcoin",           // CoinGecko usa "worldcoin-wld"
  "pol",                 // rebrand de MATIC (id oficial: "matic-network"; el token POL tiene otros ids)
  "bonk",
  "bome",                // "book-of-meme"
  "official-trump",
  "streamflow",
  "pengu",
  "just-a-chill-guy",
  "goatseus-maximus",
  // agrega aquí más entradas si querés
];

// Overrides de nombres/símbolos -> id exacto de CoinGecko (evita ambigüedades)
const ID_OVERRIDES = {
  "worldcoin": "worldcoin-wld",
  "bome": "book-of-meme",
  "pol": "polygon-ecosystem-token", // si en realidad querés MATIC, usa "matic-network"
  // agrega overrides si conocés el id exacto
};

//
// 2) UTILITARIOS
//

const sleep = ms => new Promise(r=>setTimeout(r,ms));

async function fetchJson(url, tries=3){
  let err;
  for (let i=1;i<=tries;i++){
    try{
      const r = await fetch(url, { headers:{ accept:"application/json","user-agent":"gh-actions" }});
      if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`);
      return await r.json();
    }catch(e){ err=e; await sleep(250*i); }
  }
  throw err;
}

//
// 3) VERIFICACIÓN DE IDS CONTRA COINGECKO
//

async function getAllCoinList(){
  // devuelve [{id, symbol, name}, ...]
  return await fetchJson("https://api.coingecko.com/api/v3/coins/list?include_platform=false");
}

function buildLookup(list){
  const byId = new Map();
  const bySymbol = new Map();  // símbolo no es único
  const byName = new Map();    // nombre no es único
  for (const c of list){
    byId.set(c.id.toLowerCase(), c);
    const sym = (c.symbol||"").toLowerCase();
    const nam = (c.name||"").toLowerCase();
    if(sym){ if(!bySymbol.has(sym)) bySymbol.set(sym, []); bySymbol.get(sym).push(c); }
    if(nam){ if(!byName.has(nam)) byName.set(nam, []); byName.get(nam).push(c); }
  }
  return { byId, bySymbol, byName };
}

// intenta resolver una entrada de billetera a un id válido
function resolveWalletEntry(entry, lookup){
  const raw = String(entry).trim();
  if (!raw) return { resolved:null, reason:"empty" };

  // override explícito
  if (ID_OVERRIDES[raw.toLowerCase()]) {
    return { resolved: ID_OVERRIDES[raw.toLowerCase()], via:"override" };
  }

  const key = raw.toLowerCase();

  // ya es un id válido
  if (lookup.byId.has(key)) return { resolved: key, via:"id" };

  // match exacto por símbolo
  if (lookup.bySymbol.has(key)) {
    const arr = lookup.bySymbol.get(key);
    // si hay varios, elige el primero (normalmente el principal) y marca "ambiguous"
    return { resolved: arr[0].id, via: arr.length>1 ? "symbol-ambiguous" : "symbol" , candidates: arr.map(x=>x.id)};
  }

  // match exacto por nombre
  if (lookup.byName.has(key)) {
    const arr = lookup.byName.get(key);
    return { resolved: arr[0].id, via: arr.length>1 ? "name-ambiguous" : "name", candidates: arr.map(x=>x.id) };
  }

  // no se pudo resolver
  return { resolved:null, reason:"not-found" };
}

//
// 4) DESCARGA DE PRECIOS (markets: trae price + market_cap + %24h)
//

async function getMarkets(ids){
  if (ids.length === 0) return [];
  const url = "https://api.coingecko.com/api/v3/coins/markets"
    + `?vs_currency=usd&ids=${ids.join(",")}&price_change_percentage=24h&per_page=250`;
  return await fetchJson(url);
}

//
// 5) PROGRAMA PRINCIPAL
//

async function main(){
  // 5.1 Descarga listado de monedas y arma lookup
  const all = await getAllCoinList();
  const lookup = buildLookup(all);

  // 5.2 Verifica Top50 (deberían ser válidos)
  const validTop50 = TOP50_IDS.filter(id => lookup.byId.has(id));

  // 5.3 Resuelve entradas de la billetera
  const walletResults = WALLET_RAW.map(x => ({ raw:x, ...resolveWalletEntry(x, lookup) }));
  const walletValid = walletResults.filter(r => r.resolved).map(r => r.resolved);

  // 5.4 Unifica y deduplica
  const wanted = Array.from(new Set([...validTop50, ...walletValid]));

  // 5.5 Descarga datos de mercado
  const markets = await getMarkets(wanted);

  // 5.6 Mapea al formato { updated_at, assets }
  const assets = {};
  for (const c of markets){
    const key = (c.symbol || c.id || "").toUpperCase();  // p.ej. BTC
    assets[key] = {
      usd: c.current_price ?? null,
      change_24h: c.price_change_percentage_24h_in_currency ?? null,
      market_cap: c.market_cap ?? null,
      source: "coingecko",
      id: c.id,
      name: c.name
    };
  }

  // 5.7 Meta-info: faltantes / ambiguos
  const missing = walletResults.filter(r => !r.resolved).map(r => ({ raw:r.raw, reason:r.reason }));
  const ambiguous = walletResults
    .filter(r => r.candidates && r.candidates.length > 1)
    .map(r => ({ raw:r.raw, resolved:r.resolved, candidates:r.candidates }));

  await fs.mkdir("data", { recursive: true });
  await fs.writeFile("data/snapshot.json", JSON.stringify({
    updated_at: new Date().toISOString(),
    meta: {
      included_ids: wanted,
      wallet_resolved: walletResults,
      missing,
      ambiguous
    },
    assets
  }, null, 2));

  console.log(`OK: ${Object.keys(assets).length} activos. Missing=${missing.length} Ambiguous=${ambiguous.length}`);
}

main().catch(e => { console.error(e); process.exit(1); });