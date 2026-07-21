/**
 * Zhoras One — clients-module.js
 * Módulo Clientes: retención, churn, NPS, CAC, LTV, RFM, clientes en riesgo.
 */

const clientsModule = (() => {
  let activeTab = 'overview';

  function render(container) {
    const rawRows = storage.applyFilters(storage.getData('clients'), 'clients');
    const goals   = storage.getGoals();
    const config  = storage.getConfig();
    const sym     = config.currencySymbol || '$';

    // ── DETECCIÓN DE FUENTE DE DATOS ──────────────────────────
    // Si no hay Excel de clientes O las columnas RFM críticas están vacías,
    // derivar automáticamente desde ventas.
    const hasRFMCols = rawRows.length > 0 &&
      rawRows.some(r => parseFloat(r.Días_Sin_Compra) > 0 || parseFloat(r.Frecuencia_Compra) > 0);

    let rows = rawRows;
    let derivedFromSales = false;

    if (!hasRFMCols) {
      const salesRows = storage.getData('sales');
      const derived = kpis.deriveClientsFromSales(salesRows);
      if (derived.length > 0) {
        // Merge: si hay Excel de clientes, enriquecerlo con ventas; si no, usar solo derivados
        if (rawRows.length > 0) {
          const salesMap = {};
          derived.forEach(d => { salesMap[d.Cliente_ID] = d; });
          rows = rawRows.map(r => {
            const d = salesMap[r.Cliente_ID] || {};
            return {
              ...r,
              Días_Sin_Compra:   parseFloat(r.Días_Sin_Compra) > 0 ? r.Días_Sin_Compra : d.Días_Sin_Compra,
              Frecuencia_Compra: parseFloat(r.Frecuencia_Compra) > 0 ? r.Frecuencia_Compra : d.Frecuencia_Compra,
              Ventas_Monto:      r.Ventas_Monto || d.Ventas_Monto,
              _derived:          !parseFloat(r.Días_Sin_Compra),
            };
          });
        } else {
          rows = derived;
        }
        derivedFromSales = true;
      }
    }

    const hasData = rows.length > 0;
    const data    = calcClientKPIs(rows, goals);

    container.innerHTML = `
      <div class="module-header">
        <div class="module-title-wrap">
          <h1 class="module-title">👥 ${i18n.t('clientsTitle')}</h1>
          <p class="module-subtitle">${rows.length.toLocaleString()} ${i18n.t('registros')||'registros'}${(() => {
              const _dr = storage.getDataDateRange('clients') || storage.getDataDateRange('sales');
              return _dr ? ' · ' + (i18n.getLang()==='es' ? 'Datos: ' : 'Data: ') + _dr.label : '';
            })()}${derivedFromSales ? `
            <span style="display:inline-flex;align-items:center;gap:4px;margin-left:8px;padding:2px 8px;border-radius:20px;font-size:.7rem;font-weight:700;background:var(--color-blue-bg);border:1px solid var(--color-blue-border);color:var(--color-blue);">
              ${i18n.getLang()==='es' ? '📊 Calculado desde Ventas' : '📊 Derived from Sales'}
            </span>` : ''}</p>
        </div>
        <button class="btn btn-sm btn-secondary" onclick="showModal('uploadModal')">📂 ${i18n.t('uploadData')}</button>
      </div>

      ${renderGlobalFilters('clients', { showSeller: false, showBranch: true })}
      <div class="tabs" id="clientsTabs">
        <div class="tab-item ${activeTab==='overview'?'active':''}" onclick="clientsModule.setTab('overview')">${i18n.t('clientsTabOverview')}</div>
        <div class="tab-item ${activeTab==='rfm'    ?'active':''}" onclick="clientsModule.setTab('rfm')">🎯 ${i18n.getLang()==='es'?'Segmentación RFM':'RFM Segmentation'}</div>
        <div class="tab-item ${activeTab==='risk'   ?'active':''}" onclick="clientsModule.setTab('risk')">⚠️ ${i18n.t('clientsTabRisk')}</div>
        <div class="tab-item ${activeTab==='acq'    ?'active':''}" onclick="clientsModule.setTab('acq')">📡 ${i18n.getLang()==='es'?'Adquisición':'Acquisition'}</div>
      </div>

      ${!hasData ? noData() : renderTab(data, goals, sym, rows)}
    `;

    if (hasData) setTimeout(() => renderCharts(data, sym), 50);
  }

  function renderTab(data, goals, sym, rows) {
    if (activeTab === 'overview') return renderOverview(data, goals, sym);
    if (activeTab === 'rfm')      return renderRFM(data, sym);
    if (activeTab === 'risk')     return renderRisk(data, sym);
    if (activeTab === 'acq')      return renderAcquisition(data, sym);
    return '';
  }

  // ── OVERVIEW ─────────────────────────────────────────────────
  function renderOverview(data, goals, sym) {
    const retStatus  = storage.getStatus(data.retentionRate, goals.retention_rate);
    const churnStatus= storage.getStatus(data.churnRate, goals.churn_rate, true);
    const npsStatus  = storage.getStatus(data.nps, goals.nps);
    const ltvStatus  = storage.getStatus(data.ltvCacRatio, goals.ltv_cac_ratio);

    return `
      <div class="kpi-grid" style="grid-template-columns:repeat(auto-fit,minmax(190px,1fr));margin-bottom:20px;">
        ${kpiCard('👥', i18n.t('clientesActivos'), data.totalClients.toLocaleString(), 'blue', `${data.newClients} ${i18n.getLang()==='es'?'nuevos este período':'new this period'}`, null, null, true)}
        ${kpiCard('💚', i18n.getLang()==='es'?'Retención':'Retention', pct(data.retentionRate), retStatus, `${i18n.t('metaLabel')}: ${goals.retention_rate}%`, data.retentionRate, retStatus)}
        ${kpiCard('📉', 'Churn rate', pct(data.churnRate), churnStatus, `${data.churnedClients} ${i18n.getLang()==='es'?'clientes perdidos':'churned clients'}`, null, null)}
        ${kpiCard('⭐', 'NPS', data.nps !== null ? Math.round(data.nps).toString() : '—', npsStatus, `${data.promoters} ${i18n.getLang()==='es'?'promotores':'promoters'} · ${data.detractors} ${i18n.getLang()==='es'?'detractores':'detractors'}`, null, null)}
        ${kpiCard('💎', 'LTV/CAC', data.ltvCacRatio !== null ? data.ltvCacRatio.toFixed(1)+'x' : '—', ltvStatus, `${i18n.t('metaLabel')}: ${goals.ltv_cac_ratio}x`, null, null)}
        ${kpiCard('🛒', i18n.t('frecCompra'), data.avgFrequency !== null ? data.avgFrequency.toFixed(1)+(i18n.getLang()==='es'?'/año':'/year') : '—', 'blue', i18n.t('promedioAnual'), null, null)}
        ${kpiCard('💰', i18n.t('cacReal'), data.cacReal !== null ? fmt(data.cacReal,sym) : '—', data.cacReal!==null&&goals.max_cac>0?(data.cacReal<=goals.max_cac?'green':data.cacReal<=goals.max_cac*1.3?'yellow':'red'):data.cacReal!==null&&data.ltv&&data.cacReal<data.ltv/3?'green':data.cacReal!==null?'yellow':'na', data.cacReal&&goals.max_cac>0?`${i18n.t('metaLabel')}: ≤${fmt(goals.max_cac,sym)}`:data.cacReal?(i18n.getLang()==='es'?'costo adq. por cliente nuevo':'acq. cost per new client'):(i18n.getLang()==='es'?'sube datos de marketing':'upload marketing data'), null, null)}
        ${kpiCard('🔁', i18n.t('tasaRecompra'), data.repurchaseRate !== null ? data.repurchaseRate.toFixed(1)+'%' : '—', data.repurchaseRate!==null?storage.getStatus(data.repurchaseRate, goals.repurchase_rate||50):'na', `${i18n.t('metaLabel')}: ${goals.repurchase_rate||50}% · ${data.avgDaysBetween?i18n.t('cadaDias').replace('{n}',data.avgDaysBetween):i18n.t('clientesQueVuelven')}`, data.repurchaseRate, data.repurchaseRate!==null?storage.getStatus(data.repurchaseRate, goals.repurchase_rate||50):'na')}
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;" class="charts-row">
        <div class="chart-card">
          <div class="chart-card-header"><div class="chart-card-title">${i18n.t('clientsRetVsChurn')}</div></div>
          <div class="chart-container" style="height:220px;"><canvas id="retentionChart"></canvas></div>
        </div>
        <div class="chart-card">
          <div class="chart-card-header">
            <div class="chart-card-title">⭐ NPS — ${i18n.getLang()==='es'?'Distribución':'Distribution'}</div>
            <span class="badge ${npsStatus !== 'na' ? 'badge-'+npsStatus : 'badge-blue'}">NPS: ${data.nps !== null ? Math.round(data.nps) : '—'}</span>
          </div>
          <div class="chart-container" style="height:220px;"><canvas id="npsChart"></canvas></div>
        </div>
      </div>

      <div class="chart-card">
        <div class="chart-card-header"><div class="chart-card-title">${i18n.t('clientsMonthlyEvo')}</div></div>
        <div class="chart-container" style="height:220px;"><canvas id="clientsTrendChart"></canvas></div>
      </div>
    `;
  }

  // ── RFM ──────────────────────────────────────────────────────
  function renderRFM(data, sym) {
    const segments = data.rfmSegments;
    const total = Object.values(segments).reduce((s, v) => s + v.count, 0);
    const segConfig = [
      { key:'champions', icon:'🏆', labelKey:'rfmCampeonesName', color:'green'  },
      { key:'loyal',     icon:'💚', labelKey:'rfmLealesName',     color:'green'  },
      { key:'promising', icon:'🌟', labelKey:'rfmPrometedoresName',color:'blue'  },
      { key:'atrisk',    icon:'⚠️', labelKey:'rfmAtRiskName',     color:'yellow' },
      { key:'lost',      icon:'💔', labelKey:'rfmLostName',       color:'red'   },
      { key:'new',       icon:'🆕', labelKey:'rfmNewName',        color:'blue'  },
    ];

    return `
      <div class="kpi-grid" style="grid-template-columns:repeat(auto-fit,minmax(175px,1fr));margin-bottom:20px;">
        ${segConfig.map(s => {
          const seg = segments[s.key] || { count:0, pct:0 };
          return kpiCard(s.icon, i18n.t(s.labelKey),
            seg.count.toLocaleString(), s.color,
            `${(total > 0 ? seg.count/total*100 : 0).toFixed(1)}% ${i18n.t('rfmDelTotal')}`, null, null);
        }).join('')}
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;" class="charts-row">
        <div class="chart-card">
          <!-- EXPORT PANEL -->
          <div style="margin-bottom:20px;">
            <div class="card" style="background:var(--color-bg);border:1px solid var(--color-border);border-radius:var(--radius-md);padding:16px;">
              <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                <span style="font-size:.82rem;font-weight:700;color:var(--color-text)">📥 ${i18n.t('rfmExportBtn')}</span>
                <select id="rfmExportSegSelect" class="filter-select" style="min-width:160px;">
                  <option value="all">${i18n.t('rfmExportAll')}</option>
                  ${segConfig.map(s => `<option value="${s.key}">${s.icon} ${i18n.t(s.labelKey)}</option>`).join('')}
                </select>
                <label style="display:flex;align-items:center;gap:6px;font-size:.78rem;color:var(--color-text-muted);cursor:pointer;">
                  <input type="checkbox" id="rfmAnonCheck" style="accent-color:var(--color-blue);width:14px;height:14px;" />
                  <span>${i18n.t('rfmExportAnon')}</span>
                  <span style="font-size:.7rem;color:var(--color-text-faint);">(${i18n.t('rfmExportAnonHint')})</span>
                </label>
                <button class="btn btn-secondary btn-sm" onclick="(() => {
                  const seg = document.getElementById('rfmExportSegSelect')?.value || 'all';
                  const anon = document.getElementById('rfmAnonCheck')?.checked || false;
                  clientsModule.exportRFMSegment(seg, anon);
                })()">
                  📥 ${i18n.t('rfmExportBtn')}
                </button>
              </div>
            </div>
          </div>

          <div class="chart-card-header"><div class="chart-card-title">🎯 ${i18n.t('rfmDistribucion')}</div></div>
          <div class="chart-container" style="height:240px;"><canvas id="rfmDonut"></canvas></div>
        </div>
        <div class="chart-card">
          <div class="chart-card-header"><div class="chart-card-title">💡 ${i18n.t('rfmAcciones')}</div></div>
          <div style="display:flex;flex-direction:column;gap:10px;padding:4px 0;">
            ${segConfig.map(s => {
              const seg = segments[s.key] || { count:0 };
              const actions = getRFMActions(s.key);
              return `
                <div style="display:flex;align-items:flex-start;gap:10px;">
                  <span class="badge badge-${s.color}" style="flex-shrink:0;margin-top:2px">${seg.count}</span>
                  <div>
                    <div style="font-size:.8rem;font-weight:600;color:var(--color-text)">${s.icon} ${i18n.t(s.labelKey)}</div>
                    <div style="font-size:.72rem;color:var(--color-text-faint)">${actions}</div>
                  </div>
                </div>`;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  }

  function getRFMActions(key) {
    const map = {
      champions:  i18n.t('rfmActionChamp'),
      loyal:      i18n.t('rfmActionLoyal'),
      promising:  i18n.t('rfmActionProm'),
      atrisk:     i18n.t('rfmActionRisk'),
      lost:       i18n.t('rfmActionLost'),
      new:        i18n.t('rfmActionNew'),
    };
    return map[key] || '';
  }

  // ── EN RIESGO ─────────────────────────────────────────────────
  function renderRisk(data, sym) {
    const atRisk = data.atRiskClients.slice(0, 20);
    return `
      <div class="card" style="background:var(--color-red-bg);border-color:var(--color-red-border);margin-bottom:20px;">
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
          <div style="font-size:2rem;font-weight:800;font-family:var(--font-mono);color:var(--color-red)">${data.atRiskClients.length}</div>
          <div>
            <div style="font-weight:700;color:var(--color-red)">${i18n.t('clientsRiskHeader')}</div>
            <div style="font-size:.78rem;color:var(--color-text-faint)">${i18n.t('clientsRiskSinCompra')} · ${i18n.getLang()==='es'?'Representa':'Represents'} ~${data.atRiskClients.length > 0 ? Math.round(data.atRiskClients.length / data.totalClients * 100) : 0}% ${i18n.t('clientsRiskRepresenta')}</div>
          </div>
          <div style="margin-left:auto;">
            <div style="font-size:.8rem;font-weight:600;color:var(--color-text-muted)">💡 ${i18n.t('clientsAccionSugerida')}:</div>
            <div style="font-size:.75rem;color:var(--color-text-faint)">${i18n.t('clientsAccionReact')}</div>
          </div>
        </div>
      </div>

      ${atRisk.length > 0 ? `
        <div class="chart-card">
          <div class="chart-card-header"><div class="chart-card-title">⚠️ ${i18n.t('clientsRiskList')}</div></div>
          <div class="table-wrapper">
            <table class="table">
              <thead>
                <tr>
                  <th>${i18n.t('clientsCliente')}</th>
                  <th>${i18n.t('clientsCanalAdq')}</th>
                  <th class="number">${i18n.t('clientsDiasSinCompra')}</th>
                  <th class="number">${i18n.t('clientsFrecuencia')}</th>
                  <th>${i18n.t('clientsRiesgo')}</th>
                </tr>
              </thead>
              <tbody>
                ${atRisk.map(c => {
                  const dias = parseInt(c.Días_Sin_Compra) || 0;
                  const nivel = dias > 120 ? 'red' : dias > 90 ? 'yellow' : 'blue';
                  const nivelLabel = dias > 120 ? ('🔴 '+i18n.t('clientsAlto')) : dias > 90 ? ('🟡 '+i18n.t('clientsMedio')) : ('🔵 '+i18n.t('clientsBajo'));
                  return `<tr>
                    <td style="font-weight:600;color:var(--color-text)">${sanitize(c.Nombre_Cliente) || c.Cliente_ID || i18n.t('clientsCliente')}</td>
                    <td><span class="chip">${sanitize(c.Canal_Adquisición) || '—'}</span></td>
                    <td class="number" style="color:var(--color-${nivel});font-weight:600">${dias}</td>
                    <td class="number">${c.Frecuencia_Compra || '—'}</td>
                    <td><span class="badge badge-${nivel}">${nivelLabel}</span></td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      ` : `<div class="empty-state"><div class="empty-state-icon">🎉</div><div class="empty-state-title">${i18n.t('clientsNoRisk')}</div></div>`}
    `;
  }

  // ── ADQUISICIÓN ───────────────────────────────────────────────
  function renderAcquisition(data, sym) {
    return `
      <div class="kpi-grid" style="grid-template-columns:repeat(auto-fit,minmax(175px,1fr));margin-bottom:20px;">
        ${miniKpi('🆕', i18n.t('clientsNuevos'), data.newClients.toLocaleString(), i18n.t('estePeriodo'))}
        ${miniKpi('💰', i18n.t('clientsCACEst'), data.cac !== null ? fmt(data.cac, sym) : '—', i18n.t('costoAdquisicion'))}
        ${miniKpi('💎', i18n.t('clientsLTVEst'), data.ltv !== null ? fmt(data.ltv, sym) : '—', i18n.t('clientsValorVida'))}
        ${miniKpi('📊', 'LTV/CAC ratio', data.ltvCacRatio !== null ? data.ltvCacRatio.toFixed(1)+'x' : '—', i18n.t('clientsLTVRatioMeta'))}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;" class="charts-row">
        <div class="chart-card">
          <div class="chart-card-header"><div class="chart-card-title">📡 ${i18n.t('clientsCanalDeAdq')}</div></div>
          <div class="chart-container" style="height:240px;"><canvas id="acqChannelChart"></canvas></div>
        </div>
        <div class="chart-card">
          <div class="chart-card-header"><div class="chart-card-title">📋 ${i18n.t('clientsDetallePorCanal')}</div></div>
          <div style="max-height:250px;overflow-y:auto;">
            <table class="table">
              <thead><tr><th>${i18n.getLang()==='es'?'Canal':'Channel'}</th><th class="number">${i18n.getLang()==='es'?'Clientes':'Clients'}</th><th class="number">%</th></tr></thead>
              <tbody>
                ${data.byAcquisitionChannel.map(c => `
                  <tr>
                    <td style="font-weight:500;color:var(--color-text)">${c.label}</td>
                    <td class="number">${c.value.toLocaleString()}</td>
                    <td class="number">
                      <div style="display:flex;align-items:center;gap:6px;justify-content:flex-end">
                        <div class="progress-bar-wrap" style="width:50px;"><div class="progress-bar-fill blue" style="width:${c.pct.toFixed(0)}%"></div></div>
                        <span style="font-size:.75rem;color:var(--color-text-faint)">${c.pct.toFixed(1)}%</span>
                      </div>
                    </td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // ── KPI CALC ─────────────────────────────────────────────────
  function calcClientKPIs(rows, goals) {
    if (!rows.length) return emptyClientKPIs();
    // Obtener deuda vencida por cliente desde módulo de cobranzas
    const overdueLookup = (typeof collectionsModule !== 'undefined' && collectionsModule.getOverdueByClient)
      ? collectionsModule.getOverdueByClient() : {};

    const total = rows.length;

    // Retención (activos = sin compra en ≤90 días)
    const active  = rows.filter(r => (parseFloat(r.Días_Sin_Compra) || 999) <= 90).length;
    const churned = rows.filter(r => (parseFloat(r.Días_Sin_Compra) || 0) > 120).length;
    const retRate = total > 0 ? (active / total) * 100 : null;
    const churnRate = total > 0 ? (churned / total) * 100 : null;

    // NPS
    const npsRows = rows.filter(r => r.NPS !== '' && r.NPS !== null && r.NPS !== undefined);
    let nps = null, promoters = 0, detractors = 0, passives = 0;
    if (npsRows.length) {
      promoters  = npsRows.filter(r => Number(r.NPS) >= 9).length;
      detractors = npsRows.filter(r => Number(r.NPS) <= 6).length;
      passives   = npsRows.filter(r => Number(r.NPS) === 7 || Number(r.NPS) === 8).length;
      nps = ((promoters - detractors) / npsRows.length) * 100;
    }

    // Clientes nuevos (sin compra hace menos de 30 días)
    const newClients = rows.filter(r => (parseFloat(r.Días_Sin_Compra) || 999) <= 30).length;

    // Frecuencia promedio
    const freqRows = rows.filter(r => r.Frecuencia_Compra > 0);
    const avgFrequency = freqRows.length
      ? freqRows.reduce((s, r) => s + (parseFloat(r.Frecuencia_Compra) || 0), 0) / freqRows.length : null;

    // ── CAC REAL — cruza con datos de marketing filtrados por mismo período ──
    const allMktRows = storage.getData('marketing');
    const activeF    = storage.getActiveFilters('clients');
    const mktRows    = allMktRows.filter(r => {
      const f = r.Fecha || '';
      if (activeF.dateFrom && f < activeF.dateFrom) return false;
      if (activeF.dateTo   && f > activeF.dateTo)   return false;
      return true;
    });
    const totalMktInv = mktRows.reduce((s,r)=>s+(parseFloat(r.Inversión)||0),0);
    const cacReal    = totalMktInv > 0 && newClients > 0
      ? Math.round(totalMktInv / newClients) : null;
    const ltv        = avgFrequency ? avgFrequency * 12 * 2 * 50000 : null;
    const cac        = cacReal;
    const ltvCacRatio= ltv && cac ? ltv / cac : (ltv ? ltv / 150000 : null);

    // ── TASA DE RECOMPRA ─────────────────────────────────────────
    const repeatBuyers   = rows.filter(r => (parseFloat(r.Frecuencia_Compra)||0) >= 2).length;
    const repurchaseRate = total > 0 ? (repeatBuyers / total) * 100 : null;
    const avgDaysBetween = avgFrequency && avgFrequency > 0
      ? Math.round(365 / avgFrequency) : null;

    // En riesgo (sin compra 60-180 días)
    const atRisk = rows.filter(r => {
      const d = parseFloat(r.Días_Sin_Compra) || 0;
      return d >= 60 && d <= 180;
    }).sort((a, b) => (parseFloat(b.Días_Sin_Compra) || 0) - (parseFloat(a.Días_Sin_Compra) || 0));

    // Segmentación RFM simplificada
    const rfmSegments = { champions:{count:0}, loyal:{count:0}, promising:{count:0}, atrisk:{count:0}, lost:{count:0}, new:{count:0} };
    rows.forEach(r => {
      const seg = getRFMSegmentForRow(r, overdueLookup);
      if (rfmSegments[seg]) rfmSegments[seg].count++;
    });
    Object.values(rfmSegments).forEach(s => { s.pct = total > 0 ? s.count/total*100 : 0; });

    const byAcqCh     = groupByCount(rows, 'Canal_Adquisición');
    const monthlyTrend = calcMonthly(rows);

    return {
      totalClients: total, newClients, active, churned,
      retentionRate: retRate, churnRate, churnedClients: churned,
      nps, promoters, detractors, passives,
      avgFrequency, ltv, cac, cacReal, ltvCacRatio,
      repurchaseRate, repeatBuyers, avgDaysBetween,
      atRiskClients: atRisk, rfmSegments,
      byAcquisitionChannel: byAcqCh, monthlyTrend,
    };
  }

  function emptyClientKPIs() {
    return { totalClients:0, newClients:0, active:0, churned:0, retentionRate:null,
      churnRate:null, churnedClients:0, nps:null, promoters:0, detractors:0, passives:0,
      avgFrequency:null, ltv:null, cac:null, ltvCacRatio:null,
      atRiskClients:[], rfmSegments:{champions:{count:0},loyal:{count:0},promising:{count:0},atrisk:{count:0},lost:{count:0},new:{count:0}},
      byAcquisitionChannel:[], monthlyTrend:[] };
  }

  function groupByCount(rows, field) {
    const g = {};
    rows.forEach(r => { const k = r[field] || i18n.t('sinDatos')||'—'; g[k] = (g[k]||0) + 1; });
    const total = Object.values(g).reduce((s,v)=>s+v,0);
    return Object.entries(g).map(([label,value]) => ({label,value,pct:total>0?value/total*100:0})).sort((a,b)=>b.value-a.value);
  }

  function calcMonthly(rows) {
    const months = {};
    rows.forEach(r => {
      const d = storage.parseDate(r.Fecha);
      if (!d) return;
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      months[key] = (months[key]||0) + 1;
    });
    return Object.entries(months).sort((a,b)=>a[0].localeCompare(b[0])).slice(-6).map(([key,count])=>({key,count}));
  }

  // ── CHARTS ───────────────────────────────────────────────────
  function renderCharts(data, sym) {
    const PALETTE = ['#3b82f6','#6366f1','#22c55e','#eab308','#ef4444','#a855f7'];
    const BASE = { responsive:true, maintainAspectRatio:false, animation:{duration:500},
      plugins:{ legend:{ labels:{color:'#94a3b8',font:{size:11},boxWidth:10,padding:12}},
        tooltip:{backgroundColor:'#1e293b',borderColor:'#334155',borderWidth:1,titleColor:'#94a3b8',bodyColor:'#f1f5f9',padding:8,cornerRadius:6}},
      scales:{ x:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#64748b',font:{size:11}},border:{display:false}},
               y:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#64748b',font:{size:11}},border:{display:false}}} };

    if (activeTab === 'overview') {
      mkChart('retentionChart', { type:'doughnut',
        data:{ labels:[i18n.t('clientsActivos'),i18n.t('clientsEnRiesgo'),i18n.t('clientsPerdidos')],
          datasets:[{ data:[data.active, data.atRiskClients.length, data.churnedClients],
            backgroundColor:['#22c55ecc','#eab308cc','#ef4444cc'],
            borderColor:['#22c55e','#eab308','#ef4444'], borderWidth:1.5, hoverOffset:5 }] },
        options:{...BASE, cutout:'65%', scales:{x:{display:false},y:{display:false}}} });

      mkChart('npsChart', { type:'bar',
        data:{ labels:[i18n.t('clientsDetractores'),i18n.t('clientsPasivos'),i18n.t('clientsPromotores')],
          datasets:[{ label:i18n.getLang()==='es'?'Clientes':'Clients', data:[data.detractors, data.passives, data.promoters],
            backgroundColor:['#ef4444cc','#eab308cc','#22c55ecc'],
            borderColor:['#ef4444','#eab308','#22c55e'], borderWidth:1.5, borderRadius:6 }] },
        options:{...BASE, plugins:{...BASE.plugins,legend:{display:false}},
          scales:{...BASE.scales,y:{...BASE.scales.y,ticks:{...BASE.scales.y.ticks,stepSize:1}}}} });

      if (data.monthlyTrend.length) {
        mkChart('clientsTrendChart', { type:'line',
          data:{ labels: data.monthlyTrend.map(m => charts.monthLabel(m.key)),
            datasets:[{ label:i18n.getLang()==='es'?'Clientes':'Clients', data: data.monthlyTrend.map(m=>m.count),
              borderColor:'#3b82f6', backgroundColor:'rgba(59,130,246,.08)',
              borderWidth:2.5, pointRadius:4, pointHoverRadius:6, tension:.4, fill:true }] },
          options:{...BASE} });
      }
    }

    if (activeTab === 'rfm') {
      const segs = data.rfmSegments;
      const labels = [
        i18n.t('rfmCampeonesName'), i18n.t('rfmLealesName'), i18n.t('rfmPrometedoresName'),
        i18n.t('rfmAtRiskName'), i18n.t('rfmLostName'), i18n.t('rfmNewName')
      ];
      const vals = [segs.champions.count,segs.loyal.count,segs.promising.count,segs.atrisk.count,segs.lost.count,segs.new.count];
      mkChart('rfmDonut', { type:'doughnut',
        data:{ labels, datasets:[{ data:vals,
          backgroundColor:PALETTE.map(c=>c+'cc'), borderColor:PALETTE, borderWidth:1.5, hoverOffset:5 }] },
        options:{...BASE, cutout:'60%', scales:{x:{display:false},y:{display:false}}} });
    }

    if (activeTab === 'acq') {
      const chs = data.byAcquisitionChannel.slice(0,6);
      mkChart('acqChannelChart', { type:'bar',
        data:{ labels: chs.map(c=>c.label),
          datasets:[{ label:i18n.getLang()==='es'?'Clientes':'Clients', data:chs.map(c=>c.value),
            backgroundColor:PALETTE.map(c=>c+'cc'), borderColor:PALETTE, borderWidth:1.5, borderRadius:6 }] },
        options:{...BASE, plugins:{...BASE.plugins,legend:{display:false}}} });
    }
  }

  function mkChart(id, config) {
    const el = document.getElementById(id);
    if (!el) return;
    if (window._ckCharts && window._ckCharts[id]) window._ckCharts[id].destroy();
    if (!window._ckCharts) window._ckCharts = {};
    window._ckCharts[id] = new Chart(el, config);
  }

  // ── COMPONENTS ───────────────────────────────────────────────
  function kpiCard(icon, label, value, status, sub, pct, pctStatus, hero) {
    const heroClass = hero ? ' kpi-hero' : '';
    const ghost     = hero ? ` data-ghost="${String(value).replace(/[^0-9.,KMB%x]/g,'').slice(0,5)}"` : '';
    return `<div class="kpi-card ${status}${heroClass}"${ghost}>
      <div class="kpi-card-header"><div class="kpi-card-icon">${icon}</div><div class="kpi-status-dot ${status}"></div></div>
      <div class="kpi-card-value">${value}</div>
      <div class="kpi-card-label">${label}</div>
      ${sub?`<div style="font-size:.72rem;color:var(--color-text-faint);margin-top:3px">${sub}</div>`:''}
      ${pct!==null&&pct!==undefined?`<div class="kpi-card-progress" style="margin-top:8px"><div class="progress-bar-wrap"><div class="progress-bar-fill ${pctStatus||status}" style="width:${Math.min(pct,100)}%"></div></div></div>`:''}
    </div>`;
  }
  function miniKpi(icon, label, value, sub) {
    return `<div class="card card-sm" style="text-align:center">
      <div style="font-size:1.2rem;margin-bottom:5px">${icon}</div>
      <div style="font-size:1.1rem;font-weight:800;font-family:var(--font-mono);color:var(--color-text)">${value}</div>
      <div style="font-size:.68rem;font-weight:600;color:var(--color-text-faint);text-transform:uppercase;letter-spacing:.05em;margin-top:2px">${label}</div>
      ${sub?`<div style="font-size:.68rem;color:var(--color-text-faint)">${sub}</div>`:''}
    </div>`;
  }

  function noData() {
    const hasSales = storage.getData('sales').length > 0;
    if (hasSales) {
      // Tiene ventas pero sin Cliente_ID — pedir enriquecimiento
      return `<div class="no-data-state"><div class="no-data-icon">👥</div>
        <h2 class="no-data-title">${i18n.getLang()==='es'?'Agrega Cliente_ID a tus ventas':'Add Cliente_ID to your sales data'}</h2>
        <p class="no-data-desc">${i18n.getLang()==='es'
          ? 'Tu Excel de ventas no tiene la columna <strong>Cliente_ID</strong>. Agrégala para activar la segmentación RFM automática y el análisis de retención.'
          : 'Your sales Excel does not have the <strong>Cliente_ID</strong> column. Add it to enable automatic RFM segmentation and retention analysis.'}</p>
        <button class="btn btn-secondary" onclick="excelProcessor.downloadTemplate('sales')">📥 ${i18n.getLang()==='es'?'Plantilla ventas':'Sales template'}</button>
      </div>`;
    }
    return `<div class="no-data-state"><div class="no-data-icon">👥</div>
      <h2 class="no-data-title">${i18n.t('errorNoData')}</h2>
      <p class="no-data-desc">${i18n.getLang()==='es'
        ? 'Sube tu Excel de ventas con la columna <strong>Cliente_ID</strong> para activar el análisis de clientes. El panel calculará automáticamente frecuencia, recencia y segmentos RFM.'
        : 'Upload your sales Excel with the <strong>Cliente_ID</strong> column to activate client analysis. The panel will automatically calculate frequency, recency, and RFM segments.'}</p>
      <button class="btn btn-primary" onclick="showModal('uploadModal')">📂 ${i18n.t('uploadData')}</button></div>`;
  }

  function pct(v) { return v !== null && v !== undefined ? v.toFixed(1)+'%' : '—'; }
  function fmt(n, sym='$') {
    if (!n) return `${sym}—`;
    if (n>=1000000) return `${sym}${(n/1000000).toFixed(1)}M`;
    if (n>=1000) return `${sym}${(n/1000).toFixed(0)}K`;
    return `${sym}${Math.round(n).toLocaleString()}`;
  }

  function setTab(tab) {
    activeTab = tab;
    if (window._ckCharts) { Object.values(window._ckCharts).forEach(c=>c&&c.destroy()); window._ckCharts={}; }
    render(document.getElementById('contentArea'));
  }


  // ── EXPORT RFM ───────────────────────────────────────────────
  function getRFMSegmentForRow(r, overdueLookup) {
    const dias = parseFloat(r.Días_Sin_Compra) || 999;
    const freq = parseFloat(r.Frecuencia_Compra)   || 0;
    let seg;
    if (dias <= 30  && freq >= 6) seg = 'champions';
    else if (dias <= 60  && freq >= 3) seg = 'loyal';
    else if (dias <= 60  && freq <  3) seg = 'promising';
    else if (dias >  60  && dias <= 120) seg = 'atrisk';
    else if (dias <= 30)               seg = 'new';
    else seg = 'lost';
    // Penalización por deuda vencida >60 días (si toggle activo)
    const cfg = storage.getConfig();
    if (cfg.rfmPenaltyEnabled !== false && overdueLookup) {
      const ov = overdueLookup[r.Cliente_ID];
      if (ov && ov.maxDias > 60) {
        const penalty = { champions:'loyal', loyal:'atrisk', promising:'atrisk', new:'atrisk' };
        seg = penalty[seg] || seg;
      }
    }
    return seg;
  }

  function exportRFMSegment(segmentKey, anonymize) {
    const rows = storage.applyFilters(storage.getData('clients'), 'clients');
    if (!rows.length) { showToast('\u274c ' + i18n.t('rfmExportEmpty'), 'red'); return; }

    const segConfig = {
      champions: i18n.t('rfmCampeonesName'),
      loyal:     i18n.t('rfmLealesName'),
      promising: i18n.t('rfmPrometedoresName'),
      atrisk:    i18n.t('rfmAtRiskName'),
      lost:      i18n.t('rfmLostName'),
      new:       i18n.t('rfmNewName'),
    };

    // Filtrar por segmento (o todos si segmentKey === 'all')
    const filtered = segmentKey === 'all'
      ? rows
      : rows.filter(r => getRFMSegmentForRow(r, overdueLookup) === segmentKey);

    if (!filtered.length) { showToast('\u26a0\ufe0f ' + i18n.t('rfmExportEmpty'), 'yellow'); return; }

    // Construir filas del Excel
    const sheetData = filtered.map((r, idx) => ({
      [i18n.t('rfmExportColID')]:       r.Cliente_ID || ('C' + String(idx+1).padStart(4,'0')),
      [i18n.t('rfmExportColNombre')]:   anonymize ? ('C' + String(idx+1).padStart(4,'0')) : (r.Nombre_Cliente || r.Cliente_ID || '—'),
      [i18n.t('rfmExportColSegmento')]: segConfig[getRFMSegmentForRow(r, overdueLookup)] || '—',
      [i18n.t('rfmExportColDias')]:     parseFloat(r.D\u00edas_Sin_Compra) || 0,
      [i18n.t('rfmExportColFreq')]:     parseFloat(r.Frecuencia_Compra)   || 0,
      [i18n.t('rfmExportColNPS')]:      r.NPS !== undefined && r.NPS !== '' ? Number(r.NPS) : '',
      [i18n.t('rfmExportColCanal')]:    r.Canal_Adquisici\u00f3n || '—',
    }));

    // Crear workbook con SheetJS
    const wb  = XLSX.utils.book_new();
    const ws  = XLSX.utils.json_to_sheet(sheetData);

    // Ancho de columnas
    ws['!cols'] = [
      { wch:14 }, { wch:24 }, { wch:18 }, { wch:18 }, { wch:20 }, { wch:8 }, { wch:22 }
    ];

    const segLabel = segmentKey === 'all' ? i18n.t('rfmExportAll') : (segConfig[segmentKey] || segmentKey);
    XLSX.utils.book_append_sheet(wb, ws, segLabel.slice(0,31)); // Excel max 31 chars

    const filename = `ZhorasOne_RFM_${segmentKey}_${new Date().toISOString().slice(0,10)}.xlsx`;
    XLSX.writeFile(wb, filename);
    showToast('\u2705 ' + i18n.t('rfmExportDone'), 'green');
  }

  return { render, setTab, exportRFMSegment };
})();
window.clientsModule = clientsModule;
