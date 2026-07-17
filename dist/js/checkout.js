// ════════════════════════════════════════════════════════════════
// ZHORAS ONE — checkout.js
// Conecta el frontend con la función serverless mp-create.
// Llamar iniciarPago('negocio') para mensual, o
// iniciarPago('negocio', 'anual') para el plan anual (2 meses gratis).
// ════════════════════════════════════════════════════════════════

const checkout = (() => {

  const PENDING_KEY = 'zhoras_pending_plan';

  // Inicia el flujo de pago: pide el link a mp-create y redirige a MP.
  // billingPeriod: 'mensual' (default, compatibilidad) | 'anual'
  async function iniciarPago(planId, billingPeriod = 'mensual') {
    const lang = (typeof i18n !== 'undefined') ? i18n.getLang() : 'es';

    // Datos del usuario logueado (Clerk)
    const empresaId = (window.Clerk && window.Clerk.user) ? window.Clerk.user.id : null;
    const email = (window.Clerk && window.Clerk.user)
      ? window.Clerk.user.primaryEmailAddress?.emailAddress
      : null;

    if (!empresaId || !email) {
      // Antes: fallaba aquí en silencio (o en demo, redirigía al demo sin
      // completar la suscripción). Ahora guarda la intención de pago y
      // manda a iniciar sesión; retomarPagoPendiente() la retoma sola
      // apenas hay una sesión real (llamado desde dashboard.html al
      // arrancar).
      try {
        sessionStorage.setItem(PENDING_KEY, JSON.stringify({ plan: planId, period: billingPeriod }));
      } catch (e) { /* noop */ }

      if (typeof auth !== 'undefined' && auth.redirectToSignIn) {
        await auth.redirectToSignIn();
      } else {
        alert(lang === 'en'
          ? 'Please sign in to subscribe.'
          : 'Inicia sesión para suscribirte.');
      }
      return;
    }

    // Feedback visual: deshabilitar y mostrar cargando
    const btns = document.querySelectorAll('[data-plan="' + planId + '"]');
    btns.forEach(b => { b.disabled = true; b.dataset.orig = b.textContent; b.textContent = '...'; });

    try {
      const res = await fetch('/.netlify/functions/mp-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: planId, empresa_id: empresaId, email, billing_period: billingPeriod }),
      });
      const data = await res.json();

      if (!res.ok || !data.init_point) {
        throw new Error(data.error || 'No se pudo iniciar el pago');
      }

      // Redirigir al checkout de Mercado Pago
      window.location.href = data.init_point;

    } catch (e) {
      console.error('[checkout]', e);
      alert(lang === 'en'
        ? 'Could not start payment. Please try again.'
        : 'No se pudo iniciar el pago. Intenta de nuevo.');
      // Restaurar botones
      btns.forEach(b => { b.disabled = false; if (b.dataset.orig) b.textContent = b.dataset.orig; });
    }
  }

  // Retoma un pago que quedó pendiente antes de iniciar sesión (guardado
  // por selectPlanAndLogin() en index.html o por iniciarPago() cuando no
  // había sesión). Se llama una vez al arrancar dashboard.html, ya con
  // sesión Clerk confirmada. Devuelve true si había algo que retomar.
  function retomarPagoPendiente() {
    let pending = null;
    try { pending = JSON.parse(sessionStorage.getItem(PENDING_KEY) || 'null'); }
    catch (e) { pending = null; }
    if (!pending || !pending.plan) return false;

    sessionStorage.removeItem(PENDING_KEY);
    iniciarPago(pending.plan, pending.period || 'mensual');
    return true;
  }

  return { iniciarPago, retomarPagoPendiente };

})();
