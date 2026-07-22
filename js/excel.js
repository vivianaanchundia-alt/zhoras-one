// ════════════════════════════════════════════════════════════════
// CLAROKPIS — excel.js v2.0
// Extiende excel.js existente con:
// - Columnas PVP, Precio_Facturado (descuentos/margen)
// - Módulo Proveedores completo
// - Plantillas Excel descargables por módulo
// - Etiquetas CX múltiples
// Todo lo anterior se mantiene intacto
// ════════════════════════════════════════════════════════════════

const excelProcessor = (() => {

  // ── MAPAS DE COLUMNAS (base existente + nuevas) ──────────────
  const COLUMN_MAPS = {
    // Comunes
    Fecha:               ['fecha','date','dia','day','periodo','period','fecha_venta','sale_date','transaction_date'],
    Sucursal:            ['sucursal','branch','tienda','store','local','sede','location','office'],
    País:                ['pais','país','country','region'],
    Ciudad:              ['ciudad','city','town','localidad'],
    Canal_Venta:         ['canal_venta','canal','channel','canal_de_venta','sales_channel','medio','medium'],
    Vendedor:            ['vendedor','seller','agente','agent','ejecutivo','rep','sales_rep','asesor','advisor'],
    Cliente_ID:          ['cliente_id','client_id','customer_id','id_cliente','cod_cliente','rut','documento'],
    Nombre_Cliente:      ['nombre_cliente','nombre','client_name','customer_name','cliente','name'],

    // Ventas
    Producto:            ['producto','product','item','articulo','artículo','sku','bien'],
    Categoría:           ['categoria','categoría','category','tipo_producto','product_type','línea','linea','line'],
    Ventas_Monto:        ['ventas_monto','monto','amount','ventas','sales','ingresos','revenue','total','valor','value','importe'],
    Ventas_Unidades:     ['ventas_unidades','unidades','units','cantidad','qty','quantity','piezas','items_sold'],
    Meta_Ventas:         ['meta_ventas','meta','goal','target','objetivo','presupuesto','budget','cuota','quota'],
    N_Transacciones:     ['n_transacciones','transacciones','transactions','operaciones','pedidos','orders','n_ventas'],
    Leads:               ['leads','lead','prospectos','prospects','contactos','contacts','consultas','inquiries'],
    Dias_Cierre:         ['dias_cierre','dias_para_cerrar','days_to_close','ciclo_venta','sales_cycle','tiempo_cierre'],
    // NUEVO — descuentos y margen
    PVP:                 ['pvp','precio_lista','precio_publico','list_price','precio_venta_publico','precio_referencia','precio_base','base_price','msrp'],
    Precio_Facturado:    ['precio_facturado','precio_real','precio_cobrado','invoice_price','actual_price','precio_vendido','precio_final','sale_price'],

    // Clientes
    Tipo:                ['tipo','type','segmento','segment','categoria_cliente','customer_type'],
    Canal_Adquisición:   ['canal_adquisicion','canal_adquisición','acquisition_channel','fuente','source','origen','origin'],
    NPS:                 ['nps','nps_score','net_promoter','promoter_score'],
    Días_Sin_Compra:     ['dias_sin_compra','days_since_purchase','inactividad','inactivity','ultimo_contacto','last_contact'],
    Frecuencia_Compra:   ['frecuencia_compra','frecuencia','frequency','purchase_frequency','recurrencia','recurrence'],

    // Atención
    Caso_ID:             ['caso_id','caso','ticket','case_id','ticket_id','solicitud','request_id'],
    Tiempo_Respuesta_Hrs:['tiempo_respuesta_hrs','tiempo_respuesta','response_time','hrs_respuesta','response_hours','ttr','tiempo_atencion'],
    Resuelto_1er_Contacto:['resuelto_1er_contacto','fcr','first_contact_resolution','primer_contacto','resuelto_primer','resolved_first'],
    CSAT:                ['csat','satisfaccion','satisfaction','calificacion','rating','puntuacion','score_satisfaccion'],
    Escaló:              ['escalo','escaló','escalated','escalar','escalation'],
    Motivo:              ['motivo','reason','causa','cause','tipo_reclamo','complaint_type','asunto','subject'],

    // Inventario
    Stock_Inicial:       ['stock_inicial','stock','inventario','inventory','existencias','existencia','quantity_on_hand'],
    Compras_Unidades:    ['compras_unidades','compras','purchases','entrada','entradas','received'],
    Devoluciones:        ['devoluciones','devolucion','devolución','returns','return','devuelto'],
    Costo_Unitario:      ['costo_unitario','costo','cost','precio_costo','unit_cost','cost_price'],

    // Marketing
    Campaña:             ['campaña','campaign','nombre_campaña','campaign_name','accion','acción','promo'],
    Canal_Marketing:     ['canal_marketing','canal_mkt','marketing_channel','medio_marketing','platform','plataforma'],
    Inversión:           ['inversion','inversión','investment','gasto','spend','presupuesto_marketing','pauta'],
    Ventas_Campaña:      ['ventas_campaña','ventas_campaign','campaign_sales','ventas_por_campaña','sales_from_campaign'],
    Monto_Ventas:        ['monto_ventas','revenue','ingresos_campaña','campaign_revenue'],
    Fecha_Inicio_Campaña:['fecha_inicio_campaña','fecha_inicio','start_date','inicio_campaña'],
    Fecha_Fin_Campaña:   ['fecha_fin_campaña','fecha_fin','end_date','fin_campaña'],

    // Finanzas
    Concepto:            ['concepto','concept','descripcion','descripción','description','detalle','detail'],
    Tipo_Movimiento:     ['tipo','type','movimiento','movement','tipo_movimiento'],
    Monto:               ['monto','amount','valor','value','importe'],
    Forma_Pago:          ['forma_pago','payment_method','metodo_pago','medio_pago','payment_type'],
    Es_Real:             ['es_real','real','actual','realizado','executed','confirmed'],
    Ingresos:            ['ingresos','income','revenue','entradas','cobros','sales_income'],
    Costos:              ['costos','costo','cost','cogs','costo_ventas'],
    Gastos_Operacionales:['gastos_operacionales','gastos','expenses','opex','overhead','operating_expenses'],
    Cuentas_Por_Cobrar:  ['cuentas_por_cobrar','cxc','receivables','accounts_receivable','deudores'],

    // Equipo
    Meta_Mes:            ['meta_mes','meta_mensual','monthly_goal','target_month','quota_mes','presupuesto_mes'],
    Dias_Trabajados:     ['dias_trabajados','days_worked','jornadas','workdays'],
    Dias_Ausentes:       ['dias_ausentes','dias_ausentismo','absences','absent_days','ausentismo','absenteeism'],
    Dotacion:            ['dotacion','dotación','headcount','plantilla','staff','empleados','employees'],

    // CX
    NPS_Score:           ['nps_score','nps','net_promoter_score'],
    CSAT_Score:          ['csat_score','csat','customer_satisfaction'],
    CES_Score:           ['ces_score','ces','customer_effort_score'],
    TTR_Hrs:             ['ttr_hrs','ttr','time_to_resolution','tiempo_resolucion','resolution_time'],
    FCR:                 ['fcr','first_contact_resolution','resolucion_primer_contacto'],
    Escalo:              ['escalo','escalated','escalation','escalar'],
    Perdido_Post_Reclamo:['perdido_post_reclamo','churn_post_complaint','abandono_reclamo','lost_after_complaint'],
    Motivo_Reclamo:      ['motivo_reclamo','complaint_reason','razon_reclamo','complaint_type'],
    Comentario:          ['comentario','comment','texto','text','observacion','observación','feedback'],
    // NUEVO — etiquetas múltiples CX
    Etiqueta:            ['etiqueta','tag','label','categoria_cx','cx_tag','etiqueta_1','tag_1'],
    Etiqueta_2:          ['etiqueta_2','tag_2','label_2','second_tag'],
    Etiqueta_3:          ['etiqueta_3','tag_3','label_3','third_tag'],

    // NUEVO — Proveedores
    Proveedor_ID:        ['proveedor_id','supplier_id','id_proveedor','cod_proveedor','vendor_id'],
    Proveedor_Nombre:    ['proveedor_nombre','proveedor','supplier','vendor','nombre_proveedor','supplier_name'],
    Cantidad_Comprada:   ['cantidad_comprada','cantidad','quantity','qty_purchased','units_purchased','unidades_compradas'],
    Costo_Total:         ['costo_total','total_cost','importe_compra','purchase_amount','monto_compra'],
    Lead_Time_Días:      ['lead_time_dias','lead_time','dias_entrega','delivery_days','tiempo_entrega','lead_time_days'],
    Fecha_Entrega_Esperada:['fecha_entrega_esperada','expected_delivery','fecha_esperada','promised_date'],
    Fecha_Entrega_Real:  ['fecha_entrega_real','actual_delivery','fecha_real','delivery_date','fecha_recepcion'],
    OC_ID:               ['oc_id','orden_compra','purchase_order','po_number','po_id','orden'],
    Sucursal_Destino:    ['sucursal_destino','destino','destination','warehouse','bodega'],
    País_Origen:         ['pais_origen','país_origen','country_of_origin','origin_country','procedencia'],
    // Documentos contables (notas de crédito, anulaciones, devoluciones)
    Tipo_Documento:      ['tipo_documento','tipo_doc','tipo_comprobante','tipo_registro','document_type','doc_type','tipo','type'],
    N_Documento:         ['n_documento','nro_documento','num_documento','folio','numero_factura','numero_boleta','invoice_number','doc_number','receipt_number'],
    Estado:              ['estado','status','estado_pago','payment_status','estado_factura'],
    Monto_Pendiente:     ['monto_pendiente','saldo','saldo_pendiente','balance','outstanding','deuda','pending_amount'],
    Dias_Vencida:        ['dias_vencida','dias_mora','dias_atraso','overdue_days','days_overdue','mora'],
    Tramo:               ['tramo','aging_band','rango_dias','band','aging'],
    Monto_Factura:       ['monto_factura','monto_original','valor_factura','invoice_amount','original_amount'],
    Factura_ID:          ['factura_id','id_factura','nro_factura','numero_factura','invoice_id','folio_factura','folio'],
    Fecha_Vencimiento:   ['fecha_vencimiento','vencimiento','due_date','fecha_venc','fecha_limite','fecha_vto'],
  };

  // Firmas de módulos (columnas clave para detección automática)
  const MODULE_SIGNATURES = {
    sales:     ['Ventas_Monto','Meta_Ventas','Vendedor','N_Transacciones','Leads','PVP'],
    clients:   ['Cliente_ID','NPS','Días_Sin_Compra','Frecuencia_Compra','Canal_Adquisición'],
    support:   ['Caso_ID','Tiempo_Respuesta_Hrs','Resuelto_1er_Contacto','CSAT','Escaló'],
    inventory: ['Stock_Inicial','Compras_Unidades','Devoluciones','Costo_Unitario'],
    marketing: ['Campaña','Canal_Marketing','Inversión','Ventas_Campaña'],
    finance:   ['Concepto','Ingresos','Costos','Gastos_Operacionales','Cuentas_Por_Cobrar'],
    team:      ['Meta_Mes','Dias_Trabajados','Dias_Ausentes','Dotacion'],
    cx:        ['NPS_Score','CSAT_Score','CES_Score','TTR_Hrs','FCR'],
    suppliers: ['Proveedor_Nombre','OC_ID','Lead_Time_Días','Cantidad_Comprada','Costo_Total'],
    collections: ['Monto_Pendiente','Monto_Factura','Dias_Vencida','Tramo','Fecha_Vencimiento','Factura_ID'],
  };

  // Columnas numéricas por módulo
  const NUMERIC_FIELDS = {
    sales:     ['Ventas_Monto','Ventas_Unidades','Meta_Ventas','N_Transacciones','Leads','Dias_Cierre','PVP','Precio_Facturado'],
    clients:   ['NPS','Días_Sin_Compra','Frecuencia_Compra'],
    support:   ['Tiempo_Respuesta_Hrs','CSAT'],
    inventory: ['Stock_Inicial','Compras_Unidades','Ventas_Unidades','Devoluciones','Costo_Unitario'],
    marketing: ['Inversión','Leads','Ventas_Campaña','Monto_Ventas'],
    finance:   ['Monto','Ingresos','Costos','Gastos_Operacionales','Cuentas_Por_Cobrar'],
    team:      ['Ventas_Monto','Meta_Mes','Dias_Trabajados','Dias_Ausentes','Dotacion'],
    cx:        ['NPS_Score','CSAT_Score','CES_Score','TTR_Hrs'],
    suppliers: ['Cantidad_Comprada','Costo_Unitario','Costo_Total','Lead_Time_Días'],
    collections: ['Monto_Pendiente','Monto_Factura','Dias_Vencida'],
  };

  const BOOL_FIELDS = [
    'Resuelto_1er_Contacto','Escaló','Es_Real','FCR','Escalo','Perdido_Post_Reclamo'
  ];

  // Columnas mínimas para que el panel de cada módulo tenga sentido.
  // Si tras el mapeo falta alguna, la UI lo advierte antes de guardar
  // (evita que el cliente suba con la columna clave mal nombrada y el
  // panel quede vacío sin explicación).
  const REQUIRED_COLUMNS = {
    sales:       ['Fecha','Ventas_Monto'],
    clients:     ['Cliente_ID'],
    support:     ['Fecha','Caso_ID'],
    inventory:   ['Fecha','Stock_Inicial'],
    marketing:   ['Campaña','Inversión'],
    finance:     ['Fecha'],
    team:        ['Fecha','Vendedor'],
    cx:          ['Fecha'],
    suppliers:   ['OC_ID','Proveedor_Nombre'],
    collections: ['Monto_Pendiente'],
  };

  // Grupos "al menos uno de" (P5/#5): finance no siempre trae 'Monto' — el
  // módulo también lee el esquema directo Ingresos/Costos/Gastos_Operacionales
  // (finance-module.js:284). Exigir 'Monto' de forma rígida generaba falsos
  // "falta Monto" en archivos que sí traían datos completos con el otro esquema.
  const REQUIRED_ONE_OF = {
    finance: ['Monto','Ingresos','Costos','Gastos_Operacionales'],
  };

  // ── UTILIDADES ───────────────────────────────────────────────
  function normalize(str) {
    return String(str || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .trim();
  }

  // Misma regla usada en processRows() y en la fusión raw:true/raw:false de
  // readFile()/readSheet() — un solo criterio de "esto es una columna de
  // fecha" para que ambos puntos no puedan divergir entre sí.
  function _isFechaField(key) {
    return key === 'Fecha' || key.toLowerCase().startsWith('fecha') || key.toLowerCase().includes('date');
  }

  // Fusiona SOLO las columnas de fecha desde una lectura raw:true (que entrega
  // objeto Date real para celdas de fecha genuinas, sin ambigüedad) sobre las
  // filas ya leídas con raw:false (que se mantienen intactas para todo lo
  // demás — montos con miles chilenos, texto, etc.). Invariante: las dos
  // llamadas a sheet_to_json deben usar las mismas opciones salvo `raw`, para
  // que produzcan el mismo número de filas en el mismo orden (verificado con
  // test de fila vacía intermedia).
  function _mergeRawDates(ws, rows) {
    if (!rows.length) return rows;
    const rawRows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: true });
    rows.forEach((row, i) => {
      const raw = rawRows[i];
      if (!raw) return;
      Object.keys(row).forEach(key => {
        if (_isFechaField(key) && raw[key] instanceof Date) {
          row[key] = raw[key];
        }
      });
    });
    return rows;
  }

  function cleanNumber(val) {
    if (val === null || val === undefined || val === '') return null;
    if (typeof val === 'number') return isNaN(val) ? null : val;
    const str = String(val).replace(/\s/g, '').replace(/[^\d,.-]/g, '');
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(str)) {
      return parseFloat(str.replace(/\./g, '').replace(',', '.'));
    }
    const n = parseFloat(str.replace(',', '.'));
    return isNaN(n) ? null : n;
  }

  function cleanText(val) {
    if (val === null || val === undefined) return '';
    return String(val).trim().replace(/\s+/g, ' ');
  }

  function cleanBoolean(val) {
    if (typeof val === 'boolean') return val ? 1 : 0;
    const s = String(val || '').toLowerCase().trim();
    return ['si','sí','yes','true','1','x','✓','ok'].includes(s) ? 1 : 0;
  }

  // ── MAPEO DE COLUMNAS ────────────────────────────────────────
  function mapColumns(headers) {
    const mapping = {};
    const used = new Set();

    // PASO 1 — coincidencia EXACTA (norm === keyword). Prioritaria para
    // evitar que un alias-substring de otra columna (p.ej. 'canal' en
    // Canal_Venta) capture un header exacto de otro módulo
    // (Canal_Marketing, Meta_Mes, NPS_Score, Cantidad_Comprada, Costo_Total).
    // Sin esto, mapColumns misclasifica headers de marketing/cx/suppliers.
    const pending = [];
    headers.forEach(header => {
      const norm = normalize(header);
      let found = null;
      for (const [canonical, keywords] of Object.entries(COLUMN_MAPS)) {
        if (used.has(canonical)) continue;
        if (keywords.some(kw => norm === kw)) { found = canonical; break; }
      }
      if (found) { mapping[header] = found; used.add(found); }
      else pending.push({ header, norm });
    });

    // PASO 2 — coincidencia por substring (norm.includes / kw.includes),
    // solo para headers que no tuvieron match exacto.
    pending.forEach(({ header, norm }) => {
      let found = null;
      for (const [canonical, keywords] of Object.entries(COLUMN_MAPS)) {
        if (used.has(canonical)) continue;
        if (keywords.some(kw => norm.includes(kw) || kw.includes(norm))) {
          found = canonical;
          break;
        }
      }
      if (found) {
        mapping[header] = found;
        used.add(found);
      } else {
        mapping[header] = header;
      }
    });

    return mapping;
  }

  // ── RE-MAPEO CON PRIORIDAD AL MÓDULO DETECTADO (P5/#5) ───────
  // mapColumns() es global: si un alias (p.ej. 'monto') pertenece a más de
  // un canónico (Ventas_Monto Y Monto), gana el declarado antes en
  // COLUMN_MAPS sin saber a qué módulo pertenece el archivo — un header
  // "Monto" de finanzas terminaba en Ventas_Monto y "Monto" quedaba vacío.
  // Con el módulo ya detectado (Fase A), esta Fase B prefiere el canónico
  // que pertenece a las columnas propias del módulo, sin cambiar la firma
  // pública de mapColumns(headers).
  function remapForModule(headers, mapping, module) {
    const ownFields = new Set([
      ...(NUMERIC_FIELDS[module] || []),
      ...(REQUIRED_COLUMNS[module] || []),
      ...(MODULE_SIGNATURES[module] || []),
      ...(REQUIRED_ONE_OF[module] || []),
    ]);
    if (!ownFields.size) return mapping;

    const result = { ...mapping };
    const used = new Set(Object.values(result));

    headers.forEach(header => {
      const current = result[header];
      if (ownFields.has(current)) return; // ya mapeado a algo propio del módulo

      const norm = normalize(header);
      for (const canonical of ownFields) {
        if (used.has(canonical) || canonical === current) continue;
        const keywords = COLUMN_MAPS[canonical];
        if (!keywords) continue;
        if (keywords.some(kw => norm === kw || norm.includes(kw) || kw.includes(norm))) {
          used.delete(current);
          result[header] = canonical;
          used.add(canonical);
          break;
        }
      }
    });

    return result;
  }

  // ── DETECCIÓN DE MÓDULO ──────────────────────────────────────
  // Devuelve solo el nombre del módulo (firma estable para llamadores existentes).
  function detectModule(mapping) {
    return detectModuleDetailed(mapping).module;
  }

  // Versión detallada: además del módulo, cuántas columnas-firma coincidieron,
  // un nivel de confianza y el ranking, para que la UI pueda avisar al usuario
  // cuando la detección es dudosa (y así evitar clasificaciones erróneas).
  function detectModuleDetailed(mapping) {
    const canonicals = new Set(Object.values(mapping));
    const ranking = Object.entries(MODULE_SIGNATURES).map(([mod, sigs]) => ({
      module: mod,
      score:  sigs.filter(s => canonicals.has(s)).length,
      total:  sigs.length,
    })).sort((a, b) => b.score - a.score);

    const top    = ranking[0] || { module: 'sales', score: 0, total: 0 };
    const second = ranking[1] || { score: 0 };

    // Sin coincidencias → default 'sales' pero confianza NULA (la UI debe avisar).
    // Empate en el score máximo → confianza baja (ambiguo).
    // score >= 3 y sin empate → alta. score 1-2 → media.
    let confidence;
    if (top.score === 0)                    confidence = 'none';
    else if (top.score === second.score)    confidence = 'low';   // empate
    else if (top.score >= 3)                confidence = 'high';
    else                                    confidence = 'medium';

    return {
      module:     top.score === 0 ? 'sales' : top.module,
      score:      top.score,
      confidence,
      ranking,
    };
  }

  // ── LEER ARCHIVO ─────────────────────────────────────────────
  async function readFile(file) {
    return new Promise((resolve) => {
      if (!file) { resolve({ error: i18n.t('errorInvalidFile') }); return; }

      const ext = file.name.split('.').pop().toLowerCase();
      if (!['xlsx','xls','csv'].includes(ext)) {
        resolve({ error: i18n.t('errorInvalidFile') + ' (.xlsx, .xls, .csv)' });
        return;
      }

      const reader = new FileReader();
      reader.onload = e => {
        try {
          const data = new Uint8Array(e.target.result);
          const wb   = XLSX.read(data, { type: 'array', cellDates: true });

          const sheetNames = wb.SheetNames;
          // Usar primera hoja que tenga datos
          const sheetName = sheetNames[0];
          const ws   = wb.Sheets[sheetName];
          const rows = _mergeRawDates(ws, XLSX.utils.sheet_to_json(ws, { defval: '', raw: false }));

          if (!rows.length) {
            resolve({ error: i18n.t('errorNoData') });
            return;
          }

          const headers = Object.keys(rows[0]);
          resolve({ headers, rows, sheetNames, error: null });
        } catch(e) {
          resolve({ error: i18n.t('errorUpload') + ': ' + e.message });
        }
      };
      reader.onerror = () => resolve({ error: i18n.t('errorUpload') });
      reader.readAsArrayBuffer(file);
    });
  }

  // ── PROCESAR FILAS ───────────────────────────────────────────
  function processRows(rawRows, mapping, module) {
    const seen = new Set();
    let duplicatesRemoved = 0;
    let totalsRemoved = 0;
    const processed = [];
    const numFields  = NUMERIC_FIELDS[module] || [];
    const TOTALS_KW  = ['total','subtotal','gran total','totales','suma','grand total','suma total'];

    rawRows.forEach(raw => {
      // Aplicar mapeo
      const row = {};
      for (const [excelKey, canonical] of Object.entries(mapping)) {
        row[canonical] = raw[excelKey];
      }

      // Detectar fila de totales
      const firstVal = String(Object.values(row)[0] || '').toLowerCase().trim();
      if (TOTALS_KW.includes(firstVal)) { totalsRemoved++; return; }

      // Limpiar tipos
      const cleaned = {};
      for (const [key, val] of Object.entries(row)) {
        if (numFields.includes(key)) {
          cleaned[key] = cleanNumber(val);
        } else if (BOOL_FIELDS.includes(key)) {
          cleaned[key] = cleanBoolean(val);
        } else if (_isFechaField(key)) {
          if (val instanceof Date) {
            cleaned[key] = val.toISOString().split('T')[0];
          } else {
            const parsed = storage.parseDate(val);
            cleaned[key] = parsed ? parsed.toISOString().split('T')[0] : cleanText(val);
          }
        } else {
          cleaned[key] = cleanText(val);
        }
      }

      // ── NORMALIZAR ESTADO DE PAGO ────────────────────────────
      // Orden: después de cleanNumber (Monto_Pendiente ya es número), antes de hash
      if (cleaned.Estado !== undefined || cleaned.Monto_Pendiente !== undefined) {
        const rawEstado = String(cleaned.Estado || '').toLowerCase().trim();
        const PAGADO_KW  = ['pagada','pagado','paid','cancelada','cancelado','liquidada','liquidado','ok','cobrada','cobrado','saldada','saldado'];
        const PENDIENTE_KW = ['pendiente','pending','vigente','active','open','emitida','emitido','por cobrar'];
        if (PAGADO_KW.includes(rawEstado)) {
          cleaned.Estado = 'Pagada';
        } else if (PENDIENTE_KW.includes(rawEstado) || rawEstado === '') {
          // Capa 2: si Monto_Pendiente existe y es 0, forzar Pagada independiente del texto
          const montoPend = parseFloat(cleaned.Monto_Pendiente);
          cleaned.Estado = (!isNaN(montoPend) && montoPend === 0) ? 'Pagada' : 'Pendiente';
        } else {
          // Valor desconocido: igual aplicar capa 2
          const montoPend = parseFloat(cleaned.Monto_Pendiente);
          cleaned.Estado = (!isNaN(montoPend) && montoPend === 0) ? 'Pagada' : (cleaned.Estado || 'Pendiente');
        }
      }

      // ── INVERTIR SIGNO POR TIPO_DOCUMENTO ────────────────────
      // Notas de crédito y anulaciones: el usuario sube montos positivos, el sistema los resta
      if (cleaned.Tipo_Documento) {
        const td = normalize(cleaned.Tipo_Documento);
        const NC_KW = ['nota_credito','nota_de_credito','notacredito','credit_note','nc','devolucion','devolución','anulacion','anulación','anulada','anulado','reversa','reverso','void'];
        if (NC_KW.some(kw => td.includes(kw))) {
          ['Ventas_Monto','Monto','Monto_Factura','Monto_Pendiente'].forEach(f => {
            if (cleaned[f] != null && cleaned[f] !== '') {
              const n = parseFloat(cleaned[f]);
              if (!isNaN(n) && n > 0) cleaned[f] = -n; // solo invertir si positivo (evitar doble inversión)
            }
          });
        }
      }

      // Deduplicación por hash — incluye N_Documento y Tipo_Documento para separar NC de factura original
      const hashFields = ['Fecha','Vendedor','Cliente_ID','Caso_ID','OC_ID','N_Documento','Tipo_Documento','Ventas_Monto','Monto','Costo_Total']
        .filter(f => cleaned[f] != null && cleaned[f] !== '');
      const hash = hashFields.map(f => cleaned[f]).join('|');
      if (hash && seen.has(hash)) { duplicatesRemoved++; return; }
      if (hash) seen.add(hash);

      // Ignorar filas vacías
      const hasValues = Object.values(cleaned).some(v => v !== '' && v !== null && v !== undefined);
      if (!hasValues) return;

      processed.push(cleaned);
    });

    return { rows: processed, duplicatesRemoved, totalsRemoved };
  }

  // ── PREPARAR ARCHIVO (flujo principal) ───────────────────────
  async function prepareFile(file) {
    const read = await readFile(file);
    if (read.error) return { success: false, error: read.error };

    const { headers, rows, sheetNames } = read;
    const mappingPreliminar = mapColumns(headers);
    const detection      = detectModuleDetailed(mappingPreliminar);
    const detectedModule = detection.module;
    // Fase B (P5/#5): re-mapear con prioridad al módulo ya detectado.
    const mapping = remapForModule(headers, mappingPreliminar, detectedModule);
    const { rows: processed, duplicatesRemoved, totalsRemoved } = processRows(rows, mapping, detectedModule);

    // Columnas que NO se reconocieron (quedaron con su nombre original como canónico).
    // La UI las marca para que el usuario las asigne y no pierda KPIs en silencio.
    const canonicalSet = new Set(Object.keys(COLUMN_MAPS));
    const unmappedColumns = Object.entries(mapping)
      .filter(([orig, canon]) => canon === orig && !canonicalSet.has(canon))
      .map(([orig]) => orig);

    // Columnas requeridas del módulo detectado que faltan tras el mapeo.
    const mappedCanon = new Set(Object.values(mapping));
    const missingRequired = (REQUIRED_COLUMNS[detectedModule] || [])
      .filter(col => !mappedCanon.has(col));
    // Grupo "al menos uno de" (P5/#5): falta solo si NINGUNO de sus miembros se mapeó.
    const oneOfGroup = REQUIRED_ONE_OF[detectedModule];
    if (oneOfGroup && !oneOfGroup.some(c => mappedCanon.has(c))) {
      missingRequired.push(oneOfGroup.join(' / '));
    }

    const fechas = processed
      .map(r => r.Fecha || r.fecha)
      .filter(Boolean)
      .map(f => new Date(f))
      .filter(d => !isNaN(d));

    const dateRange = fechas.length ? {
      from: new Date(Math.min(...fechas)).toISOString().split('T')[0],
      to:   new Date(Math.max(...fechas)).toISOString().split('T')[0],
    } : null;

    const warnings = validateCoherence(processed, detectedModule, dateRange);

    return {
      success: true,
      fileName: file.name,
      fileSize: file.size,
      sheetNames,
      originalHeaders: headers,
      mapping,
      detectedModule,
      detectionConfidence: detection.confidence,   // 'high' | 'medium' | 'low' | 'none'
      detectionScore:      detection.score,
      detectionRanking:    detection.ranking,
      unmappedColumns,                              // headers no reconocidos
      missingRequired,                              // requeridas ausentes tras mapeo
      rows:             processed,
      totalRows:        rows.length,
      validRows:        processed.length,
      duplicatesRemoved,
      totalsRemoved,
      dateRange,
      warnings,
      preview:          processed.slice(0, 5),
    };
  }

  // ── VALIDACIÓN DE COHERENCIA ────────────────────────────────
  // Detecta anomalías sin bloquear — informa, no impide.
  // Devuelve array de { type, message_es, message_en }
  function validateCoherence(rows, module, dateRange) {
    const warnings = [];
    const today = new Date();
    today.setHours(0,0,0,0);

    // 1. Fechas futuras (más de 7 días hacia adelante)
    const futureLimit = new Date(today.getTime() + 7 * 86400000);
    const futureDates = rows.filter(r => {
      const d = r.Fecha ? new Date(r.Fecha) : null;
      return d && !isNaN(d) && d > futureLimit;
    });
    if (futureDates.length > 0) {
      warnings.push({
        type: 'future_dates',
        message_es: `${futureDates.length} fila(s) tienen fechas futuras. Verifica que el formato dd/mm/yyyy sea correcto.`,
        message_en: `${futureDates.length} row(s) have future dates. Check that the date format dd/mm/yyyy is correct.`,
      });
    }

    // 2. Montos negativos inesperados (módulos donde no deberían existir)
    // Excluye filas ya marcadas como nota de crédito/devolución: esas SÍ
    // deben quedar en negativo (así se restan de las ventas) — antes este
    // chequeo las detectaba y avisaba "usa Tipo_Documento = nota_credito"
    // sobre filas que ya tenían esa marca, un falso positivo que bloqueaba
    // la subida incluso cuando el Excel estaba correctamente etiquetado.
    const NC_KW = ['nota_credito','nota_de_credito','notacredito','credit_note','nc','devolucion','devolución','anulacion','anulación','anulada','anulado','reversa','reverso','void'];
    const esNotaCredito = r => {
      if (!r.Tipo_Documento) return false;
      const td = normalize(r.Tipo_Documento);
      return NC_KW.some(kw => td.includes(kw));
    };
    const moneyFields = ['Ventas_Monto','Monto','Ingresos','Meta_Ventas'];
    const NO_NEG_MODULES = ['sales','marketing','team'];
    if (NO_NEG_MODULES.includes(module)) {
      moneyFields.forEach(f => {
        const neg = rows.filter(r => r[f] !== undefined && parseFloat(r[f]) < 0 && !esNotaCredito(r));
        if (neg.length > 0) {
          warnings.push({
            type: 'negative_amounts',
            message_es: `${neg.length} fila(s) tienen ${f} negativo. Si son notas de crédito, usa la columna Tipo_Documento = nota_credito.`,
            message_en: `${neg.length} row(s) have negative ${f}. If these are credit notes, use Tipo_Documento = nota_credito.`,
          });
        }
      });
    }

    // 3. Columnas requeridas vacías
    (REQUIRED_COLUMNS[module] || []).forEach(col => {
      const empty = rows.filter(r => r[col] === undefined || r[col] === null || r[col] === '');
      if (empty.length > 0) {
        warnings.push({
          type: 'missing_required',
          message_es: `${empty.length} fila(s) no tienen valor en la columna requerida "${col}".`,
          message_en: `${empty.length} row(s) are missing a value in the required column "${col}".`,
        });
      }
    });
    // 3b. Grupo "al menos uno de" (P5/#5) — por fila: finance acepta Monto
    // O el esquema directo Ingresos/Costos/Gastos_Operacionales.
    const oneOfGroupVC = REQUIRED_ONE_OF[module];
    if (oneOfGroupVC) {
      const empty = rows.filter(r => !oneOfGroupVC.some(c => r[c] !== undefined && r[c] !== null && r[c] !== ''));
      if (empty.length > 0) {
        const label = oneOfGroupVC.join('/');
        warnings.push({
          type: 'missing_required',
          message_es: `${empty.length} fila(s) no tienen valor en ninguna de las columnas requeridas (${label}).`,
          message_en: `${empty.length} row(s) are missing a value in any of the required columns (${label}).`,
        });
      }
    }

    // 3c. Finanzas: doble esquema en la misma fila (Monto+Tipo_Movimiento Y
    // columna directa) — el cálculo ya prioriza la columna directa e ignora
    // Monto en esas filas (finance-module.js: resolveRowFinance) para no
    // duplicar, pero avisamos para que el usuario sepa que Monto se ignora.
    if (module === 'finance') {
      const dual = rows.filter(r => {
        const hasMonto  = r.Monto !== undefined && r.Monto !== null && r.Monto !== '' && parseFloat(r.Monto) !== 0;
        const hasDirect = ['Ingresos','Costos','Gastos_Operacionales'].some(c => r[c] !== undefined && r[c] !== null && r[c] !== '');
        return hasMonto && hasDirect;
      });
      if (dual.length > 0) {
        warnings.push({
          type: 'dual_schema_finance',
          message_es: `${dual.length} fila(s) tienen Monto y también una columna directa (Ingresos/Costos/Gastos_Operacionales). Se usará la columna directa y se ignorará Monto en esas filas para evitar duplicar el valor.`,
          message_en: `${dual.length} row(s) have both Monto and a direct column (Ingresos/Costos/Gastos_Operacionales). The direct column will be used and Monto ignored on those rows to avoid double-counting.`,
        });
      }
    }

    // 4. Rango de fechas demasiado amplio (>5 años) — posible error de formato
    if (dateRange) {
      const from = new Date(dateRange.from);
      const to   = new Date(dateRange.to);
      const diffYears = (to - from) / (365 * 86400000);
      if (diffYears > 5) {
        warnings.push({
          type: 'date_range_wide',
          message_es: `El rango de fechas es mayor a 5 años (${from.getFullYear()}–${to.getFullYear()}). Verifica que no haya fechas erróneas.`,
          message_en: `Date range is over 5 years (${from.getFullYear()}–${to.getFullYear()}). Check for any incorrect dates.`,
        });
      }
    }

    // 5. Archivo muy pequeño para módulo (<3 filas)
    if (rows.length > 0 && rows.length < 3) {
      warnings.push({
        type: 'few_rows',
        message_es: `Solo ${rows.length} fila(s) detectada(s). Los KPIs pueden no ser representativos.`,
        message_en: `Only ${rows.length} row(s) detected. KPIs may not be representative.`,
      });
    }

    // 6. Columna numérica con muchos huecos → posible fórmula que depende de
    //    OTRO archivo (SheetJS no puede recalcularla y llega vacía/rota).
    //    Solo con ≥5 filas y ≥30% de la columna vacía, para no dar falsos
    //    positivos en columnas legítimamente opcionales.
    if (rows.length >= 5) {
      const numFields = NUMERIC_FIELDS[module] || [];
      numFields.forEach(f => {
        // ¿la columna existe en los datos? (si nadie la trae, no aplica)
        const present = rows.some(r => f in r);
        if (!present) return;
        const emptyCount = rows.filter(r => {
          const v = r[f];
          return v === null || v === undefined || v === '' ||
                 (typeof v === 'number' && isNaN(v));
        }).length;
        const ratio = emptyCount / rows.length;
        if (ratio >= 0.30) {
          const pct = Math.round(ratio * 100);
          warnings.push({
            type: 'possible_broken_formula',
            message_es: `La columna "${f}" tiene ${pct}% de celdas vacías o sin número. Si tu Excel usa fórmulas que dependen de otro archivo, guárdalo como valores (Pegar como valores) o usa la plantilla.`,
            message_en: `Column "${f}" has ${pct}% empty or non-numeric cells. If your Excel uses formulas that depend on another file, save it as values (Paste as values) or use the template.`,
          });
        }
      });
    }

    return warnings;
  }

  // ── GUARDAR PROCESADO ────────────────────────────────────────
  // Devuelve { ok:true, fileId, rows } o { ok:false, error } — nunca lanza
  // ni deja creer al usuario que algo se guardó cuando no fue así. Si
  // addData falla después de crear el archivo, se revierte la entrada
  // de archivo (no queda un archivo "fantasma" sin datos detrás).
  async function saveProcessed(prepared, confirmedModule, confirmedMapping = null, options = {}) {
    // Gate de plan vencido (Bloque 3.6): solo lectura hasta que suscriba.
    // Único punto por el que pasan todas las subidas, sin importar qué
    // botón de la UI las disparó.
    if (typeof auth !== 'undefined' && !auth.isDemo() && typeof plans !== 'undefined' && plans.getPlanActivo() === 'vencido') {
      return { ok: false, error: 'gateVencidoAction' };
    }

    // Capturado ANTES de guardar — después de addFile ya no sería "el primero".
    const esPrimerArchivo = (typeof storage !== 'undefined' && storage.getFiles().length === 0);

    let finalRows = prepared.rows;

    if (confirmedMapping) {
      const { rows } = processRows(prepared.rows, confirmedMapping, confirmedModule);
      finalRows = rows;
    }

    // Si el usuario eligió "reemplazar", borrar los archivos solapados PRIMERO
    // para que no queden datos duplicados del archivo anterior.
    if (Array.isArray(options.replaceFileIds) && options.replaceFileIds.length) {
      for (const id of options.replaceFileIds) {
        await storage.removeFile(id);
      }
    }

    const fileMeta = await storage.addFile({
      name:       prepared.fileName,
      module:     confirmedModule,
      rows:       finalRows.length,
      duplicates: prepared.duplicatesRemoved,
      dateRange:  prepared.dateRange,
      size:       prepared.fileSize,
    });

    if (!fileMeta) {
      return { ok: false, error: 'uploadSaveFailedMsg' };
    }

    const result = await storage.addData(confirmedModule, finalRows, fileMeta.id);
    if (!result.ok) {
      // addData no tocó _memCache (falló antes de eso) — solo queda
      // limpiar la entrada de archivo que addFile sí llegó a crear.
      await storage.removeFile(fileMeta.id);
      return { ok: false, error: 'uploadSaveFailedMsg' };
    }

    if (esPrimerArchivo && typeof storage !== 'undefined' && storage.trackEvento) {
      storage.trackEvento('primer_archivo', { modulo: confirmedModule });
    }

    return { ok: true, fileId: fileMeta.id, rows: finalRows.length };
  }

  // ── DETECCIÓN DE SOLAPAMIENTO (previene duplicados al re-subir) ──
  function checkOverlap(dateRange, module) {
    if (typeof storage === 'undefined' || !storage.getOverlappingFiles) return [];
    return storage.getOverlappingFiles(module, dateRange);
  }

  // ── PLANTILLAS DESCARGABLES ──────────────────────────────────
  const TEMPLATES = {
    sales: {
      name: 'plantilla_ventas.xlsx',
      name_en: 'template_sales.xlsx',
      headers: ['Fecha','Sucursal','País','Ciudad','Canal_Venta','Vendedor',
                'Producto','Categoría','Ventas_Monto','Ventas_Unidades',
                'Meta_Ventas','N_Transacciones','Leads','Dias_Cierre',
                'Cliente_ID','Nombre_Cliente','PVP','Precio_Facturado'],
      example: ['2026-05-15','Santiago Centro','Chile','Santiago','Presencial',
                'Ana García','Zapatillas Running Air','Calzado Deportivo',
                76415,1,80000,1,3,2,'C0001','Carlos Mendoza',89900,76415],
      notes:   ['YYYY-MM-DD','Nombre de la sucursal','','','Presencial u Online',
                'Nombre del vendedor','Nombre exacto del producto','Categoría del producto',
                'Monto en pesos','Unidades vendidas','Meta mensual de ventas',
                'N° de transacciones','Leads generados','Días para cerrar la venta',
                'ID único del cliente','Nombre del cliente',
                'Precio de lista / público','Precio real facturado al cliente'],
    },
    clients: {
      name: 'plantilla_clientes.xlsx',
      name_en: 'template_clients.xlsx',
      headers: ['Fecha','Cliente_ID','Nombre_Cliente','Canal_Adquisición',
                'NPS','Días_Sin_Compra','Frecuencia_Compra','Sucursal','Tipo'],
      example: ['2026-05-01','C0001','Carlos Mendoza','Google Ads',
                9,5,8,'Santiago Centro','Recurrente'],
      notes:   ['YYYY-MM-DD','ID único del cliente','Nombre completo',
                'Instagram · Google Ads · Referido · Tienda Física · TikTok',
                '0 a 10','Días desde última compra','Compras por año',
                'Sucursal donde compra','Nuevo · Recurrente · VIP'],
    },
    support: {
      name: 'plantilla_atencion_cliente.xlsx',
      name_en: 'template_support.xlsx',
      headers: ['Fecha','Caso_ID','Motivo','Canal_Venta','Tiempo_Respuesta_Hrs',
                'Resuelto_1er_Contacto','CSAT','Escaló','Cliente_ID','Vendedor'],
      example: ['2026-05-10','T10001','Cambio de talla','Teléfono',
                1.5,1,4.5,0,'C0001','Ana García'],
      notes:   ['YYYY-MM-DD','ID único del caso','Motivo del contacto',
                'Teléfono · Email · Chat · WhatsApp','Horas hasta primera respuesta',
                '1=Sí · 0=No','1 a 5','1=Sí · 0=No','ID del cliente','Agente que atendió'],
    },
    inventory: {
      name: 'plantilla_inventario.xlsx',
      name_en: 'template_inventory.xlsx',
      headers: ['Fecha','Producto','Categoría','Stock_Inicial','Compras_Unidades',
                'Ventas_Unidades','Devoluciones','Costo_Unitario','Sucursal'],
      example: ['2026-05-01','Zapatillas Running Air','Calzado Deportivo',
                120,50,85,3,47500,'Santiago Centro'],
      notes:   ['YYYY-MM-DD o primer día del mes','Nombre del producto','Categoría',
                'Stock al inicio del período','Unidades compradas en el período',
                'Unidades vendidas','Unidades devueltas','Costo por unidad','Sucursal'],
    },
    marketing: {
      name: 'plantilla_marketing.xlsx',
      name_en: 'template_marketing.xlsx',
      headers: ['Fecha','Campaña','Canal_Marketing','Inversión','Leads',
                'Ventas_Campaña','Monto_Ventas','Fecha_Inicio_Campaña','Fecha_Fin_Campaña'],
      example: ['2026-05-10','Día de la Madre','Meta Ads',1480000,820,
                1240,8140000,'2026-05-08','2026-05-14'],
      notes:   ['Fecha de registro','Nombre de la campaña',
                'Meta Ads · Google Ads · TikTok · Email · Instagram',
                'Inversión total en pesos','Leads generados por la campaña',
                'N° ventas atribuidas','Monto de ventas atribuidas',
                'Inicio YYYY-MM-DD','Fin YYYY-MM-DD'],
    },
    finance: {
      name: 'plantilla_finanzas.xlsx',
      name_en: 'template_finance.xlsx',
      // Un solo esquema por fila (nunca ambos): esta fila usa Monto+Tipo_Movimiento
      // y deja las columnas directas vacías. Si prefieres el esquema de columnas
      // directas, llena Ingresos/Costos/Gastos_Operacionales y deja Monto vacío.
      headers: ['Fecha','Concepto','Tipo_Movimiento','Monto','Forma_Pago',
                'Es_Real','Ingresos','Costos','Gastos_Operacionales','Cuentas_Por_Cobrar'],
      example: ['2026-05-01','Ventas del mes','Ingreso',21200000,'Transferencia',
                1,'','','',6360000],
      notes:   ['YYYY-MM-DD','Descripción del movimiento','Ingreso · Egreso',
                'Monto en pesos','Transferencia · Efectivo · Tarjeta',
                '1=Real · 0=Proyectado','Vacío si usas Monto + Tipo_Movimiento',
                'Vacío si usas Monto + Tipo_Movimiento','Vacío si usas Monto + Tipo_Movimiento','Cuentas por cobrar'],
    },
    team: {
      name: 'plantilla_equipo.xlsx',
      name_en: 'template_team.xlsx',
      headers: ['Fecha','Vendedor','Sucursal','Canal_Venta','Ventas_Monto',
                'Meta_Mes','Dias_Trabajados','Dias_Ausentes','Dotacion','Leads'],
      example: ['2026-05-01','Ana García','Santiago Centro','Presencial',
                4656000,4800000,21,1,1,95],
      notes:   ['YYYY-MM-DD o primer día del mes','Nombre del vendedor',
                'Sucursal','Presencial · Online','Ventas del mes en pesos',
                'Meta mensual en pesos','Días trabajados','Días ausentes',
                '1 por persona','Leads gestionados'],
    },
    cx: {
      name: 'plantilla_encuestas_cx.xlsx',
      name_en: 'template_cx.xlsx',
      headers: ['Fecha','Cliente_ID','Canal_Venta','NPS_Score','CSAT_Score',
                'CES_Score','TTR_Hrs','FCR','Escalo','Perdido_Post_Reclamo',
                'Comentario','Etiqueta','Etiqueta_2','Etiqueta_3'],
      example: ['2026-05-12','C0001','Presencial',9,5,2,1.5,1,0,0,
                'Excelente atención','','',''],
      notes:   ['YYYY-MM-DD','ID del cliente','Canal de atención',
                '0 a 10 (Net Promoter Score)','1 a 5 (Satisfacción)',
                '1 a 5 (Esfuerzo — menor es mejor)','Horas hasta resolución',
                '1=Sí · 0=No','1=Sí · 0=No','1=Sí · 0=No',
                'Comentario libre del cliente',
                'Etiqueta principal (ej: tiempo_entrega)',
                'Segunda etiqueta (opcional)','Tercera etiqueta (opcional)'],
    },
    suppliers: {
      name: 'plantilla_proveedores.xlsx',
      name_en: 'template_suppliers.xlsx',
      headers: ['Fecha','OC_ID','Proveedor_ID','Proveedor_Nombre','Producto',
                'Categoría','Cantidad_Comprada','Costo_Unitario','Costo_Total',
                'Lead_Time_Días','Fecha_Entrega_Esperada','Fecha_Entrega_Real',
                'Sucursal_Destino','País_Origen'],
      example: ['2026-05-03','OC-2026-089','P001','Nike Chile Distribuidora',
                'Zapatillas Running Air','Calzado Deportivo',
                100,47500,4750000,14,'2026-05-17','2026-05-18',
                'Santiago Centro','Chile'],
      notes:   ['Fecha de la orden YYYY-MM-DD','N° de orden de compra',
                'ID del proveedor','Nombre del proveedor','Producto comprado',
                'Categoría del producto','Unidades compradas','Costo por unidad',
                'Costo total (cantidad × unitario)','Días de entrega prometidos',
                'Fecha esperada YYYY-MM-DD','Fecha real de entrega YYYY-MM-DD',
                'Sucursal de destino','País de origen del producto'],
    },
  };

  // Traducción ES→EN de las notas de plantilla (headers/example NO se traducen).
  const NOTE_TR = {
    'YYYY-MM-DD': 'YYYY-MM-DD',
    'Nombre de la sucursal': 'Branch name',
    'Presencial u Online': 'In-store or Online',
    'Nombre del vendedor': 'Salesperson name',
    'Nombre exacto del producto': 'Exact product name',
    'Categoría del producto': 'Product category',
    'Monto en pesos': 'Amount in local currency',
    'Unidades vendidas': 'Units sold',
    'Meta mensual de ventas': 'Monthly sales target',
    'N° de transacciones': 'Number of transactions',
    'Leads generados': 'Leads generated',
    'Días para cerrar la venta': 'Days to close the sale',
    'ID único del cliente': 'Unique customer ID',
    'Nombre del cliente': 'Customer name',
    'Precio de lista / público': 'List / retail price',
    'Precio real facturado al cliente': 'Actual price invoiced to customer',
    'Nombre completo': 'Full name',
    'Instagram · Google Ads · Referido · Tienda Física · TikTok': 'Instagram · Google Ads · Referral · Physical Store · TikTok',
    '0 a 10': '0 to 10',
    'Días desde última compra': 'Days since last purchase',
    'Compras por año': 'Purchases per year',
    'Sucursal donde compra': 'Branch where they shop',
    'Nuevo · Recurrente · VIP': 'New · Returning · VIP',
    'ID único del caso': 'Unique case ID',
    'Motivo del contacto': 'Reason for contact',
    'Teléfono · Email · Chat · WhatsApp': 'Phone · Email · Chat · WhatsApp',
    'Horas hasta primera respuesta': 'Hours to first response',
    '1=Sí · 0=No': '1=Yes · 0=No',
    '1 a 5': '1 to 5',
    'ID del cliente': 'Customer ID',
    'Agente que atendió': 'Agent who handled it',
    'YYYY-MM-DD o primer día del mes': 'YYYY-MM-DD or first day of the month',
    'Nombre del producto': 'Product name',
    'Categoría': 'Category',
    'Stock al inicio del período': 'Stock at start of period',
    'Unidades compradas en el período': 'Units purchased in the period',
    'Unidades devueltas': 'Units returned',
    'Costo por unidad': 'Cost per unit',
    'Sucursal': 'Branch',
    'Fecha de registro': 'Record date',
    'Nombre de la campaña': 'Campaign name',
    'Meta Ads · Google Ads · TikTok · Email · Instagram': 'Meta Ads · Google Ads · TikTok · Email · Instagram',
    'Inversión total en pesos': 'Total investment in local currency',
    'Leads generados por la campaña': 'Leads generated by the campaign',
    'N° ventas atribuidas': 'Number of attributed sales',
    'Monto de ventas atribuidas': 'Attributed sales amount',
    'Inicio YYYY-MM-DD': 'Start YYYY-MM-DD',
    'Fin YYYY-MM-DD': 'End YYYY-MM-DD',
    'Descripción del movimiento': 'Transaction description',
    'Ingreso · Egreso': 'Income · Expense',
    'Transferencia · Efectivo · Tarjeta': 'Transfer · Cash · Card',
    '1=Real · 0=Proyectado': '1=Actual · 0=Projected',
    'Total ingresos del período': 'Total income for the period',
    'Costo de ventas': 'Cost of goods sold',
    'Gastos operacionales': 'Operating expenses',
    'Cuentas por cobrar': 'Accounts receivable',
    'Presencial · Online': 'In-store · Online',
    'Ventas del mes en pesos': 'Monthly sales in local currency',
    'Meta mensual en pesos': 'Monthly target in local currency',
    'Días trabajados': 'Days worked',
    'Días ausentes': 'Days absent',
    '1 por persona': '1 per person',
    'Leads gestionados': 'Leads handled',
    'Canal de atención': 'Support channel',
    '0 a 10 (Net Promoter Score)': '0 to 10 (Net Promoter Score)',
    '1 a 5 (Satisfacción)': '1 to 5 (Satisfaction)',
    '1 a 5 (Esfuerzo — menor es mejor)': '1 to 5 (Effort — lower is better)',
    'Horas hasta resolución': 'Hours to resolution',
    'Comentario libre del cliente': 'Free-text customer comment',
    'Etiqueta principal (ej: tiempo_entrega)': 'Main tag (e.g. delivery_time)',
    'Segunda etiqueta (opcional)': 'Second tag (optional)',
    'Tercera etiqueta (opcional)': 'Third tag (optional)',
    'Fecha de la orden YYYY-MM-DD': 'Order date YYYY-MM-DD',
    'N° de orden de compra': 'Purchase order number',
    'ID del proveedor': 'Supplier ID',
    'Nombre del proveedor': 'Supplier name',
    'Producto comprado': 'Product purchased',
    'Unidades compradas': 'Units purchased',
    'Costo total (cantidad × unitario)': 'Total cost (quantity × unit)',
    'Días de entrega prometidos': 'Promised delivery days',
    'Fecha esperada YYYY-MM-DD': 'Expected date YYYY-MM-DD',
    'Fecha real de entrega YYYY-MM-DD': 'Actual delivery date YYYY-MM-DD',
    'Sucursal de destino': 'Destination branch',
    'País de origen del producto': 'Product country of origin',
  };

  function downloadTemplate(moduleId) {
    if (typeof XLSX === 'undefined') {
      showToast('⏳ Cargando...', 'blue');
      return;
    }

    const tpl = TEMPLATES[moduleId];
    if (!tpl) {
      showToast('❌ Plantilla no disponible', 'red');
      return;
    }

    const lang = typeof i18n !== 'undefined' ? i18n.getLang() : 'es';
    const trNote = (n) => (lang === 'en' ? (NOTE_TR[n] || n) : n);

    // Fila de encabezados (NUNCA se traducen — el parser los reconoce así)
    const headerRow = tpl.headers;
    // Fila de notas/instrucciones (traducidas si el idioma es EN)
    const notesRow  = (tpl.notes || tpl.headers.map(() => '')).map(trNote);
    // Fila de ejemplo
    const exampleRow = tpl.example;

    const ws = XLSX.utils.aoa_to_sheet([
      headerRow,
      notesRow,
      exampleRow,
    ]);

    // Estilo de ancho de columnas automático
    ws['!cols'] = headerRow.map(h => ({ wch: Math.max(h.length + 4, 18) }));

    // Congelar primera fila (encabezados)
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };

    const dataSheetName = lang === 'en' ? 'Data' : 'Datos';
    const instrSheetName = lang === 'en' ? 'Instructions' : 'Instrucciones';
    const instrTitle = lang === 'en'
      ? 'Zhoras One — How to fill in this template'
      : 'Zhoras One — Instrucciones de llenado';
    const instrHeaders = lang === 'en'
      ? ['Column', 'Description', 'Example']
      : ['Columna', 'Descripción', 'Ejemplo'];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, dataSheetName);

    // Hoja de instrucciones
    const instrWs = XLSX.utils.aoa_to_sheet([
      [instrTitle],
      [''],
      instrHeaders,
      ...headerRow.map((h, i) => [h, notesRow[i] || '', exampleRow[i] ?? '']),
    ]);
    instrWs['!cols'] = [{ wch: 25 }, { wch: 50 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, instrWs, instrSheetName);

    // P8/#8: nombre completo en inglés (antes solo traducía el prefijo,
    // dejando el resto en español: "template_atencion_cliente.xlsx").
    const filename = lang === 'en'
      ? (tpl.name_en || tpl.name.replace('plantilla_', 'template_'))
      : tpl.name;

    XLSX.writeFile(wb, filename);
    showToast('📥 ' + (i18n?.t('templateDownload') || 'Plantilla descargada'), 'green');
  }

  // ── LEER HOJA ESPECÍFICA ─────────────────────────────────────
  function readSheet(file, sheetName) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const wb   = XLSX.read(new Uint8Array(e.target.result), { type: 'array', cellDates: true });
          const ws   = wb.Sheets[sheetName] || wb.Sheets[wb.SheetNames[0]];
          const rows = _mergeRawDates(ws, XLSX.utils.sheet_to_json(ws, { defval: '', raw: false }));
          resolve({ rows, headers: rows.length ? Object.keys(rows[0]) : [] });
        } catch(e) {
          resolve({ rows: [], headers: [], error: e.message });
        }
      };
      reader.onerror = () => resolve({ rows: [], headers: [], error: 'Read error' });
      reader.readAsArrayBuffer(file);
    });
  }

  // ── API PÚBLICA ──────────────────────────────────────────────
  return {
    readFile,
    readSheet,
    mapColumns,
    detectModule,
    detectModuleDetailed,
    processRows,
    validateCoherence,
    _mergeRawDates,
    prepareFile,
    saveProcessed,
    checkOverlap,
    downloadTemplate,
    COLUMN_MAPS,
    MODULE_SIGNATURES,
    REQUIRED_COLUMNS,
    TEMPLATES,
    normalize,
    cleanNumber,
    cleanText,
  };
})();
