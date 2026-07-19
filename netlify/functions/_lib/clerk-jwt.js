// Verificación de JWT de Clerk para funciones serverless.
// La identidad SIEMPRE se deriva del token verificado, nunca del body.

const { createRemoteJWKSet, jwtVerify } = require('jose');

let _jwks = null;

function _getJWKS() {
  if (_jwks) return _jwks;
  const issuer = process.env.CLERK_ISSUER;
  if (!issuer) return null;
  // Cachea las claves en memoria; Netlify reutiliza el contenedor.
  _jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
  return _jwks;
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

    const jwks = _getJWKS();
    if (!jwks) {
      console.error('[clerk-jwt] CLERK_ISSUER no configurado');
      return null;
    }

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
