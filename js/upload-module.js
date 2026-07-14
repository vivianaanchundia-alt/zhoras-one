// ════════════════════════════════════════════════════════════════
// CLAROKPIS — upload-module.js
// ════════════════════════════════════════════════════════════════

// ── MANEJO DE ARCHIVOS ────────────────────────────────────────────
async function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  await processExcelFile(file);
}

async function processExcelFile(file) {
  showUploadStatus(i18n.t('uploadProcessing'));

  const result = await excelProcessor.prepareFile(file);

  if (!result.success) {
    showToast('❌ ' + result.error, 'red');
    hideUploadStatus();
    return;
  }

  app.pendingUpload = result;
  showUploadConfirmation(result);
}

function showUploadStatus(msg) {
  document.getElementById('uploadStatus')?.classList.remove('hidden');
  const el = document.getElementById('uploadStatusText');
  if (el) el.textContent = msg;
  document.getElementById('uploadConfirmation')?.classList.add('hidden');
  document.getElementById('uploadSuccess')?.classList.add('hidden');
}

function hideUploadStatus() {
  document.getElementById('uploadStatus')?.classList.add('hidden');
}

function showUploadConfirmation(result) {
  hideUploadStatus();
  document.getElementById('uploadConfirmation')?.classList.remove('hidden');

  const fileName  = document.getElementById('confFileName');
  const fileStats = document.getElementById('confFileStats');
  const modSel    = document.getElementById('confModule');
  const list      = document.getElementById('confMappingList');

  if (fileName)  fileName.textContent = result.fileName;
  if (fileStats) fileStats.textContent =
    `${result.validRows.toLocaleString()} ${i18n.t('uploadRecords')} · ${result.duplicatesRemoved} ${i18n.t('uploadDuplicates')}` +
    (result.dateRange ? ` · ${storage.formatDate(result.dateRange.from)} – ${storage.formatDate(result.dateRange.to)}` : '');

  if (modSel) modSel.value = result.detectedModule;

  // ── BANNER DE CONFIANZA DE DETECCIÓN ────────────────────────
  // Evita que el usuario acepte a ciegas un módulo mal detectado.
  const isES = i18n.getLang() === 'es';
  const banner = document.getElementById('confDetectionBanner');
  if (banner) {
    const conf = result.detectionConfidence || 'none';
    const modName = (modSel && modSel.selectedOptions[0]?.textContent) || result.detectedModule;
    const cfg = {
      high:   { bg:'--color-green-bg', bd:'--color-green-border', fg:'--color-green',
                es:`✅ Módulo detectado con alta confianza: <strong>${modName}</strong>. Verifica igualmente antes de guardar.`,
                en:`✅ Module detected with high confidence: <strong>${modName}</strong>. Please verify before saving.` },
      medium: { bg:'--color-yellow-bg', bd:'--color-yellow-border', fg:'--color-yellow',
                es:`🟡 Módulo detectado: <strong>${modName}</strong>, pero con pocas señales. <strong>Confirma que sea correcto.</strong>`,
                en:`🟡 Module detected: <strong>${modName}</strong>, but with few signals. <strong>Confirm it's correct.</strong>` },
      low:    { bg:'--color-yellow-bg', bd:'--color-yellow-border', fg:'--color-yellow',
                es:`⚠️ Detección ambigua — varios módulos coinciden. Elegimos <strong>${modName}</strong>. <strong>Revisa el selector de Módulo con cuidado.</strong>`,
                en:`⚠️ Ambiguous detection — several modules match. We chose <strong>${modName}</strong>. <strong>Review the Module selector carefully.</strong>` },
      none:   { bg:'--color-red-bg', bd:'--color-red-border', fg:'--color-red',
                es:`❌ No pudimos reconocer el tipo de datos. Pusimos <strong>${modName}</strong> por defecto. <strong>Selecciona el módulo correcto manualmente</strong> antes de guardar.`,
                en:`❌ We couldn't recognize the data type. We defaulted to <strong>${modName}</strong>. <strong>Select the correct module manually</strong> before saving.` },
    }[conf];
    banner.innerHTML = `
      <div style="padding:10px 14px;background:var(${cfg.bg});border:1px solid var(${cfg.bd});border-radius:10px;font-size:.78rem;color:var(${cfg.fg});">
        ${isES ? cfg.es : cfg.en}
      </div>`;
    banner.style.display = 'block';

    // Si el usuario corrige el módulo a mano, el banner pasa a estado "manual".
    if (modSel && !modSel._bannerHooked) {
      modSel._bannerHooked = true;
      modSel.addEventListener('change', () => {
        const nm = modSel.selectedOptions[0]?.textContent || modSel.value;
        banner.innerHTML = `
          <div style="padding:10px 14px;background:var(--color-blue-bg);border:1px solid var(--color-blue-border);border-radius:10px;font-size:.78rem;color:var(--color-blue);">
            ${isES ? `✏️ Módulo seleccionado manualmente: <strong>${nm}</strong>.` : `✏️ Module selected manually: <strong>${nm}</strong>.`}
          </div>`;
      });
    }
  }

  if (list) {
    const canonicalKeys = Object.keys(excelProcessor.COLUMN_MAPS);
    const unmapped = new Set(result.unmappedColumns || []);
    list.innerHTML = Object.entries(result.mapping).map(([orig, canonical]) => {
      const isUnmapped = unmapped.has(orig);
      // Columna no reconocida: marca visual + el <select> arranca en "sin asignar"
      const tag = isUnmapped
        ? `<span style="font-size:.68rem;color:var(--color-yellow);font-weight:700;margin-left:6px;">${isES ? '⚠ sin reconocer' : '⚠ unrecognized'}</span>`
        : '';
      const options = [
        ...(isUnmapped ? [] : [`<option value="${canonical}">${canonical}</option>`]),
        ...canonicalKeys.filter(k => k !== canonical)
          .map(k => `<option value="${k}">${k}</option>`),
        `<option value="${orig}"${isUnmapped ? ' selected' : ''}>${orig} (${i18n.t('uploadSinCambio')})</option>`,
      ].join('');
      return `
      <div class="mapping-row"${isUnmapped ? ' style="background:var(--color-yellow-bg);border-radius:6px;"' : ''}>
        <div class="mapping-excel-col" title="${orig}">${orig}${tag}</div>
        <span class="mapping-arrow">→</span>
        <select class="filter-select mapping-select" data-original="${orig}">
          ${options}
        </select>
      </div>`;
    }).join('');
  }

  // ── WARNINGS DE COHERENCIA ──────────────────────────────────
  const warningsEl = document.getElementById('confWarnings');
  if (warningsEl) {
    if (result.warnings && result.warnings.length > 0) {
      const isES = i18n.getLang() === 'es';
      warningsEl.innerHTML = `
        <div style="margin-top:12px;padding:10px 14px;background:var(--color-yellow-bg);border:1px solid var(--color-yellow-border);border-radius:10px;">
          <div style="font-size:.78rem;font-weight:700;color:var(--color-yellow);margin-bottom:6px;">
            ⚠️ ${isES ? 'Advertencias detectadas — revisa antes de confirmar' : 'Warnings detected — review before confirming'}
          </div>
          ${result.warnings.map(w => `
            <div style="font-size:.75rem;color:var(--color-text-muted);padding:3px 0;border-top:1px solid var(--color-yellow-border);">
              ${isES ? w.message_es : w.message_en}
            </div>`).join('')}
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;padding-top:10px;border-top:1px solid var(--color-yellow-border);">
            <button type="button" class="btn btn-sm btn-secondary" onclick="cancelUpload()">
              ↩️ ${isES ? 'Corregir y volver a subir' : 'Fix and re-upload'}
            </button>
            <span style="font-size:.72rem;color:var(--color-text-faint);align-self:center;">
              ${isES ? 'o revisa los datos y confirma abajo si son correctos.' : 'or review the data and confirm below if it\'s correct.'}
            </span>
          </div>
        </div>`;
      warningsEl.style.display = 'block';
    } else {
      warningsEl.style.display = 'none';
    }
  }
}

