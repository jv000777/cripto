/* ---------- CONFIG ---------- */
const API_URL = 'https://api.coingecko.com/api/v3/simple/price';
const VS = 'usd';

/* ---------- OVERRIDES DE ID ---------- */
// Mapea símbolos o IDs mal detectados al ID correcto de CoinGecko
const ID_OVERRIDES = {
  'pengu': 'pudgy-penguins',       // Forzar que PENGU sea Pudgy Penguins
  'pudgy-penguins': 'pudgy-penguins' // redundante pero seguro
};

/* ---------- FUNCIÓN PRINCIPAL ---------- */
async function fetchPrices(assets) {
  try {
    // Normalizar IDs aplicando override
    const ids = assets.map(sym => {
      const low = sym.toLowerCase();
      return ID_OVERRIDES[low] || low;
    });

    // Evitar duplicados
    const uniqueIds = [...new Set(ids)];

    // Llamada a CoinGecko
    const url = `${API_URL}?ids=${uniqueIds.join(',')}&vs_currencies=${VS}&include_market_cap=true&include_24hr_change=true&include_7d_change=true`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Error HTTP ${res.status}`);
    const data = await res.json();

    // Mapear respuesta a formato interno
    return assets.map(sym => {
      const id = ID_OVERRIDES[sym.toLowerCase()] || sym.toLowerCase();
      const info = data[id];
      if (!info) return { symbol: sym, usd: null, market_cap: null, change_24h: null, change_7d: null };

      return {
        symbol: sym,
        usd: info.usd ?? null,
        market_cap: info.usd_market_cap ?? null,
        change_24h: info.usd_24h_change ?? null,
        change_7d: info.usd_7d_change ?? null
      };
    });
  } catch (err) {
    console.error('Error al obtener precios:', err);
    return assets.map(sym => ({ symbol: sym, usd: null, market_cap: null, change_24h: null, change_7d: null }));
  }
}

/* ---------- EJEMPLO DE USO ---------- */
(async () => {
  const activos = ['BTC', 'ETH', 'PENGU', 'SOL'];
  const precios = await fetchPrices(activos);
  console.log(precios);
})();