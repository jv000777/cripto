/* ---------- FORMATTERS ---------- */
const nfUSD = new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:6});
const nfPct = new Intl.NumberFormat('en-US',{minimumFractionDigits:2,maximumFractionDigits:2,signDisplay:'exceptZero'});
const nfCompact = new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',compactDisplay:'short',maximumFractionDigits:2});

/* ---------- EXCLUSIONES ---------- */
const EXCLUDE_IDS = new Set([
  "tether","usd-coin","dai","true-usd","pax-dollar","frax","usdd","first-digital-usd","usdp","binance-usd","gemini-dollar",
  "staked-ether","wrapped-bitcoin","weth","rocket-pool-eth","frax-ether","ankreth","cbeth","sfrxeth","reth","frxeth"
]);

/* ---------- SIEMPRE INCLUIR ---------- */
const ALWAYS_INCLUDE_IDS = ["pudgy-penguins"];

let FULL = [];
let shown = 10;
let sortKey = 'market_cap';
let sortDir = 'desc';

async function fetchLive(){
  const urlTop = 'https://api.coingecko.com/api/v3/coins/markets'
    + '?vs_currency=usd&order=market_cap_desc&per_page=200&page=1'
    + '&sparkline=false&price_change_percentage=24h,7d';
  const r1 = await fetch(urlTop, { cache:'no-store', headers:{accept:'application/json'}});
  if (!r1.ok) throw new Error('CG top HTTP '+r1.status);
  const top = await r1.json();

  let extra = [];
  if (ALWAYS_INCLUDE_IDS.length){
    const urlExtra = 'https://api.coingecko.com/api/v3/coins/markets'
      + `?vs_currency=usd&ids=${encodeURIComponent(ALWAYS_INCLUDE_IDS.join(','))}`
      + '&sparkline=false&price_change_percentage=24h,7d';
    const r2 = await fetch(urlExtra, { cache:'no-store', headers:{accept:'application/json'}});
    if (r2.ok) extra = await r2.json();
  }

  const map = new Map();
  [...top, ...extra].forEach(c => { if (c && c.id) map.set(c.id, c); });
  const data = [...map.values()];

  FULL = data
    .filter(c => c && c.id && !EXCLUDE_IDS.has(c.id.toLowerCase()))
    .map(c => ({
      id: c.id,
      name: c.name,
      symbol: (c.symbol||'').toUpperCase(),
      usd: c.current_price ?? null,
      change_24h: c.price_change_percentage_24h_in_currency ?? c.price_change_percentage_24h ?? null,
      change_7d:  c.price_change_percentage_7d_in_currency ?? null,
      market_cap: c.market_cap ?? null
    }))
    .sort((a,b)=> (b.market_cap??0)-(a.market_cap??0));

  document.getElementById('update-time').textContent = 'Última actualización: ' + new Date().toLocaleString();
}

async function fetchSnapshot(){
  const res = await fetch('/data/snapshot.json?ts=' + Date.now(), { cache: 'no-store' });
  if (!res.ok) throw new Error('snapshot HTTP ' + res.status);
  const text = await res.text();
  const j = JSON.parse(text);
  document.getElementById('update-time').textContent =
    'Última actualización: ' + (j.updated_at ? new Date(j.updated_at).toLocaleString() : '—');

  FULL = Object.entries(j.assets || {})
    .map(([sym, x]) => ({ ...x, symbol: x.symbol || sym }))
    .filter(x => x.id && !EXCLUDE_IDS.has(x.id.toLowerCase()))
    .sort((a,b)=> (b.market_cap??0)-(a.market_cap??0));
}

