/**
 * BACKEND DE LA AGENDA — Google Apps Script
 * ------------------------------------------------------------
 * Pega este archivo en: tu Google Sheet > Extensiones > Apps Script.
 * Luego ejecuta la función `setup` una vez (te pedirá permisos).
 * Instrucciones completas en el README.md del repositorio.
 */

const CONFIG = {
  ZONA: 'America/Mexico_City',
  OFFSET: '-06:00',            // CDMX ya no usa horario de verano

  HOJA_CITAS: 'Citas',
  HOJA_BLOQUEOS: 'Bloqueos',
  HOJA_DISPONIBILIDAD: 'Disponibilidad',   // ← aquí anotas qué días y horas estás en cada ciudad
  CARPETA_COMPROBANTES: 'Comprobantes de pago',

  DIAS_ADELANTE: 120,           // cuántos días hacia adelante se pueden reservar
  ANTICIPACION_HORAS: 24,      // mínimo de horas antes de la sesión para reservar


  NOMBRE_NEGOCIO: 'Tu Nombre',
  EMAIL_DUENO: '',                    // correo donde te avisan de cada reserva (vacío = no avisar)
  EMAIL_CLIENTE_AL_RESERVAR: true,    // correo de "recibimos tu solicitud"
  EMAIL_CLIENTE_AL_CONFIRMAR: true,   // correo cuando cambias Estado a "Confirmada"
  EMAIL_CLIENTE_AL_RESPONDER: true,   // correo cuando escribes en la columna "Respuesta"

  MAX_MB: 5,
};

const COLUMNAS = ['Folio', 'Registrado', 'Nombre', 'Teléfono', 'Correo', 'Paquete', 'Precio', 'Extras', 'Total', 'Anticipo',
  'Fecha', 'Hora', 'Ubicación', 'Preguntas', 'Comprobante', 'Estado', 'Respuesta'];
const ESTADOS = ['Pendiente', 'Confirmada', 'Cancelada'];

/* ===================== Configuración inicial ===================== */

function setup() {
  const ss = SpreadsheetApp.getActive();
  ss.setSpreadsheetTimeZone(CONFIG.ZONA);

  const citas = ss.getSheetByName(CONFIG.HOJA_CITAS) || ss.insertSheet(CONFIG.HOJA_CITAS);
  if (citas.getLastRow() === 0) {
    citas.appendRow(COLUMNAS);
    citas.getRange(1, 1, 1, COLUMNAS.length).setFontWeight('bold').setBackground('#efe7da');
    citas.setFrozenRows(1);
  }
  const reglaEstado = SpreadsheetApp.newDataValidation().requireValueInList(ESTADOS, true).build();
  citas.getRange(2, col_('Estado'), citas.getMaxRows() - 1, 1).setDataValidation(reglaEstado);

  const bloq = ss.getSheetByName(CONFIG.HOJA_BLOQUEOS) || ss.insertSheet(CONFIG.HOJA_BLOQUEOS);
  if (bloq.getLastRow() === 0) {
    bloq.appendRow(['Fecha', 'Hasta (opcional)', 'Hora (opcional)', 'Motivo']);
    bloq.getRange(1, 1, 1, 4).setFontWeight('bold').setBackground('#efe7da');
    bloq.setFrozenRows(1);
    bloq.getRange('A1').setNote(
      'Una fila por bloqueo.\n' +
      '• Solo Fecha → bloquea el día completo.\n' +
      '• Fecha + Hasta → bloquea un rango de días (vacaciones).\n' +
      '• Fecha + Hora → bloquea solo ese horario.');
  }

  const disp = ss.getSheetByName(CONFIG.HOJA_DISPONIBILIDAD) || ss.insertSheet(CONFIG.HOJA_DISPONIBILIDAD, 0);
  if (disp.getLastRow() === 0) {
    disp.appendRow(['Fecha', 'Hasta (opcional)', 'Ubicación', 'Días (opcional)', 'Horarios']);
    disp.getRange(1, 1, 1, 5).setFontWeight('bold').setBackground('#efe7da');
    disp.setFrozenRows(1);
    disp.getRange('A:B').setNumberFormat('yyyy-mm-dd');
    disp.getRange('D:E').setNumberFormat('@');
    disp.getRange('A1').setNote(
      'Una fila por bloque de fechas en una ciudad.\n' +
      '• Fecha + Hasta → rango de días (si no pones Hasta, es solo ese día).\n' +
      '• Ubicación → Aguascalientes o Ciudad de México (también acepta AGS y CDMX).\n' +
      '• Días → opcional, ej. "L-V" o "L, M, J". Vacío = todos los días del rango.\n' +
      '• Horarios → horas de inicio separadas por coma: 10:00, 12:00, 16:00');
    // Tus fechas iniciales (agrega CDMX aquí o directo en la hoja cuando las tengas)
    disp.getRange(2, 1, 1, 5).setValues([
      ['2026-12-15', '2026-12-23', 'Aguascalientes', '', '9:00, 10:00, 11:00, 12:00, 13:00, 14:00, 15:00, 16:00, 17:00'],
    ]);
  }

  carpeta_();

  // Disparador para enviar correos cuando editas Estado o Respuesta
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'alEditar')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('alEditar').forSpreadsheet(ss).onEdit().create();

  Logger.log('Listo ✅  Ahora ve a Implementar > Nueva implementación > App web.');
}

