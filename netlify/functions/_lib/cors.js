const ORIGENES_PERMITIDOS = [
  'https://zhorasone.com',
  'https://www.zhorasone.com',
  'http://127.0.0.1:5500', // Live Server local
  'http://localhost:5500',
];

function cabecerasCORS(event) {
  const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || '';
  const permitido = ORIGENES_PERMITIDOS.includes(origin);
  return {
    'Access-Control-Allow-Origin': permitido ? origin : ORIGENES_PERMITIDOS[0],
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };
}

module.exports = { cabecerasCORS };
