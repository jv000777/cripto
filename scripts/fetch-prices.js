const fs = require('fs');
const https = require('https');

const url = 'https://api.coincap.io/v2/assets?limit=5';

https.get(url, (res) => {
  let data = '';

  res.on('data', chunk => { data += chunk; });

  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      const prices = json.data.map(c => ({
        name: c.name,
        symbol: c.symbol,
        priceUsd: c.priceUsd
      }));

      // Crea carpeta "data" si no existe
      if (!fs.existsSync('data')) fs.mkdirSync('data');

      fs.writeFileSync('data/snapshot.json', JSON.stringify(prices, null, 2));
      console.log('✅ Precios guardados en data/snapshot.json');
    } catch (err) {
      console.error('❌ Error parseando datos:', err);
      process.exit(1);
    }
  });
}).on('error', err => {
  console.error('❌ Error al obtener datos:', err);
  process.exit(1);
});