/* ===================== Endpoints ===================== */

function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || '';
    if (action === 'disponibilidad') return json_(Object.assign({ ok: true }, disponibilidad_()));
    return json_({ ok: true, mensaje: 'API de agenda activa' });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const d = JSON.parse(e.postData.contents);

    if (d.website) return json_({ ok: true, folio: 'OK' }); // bot (honeypot)

    // Validación básica
    const req = ['nombre', 'telefono', 'correo', 'paquete', 'ubicacion', 'fecha', 'hora'];
    for (const k of req) if (!d[k] || !String(d[k]).trim()) throw new Error('Falta el campo ' + k);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.fecha) || !/^\d{2}:\d{2}$/.test(d.hora)) throw new Error('Fecha u hora inválida');
    if (!d.comprobante || !d.comprobante.base64) throw new Error('Falta el comprobante');

    // Revisa que el horario siga libre (evita dobles reservas)
    const disp = disponibilidad_();
    const lugar = normLugar_(d.ubicacion);
    if ((((disp.ubicaciones[lugar] || {})[d.fecha]) || []).indexOf(d.hora) === -1) {
      return json_({ ok: false, code: 'OCUPADO', error: 'Ese horario se acaba de ocupar. Elige otro, por favor.' });
    }

    // Guarda el comprobante en Drive
    const bytes = Utilities.base64Decode(d.comprobante.base64);
    if (bytes.length > CONFIG.MAX_MB * 1024 * 1024) throw new Error('Comprobante demasiado grande');
    const tipo = String(d.comprobante.tipo || '');
    if (!/^image\/|application\/pdf/.test(tipo)) throw new Error('Tipo de archivo no permitido');

    const folio = 'C' + Utilities.formatDate(new Date(), CONFIG.ZONA, 'yyMMdd') + '-' +
      Math.random().toString(36).slice(2, 6).toUpperCase();
    const ext = (String(d.comprobante.nombre).split('.').pop() || 'jpg').slice(0, 5);
    const archivo = carpeta_().createFile(
      Utilities.newBlob(bytes, tipo, `${d.fecha}_${d.hora.replace(':', '')}_${folio}.${ext}`));

    // Guarda la cita (el apóstrofo fuerza texto para que Sheets no convierta la fecha)
    const hoja = SpreadsheetApp.getActive().getSheetByName(CONFIG.HOJA_CITAS);
    hoja.appendRow([
      folio,
      Utilities.formatDate(new Date(), CONFIG.ZONA, 'yyyy-MM-dd HH:mm'),
      limpio_(d.nombre), "'" + limpio_(d.telefono), limpio_(d.correo),
      limpio_(d.paquete), Number(d.precio) || '', limpio_(d.extras || ''), Number(d.total) || '', Number(d.anticipo) || '',
      "'" + d.fecha, "'" + d.hora, limpio_(d.ubicacion),
      limpio_(d.preguntas || ''), archivo.getUrl(), 'Pendiente', '',
    ]);

    avisos_(d, folio, archivo.getUrl());
    return json_({ ok: true, folio: folio });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

