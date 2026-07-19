// ClaroKPIs — cx-module.js
// Módulo CX Satisfacción

// ════════════════════════════════════════════════════════════════
const cxModule = (() => {
  let _activeTab = 'metrics'; // tab por defecto

  // ── CATEGORÍAS DE INSATISFACCIÓN (predefinidas + custom en LS) ─
  const DEFAULT_CATEGORIES = [
    { key:'demora_entrega',       label:'Demora en entrega' },
    { key:'producto_defectuoso',  label:'Producto defectuoso' },
    { key:'mala_postventa',       label:'Mala post-venta' },
    { key:'atencion_lenta',       label:'Atención lenta' },
    { key:'info_incorrecta',      label:'Información incorrecta' },
    { key:'precio_no_coincide',   label:'Precio no coincide' },
    { key:'compra_dificil',       label:'Proceso de compra difícil' },
    { key:'sin_stock',            label:'Producto sin stock' },
    { key:'mala_comunicacion',    label:'Mala comunicación' },
    { key:'problema_devolucion',  label:'Problema con devolución' },
    { key:'falta_seguimiento',    label:'Falta de seguimiento' },
    { key:'mal_trato',            label:'Mal trato' },
    { key:'cobro_incorrecto',     label:'Cobro incorrecto' },
    { key:'bajo_expectativas',    label:'Producto bajo expectativas' },
    { key:'otro',                 label:'Otro motivo' },
  ];

  // ── ALIAS — normaliza etiquetas del Excel a keys internas ──────
  const LABEL_ALIASES = {
    'postventa':'mala_postventa','post-venta':'mala_postventa',
    'devolucion':'problema_devolucion','devolución':'problema_devolucion',
    'proceso_devolucion':'problema_devolucion',
    'precio_elevado':'precio_no_coincide','precio elevado':'precio_no_coincide',
    'demora':'demora_entrega','retraso':'demora_entrega',
    'defecto':'producto_defectuoso',
    'trato':'mal_trato',
    'seguimiento':'falta_seguimiento',
    'stock':'sin_stock',
  };

  const LS_KEY  = 'cx_categories';  // storage.lsSet/Get añade prefijo clarokpis_
  const LS_TAGS = 'cx_tags';

  function getCategories() {
    try {
      const custom = storage.lsGet(LS_KEY) || [];
      return [...DEFAULT_CATEGORIES, ...custom];
    } catch { return [...DEFAULT_CATEGORIES]; }
  }

  function saveCustomCategory(label) {
    const key = label.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'');
    try {
      const custom = storage.lsGet(LS_KEY) || [];
      if (!custom.find(c=>c.key===key) && !DEFAULT_CATEGORIES.find(c=>c.key===key)) {
        custom.push({ key, label });
        storage.lsSet(LS_KEY, custom);
      }
      return key;
    } catch { return key; }
  }

  function deleteCustomCategory(key) {
    try {
      const custom = storage.lsGet(LS_KEY) || [];
      storage.lsSet(LS_KEY, custom.filter(c=>c.key!==key));
    } catch {}
  }

  // Manual tags: stored as { "fileId_rowIdx": ["key1","key2","key3"] }
  function getAllTags() {
    try { return storage.lsGet(LS_TAGS) || {}; } catch { return {}; }
  }

  function getTagsForRow(rowId) {
    return getAllTags()[rowId] || [];
  }

  function setTagForRow(rowId, slotIndex, categoryKey) {
    const all = getAllTags();
    if (!all[rowId]) all[rowId] = [];
    all[rowId][slotIndex] = categoryKey;
    // Remove empty slots at end
    while (all[rowId].length && !all[rowId][all[rowId].length-1]) all[rowId].pop();
    if (!all[rowId].length) delete all[rowId];
    storage.lsSet(LS_TAGS, all);
  }

  // Resolve tags: merge Excel columns + manual tags
  function resolveRowTags(row, rowId, categories) {
    // Start with manual tags
    const manual = getTagsForRow(rowId);
    // Also read from Excel columns Etiqueta / Etiqueta_2 / Etiqueta_3
    const excelRaw = [row.Etiqueta, row.Etiqueta_2, row.Etiqueta_3]
      .filter(v => v && String(v).trim());

    // Normalize excel labels to keys
    const excelKeys = excelRaw.map(v => {
      const norm = String(v).trim().toLowerCase().replace(/\s+/g,'_');
      return LABEL_ALIASES[norm] || LABEL_ALIASES[v.trim()] ||
        (categories.find(c=>c.key===norm||c.label.toLowerCase()===v.trim().toLowerCase())?.key) ||
        norm;
    });

    // Merge: manual overrides excel; deduplicate
    const merged = [...new Set([...manual.filter(Boolean), ...excelKeys])].slice(0,3);
    return merged;
  }

  // ── RENDER PRINCIPAL ──────────────────────────────────────────
  // Debounce para el buscador de comentarios
  if (!window._cxSearchDebounced) {
    window._cxSearchDebounced = debounce(() => cxModule.setTab('comments'), 250);
  }

  function render(container) {
    // Siempre resetear al navegar desde el sidebar
    _activeTab = 'metrics';
    window._cxCommentFilter = 'all';
    window._cxCommentSearch = '';
    _render(container);
  }

  function _render(container) {
    const rows    = storage.applyFilters(storage.getData('cx'),          'cx');
    const goals   = storage.getGoals();
    const data    = calcCXKPIs(rows, goals);
    const hasData = rows.length > 0;

    container.innerHTML = `
      <div class="module-header">
        <div class="module-title-wrap">
          <h1 class="module-title">😊 ${i18n.t('cxTitle')}</h1>
          <p class="module-subtitle">${rows.length.toLocaleString()} ${i18n.t('registros')||'registros'}${(() => {
              const _dr = storage.getDataDateRange('cx');
              return _dr ? ' · ' + (i18n.getLang()==='es' ? 'Datos: ' : 'Data: ') + _dr.label : '';
            })()}</p>
        </div>
        <button class="btn btn-sm btn-secondary" onclick="showModal('uploadModal')">📂 ${i18n.t('uploadData')}</button>
      </div>

      ${renderGlobalFilters('cx', { showSeller: false, showChannel: true })}
      <div class="tabs" id="cxTabs">
        <div class="tab-item ${_activeTab==='metrics'  ?'active':''}" onclick="cxModule.setTab('metrics')">${i18n.getLang()==='es'?'📊 Métricas CX':'📊 CX Metrics'}</div>
        <div class="tab-item ${_activeTab==='comments' ?'active':''}" onclick="cxModule.setTab('comments')">${i18n.getLang()==='es'?'💬 Análisis de comentarios':'💬 Comment analysis'}</div>
        <div class="tab-item ${_activeTab==='pareto'   ?'active':''}" onclick="cxModule.setTab('pareto')">${i18n.getLang()==='es'?'📉 Pareto insatisfacción':'📉 Dissatisfaction Pareto'}</div>
      </div>

      ${!hasData ? noData() : renderTab(rows, data, goals)}
    `;

    // Etiquetado de comentarios por listener delegado, no onchange/onclick
    // inline con datos interpolados (rowId incluye Cliente_ID, que viene
    // del Excel del usuario). Registrado UNA vez por contenedor.
    if (!container._cxClickBound) {
      container._cxClickBound = true;
      container.addEventListener('change', (e) => {
        const sel = e.target.closest('.cx-tag-select');
        if (sel) cxModule.setTag(sel.dataset.rowId, Number(sel.dataset.slot), sel.value);
      });
      container.addEventListener('click', (e) => {
        const clearBtn = e.target.closest('.cx-clear-tags');
        if (clearBtn) { cxModule.clearTags(clearBtn.dataset.rowId); return; }
        const delCat = e.target.closest('.cx-del-cat');
        if (delCat) cxModule.deleteCategory(delCat.dataset.catKey);
      });
    }

    if (hasData) {
      if (_activeTab === 'metrics') setTimeout(() => renderCharts(data), 50);
      if (_activeTab === 'pareto')  setTimeout(() => renderParetoChart(rows), 50);
    }
  }

  function renderTab(rows, data, goals) {
    if (_activeTab === 'metrics')  return renderMetrics(data, goals);
    if (_activeTab === 'comments') return renderComments(rows);
    if (_activeTab === 'pareto')   return renderPareto(rows);
    return '';
  }

  function setTab(tab) {
    _activeTab = tab;
    if (window._ckCharts) { Object.values(window._ckCharts).forEach(c=>c&&c.destroy()); window._ckCharts={}; }
    _render(document.getElementById('contentArea'));
  }

  // ── TAB 1: MÉTRICAS ───────────────────────────────────────────
  function renderMetrics(data, goals) {
    const npsStatus  = storage.getStatus(data.nps,  goals.nps || 50);
    const csatStatus = storage.getStatus(data.csat, goals.csat || 80);
    const fcrStatus  = storage.getStatus(data.fcr,  goals.resolution_rate || 90);
    const ttrStatus  = storage.getStatus(data.ttr,  goals.response_time_hrs || 4, true);
    const cxScoreVals = [data.nps!==null?(data.nps+100)/2:null, data.csat, data.fcr].filter(v=>v!==null);
    const cxScoreAvg  = cxScoreVals.length ? cxScoreVals.reduce((s,v)=>s+v,0)/cxScoreVals.length : null;

    return `
      <div class="kpi-grid" style="grid-template-columns:repeat(auto-fit,minmax(175px,1fr));margin-bottom:20px;">
        ${kpiCard('⭐','NPS',  data.nps!==null?Math.round(data.nps).toString():'—', npsStatus,  `${data.promoters} promotores · ${data.detractors} detractores`, null, null)}
        ${kpiCard('😊','CSAT', pct(data.csat),  csatStatus, `Meta: ${goals.csat||80}%`, data.csat, csatStatus)}
        ${kpiCard('✅','FCR',  pct(data.fcr),   fcrStatus,  i18n.t('cxResolucion1er'), data.fcr, fcrStatus)}
        ${kpiCard('⏱️','TTR',  data.ttr!==null?data.ttr.toFixed(1)+' hrs':'—', ttrStatus, `Meta: <${goals.response_time_hrs||4} hrs`, null, null)}
        ${kpiCard('📊','CX Score', cxScoreAvg!==null?Math.round(cxScoreAvg).toString():'—', cxScoreAvg!==null&&cxScoreAvg>=75?'green':cxScoreAvg!==null&&cxScoreAvg>=55?'yellow':'red', i18n.t('cxIndiceCompuesto'), cxScoreAvg, cxScoreAvg!==null&&cxScoreAvg>=75?'green':cxScoreAvg!==null&&cxScoreAvg>=55?'yellow':'red')}
        ${kpiCard('📈',(i18n.getLang()==='es'?'Escalación':'Escalation'), pct(data.escalationRate), data.escalationRate!==null&&data.escalationRate<10?'green':data.escalationRate!==null&&data.escalationRate<20?'yellow':'red', i18n.t('cxCasosEscalados'), null, null)}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;" class="charts-row">
        <div class="chart-card">
          <div class="chart-card-header">
            <div class="chart-card-title">${i18n.t('cxDistNPS')}</div>
            <span class="badge ${npsStatus!=='na'?'badge-'+npsStatus:'badge-blue'}">NPS: ${data.nps!==null?Math.round(data.nps):'—'}</span>
          </div>
          <div class="chart-container" style="height:220px;"><canvas id="cxNpsChart"></canvas></div>
        </div>
        <div class="chart-card">
          <div class="chart-card-header"><div class="chart-card-title">${i18n.t('cxMetricasVsMeta')}</div></div>
          <div class="chart-container" style="height:220px;"><canvas id="cxRadarChart"></canvas></div>
        </div>
      </div>
      ${data.correlationNote ? `
        <div class="alert alert-blue" style="margin-bottom:16px;">
          <span class="alert-icon">💡</span>
          <div class="alert-body">
            <div class="alert-title">Correlación CX → Ventas</div>
            <div class="alert-message">${data.correlationNote}</div>
          </div>
        </div>` : ''}
    `;
  }

  // ── TAB 2: ANÁLISIS DE COMENTARIOS ────────────────────────────
  function renderComments(rows) {
    const categories = getCategories();
    const isDemo = auth.isDemo();

    // Filter options
    const filterVal = window._cxCommentFilter || 'all';
    const searchVal = window._cxCommentSearch || '';

    const filtered = rows.filter(r => {
      const score = Number(r.NPS_Score);
      if (filterVal === 'detractors' && score > 6) return false;
      if (filterVal === 'passives'   && (score < 7 || score > 8)) return false;
      if (filterVal === 'promoters'  && score < 9) return false;
      if (filterVal === 'tagged') {
        const rowId = _rowId(r, rows.indexOf(r));
        const tags = resolveRowTags(r, rowId, categories);
        if (!tags.length) return false;
      }
      if (filterVal === 'untagged') {
        const rowId = _rowId(r, rows.indexOf(r));
        const tags = resolveRowTags(r, rowId, categories);
        if (tags.length) return false;
      }
      if (filterVal.startsWith('tag:')) {
        const tagKey = filterVal.slice(4);
        const rowId = _rowId(r, rows.indexOf(r));
        const tags = resolveRowTags(r, rowId, categories);
        if (!tags.includes(tagKey)) return false;
      }
      if (searchVal && !String(r.Comentario||'').toLowerCase().includes(searchVal.toLowerCase())) return false;
      return r.Comentario && String(r.Comentario).trim();
    });

    const withComments = rows.filter(r => r.Comentario && String(r.Comentario).trim()).length;
    const allTagged = filtered.filter(r => {
      const idx = rows.indexOf(r);
      return resolveRowTags(r, _rowId(r, idx), categories).length > 0;
    }).length;

    return `
      <div style="margin-bottom:16px;">
        <!-- Encabezado info -->
        <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:12px;">
          <div style="font-size:.82rem;color:var(--color-text-muted);">
            <strong style="color:var(--color-text)">${withComments}</strong> ${i18n.t('cxWithComments')} ·
            <strong style="color:var(--color-green)">${allTagged}</strong> ${i18n.t('cxCategorized')}
          </div>
          <div style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
            <!-- Búsqueda -->
            <input type="text" placeholder="🔍 Buscar en comentarios…"
              value="${searchVal}"
              oninput="window._cxCommentSearch=this.value;window._cxSearchDebounced&&window._cxSearchDebounced()"
              style="padding:5px 10px;background:var(--color-bg);border:1px solid var(--color-border);border-radius:6px;color:var(--color-text);font-size:.78rem;width:200px;" />
            <!-- Filtro por tipo -->
            <select onchange="window._cxCommentFilter=this.value;cxModule.setTab('comments')"
              style="padding:5px 10px;background:var(--color-bg);border:1px solid var(--color-border);border-radius:6px;color:var(--color-text);font-size:.78rem;">
              <option value="all"        ${filterVal==='all'       ?'selected':''}>${i18n.getLang()==='es'?'Todos los comentarios':'All comments'}</option>
              <option value="detractors" ${filterVal==='detractors'?'selected':''}>${i18n.getLang()==='es'?'Solo detractores (NPS 0-6)':'Detractors only (NPS 0-6)'}</option>
              <option value="passives"   ${filterVal==='passives'  ?'selected':''}>${i18n.getLang()==='es'?'Solo pasivos (NPS 7-8)':'Passives only (NPS 7-8)'}</option>
              <option value="promoters"  ${filterVal==='promoters' ?'selected':''}>${i18n.getLang()==='es'?'Solo promotores (NPS 9-10)':'Promoters only (NPS 9-10)'}</option>
              <option value="untagged"   ${filterVal==='untagged'  ?'selected':''}>${i18n.getLang()==='es'?'Sin categorizar':'Uncategorized'}</option>
              <option value="tagged"     ${filterVal==='tagged'    ?'selected':''}>${i18n.getLang()==='es'?'Ya categorizados':'Categorized'}</option>
              ${categories.map(cat => `<option value="tag:${sanitizeAttr(cat.key)}" ${filterVal==='tag:'+cat.key?'selected':''}>${i18n.getLang()==='es'?'Tag:':'Tag:'} ${sanitize(cat.label)}</option>`).join('')}
            </select>
          </div>
        </div>

        <!-- Gestión de categorías -->
        <details style="margin-bottom:12px;">
          <summary style="cursor:pointer;font-size:.8rem;font-weight:700;color:var(--color-blue);padding:6px 0;list-style:none;display:flex;align-items:center;gap:6px;">
            🏷️ ${i18n.t('cxManageCategories')} (${categories.length}) <span style="font-size:.7rem;color:var(--color-text-faint);margin-left:4px;">▼</span>
          </summary>
          <div style="background:var(--color-bg);border:1px solid var(--color-border);border-radius:8px;padding:12px;margin-top:8px;">
            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;">
              ${categories.map(c => {
                const isDefault = DEFAULT_CATEGORIES.find(d=>d.key===c.key);
                return `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 9px;background:rgba(59,130,246,.12);border:1px solid rgba(59,130,246,.25);border-radius:20px;font-size:.73rem;color:var(--color-blue);">
                  ${c.label}
                  ${!isDefault && !isDemo ? `<span class="cx-del-cat" data-cat-key="${sanitizeAttr(c.key)}" style="cursor:pointer;color:var(--color-text-faint);font-size:.9rem;line-height:1;margin-left:2px;" title="Eliminar">×</span>` : ''}
                </span>`;
              }).join('')}
            </div>
            ${!isDemo ? `
            <div style="display:flex;gap:8px;">
              <input type="text" id="newCategoryInput" placeholder="${i18n.t('cxNuevaCategoria')}"
                style="padding:5px 10px;background:var(--color-bg-card);border:1px solid var(--color-border);border-radius:6px;color:var(--color-text);font-size:.78rem;flex:1;"
                onkeydown="if(event.key==='Enter')cxModule.addCategory()" />
              <button class="btn btn-sm btn-secondary" onclick="cxModule.addCategory()">+ Agregar</button>
            </div>` : `<p style="font-size:.73rem;color:var(--color-text-faint);">${i18n.t('cxDemoNoEdit')}</p>`}
          </div>
        </details>

        <!-- Tabla de comentarios -->
        <div style="font-size:.78rem;color:var(--color-text-faint);margin-bottom:8px;">${filtered.length} ${i18n.t('cxCommentsShown')}</div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${filtered.length === 0
            ? `<div style="text-align:center;padding:32px;color:var(--color-text-faint);font-size:.85rem;">Sin comentarios para el filtro seleccionado.</div>`
            : filtered.map((r, fi) => {
                const globalIdx = rows.indexOf(r);
                const rowId = _rowId(r, globalIdx);
                const tags  = resolveRowTags(r, rowId, categories);
                const score = Number(r.NPS_Score);
                const scoreColor = score<=6?'var(--color-red)':score<=8?'var(--color-yellow)':'var(--color-green)';
                const scoreBg    = score<=6?'rgba(239,68,68,.1)':score<=8?'rgba(234,179,8,.1)':'rgba(34,197,94,.1)';
                const scoreBorder= score<=6?'rgba(239,68,68,.3)':score<=8?'rgba(234,179,8,.3)':'rgba(34,197,94,.3)';
                const typeLabel  = score<=6?'Detractor':score<=8?'Pasivo':'Promotor';

                return `
                <div style="background:var(--color-bg-card);border:1px solid var(--color-border);border-radius:8px;padding:12px 14px;"
                     id="cx-row-${sanitizeAttr(rowId)}">
                  <div style="display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap;">
                    <!-- Score badge -->
                    <div style="text-align:center;flex-shrink:0;min-width:52px;">
                      <div style="font-size:1.2rem;font-weight:800;font-family:var(--font-mono);color:${scoreColor};background:${scoreBg};border:1px solid ${scoreBorder};border-radius:8px;padding:4px 8px;line-height:1.2;">${score}</div>
                      <div style="font-size:.65rem;color:${scoreColor};font-weight:600;margin-top:2px;">${typeLabel}</div>
                    </div>
                    <!-- Comentario + meta -->
                    <div style="flex:1;min-width:200px;">
                      <div style="font-size:.83rem;color:var(--color-text);line-height:1.5;margin-bottom:6px;">"${sanitize(r.Comentario)}"</div>
                      <div style="font-size:.7rem;color:var(--color-text-faint);">
                        ${storage.formatDate(r.Fecha,'medium')} · ${sanitize(normalizeChannel(r.Canal_Venta))||'—'} · ${sanitize(r.Sucursal)||'—'}
                        ${r.CSAT_Score?` · CSAT: ${r.CSAT_Score}`:''}
                      </div>
                    </div>
                    <!-- Categorización -->
                    <div style="display:flex;flex-direction:column;gap:5px;min-width:180px;">
                      ${[0,1,2].map(slot => {
                        const currentKey = tags[slot] || '';
                        return `
                        <select class="cx-tag-select" data-row-id="${sanitizeAttr(rowId)}" data-slot="${slot}"
                          style="padding:4px 8px;background:var(--color-bg);border:1px solid ${currentKey?'var(--color-blue)':'var(--color-border)'};border-radius:6px;color:${currentKey?'var(--color-blue)':'var(--color-text-faint)'};font-size:.73rem;width:100%;"
                          ${isDemo?'disabled':''}>
                          <option value="">— ${slot===0?i18n.t('cxCategoriaPrincipal'):slot===1?(i18n.getLang()==='es'?'Categoría 2':'Category 2'):(i18n.getLang()==='es'?'Categoría 3':'Category 3')} —</option>
                          ${categories.map(c=>`<option value="${sanitizeAttr(c.key)}" ${currentKey===c.key?'selected':''}>${sanitize(c.label)}</option>`).join('')}
                        </select>`;
                      }).join('')}
                      ${!isDemo && tags.length ? `<button class="cx-clear-tags" data-row-id="${sanitizeAttr(rowId)}" style="font-size:.68rem;color:var(--color-text-faint);background:none;border:none;cursor:pointer;text-align:left;padding:0;">✕ Limpiar</button>` : ''}
                    </div>
                  </div>
                </div>`;
              }).join('')}
        </div>
      </div>
    `;
  }

  // ── TAB 3: PARETO INSATISFACCIÓN ──────────────────────────────
  function renderPareto(rows) {
    const categories = getCategories();
    const tagCounts  = _buildTagCounts(rows, categories);

    if (!tagCounts.length) {
      return `
        <div class="no-data-state" style="padding:40px;">
          <div class="no-data-icon">📉</div>
          <h2 style="font-size:1rem;color:var(--color-text);">Sin categorías asignadas aún</h2>
          <p style="font-size:.83rem;color:var(--color-text-muted);max-width:420px;text-align:center;">
            Ve a la pestaña <strong>Análisis de comentarios</strong> y categoriza las respuestas, o sube tu Excel con la columna <code>Etiqueta</code> ya completada.
          </p>
          <button class="btn btn-secondary btn-sm" style="margin-top:12px;" onclick="cxModule.setTab('comments')">💬 Ir a comentarios →</button>
        </div>`;
    }

    const total   = tagCounts.reduce((s,t)=>s+t.count,0);
    // Nota: cada comentario puede tener hasta 3 tags → el total de menciones puede ser > nº de filas
    let cumPct    = 0;

    // Pareto 80/20 cutoff
    const paretoIdx = (() => {
      let acc=0;
      for(let i=0;i<tagCounts.length;i++){
        acc+=tagCounts[i].count/total*100;
        if(acc>=80) return i;
      }
      return tagCounts.length-1;
    })();

    return `
      <div>
        <!-- Insight card -->
        <div style="background:rgba(59,130,246,.07);border:1px solid rgba(59,130,246,.2);border-radius:10px;padding:12px 16px;margin-bottom:16px;display:flex;gap:12px;align-items:flex-start;">
          <span style="font-size:1.3rem;">📌</span>
          <div>
            <div style="font-size:.85rem;font-weight:700;color:var(--color-text);margin-bottom:3px;">${i18n.getLang()==='es'?'Ley de Pareto aplicada a la insatisfacción':'Pareto Law applied to dissatisfaction'}</div>
            <div style="font-size:.78rem;color:var(--color-text-muted);">
              ${i18n.getLang()==='es'?'Nota: cada comentario puede tener hasta 3 categorías — las menciones pueden superar el nº de comentarios.':'Note: each comment can have up to 3 categories — mentions may exceed the number of comments.'} |
              <button class="btn btn-ghost btn-sm" style="font-size:.7rem;padding:2px 6px;" onclick="cxModule.setTab('comments')">${i18n.getLang()==='es'?'Ver en comentarios →':'View in comments →'}</button>
            </div>
            <div style="font-size:.78rem;color:var(--color-text-muted);">
              ${i18n.getLang()==='es'?'Las primeras':'The first'} <strong style="color:var(--color-blue)">${paretoIdx+1} ${i18n.getLang()==='es'?'causas':'causes'}</strong> ${i18n.getLang()==='es'?'representan el 80% de todas las insatisfacciones':'represent 80% of all dissatisfaction cases'}
              (${tagCounts.slice(0,paretoIdx+1).reduce((s,t)=>s+t.count,0)} ${i18n.getLang()==='es'?'de':'of'} ${total} ${i18n.getLang()==='es'?'menciones':'mentions'}).
              ${i18n.getLang()==='es'?'Resolviendo estas causas se elimina el 80% del problema.':'Resolving these causes eliminates 80% of the problem.'}
            </div>
          </div>
        </div>

        <!-- Gráfico Pareto -->
        <div class="chart-card" style="margin-bottom:16px;">
          <div class="chart-card-header">
            <div class="chart-card-title">📉 ${i18n.getLang()==='es'?'Pareto de insatisfacciones — frecuencia y % acumulado':'Dissatisfaction Pareto — frequency and cumulative %'}</div>
          </div>
          <div class="chart-container" style="height:300px;"><canvas id="cxParetoChart"></canvas></div>
        </div>

        <!-- Tabla detallada -->
        <div class="chart-card">
          <div class="chart-card-header"><div class="chart-card-title">📋 ${i18n.getLang()==='es'?'Tabla de categorías por frecuencia':'Category frequency table'}</div></div>
          <table style="width:100%;border-collapse:collapse;font-size:.8rem;">
            <thead>
              <tr style="border-bottom:1px solid var(--color-border);">
                <th style="text-align:left;padding:8px 10px;color:var(--color-text-faint);font-weight:600;">#</th>
                <th style="text-align:left;padding:8px 10px;color:var(--color-text-faint);font-weight:600;">${i18n.getLang()==='es'?'Categoría':'Category'}</th>
                <th style="text-align:right;padding:8px 10px;color:var(--color-text-faint);font-weight:600;">${i18n.getLang()==='es'?'Menciones':'Mentions'}</th>
                <th style="text-align:right;padding:8px 10px;color:var(--color-text-faint);font-weight:600;">${i18n.getLang()==='es'?'% del total':'% of total'}</th>
                <th style="text-align:right;padding:8px 10px;color:var(--color-text-faint);font-weight:600;">${i18n.getLang()==='es'?'% acumulado':'Cumulative %'}</th>
                <th style="padding:8px 10px;"></th>
              </tr>
            </thead>
            <tbody>
              ${tagCounts.map((t, i) => {
                cumPct += (t.count/total*100);
                const isPareto = i <= paretoIdx;
                return `
                  <tr style="border-bottom:1px solid var(--color-border);background:${isPareto?'rgba(239,68,68,.04)':'transparent'}">
                    <td style="padding:8px 10px;color:var(--color-text-faint);">${i+1}</td>
                    <td style="padding:8px 10px;">
                      <span style="color:var(--color-text);font-weight:${isPareto?'700':'400'};">${t.label}</span>
                      ${isPareto?`<span style="margin-left:6px;font-size:.65rem;padding:1px 6px;background:rgba(239,68,68,.15);color:var(--color-red);border-radius:10px;">TOP 80%</span>`:''}
                    </td>
                    <td style="text-align:right;padding:8px 10px;font-family:var(--font-mono);font-weight:700;color:${isPareto?'var(--color-red)':'var(--color-text)'};">${t.count}</td>
                    <td style="text-align:right;padding:8px 10px;color:var(--color-text-muted);">${(t.count/total*100).toFixed(1)}%</td>
                    <td style="text-align:right;padding:8px 10px;color:${cumPct<=80?'var(--color-red)':'var(--color-text-faint)'};">${cumPct.toFixed(1)}%</td>
                    <td style="padding:8px 10px;">
                      <div style="background:var(--color-border);border-radius:3px;height:6px;width:100px;">
                        <div style="background:${isPareto?'var(--color-red)':'var(--color-blue)'};height:100%;border-radius:3px;width:${Math.round(t.count/tagCounts[0].count*100)}%;"></div>
                      </div>
                    </td>
                  </tr>`;
              }).join('')}
            </tbody>
            <tfoot>
              <tr style="border-top:2px solid var(--color-border);">
                <td colspan="2" style="padding:8px 10px;font-weight:700;color:var(--color-text);">Total menciones</td>
                <td style="text-align:right;padding:8px 10px;font-weight:700;font-family:var(--font-mono);">${total}</td>
                <td colspan="3"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    `;
  }

  // ── HELPERS: build tag counts from all rows ───────────────────
  function _rowId(row, idx) {
    return `${row.Cliente_ID||''}_${row.Fecha||''}_${idx}`;
  }

  function _buildTagCounts(rows, categories) {
    const counts = {};
    rows.forEach((r, idx) => {
      const rowId = _rowId(r, idx);
      const tags  = resolveRowTags(r, rowId, categories);
      tags.forEach(key => {
        if (!key) return;
        counts[key] = (counts[key]||0) + 1;
      });
    });
    return Object.entries(counts)
      .map(([key, count]) => ({
        key,
        label: categories.find(c=>c.key===key)?.label || key,
        count,
      }))
      .sort((a,b) => b.count - a.count);
  }

  // ── ACCIONES PÚBLICAS (llamadas desde HTML) ───────────────────
  function setTag(rowId, slotIndex, categoryKey) {
    setTagForRow(rowId, slotIndex, categoryKey);
    // Update UI locally without full re-render
    const selects = document.querySelectorAll(`#cx-row-${CSS.escape(rowId)} select`);
    selects.forEach((sel, i) => {
      if (i === slotIndex) {
        sel.style.borderColor = categoryKey ? 'var(--color-blue)' : 'var(--color-border)';
        sel.style.color = categoryKey ? 'var(--color-blue)' : 'var(--color-text-faint)';
      }
    });
  }

  function clearTags(rowId) {
    const all = getAllTags();
    delete all[rowId];
    storage.lsSet(LS_TAGS, all);
    cxModule.setTab('comments');
  }

  function addCategory() {
    const input = document.getElementById('newCategoryInput');
    if (!input || !input.value.trim()) return;
    saveCustomCategory(input.value.trim());
    cxModule.setTab('comments');
  }

  function deleteCategory(key) {
    deleteCustomCategory(key);
    cxModule.setTab('comments');
  }

  // ── CHART RENDERERS ───────────────────────────────────────────
  function renderCharts(data) {
    const BASE={responsive:true,maintainAspectRatio:false,animation:{duration:500},plugins:{legend:{labels:{color:'#94a3b8',font:{size:11},boxWidth:10,padding:12}},tooltip:{backgroundColor:'#1e293b',borderColor:'#334155',borderWidth:1,titleColor:'#94a3b8',bodyColor:'#f1f5f9',padding:8,cornerRadius:6}},scales:{x:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#64748b',font:{size:11}},border:{display:false}},y:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#64748b',font:{size:11}},border:{display:false}}}};
    mkChart('cxNpsChart',{type:'bar',data:{labels:[i18n.t('clientsDetractores'),i18n.t('clientsPasivos'),i18n.t('clientsPromotores')],datasets:[{label:'Respuestas',data:[data.detractors,data.passives,data.promoters],backgroundColor:['rgba(239,68,68,.7)','rgba(234,179,8,.7)','rgba(34,197,94,.7)'],borderColor:['#ef4444','#eab308','#22c55e'],borderWidth:1.5,borderRadius:6}]},options:{...BASE,plugins:{...BASE.plugins,legend:{display:false}}}});
    const goals=storage.getGoals();
    mkChart('cxRadarChart',{type:'radar',data:{labels:['NPS','CSAT','FCR','TTR (inv)',i18n.t('cxSinEscalacion')],datasets:[
      {label:'Actual',data:[data.nps!==null?Math.min((data.nps+100)/2,100):0,data.csat||0,data.fcr||0,data.ttr!==null?Math.max(0,100-(data.ttr/(goals.response_time_hrs||4)*100)):0,data.escalationRate!==null?100-data.escalationRate:0],borderColor:'#3b82f6',backgroundColor:'rgba(59,130,246,.12)',borderWidth:2,pointBackgroundColor:'#3b82f6'},
      {label:'Meta',data:[Math.min(((goals.nps||50)+100)/2,100),goals.csat||80,goals.resolution_rate||90,80,90],borderColor:'rgba(234,179,8,.5)',backgroundColor:'rgba(234,179,8,.06)',borderWidth:1.5,borderDash:[4,3],pointBackgroundColor:'#eab308'},
    ]},options:{...BASE,scales:{r:{grid:{color:'rgba(255,255,255,.08)'},ticks:{display:false},pointLabels:{color:'#94a3b8',font:{size:11}},angleLines:{color:'rgba(255,255,255,.08)'}}}}});
  }

  function renderParetoChart(rows) {
    const categories = getCategories();
    const tagCounts  = _buildTagCounts(rows, categories);
    if (!tagCounts.length) return;

    const total  = tagCounts.reduce((s,t)=>s+t.count,0);
    const labels = tagCounts.map(t => t.label.length>20 ? t.label.slice(0,18)+'…' : t.label);
    const bars   = tagCounts.map(t => t.count);
    let acc=0;
    const cumLine = tagCounts.map(t => { acc+=t.count/total*100; return Math.round(acc*10)/10; });

    mkChart('cxParetoChart', {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            type: 'bar',
            label: i18n.getLang()==='es'?'Menciones':'Mentions',
            data: bars,
            backgroundColor: tagCounts.map((_,i)=>i<=tagCounts.findIndex((_,j)=>{let a=0;for(let k=0;k<=j;k++)a+=tagCounts[k].count/total*100;return a>=80;})?'rgba(239,68,68,.75)':'rgba(59,130,246,.5)'),
            borderColor:     tagCounts.map((_,i)=>i<=tagCounts.findIndex((_,j)=>{let a=0;for(let k=0;k<=j;k++)a+=tagCounts[k].count/total*100;return a>=80;})?'#ef4444':'#3b82f6'),
            borderWidth: 1.5, borderRadius: 4, order: 2,
            yAxisID: 'y',
          },
          {
            type: 'line',
            label: i18n.getLang()==='es'?'% acumulado':'Cumulative %',
            data: cumLine,
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245,158,11,.1)',
            borderWidth: 2.5,
            pointBackgroundColor: '#f59e0b',
            pointRadius: 4,
            tension: 0.3,
            order: 1,
            yAxisID: 'y2',
          },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: { duration: 500 },
        plugins: {
          legend: { labels: { color:'#94a3b8', font:{ size:11 }, boxWidth:12 } },
          tooltip: { backgroundColor:'#1e293b', borderColor:'#334155', borderWidth:1, titleColor:'#94a3b8', bodyColor:'#f1f5f9' },
          annotation: {
            annotations: {
              line80: { type:'line', yMin:80, yMax:80, yScaleID:'y2', borderColor:'rgba(245,158,11,.4)', borderWidth:1, borderDash:[4,4] }
            }
          }
        },
        scales: {
          x:  { grid:{color:'rgba(255,255,255,.04)'}, ticks:{color:'#64748b',font:{size:10},maxRotation:35} },
          y:  { position:'left',  grid:{color:'rgba(255,255,255,.04)'}, ticks:{color:'#64748b',font:{size:11}}, title:{display:true,text:i18n.getLang()==='es'?'Menciones':'Mentions',color:'#64748b',font:{size:10}} },
          y2: { position:'right', grid:{display:false}, ticks:{color:'#f59e0b',font:{size:11},callback:v=>v+'%'}, max:100, title:{display:true,text:i18n.getLang()==='es'?'% acumulado':'Cumulative %',color:'#f59e0b',font:{size:10}} },
        },
      },
    });
  }

  // ── CÁLCULOS KPIs ─────────────────────────────────────────────
  function calcCXKPIs(rows, goals) {
    if (!rows.length) return { nps:null,csat:null,fcr:null,ttr:null,escalationRate:null,promoters:0,detractors:0,passives:0,correlationNote:null };
    const npsRows  = rows.filter(r=>r.NPS_Score!==''&&r.NPS_Score!=null);
    const csatRows = rows.filter(r=>r.CSAT_Score!==''&&r.CSAT_Score!=null);
    const fcrRows  = rows.filter(r=>r.FCR!==''&&r.FCR!=null);
    const ttrRows  = rows.filter(r=>r.TTR_Hrs>0);
    const escRows  = rows.filter(r=>r.Escalo===true||r.Escalo==='true'||r.Escalo==='1'||Number(r.Escalo)===1);

    let nps=null,promoters=0,detractors=0,passives=0;
    if(npsRows.length){
      promoters  = npsRows.filter(r=>Number(r.NPS_Score)>=9).length;
      detractors = npsRows.filter(r=>Number(r.NPS_Score)<=6).length;
      passives   = npsRows.filter(r=>Number(r.NPS_Score)===7||Number(r.NPS_Score)===8).length;
      nps = ((promoters-detractors)/npsRows.length)*100;
    }
    const csat    = csatRows.length ? csatRows.reduce((s,r)=>s+(parseFloat(r.CSAT_Score)||0),0)/csatRows.length : null;
    const fcrTrue = fcrRows.filter(r=>r.FCR===true||r.FCR==='true'||r.FCR==='1'||Number(r.FCR)===1).length;
    const fcr     = fcrRows.length ? (fcrTrue/fcrRows.length)*100 : null;
    const ttr     = ttrRows.length ? ttrRows.reduce((s,r)=>s+(parseFloat(r.TTR_Hrs)||0),0)/ttrRows.length : null;
    const escalationRate = rows.length>0 ? (escRows.length/rows.length)*100 : null;
    const correlationNote = nps!==null&&nps>50
      ? 'NPS alto (>50) correlaciona con mayor retención y LTV. Los promotores generan hasta 3x más referencias.'
      : nps!==null&&nps<0
        ? 'NPS negativo: acción urgente. Clientes detractores impactan directamente las ventas por boca a boca negativo.'
        : null;
    return { nps, promoters, detractors, passives, csat, fcr, ttr, escalationRate, correlationNote };
  }

  // ── UTILS LOCALES ─────────────────────────────────────────────
  function mkChart(id,config){const el=document.getElementById(id);if(!el)return;if(window._ckCharts&&window._ckCharts[id])window._ckCharts[id].destroy();if(!window._ckCharts)window._ckCharts={};window._ckCharts[id]=new Chart(el,config);}
  function kpiCard(icon,label,value,status,sub,p,ps){return`<div class="kpi-card ${status}"><div class="kpi-card-header"><div class="kpi-card-icon">${icon}</div><div class="kpi-status-dot ${status}"></div></div><div class="kpi-card-value">${value}</div><div class="kpi-card-label">${label}</div>${sub?`<div style="font-size:.72rem;color:var(--color-text-faint);margin-top:3px">${sub}</div>`:''}${p!==null&&p!==undefined?`<div class="kpi-card-progress" style="margin-top:8px"><div class="progress-bar-wrap"><div class="progress-bar-fill ${ps||status}" style="width:${Math.min(p,100)}%"></div></div></div>`:''}</div>`;}
  function pct(v){return v!==null&&v!==undefined?v.toFixed(1)+'%':'—';}
  function noData(){return`<div class="no-data-state"><div class="no-data-icon">😊</div><h2 class="no-data-title">${i18n.t('errorNoData')}</h2><p class="no-data-desc">Sube un Excel de CX con columnas: NPS_Score, CSAT_Score, FCR, TTR_Hrs, Escalo, Comentario</p><button class="btn btn-primary" onclick="showModal('uploadModal')">📂 ${i18n.t('uploadData')}</button></div>`;}

  return { render, setTab, setTag, clearTags, addCategory, deleteCategory };
})();


// ════════════════════════════════════════════════════════════════
// MÓDULO EQUIPO
window.cxModule         = cxModule;
