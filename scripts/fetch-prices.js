// Front-end con CoinGecko. Pinta 1h/4h/1d/1w (verde/rojo).

const nfUSD = new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:6});
const nfPct = new Intl.NumberFormat('en-US',{minimumFractionDigits:2,maximumFractionDigits:2,signDisplay:'exceptZero'});
const nfCompact = new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',compactDisplay:'short',maximumFractionDigits:2});

const EXCLUDE_IDS = new Set([
  "tether","usd-coin","dai","true-usd","pax-dollar","frax","usdd","first-digital-usd","usdp","binance-usd","gemini-dollar",
  "staked-ether","wrapped-bitcoin","weth","rocket-pool-eth","frax-ether","ankreth","cbeth","sfrxeth","reth","frxeth"
]);
const ALWAYS_INCLUDE_IDS = ["pudgy-penguins"];

let FULL = [];
let shown = 10;
let sortKey = 'market_cap';
let sortDir = 'desc';

function cls(v){ return v==null ? 'sq gray' : v>=0 ? 'sq green' : 'sq red'; }

function pct4hFromSparkline(c){
  const arr = c?.sparkline_in_7d?.price || [];
  if (arr.length < 2) return null;
  const stepsBack = Math.max(1, Math.round(arr.length * 4 / (7*24))); // ~4h atrás
  const last = arr[arr.length-1];
  const older = arr[arr.length-1-stepsBack];
  if (!older || older<=0 || last==null) return null;
  return (last-older)/older*100;
}

async function fetchLive(){
  const base = 'https://api.coingecko.com/api/v3/coins/markets';
  const urlTop = `${base}?vs_currency=usd&order=market_cap_desc&per_page=200&page=1&sparkline=true&price_change_percentage=1h,24h,7d`;
  const r1 = await fetch(urlTop, { cache:'no-store', headers:{accept:'application/json'}});
  if (!r1.ok) throw new Error('CG top HTTP '+r1.status);
  const top = await r1.json();

  let extra = [];
  if (ALWAYS_INCLUDE_IDS.length){
    const urlExtra = `${base}?vs_currency=usd&ids=${encodeURIComponent(ALWAYS_INCLUDE_IDS.join(','))}&sparkline=true&price_change_percentage=1h,24h,7d`;
    const r2 = await fetch(urlExtra, { cache:'no-store', headers:{accept:'application/json'}});
    if (r2.ok) extra = await r2.json();
  }

  const map = new Map();
  [...top, ...extra].forEach(c => { if (c && c.id) map.set(c.id, c); });
  const data = [...map.values()];

  FULL = data
    .filter(c => c && c.id && !EXCLUDE_IDS.has(c.id.toLowerCase()))
    .map(c => {
      const ch1h = c.price_change_percentage_1h_in_currency ?? null;
      const ch24 = c.price_change_percentage_24h_in_currency ?? c.price_change_percentage_24h ?? null;
      const ch7d = c.price_change_percentage_7d_in_currency ?? null;
      const ch4h = pct4hFromSparkline(c);
      return {
        id: c.id,
        name: c.name,
        symbol: (c.symbol||'').toUpperCase(),
        usd: c.current_price ?? null,
        change_24h: ch24,
        change_7d:  ch7d,
        market_cap: c.market_cap ?? null,
        tf1h: ch1h, tf4h: ch4h, tf1d: ch24, tf1w: ch7d
      };
    })
    .sort((a,b)=> (b.market_cap??0)-(a.market_cap??0));

  document.getElementById('update-time').textContent = 'Última actualización: ' + new Date().toLocaleString();
}

async function fetchSnapshot(){
  const res = await fetch('data/snapshot.json?ts=' + Date.now(), { cache:'no-store' });
  if (!res.ok) throw new Error('snapshot HTTP '+res.status);
  const j = await res.json();
  document.getElementById('update-time').textContent =
    'Última actualización: ' + (j.updated_at ? new Date(j.updated_at).toLocaleString() : '—');

  FULL = Object.entries(j.assets || {})
    .map(([sym, x]) => ({
      id:x.id,name:x.name,symbol:(x.symbol||sym).toUpperCase(),
      usd:x.usd??null,change_24h:x.change_24h??null,change_7d:x.change_7d??null,market_cap:x.market_cap??null,
      tf1h:null, tf4h:null, tf1d:x.change_24h??null, tf1w:x.change_7d??null
    }))
    .filter(x => x.id && !EXCLUDE_IDS.has(x.id.toLowerCase()))
    .sort((a,b)=> (b.market_cap??0)-(a.market_cap??0));
}