function confirmUpload() {
  if (!app.pendingUpload) return;

  const module = document.getElementById('confModule')?.value;
  if (!module) { showToast('❌ ' + i18n.t('uploadSelectModule'), 'red'); return; }

  const confirmedMapping = {};
  document.querySelectorAll('.mapping-select').forEach(sel => {
    confirmedMapping[sel.dataset.original] = sel.value;
  });

  // ── VALIDAR COLUMNAS REQUERIDAS DEL MÓDULO ELEGIDO ──────────
  // Bloqueo suave: si falta una columna clave, el panel quedaría vacío.
  // Advertimos y pedimos confirmación explícita en vez de guardar en silencio.
  const req = (excelProcessor.REQUIRED_COLUMNS || {})[module] || [];
  const mappedCanon = new Set(Object.values(confirmedMapping));
  const missing = req.filter(c => !mappedCanon.has(c));
  if (missing.length > 0) {
    const isES = i18n.getLang() === 'es';
    const msg = isES
      ? `Faltan columnas requeridas para este módulo: ${missing.join(', ')}.\n\nEl panel podría quedar sin datos. ¿Guardar de todas formas?`
      : `Missing required columns for this module: ${missing.join(', ')}.\n\nThe panel may end up empty. Save anyway?`;
    if (!confirm(msg)) return;
  }

  const { fileId, rows } = excelProcessor.saveProcessed(app.pendingUpload, module, confirmedMapping);

  document.getElementById('uploadConfirmation')?.classList.add('hidden');
  document.getElementById('uploadSuccess')?.classList.remove('hidden');

  const successText   = document.getElementById('uploadSuccessText');
  const successDetail = document.getElementById('uploadSuccessDetail');
  const savedMsg = i18n.t('uploadSavedMsg').replace('{n}', rows.toLocaleString());
  if (successText)   successText.textContent   = '✅ ' + savedMsg;
  if (successDetail) successDetail.textContent =
    `${i18n.t('uploadModuloLabel')}: ${module} · ${i18n.t('uploadArchivoLabel')}: ${app.pendingUpload.fileName}`;

  app.pendingUpload = null;

  if (typeof generateAutoAlerts === 'function') generateAutoAlerts();

  buildSidebarNav();
  renderCurrentModule();
  showToast('✅ ' + savedMsg, 'green');
}

