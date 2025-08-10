// Node 20: usa fetch nativo + reintentos y nunca falla el job
import fs from "fs/promises";

const IDS = ["bitcoin","ethereum","solana","ripple","litecoin"];
const URL = `https://api.coingecko.com/api/v3/simple/price?ids=${IDS.join(",")}&vs_currencies=usd&include_24hr_change=true`;

const sleep = ms => new Promise(r=>setTimeout(r,ms));

async function fetchJson(url, tries=3){
  let last;
  for(let i=1;i<=tries;i++){
    try{
      const r = await fetch(url,{headers:{accept:"application/json","user-agent":"gh-actions"}});
      if(!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`);
      return await r.json();
    }catch(e){
      last=e; console.log(`retry ${i}/${tries}: ${e.message}`); await sleep(1200*i);
    }
  }
  console.log("giving up:", last?.message);
  return null;
}

function toSnapshot(raw){
  const assets = {};
  for(const id of IDS){
    const row = raw?.[id] || {};
    assets[id.toUpperCase()] = {
      usd: row.usd ?? null,
      change_24h: row.usd_24h_change!=null ? Number(row.usd_24h_change.toFixed(2)) : null,
      source: "coingecko"
    };
  }
  return { updated_at: new Date().toISOString(), assets };
}

(async ()=>{
  const raw = await fetchJson(URL,3);
  const snap = toSnapshot(raw);
  await fs.mkdir("data",{recursive:true});
  await fs.writeFile("data/snapshot.json", JSON.stringify(snap,null,2));
  console.log("wrote data/snapshot.json", snap.updated_at);
})();
