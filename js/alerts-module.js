// ════════════════════════════════════════════════════════════════
// CLAROKPIS — alerts-module.js
// Extraído del inline — líneas 1362-1433 y 1504-1574
// ════════════════════════════════════════════════════════════════

function generateAutoAlerts() {
  const goals    = storage.getGoals();
  const salesData = storage.getData('sales'); // Alertas operativas: usan todos los datos del presente
  const invData   = storage.getData('inventory');
  const teamData  = storage.getData('team');
  const clientData= storage.getData('clients');

  // Alertas de ventas
  const totalSales = salesData.reduce((s,r) => s+(parseFloat(r.Ventas_Monto)||0), 0);
  const totalGoal  = salesData.reduce((s,r) => s+(parseFloat(r.Meta_Ventas)||0), 0) || goals.sales_monthly;
  if (totalGoal > 0) {
    const pct = (totalSales / totalGoal) * 100;
    if (pct < 80) {
      storage.addAlert({
        type:    pct < 60 ? 'critical' : 'warning',
        module:  'sales',
        kpi:     'goal_achievement',
        messageKey: 'alertSalesGoal',
        params:     { pct: pct.toFixed(0), falta: formatCurrency(totalGoal-totalSales) },
        value:   pct, goal:100,
      });
    }
  }

  // Alertas de stock crítico
  const products = {};
  invData.forEach(r => {
    const n = r.Producto || 'Sin producto';
    if (!products[n]) products[n] = { stock:0, ventas:0 };
    products[n].stock  += parseFloat(r.Stock_Inicial)    || 0;
    products[n].ventas += parseFloat(r.Ventas_Unidades)   || 0;
  });
  Object.entries(products).forEach(([nombre, p]) => {
    const diasDiarios = p.ventas / 180; // 6 meses
    const dias = diasDiarios > 0 ? p.stock / diasDiarios : 999;
    if (dias < 7 && dias >= 0) {
      storage.addAlert({
        type:'critical', module:'inventory', kpi:'stock',
        messageKey: 'alertStockCritico',
        params:     { nombre, dias: Math.round(dias), stock: Math.round(p.stock) },
        value: dias, goal: 7,
      });
    }
  });

  // Alertas de equipo bajo meta
  const now        = new Date();
  const daysInMonth= new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
  const progress   = now.getDate() / daysInMonth;
  if (progress >= 0.4) {
    const sellers = {};
    teamData.forEach(r => {
      const n = r.Vendedor || 'Sin nombre';
      if (!sellers[n]) sellers[n] = { monto:0, meta:0 };
      sellers[n].monto += parseFloat(r.Ventas_Monto) || 0;
      sellers[n].meta  += parseFloat(r.Meta_Mes)     || 0;
    });
    Object.entries(sellers).forEach(([nombre, s]) => {
      if (!s.meta) return;
      const pct = (s.monto / s.meta) * 100;
      if (pct < progress * 100 * 0.85) {
        storage.addAlert({
          type:'warning', module:'team', kpi:'goal_achievement',
          messageKey: 'alertTeamBajo',
          params:     { nombre, pct: pct.toFixed(0) },
          value: pct, goal: 90,
        });
      }
    });
  }

  // Alertas de clientes en riesgo
  const enRiesgo = clientData.filter(r => (parseFloat(r.Días_Sin_Compra)||0) > 90).length;
  if (enRiesgo > 0) {
    const pct = (enRiesgo / clientData.length) * 100;
    storage.addAlert({
      type:'warning', module:'clients', kpi:'churn',
      messageKey: 'alertClientesRiesgo',
      params:     { n: enRiesgo, pct: pct.toFixed(1) },
      value: enRiesgo, goal: 0,
    });
  }

  // Actualizar sidebar con nuevas alertas
  if (typeof buildSidebarNav === 'function') buildSidebarNav();
  // ── ALERTAS COBRANZAS ────────────────────────────────────────
  const collRows = storage.getData('collections') || [];
  if (collRows.length) {
    const sym = storage.getConfig().currencySymbol || '$';
    const fmtC = n => n>=1e6?sym+(n/1e6).toFixed(1)+'M':sym+(n/1e3).toFixed(0)+'K';
    // Facturas críticas (+90 días)
    collRows.filter(r => r.Tramo === '+90' && (parseFloat(r.Dias_Vencida)||0) > 90).slice(0,2).forEach(f => {
      storage.addAlert({ type:'critical', module:'collections', kpi:'overdue_critical',
        messageKey:'collAlertVencida',
        params:{ cliente:f.Nombre_Cliente||f.Cliente_ID, id:f.Factura_ID, dias:Math.round(parseFloat(f.Dias_Vencida)||0), monto:fmtC(parseFloat(f.Monto_Pendiente)||0) },
        value:parseFloat(f.Dias_Vencida)||0, goal:90 });
    });
    // Concentración de deuda
    const activas = collRows.filter(r => r.Estado !== 'Pagada');
    const totalCxC = activas.reduce((s,r)=>s+(parseFloat(r.Monto_Pendiente)||0),0);
    const byC = {}; activas.forEach(r=>{ byC[r.Cliente_ID]=(byC[r.Cliente_ID]||0)+(parseFloat(r.Monto_Pendiente)||0); });
    const top3 = Object.values(byC).sort((a,b)=>b-a).slice(0,3).reduce((s,v)=>s+v,0);
    const conc = totalCxC > 0 ? top3/totalCxC*100 : 0;
    if (conc > 60) storage.addAlert({ type:'warning', module:'collections', kpi:'concentration',
      messageKey:'collAlertConcentracion',
      params:{ pct:conc.toFixed(0), n:Math.min(3,Object.keys(byC).length) },
      value:conc, goal:60 });
  }
}

