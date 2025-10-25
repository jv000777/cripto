const IDS=["bitcoin","ethereum","solana","ripple","optimism","worldcoin-wld","polygon-ecosystem-token","bonk","book-of-meme"];
const fmtN=(x,d=8)=>x==null?"-":Number(x).toLocaleString("en-US",{maximumFractionDigits:d});
const fmtP=x=>x==null?"-":((x>=0?"+":"")+Number(x).toFixed(2)+"%");
async function cargar(){
  const status=document.getElementById("update-time");
  const tbody=document.getElementById("rows");
  try{
    status.textContent="Última actualización: cargando…";
    const url="https://api.coingecko.com/api/v3/coins/markets"
      +"?vs_currency=usd&ids="+encodeURIComponent(IDS.join(","))
      +"&price_change_percentage=24h,7d&per_page=250";
    const r=await fetch(url,{headers:{Accept:"application/json"},cache:"no-store"});
    if(!r.ok) throw new Error("HTTP "+r.status);
    const data=await r.json();
    data.sort((a,b)=>(b.market_cap||0)-(a.market_cap||0));
    let html="";
    for(const c of data){
      html+=`<tr>
        <td><span class="hdr">${c.name} (${(c.symbol||"").toUpperCase()})</span></td>
        <td class="num">${fmtN(c.current_price)}</td>
        <td class="num">${fmtP(c.price_change_percentage_24h_in_currency)}</td>
        <td class="num">${fmtP(c.price_change_percentage_7d_in_currency)}</td>
      </tr>`;
    }
    tbody.innerHTML=html||`<tr><td colspan="4">Sin datos</td></tr>`;
    status.textContent="Última actualización: "+new Date().toLocaleString();
  }catch(e){
    tbody.innerHTML=`<tr><td colspan="4">Error</td></tr>`;
    status.textContent="Error: "+e.message;
  }
}
document.addEventListener("DOMContentLoaded",cargar);