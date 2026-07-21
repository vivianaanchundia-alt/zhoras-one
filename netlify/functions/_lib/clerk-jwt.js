// Verificación de JWT de Clerk para funciones serverless.
// La identidad SIEMPRE se deriva del token verificado, nunca del body.

// jose ^6.2.3 es ESM-only (require() falla en Node <22.12 con ERR_REQUIRE_ESM).
// import() dinámico funciona en cualquier versión sin cambiar la firma async pública.
let _joseP = null;
function _jose() { return (_joseP ||= import('jose')); }

let _jwksP = null; // cachea la PROMESA (no el resultado) para no duplicar la descarga en arranques concurrentes

function _getJWKS() {
  if (_jwksP) return _jwksP;
  const issuer = process.env.CLERK_ISSUER;
  if (!issuer) {
    console.error('[clerk-jwt] CLERK_ISSUER no configurado');
    return Promise.resolve(null);
  }
  // Cachea las claves en memoria; Netlify reutiliza el contenedor.
  _jwksP = _jose()
    .then(({ createRemoteJWKSet }) => createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`)))
    .catch(e => {
      console.error('[clerk-jwt] fallo al cargar jose/JWKS:', e.message);
      _jwksP = null;
      return null;
    });
  return _jwksP;
}

/**
 * Verifica el JWT del header Authorization y devuelve los claims.
 * @param {object} event - el event de la Netlify Function
 * @returns {Promise<object|null>} claims verificados, o null si es inválido
 */
async function verificarClerkJWT(event) {
  try {
    const raw = event.headers.authorization || event.headers.Authorization || '';
    const token = raw.startsWith('Bearer ') ? raw.slice(7).trim() : '';
    if (!token) return null;

    const jwks = await _getJWKS();
    if (!jwks) return null; // config faltante (ya logueado en _getJWKS)

    const { jwtVerify } = await _jose();
    const { payload } = await jwtVerify(token, jwks, {
      issuer: process.env.CLERK_ISSUER,
      clockTolerance: 30, // 30s de margen por desfase de reloj
    });

    if (!payload.sub) return null;
    return payload;
  } catch (e) {
    console.warn('[clerk-jwt] Token inválido:', e.code || e.message);
    return null;
  }
}

module.exports = { verificarClerkJWT };