/* ===================== Disponibilidad ===================== */

function disponibilidad_() {
  const ss = SpreadsheetApp.getActive();
  const tz = ss.getSpreadsheetTimeZone();
  const ocupados = {}, diasBloq = {}, horasBloq = {}, rangos = [];

  // Citas activas (un horario ocupado lo está en ambas ciudades: no puedes estar en dos lugares)
  const citas = ss.getSheetByName(CONFIG.HOJA_CITAS);
  if (citas && citas.getLastRow() > 1) {
    const iF = COLUMNAS.indexOf('Fecha'), iH = COLUMNAS.indexOf('Hora'), iE = COLUMNAS.indexOf('Estado');
    citas.getRange(2, 1, citas.getLastRow() - 1, COLUMNAS.length).getValues().forEach(r => {
      if (String(r[iE]).trim() === 'Cancelada') return;
      const f = aFecha_(r[iF], tz), h = aHora_(r[iH], tz);
      if (f && h) ocupados[f + '|' + h] = true;
    });
  }

  // Bloqueos manuales
  const bloq = ss.getSheetByName(CONFIG.HOJA_BLOQUEOS);
  if (bloq && bloq.getLastRow() > 1) {
    bloq.getRange(2, 1, bloq.getLastRow() - 1, 3).getValues().forEach(r => {
      const f = aFecha_(r[0], tz); if (!f) return;
      const hasta = aFecha_(r[1], tz), h = aHora_(r[2], tz);
      if (hasta) rangos.push([f, hasta]);
      else if (h) horasBloq[f + '|' + h] = true;
      else diasBloq[f] = true;
    });
  }
  const diaBloqueado = f => diasBloq[f] || rangos.some(([a, b]) => f >= a && f <= b);

  // Ventana de fechas reservables
  const ahora = new Date();
  const limite = ahora.getTime() + CONFIG.ANTICIPACION_HORAS * 3600 * 1000;
  const base = new Date(Utilities.formatDate(ahora, CONFIG.ZONA, 'yyyy-MM-dd') + 'T12:00:00' + CONFIG.OFFSET);
  const ventana = [];
  for (let i = 0; i <= CONFIG.DIAS_ADELANTE; i++) {
    const dia = new Date(base.getTime() + i * 86400000);
    ventana.push({
      f: Utilities.formatDate(dia, CONFIG.ZONA, 'yyyy-MM-dd'),
      dow: Number(Utilities.formatDate(dia, CONFIG.ZONA, 'u')) % 7, // 0 = domingo
    });
  }

  // Lo que anotaste en la hoja Disponibilidad
  const ubicaciones = {};
  const hoja = ss.getSheetByName(CONFIG.HOJA_DISPONIBILIDAD);
  if (hoja && hoja.getLastRow() > 1) {
    hoja.getRange(2, 1, hoja.getLastRow() - 1, 5).getValues().forEach(r => {
      const ini = aFecha_(r[0], tz); if (!ini) return;
      const fin = aFecha_(r[1], tz) || ini;
      const lugar = normLugar_(r[2]); if (!lugar) return;
      const dias = parseDias_(r[3]);
      const horas = parseHoras_(r[4], tz); if (!horas.length) return;
      ventana.forEach(({ f, dow }) => {
        if (f < ini || f > fin || (dias && dias.indexOf(dow) === -1)) return;
        const mapa = ubicaciones[lugar] = ubicaciones[lugar] || {};
        mapa[f] = mapa[f] || [];
        horas.forEach(h => { if (mapa[f].indexOf(h) === -1) mapa[f].push(h); });
      });
    });
  }

  Object.keys(ubicaciones).forEach(l => {
    const mapa = ubicaciones[l];
    Object.keys(mapa).forEach(f => {
      mapa[f] = diaBloqueado(f) ? [] : mapa[f].sort().filter(h =>
        !ocupados[f + '|' + h] && !horasBloq[f + '|' + h] &&
        new Date(f + 'T' + h + ':00' + CONFIG.OFFSET).getTime() > limite);
    });
  });

  return { desde: ventana[0].f, hasta: ventana[ventana.length - 1].f, ubicaciones };
}