function cancelUpload() {
  app.pendingUpload = null;
  resetUploadZone();
}

function resetUploadZone() {
  document.getElementById('uploadConfirmation')?.classList.add('hidden');
  document.getElementById('uploadSuccess')?.classList.add('hidden');
  document.getElementById('uploadStatus')?.classList.add('hidden');
  const fi = document.getElementById('fileInput');
  if (fi) fi.value = '';
}

function switchUploadTab(tab) {
  document.getElementById('panelUpload')?.classList.toggle('hidden', tab !== 'upload');
  document.getElementById('panelFiles')?.classList.toggle('hidden',  tab !== 'files');
  document.getElementById('tabUpload')?.classList.toggle('active',   tab === 'upload');
  document.getElementById('tabFiles')?.classList.toggle('active',    tab === 'files');
  if (tab === 'files') renderFileList();
}

// ── LISTADO DE ARCHIVOS ───────────────────────────────────────────
function renderFileList() {
  const files     = storage.getFiles();
  const container = document.getElementById('fileListContainer');
  if (!container) return;

  if (!files.length) {
    container.innerHTML = `
      <div style="text-align:center;padding:24px;color:var(--color-text-faint);">
        <div style="font-size:2rem;margin-bottom:8px">📂</div>
        <div style="font-size:.85rem">${i18n.t('uploadNoFiles')}</div>
      </div>`;
    return;
  }

  container.innerHTML = files.map(f => `
    <div class="file-item" style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:var(--color-bg);border:1px solid var(--color-border);border-radius:8px;margin-bottom:8px;">
      <span style="font-size:1.2rem">📊</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:.82rem;font-weight:600;color:var(--color-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${f.name}</div>
        <div style="font-size:.7rem;color:var(--color-text-muted);margin-top:2px">
          ${f.module||'—'} · ${(f.rows||0).toLocaleString()} ${i18n.t('uploadRegistrosLabel')}
          ${f.dateRange ? ` · ${storage.formatDate(f.dateRange.from)} – ${storage.formatDate(f.dateRange.to)}` : ''}
        </div>
      </div>
      <div style="font-size:.7rem;color:var(--color-text-faint);">
        ${storage.formatDate(f.uploadedAt, 'medium')}
      </div>
      ${!auth.isDemo() ? `
        <button onclick="deleteFile('${f.id}')"
          style="color:var(--color-text-faint);padding:4px 8px;border-radius:4px;border:none;background:none;cursor:pointer;font-size:.8rem;"
          onmouseover="this.style.color='var(--color-red)'" onmouseout="this.style.color='var(--color-text-faint)'"
          title="${i18n.t('uploadDelTitle')}">🗑️</button>` : ''}
    </div>`).join('');
}

function deleteFile(fileId) {
  if (auth.isDemo()) { showToast('🔒 ' + i18n.t('uploadNoDemo'), 'yellow'); return; }
  if (!confirm(i18n.t('uploadDelConfirm'))) return;

  app.pendingDeleteId = fileId;
  storage.removeFile(fileId).then(() => {
    app.pendingDeleteId = null;
    renderFileList();
    buildSidebarNav();
    renderCurrentModule();
    showToast('🗑️ ' + i18n.t('uploadDeleted'), 'yellow');
  }).catch(e => {
    app.pendingDeleteId = null;
    showToast('❌ ' + i18n.t('uploadDelError') + ': ' + e.message, 'red');
  });
}

// ── DRAG & DROP ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const zone = document.getElementById('uploadZone');
  if (!zone) return;
  zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', ()=> zone.classList.remove('drag-over'));
  zone.addEventListener('drop', async e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) await processExcelFile(file);
  });
});

// ── PLANTILLAS ────────────────────────────────────────────────────
function downloadTemplate(module) {
  if (typeof excelProcessor?.downloadTemplate === 'function') {
    excelProcessor.downloadTemplate(module);
  } else {
    showToast('⏳ ' + i18n.t('uploadLoadingMsg'), 'blue');
  }
}