// ── RESOLVER ALERTA ───────────────────────────────────────────────
function resolveAlertUI(alertId) {
  if (auth.isDemo()) { showToast('🔒 ' + (i18n.t('alertDemoBlocked')||'No disponible en demo'), 'yellow'); return; }
  const role = auth.getCurrentRole();
  if (role === 'owner') { showToast('🔒 ' + (i18n.t('alertNoPermission')||'Sin permiso'), 'yellow'); return; }

  document.getElementById('resolveAlertModal')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'resolveAlertModal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;';

  const box = document.createElement('div');
  box.style.cssText = 'background:var(--color-bg-card);border:1px solid var(--color-border);border-radius:12px;width:100%;max-width:440px;padding:20px;';

  const isEs = i18n.getLang() === 'es';

  const title = document.createElement('div');
  title.style.cssText = 'font-size:.95rem;font-weight:700;color:var(--color-text);margin-bottom:14px;';
  title.textContent = '✅ ' + (i18n.t('alertResolve') || (isEs?'Resolver alerta':'Resolve alert'));

  const desc = document.createElement('div');
  desc.style.cssText = 'font-size:.8rem;color:var(--color-text-muted);margin-bottom:10px;';
  desc.textContent = i18n.t('alertActionPlaceholder');

  const textarea = document.createElement('textarea');
  textarea.id = 'resolveNoteInput';
  textarea.placeholder = i18n.t('alertNotePlaceholder');
  textarea.style.cssText = 'width:100%;height:80px;padding:8px;background:var(--color-bg);border:1px solid var(--color-border);border-radius:6px;color:var(--color-text);font-size:.82rem;resize:vertical;font-family:inherit;box-sizing:border-box;';

  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:8px;margin-top:12px;justify-content:flex-end;';

  const btnCancel = document.createElement('button');
  btnCancel.textContent = i18n.t('cancel') || (isEs?'Cancelar':'Cancel');
  btnCancel.style.cssText = 'padding:7px 16px;background:var(--color-bg-card-2);border:1px solid var(--color-border);border-radius:6px;color:var(--color-text-muted);cursor:pointer;font-size:.82rem;';
  btnCancel.onclick = () => overlay.remove();

  const btnConfirm = document.createElement('button');
  btnConfirm.textContent = '✅ ' + (i18n.t('alertResolveSave') || (isEs?'Confirmar':'Confirm'));
  btnConfirm.style.cssText = 'padding:7px 16px;background:#22c55e;border:none;border-radius:6px;color:#fff;cursor:pointer;font-size:.82rem;font-weight:600;';
  btnConfirm.dataset.alertId = alertId;
  btnConfirm.onclick = function() { _confirmResolveAlert(this.dataset.alertId); };

  btnRow.appendChild(btnCancel);
  btnRow.appendChild(btnConfirm);
  box.appendChild(title);
  box.appendChild(desc);
  box.appendChild(textarea);
  box.appendChild(btnRow);
  overlay.appendChild(box);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
  setTimeout(() => textarea.focus(), 50);
}

function _confirmResolveAlert(alertId) {
  const note       = (document.getElementById('resolveNoteInput')?.value || '').trim();
  const user       = auth.getCurrentUser();
  const resolvedBy = user?.name || auth.getCurrentRole() || 'unknown';

  storage.resolveAlert(alertId, resolvedBy, new Date().toISOString(), note);
  document.getElementById('resolveAlertModal')?.remove();
  buildSidebarNav();
  renderCurrentModule();
  showToast('✅ ' + (i18n.getLang()==='es'
    ? `Alerta resuelta por ${resolvedBy}`
    : `Alert resolved by ${resolvedBy}`), 'green');
}