function normLugar_(v) {
  const s = String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
  const alias = { cdmx: 'ciudad de mexico', df: 'ciudad de mexico', 'cd. de mexico': 'ciudad de mexico', ags: 'aguascalientes' };
  return alias[s] || s;
}

/** "L-V", "L, M, J", "lunes, miércoles" → [1,2,3...]. Vacío → null (todos). */
function parseDias_(v) {
  const s = String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
  if (!s) return null;
  const num = t => {
    if (t === 'X' || t.indexOf('MI') === 0) return 3;
    if (t.indexOf('D') === 0) return 0;
    if (t.indexOf('L') === 0) return 1;
    if (t.indexOf('M') === 0) return 2;
    if (t.indexOf('J') === 0) return 4;
    if (t.indexOf('V') === 0) return 5;
    if (t.indexOf('S') === 0) return 6;
    return -1;
  };
  const out = [];
  s.split(/[,;\s]+/).filter(Boolean).forEach(tok => {
    const partes = tok.split('-');
    if (partes.length === 2) {
      let a = num(partes[0]), b = num(partes[1]);
      if (a < 0 || b < 0) return;
      for (let i = a; ; i = (i + 1) % 7) { out.push(i); if (i === b) break; }
    } else if (num(tok) >= 0) out.push(num(tok));
  });
  return out.length ? out : null;
}

function parseHoras_(v, tz) {
  if (v instanceof Date) return [aHora_(v, tz)];
  return String(v || '').split(/[,;]+/).map(x => aHora_(x, tz)).filter(Boolean);
}

/* ===================== Correos ===================== */

function avisos_(d, folio, urlComprobante) {
  const cuando = fechaLarga_(d.fecha) + ' a las ' + d.hora + ' en ' + d.ubicacion;
  try {
    if (CONFIG.EMAIL_DUENO) {
      MailApp.sendEmail({
        to: CONFIG.EMAIL_DUENO,
        subject: `Nueva reserva ${folio}: ${d.nombre} — ${cuando}`,
        htmlBody: `<p><b>${esc_(d.nombre)}</b> reservó el paquete <b>${esc_(d.paquete)}</b> ($${d.precio})${d.extras ? ' + ' + esc_(d.extras) : ''}.<br>Total: $${d.total} · Anticipo transferido: $${d.anticipo}</p>
          <p>📅 ${cuando}<br>📞 ${esc_(d.telefono)}<br>✉️ ${esc_(d.correo)}</p>
          ${d.preguntas ? `<p><b>Pregunta:</b><br>${esc_(d.preguntas)}</p>` : ''}
          <p><a href="${urlComprobante}">Ver comprobante</a> · <a href="${SpreadsheetApp.getActive().getUrl()}">Abrir agenda</a></p>`,
      });
    }
    if (CONFIG.EMAIL_CLIENTE_AL_RESERVAR) {
      MailApp.sendEmail({
        to: d.correo,
        name: CONFIG.NOMBRE_NEGOCIO,
        replyTo: CONFIG.EMAIL_DUENO || undefined,
        subject: `Recibimos tu solicitud (${folio})`,
        htmlBody: `<p>Hola ${esc_(String(d.nombre).split(' ')[0])},</p>
          <p>Recibimos tu solicitud para el paquete <b>${esc_(d.paquete)}</b>${d.extras ? ' + ' + esc_(d.extras) : ''} el <b>${cuando}</b>.</p>
          <p>Total de tu sesión: <b>$${d.total}</b> · Anticipo: <b>$${d.anticipo}</b> · Resto el día de la sesión: <b>$${Math.max(0, d.total - d.anticipo)}</b></p>
          <p>Revisaremos tu comprobante y te confirmaremos muy pronto. Tu horario queda apartado mientras tanto.</p>
          <p>Folio: <b>${folio}</b></p><p>— ${CONFIG.NOMBRE_NEGOCIO}</p>`,
      });
    }
  } catch (err) { console.error('Error enviando correos', err); }
}

