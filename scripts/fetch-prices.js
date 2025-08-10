import fs from "fs/promises";

const COINS = [
  // Top 50
  "bitcoin","ethereum","tether","binancecoin","solana","ripple","usd-coin","staked-ether","cardano","dogecoin",
  "avalanche-2","tron","shiba-inu","wrapped-bitcoin","polkadot","chainlink","polygon","bitcoin-cash","toncoin","uniswap",
  "litecoin","internet-computer","dai","near","ethereum-classic","filecoin","aptos","leo-token","stellar","okb",
  "vechain","render-token","monero","arbitrum","fantom","the-graph","hedera","immutable-x","maker","kaspa",
  "gala","optimism","frax","sei-network","algorand","flow","thorchain","conflux-token","mina-protocol","worldcoin",

  // Billetera fría
  "official-trump","streamflow","pengu","bonk","just-a-chill-guy","bome","goatseus-maximus","pol"
];

async function fetchJson(url){
  const r = await fetch(url, { headers:{accept:"application/json","user-agent":"gh-actions"} });
  if(!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`);
  return r.json();
}

async function main(){
  const url = "https://api.coingecko.com/api/v3/coins/markets"
    + `?vs_currency=usd&ids=${COINS.join(",")}&price_change_percentage=24h&per_page=250`;

  const arr = await fetchJson(url);
  const assets = {};
  for (const c of arr){
    const key = (c.symbol || c.id || "").toUpperCase();
    assets[key] = {
      usd: c.current_price ?? null,
      change_24h: c.price_change_percentage_24h_in_currency ?? null,
      market_cap: c.market_cap ?? null,
      source: "coingecko",
      id: c.id,
      name: c.name
    };
  }

  await fs.mkdir("data", { recursive: true });
  await fs.writeFile(
    "data/snapshot.json",
    JSON.stringify({ updated_at: new Date().toISOString(), assets }, null, 2)
  );
  console.log("snapshot escrito con", Object.keys(assets).length, "activos");
}

main().catch(e => { console.error(e); process.exit(1); });