// IDs oficiales de CoinGecko
const IDS = [
  "bitcoin","ethereum","solana","ripple","optimism",
  "worldcoin-wld","polygon-ecosystem-token","bonk","book-of-meme"
];

function fmtN(x,d=8){ if(x==null) return "-"; return Number(x).toLocaleString("en-US",{maximumFractionDigits:d}); }
function fmtP(x){ if(x==null) return "-"; const s=Number(x).toFixed(2); return (x>=0?"+":"")+s+"%"; }

async function cargar(){
  const status=document.getElementById("status");
  const tbody =document.querySelector("#tabla tbody");
  try{
    const url = "https://api.coingecko.com/api/v3/coins/markets"
      + "?vs_currency=usd"
      + "&ids=" + encodeURIComponent(IDS.join(","))
      + "&price_change_percentage=24h,7d"
      + "&per_page=250";

    // Si tienes clave gratuita de CoinGecko, agrega: headers: { "Accept":"application/json", "x-cg-api-key":"TU_CLAVE" }
    const r = await fetch(url, { headers:{ "Accept":"application/json" }, cache:"no-store" });
    if(!r.ok) throw new Error("HTTP "+r.status);
    const data = await r.json();

    // Orden por capitalización
    data.sort((a,b)=>(b.market_cap||0)-(a.market_cap||0));

    // Pintar tabla
    tbody.innerHTML = "";
    for(const c of data){
      const tr=document.createElement("tr");
      tr.innerHTML = `
        <td>${c.name} (${(c.symbol||"").toUpperCase()})</td>
        <td>${fmtN(c.current_price)}</td>
        <td>${fmtP(c.price_change_percentage_24h_in_currency)}</td>
        <td>${fmtP(c.price_change_percentage_7d_in_currency)}</td>
        <td>${fmtN(c.market_cap,0)}</td>
      `;
      tbody.appendChild(tr);
    }
    status.textContent = "Actualizado: " + new Date().toLocaleString();
  }catch(e){
    document.getElementById("status").textContent = "Error: " + e.message;
  }
}

document.addEventListener("DOMContentLoaded", cargar);