function setSort(key){
  if (sortKey === key){
    sortDir = (sortDir === 'desc') ? 'asc' : 'desc';
  } else {
    sortKey = key;
    sortDir = 'desc';
  }
  render();
}
function cmp(a,b){
  const va = getVal(a, sortKey);
  const vb = getVal(b, sortKey);
  const na = (va==null || Number.isNaN(va));
  const nb = (vb==null || Number.isNaN(vb));
  if (na && nb) return 0;
  if (na) return 1;
  if (nb) return -1;
  return sortDir==='desc' ? (vb-va) : (va-vb);
}
function getVal(x,k){
  if (k==='market_cap') return Number(x.market_cap ?? NaN);
  if (k==='change_24h') return Number(x.change_24h ?? NaN);
  if (k==='change_7d')  return Number(x.change_7d  ?? NaN);
  return NaN;
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
    const mcShort= x.market_cap!=null ? nfCompact.format(x.market_cap) : '—';
    const name = x.name || x.id || x.symbol || '';

    const mini = `
      <div class="miniTF">
        <div class="miniTF-labels">
          <span>1h</span><span>4h</span><span>1d</span><span>1w</span>
        </div>
        <div class="miniTF-sq">
          <span class="sq gray" data-tf="1h"></span>
          <span class="sq gray" data-tf="4h"></span>
          <span class="sq gray" data-tf="1d"></span>
          <span class="sq gray" data-tf="1w"></span>
        </div>
      </div>`;

    tbody.insertAdjacentHTML('beforeend', `
      <tr>
        <td>
          <div class="name">
            <strong>${name} <span class="sym">(${(x.symbol||'')})</span></strong>
            <span class="mc">· MC ${mcShort}</span>
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
  if (shown >= FULL.length){ shown = 10; }
  else { shown = Math.min(FULL.length, shown + 5); }
  render();
});

document.getElementById('y').textContent = new Date().getFullYear();
refresh();
setInterval(refresh, 30000);
document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) refresh(); });

/* Modal logo */
document.getElementById('logoClick').addEventListener('click', function(){
  document.getElementById('imageModal').style.display = 'flex';
});
document.getElementById('imageModal').addEventListener('click', function(){
  this.style.display = 'none';
});

/* === MINI-TFs DINÁMICO · %K lento (8,2,3) · UMBRAL 15/85 · Binance→OKX · sin parpadeo === */
/** Pares especiales si el ticker difiere */
function getPairFromSymbol(sym){
  const manual = {
    POL:{binance:'POLUSDT', okx:'POL-USDT'},
    WLD:{binance:'WLDUSDT', okx:'WLD-USDT'},
    OP: {binance:'OPUSDT',  okx:'OP-USDT'},
    TIA:{binance:'TIAUSDT', okx:'TIA-USDT'},
    RNDR:{binance:'RNDRUSDT',okx:'RNDR-USDT'},
    FET:{binance:'FETUSDT', okx:'FET-USDT'}
  };
  return manual[sym] ?? { binance: sym + 'USDT', okx: sym + '-USDT' };
}

/** Timeframes */
const TF_TO_BINANCE = { '1h':'1h', '4h':'4h', '1d':'1d', '1w':'1w' };
const TF_TO_OKX     = { '1h':'1H', '4h':'4H', '1d':'1D', '1w':'1W' };

/** Umbrales */
const STOCH_LOW  = 15; // ≤15 → verde
const STOCH_HIGH = 85; // ≥85 → rojo

/** Helpers UI */
function setSquare(el, color){
  el.classList.remove('green','red','gray');
  el.classList.add(color);
}
function getSquareColor(el){
  return el.classList.contains('green') ? 'green'
       : el.classList.contains('red')   ? 'red'
       : 'gray';
}
function applySquare(el, color, title){
  const prev = getSquareColor(el);
  if (prev !== color){
    el.classList.remove('green','red','gray');
    el.classList.add(color);
  }
  if (el.title !== title) el.title = title;
}

/** Estocástico lento: devuelve último %K suavizado y %D */
function stochasticKD(highs, lows, closes, kPeriod=8, kSmoothing=2, dPeriod=3) {
  const n = closes.length;
  if (n < kPeriod) return { k: null, d: null };

  const kValues = [];
  for (let i = kPeriod - 1; i < n; i++) {
    const H = Math.max(...highs.slice(i - kPeriod + 1, i + 1));
    const L = Math.min(...lows.slice(i - kPeriod + 1, i + 1));
    const C = closes[i];
    const k = ((C - L) / ((H - L) || 1e-9)) * 100;
    kValues.push(k);
  }

  const kSmoothed = [];
  for (let i = kSmoothing - 1; i < kValues.length; i++) {
    const slice = kValues.slice(i - kSmoothing + 1, i + 1);
    kSmoothed.push(slice.reduce((a, b) => a + b, 0) / slice.length);
  }

  const dValues = [];
  for (let i = dPeriod - 1; i < kSmoothed.length; i++) {
    const slice = kSmoothed.slice(i - dPeriod + 1, i + 1);
    dValues.push(slice.reduce((a, b) => a + b, 0) / slice.length);
  }

  const lastK = kSmoothed[kSmoothed.length - 1] ?? null;
  const lastD = dValues[dValues.length - 1] ?? null;
  return { k: lastK, d: lastD };
}

/** Fetch Binance */
async function getKlinesBinance(symbol, interval, limit=200){
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const r = await fetch(url);
  if(!r.ok) throw new Error('Binance '+r.status);
  const rows = await r.json();
  return { highs: rows.map(r=>+r[2]), lows: rows.map(r=>+r[3]), closes: rows.map(r=>+r[4]), src:'BIN' };
}
/** Fetch OKX (revierte orden) */
async function getKlinesOKX(symbol, interval, limit=200){
  const url = `https://www.okx.com/api/v5/market/candles?instId=${symbol}&bar=${interval}&limit=${limit}`;
  const r = await fetch(url);
  if(!r.ok) throw new Error('OKX '+r.status);
  const j = await r.json();
  if(!j.data) throw new Error('OKX sin data');
  return {
    highs:  j.data.map(r=>+r[2]).reverse(),
    lows:   j.data.map(r=>+r[3]).reverse(),
    closes: j.data.map(r=>+r[4]).reverse(),
    src:'OKX'
  };
}
/** Fallback */
async function getDataWithFallback(pairObj, tf){
  try{ return await getKlinesBinance(pairObj.binance, TF_TO_BINANCE[tf]); }
  catch(e1){
    console.warn(`Binance falló ${pairObj.binance}/${tf} → OKX`, e1);
    return await getKlinesOKX(pairObj.okx, TF_TO_OKX[tf]);
  }
}

/** Evalúa y prepara cambios en una fila (batch sin parpadeo) */
async function evaluateAndPaintRow(tr, pairObj){
  const squares = tr.querySelectorAll('.miniTF-sq .sq');
  if (squares.length!==4 || !pairObj) return;

  const tfs = ['1h','4h','1d','1w'];
  const pending = [];

  for (let i=0;i<tfs.length;i++){
    const tf = tfs[i];
    try{
      const d = await getDataWithFallback(pairObj, tf);
      const { k } = stochasticKD(d.highs, d.lows, d.closes, 8, 2, 3);
      const color = (k != null && k <= STOCH_LOW) ? 'green'
                   : (k != null && k >= STOCH_HIGH) ? 'red'
                   : 'gray';
      const title = (k != null) ? `%K ${k.toFixed(1)} · ${tf} · ${d.src}` : `sin datos · ${tf}`;
      pending.push({ idx:i, color, title });
      await new Promise(r=>setTimeout(r, 100)); // rate-limit friendly
    }catch(e){
      pending.push({ idx:i, color:'gray', title:`sin datos · ${tf}` });
      console.warn('MiniTF %K error', tf, e);
    }
  }

  requestAnimationFrame(()=>{
    for (const p of pending){
      const el = squares[p.idx];
      applySquare(el, p.color, p.title);
    }
  });
}

/** Recorre todas las filas y aplica */
async function paintAllVisibleRows(){
  let symbols=0, g=0, r=0, x=0;
  const trs = Array.from(document.querySelectorAll('#rows tr'));
  for(const tr of trs){
    const symEl = tr.querySelector('.sym'); if(!symEl) continue;
    const sym = (symEl.textContent||'').replace(/[()]/g,'').trim().toUpperCase();
    if(!sym) continue;
    const pairObj = getPairFromSymbol(sym);
    symbols++;
    await evaluateAndPaintRow(tr, pairObj);
    // esperar al frame donde se aplican cambios y contar
    await new Promise(res=>requestAnimationFrame(()=>res()));
    tr.querySelectorAll('.miniTF-sq .sq').forEach(s=>{
      if(s.classList.contains('green')) g++;
      else if(s.classList.contains('red')) r++;
      else x++;
    });
  }
  console.log(`miniTF: símbolos revisados ${symbols} · verdes ${g} · rojos ${r} · grises ${x}`);
}

/** Hook a tu render() */
const __originalRender__ = render;
render = function(){
  __originalRender__();
  paintAllVisibleRows();
};

/** Capa inicial por si este bloque carga después del primer render */
if (document.readyState !== 'loading') setTimeout(()=>paintAllVisibleRows(), 300);
else document.addEventListener('DOMContentLoaded', ()=>setTimeout(()=>paintAllVisibleRows(), 300));