/** Se ejecuta cuando editas la hoja (instalado por setup). */
function alEditar(e) {
  const hoja = e.range.getSheet();
  if (hoja.getName() !== CONFIG.HOJA_CITAS || e.range.getRow() < 2 || e.range.getNumRows() > 1) return;
  const fila = hoja.getRange(e.range.getRow(), 1, 1, COLUMNAS.length).getValues()[0];
  const v = n => fila[COLUMNAS.indexOf(n)];
  const correo = v('Correo'); if (!correo) return;
  const tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone();
  const cuando = fechaLarga_(aFecha_(v('Fecha'), tz)) + ' a las ' + aHora_(v('Hora'), tz) + ' en ' + v('Ubicación');
  const nombre = String(v('Nombre')).split(' ')[0];
  const col = e.range.getColumn();

  if (col === col_('Estado') && e.value === 'Confirmada' && CONFIG.EMAIL_CLIENTE_AL_CONFIRMAR) {
    MailApp.sendEmail({
      to: correo, name: CONFIG.NOMBRE_NEGOCIO, replyTo: CONFIG.EMAIL_DUENO || undefined,
      subject: `¡Tu sesión está confirmada! (${v('Folio')})`,
      htmlBody: `<p>Hola ${esc_(nombre)},</p><p>Confirmamos tu pago. Te esperamos el <b>${cuando}</b> para tu sesión <b>${esc_(v('Paquete'))}</b>.</p><p>— ${CONFIG.NOMBRE_NEGOCIO}</p>`,
    });
  }
  if (col === col_('Respuesta') && e.value && CONFIG.EMAIL_CLIENTE_AL_RESPONDER) {
    MailApp.sendEmail({
      to: correo, name: CONFIG.NOMBRE_NEGOCIO, replyTo: CONFIG.EMAIL_DUENO || undefined,
      subject: `Respuesta a tu pregunta (${v('Folio')})`,
      htmlBody: `<p>Hola ${esc_(nombre)},</p><p><i>Tu pregunta:</i><br>${esc_(v('Preguntas'))}</p><p><i>Respuesta:</i><br>${esc_(e.value)}</p><p>— ${CONFIG.NOMBRE_NEGOCIO}</p>`,
    });
  }
}

/* ===================== Utilidades ===================== */

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function col_(nombre) { return COLUMNAS.indexOf(nombre) + 1; }
function limpio_(s) { return String(s).trim().slice(0, 2000).replace(/^[=+\-@]/, "'$&"); } // evita fórmulas inyectadas
function esc_(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/\n/g, '<br>'); }
function aFecha_(v, tz) {
  if (v instanceof Date) return Utilities.formatDate(v, tz, 'yyyy-MM-dd');
  const s = String(v || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}
function aHora_(v, tz) {
  if (v instanceof Date) return Utilities.formatDate(v, tz, 'HH:mm');
  const m = String(v || '').trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(a\.?\s*m\.?|p\.?\s*m\.?)?$/);
  if (!m) return '';
  let h = Number(m[1]);
  if (m[3] && m[3][0] === 'p' && h < 12) h += 12;
  if (m[3] && m[3][0] === 'a' && h === 12) h = 0;
  return ('0' + h).slice(-2) + ':' + (m[2] || '00');
}
function fechaLarga_(ymd) {
  if (!ymd) return '';
  const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const d = new Date(ymd + 'T12:00:00' + CONFIG.OFFSET);
  const dow = Number(Utilities.formatDate(d, CONFIG.ZONA, 'u')) % 7;
  const [, m, dd] = ymd.split('-').map(Number);
  return `${dias[dow]} ${dd} de ${meses[m - 1]}`;
}
function carpeta_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('CARPETA_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (_) {} }
  const f = DriveApp.createFolder(CONFIG.CARPETA_COMPROBANTES);
  props.setProperty('CARPETA_ID', f.getId());
  return f;
}