function setSort(key){
  if (sortKey === key){ sortDir = (sortDir === 'desc') ? 'asc' : 'desc'; }
  else { sortKey = key; sortDir = 'desc'; }
  render();
}
function getVal(x,k){
  if (k==='market_cap') return Number(x.market_cap ?? NaN);
  if (k==='change_24h') return Number(x.change_24h ?? NaN);
  if (k==='change_7d')  return Number(x.change_7d  ?? NaN);
  return NaN;
}
function cmp(a,b){
  const va=getVal(a,sortKey), vb=getVal(b,sortKey);
  const na=(va==null||Number.isNaN(va)), nb=(vb==null||Number.isNaN(vb));
  if (na&&nb) return 0; if (na) return 1; if (nb) return -1;
  return sortDir==='desc' ? (vb-va) : (va-vb);
}
function updateArrows(){
  document.getElementById('arr-mc').textContent  = (sortKey==='market_cap') ? (sortDir==='desc'?'↓':'↑') : '';
  document.getElementById('arr-24h').textContent = (sortKey==='change_24h') ? (sortDir==='desc'?'↓':'↑') : '';
  document.getElementById('arr-7d').textContent  = (sortKey==='change_7d')  ? (sortDir==='desc'?'↓':'↑') : '';
}

function render(){
  const list = [...FULL].sort(cmp).slice(0, shown);
  const tbody = document.getElementById('rows');
  tbody.innerHTML = '';
  for (const x of list){
    const price = x.usd!=null ? nfUSD.format(x.usd) : '—';
    const c24 = (typeof x.change_24h==='number') ? nfPct.format(x.change_24h)+'%' : '—';
    const c7  = (typeof x.change_7d ==='number') ? nfPct.format(x.change_7d) +'%' : '—';
    const cls24 = (typeof x.change_24h==='number') ? (x.change_24h>=0?'pill up':'pill down') : 'pill';
    const cls7  = (typeof x.change_7d ==='number') ? (x.change_7d >=0?'pill up':'pill down') : 'pill';

    const mini = `
      <div class="miniTF">
        <div class="miniTF-labels">
          <span>1h</span><span>4h</span><span>1d</span><span>1w</span>
        </div>
        <div class="miniTF-sq">
          <span class="${cls(x.tf1h)}" data-tf="1h" title="${x.tf1h!=null?nfPct.format(x.tf1h)+'%':''}"></span>
          <span class="${cls(x.tf4h)}" data-tf="4h" title="${x.tf4h!=null?nfPct.format(x.tf4h)+'%':''}"></span>
          <span class="${cls(x.tf1d)}" data-tf="1d" title="${x.tf1d!=null?nfPct.format(x.tf1d)+'%':''}"></span>
          <span class="${cls(x.tf1w)}" data-tf="1w" title="${x.tf1w!=null?nfPct.format(x.tf1w)+'%':''}"></span>
        </div>
      </div>`;

    tbody.insertAdjacentHTML('beforeend', `
      <tr>
        <td>
          <div class="name">
            <strong>${x.name} <span class="sym">(${(x.symbol||'')})</span></strong>
            <span class="mc">· MC ${x.market_cap!=null ? nfCompact.format(x.market_cap) : '—'}</span>
            ${mini}
          </div>
        </td>
        <td class="num">${price}</td>
        <td class="num"><span class="${cls24}">${c24}</span></td>
        <td class="num"><span class="${cls7}">${c7}</span></td>
      </tr>
    `);
  }
  const mb = document.getElementById('morebar');
  const remaining = Math.max((FULL.length - shown), 0);
  mb.textContent = remaining>0 ? `MORE (+${Math.min(5,remaining)})` : 'LESS (top-10)';
  updateArrows();
}

async function refresh(){
  try{ await fetchLive(); }
  catch(e){
    console.warn('Live CG falló, uso snapshot:', e);
    try{ await fetchSnapshot(); }catch(e2){
      console.error('Snapshot también falló:', e2);
      document.getElementById('rows').innerHTML = '<tr><td colspan="4">Error al cargar</td></tr>';
      return;
    }
  }
  render();
}

document.getElementById('th-mc').addEventListener('click', ()=>setSort('market_cap'));
document.getElementById('th-24h').addEventListener('click', ()=>setSort('change_24h'));
document.getElementById('th-7d').addEventListener('click',  ()=>setSort('change_7d'));
document.getElementById('morebar').addEventListener('click', ()=>{
  shown = (shown >= FULL.length) ? 10 : Math.min(FULL.length, shown + 5);
  render();
});
document.getElementById('y').textContent = new Date().getFullYear();

refresh();
setInterval(refresh, 90000); // menos presión a CG
document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) refresh(); });

document.getElementById('logoClick').addEventListener('click', ()=> {
  document.getElementById('imageModal').style.display = 'flex';
});
document.getElementById('imageModal').addEventListener('click', function(){ this.style.display='none'; });