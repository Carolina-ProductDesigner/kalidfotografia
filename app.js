(() => {
  "use strict";
  const C = window.CONFIG;
  const DEMO = !C.appsScriptUrl;
  const $ = (s, r = document) => r.querySelector(s);

  const state = { porUbicacion: {}, fechas: {}, desde: null, hasta: null, mes: null, fecha: null, hora: null, cargando: true, error: null };

  /* ---------- Utilidades ---------- */
  const money = (n) =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency: C.moneda || "MXN", minimumFractionDigits: Number.isInteger(n) ? 0 : 2 }).format(n) + " " + (C.moneda || "MXN");
  const pad = (n) => String(n).padStart(2, "0");
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseYmd = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const fechaLarga = (s) => parseYmd(s).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
  const hora12 = (h) => {
    const [hh, mm] = h.split(":").map(Number);
    return `${((hh + 11) % 12) + 1}:${pad(mm)} ${hh < 12 ? "am" : "pm"}`;
  };
  const getPath = (path) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), C);
  const normLugar = (v) => {
    const s = String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
    return ({ cdmx: "ciudad de mexico", ags: "aguascalientes" })[s] || s;
  };
  const paqueteSel = () => C.paquetes.find((p) => p.id === $("#paquete").value);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  /** Escribe texto envolviendo los números (y su $) en <span class="num"> → Didot itálica */
  const conNumeros = (node, texto) => {
    node.replaceChildren();
    String(texto).split(/(\$?\d[\d,.]*)/).forEach((parte, i) => {
      if (!parte) return;
      node.append(i % 2 ? el("span", "num", parte) : document.createTextNode(parte));
    });
  };

  /* ---------- Textos desde config ---------- */
  document.querySelectorAll("[data-bind]").forEach((n) => { const v = getPath(n.dataset.bind); if (v != null) n.textContent = v; });
  document.title = `${C.negocio.nombre} · Agenda tu sesión`;
  $("#year").textContent = new Date().getFullYear();
  if (DEMO) console.info("Modo demo: horarios de prueba. Conecta Google Sheets en config.js → appsScriptUrl");

  /* ---------- Paquete ---------- */
  function renderPaquetes() {
    const grid = $("#paquetes-grid");
    $("#paquete").value = C.paquetes[0].id; // paquete único: queda seleccionado siempre
    C.paquetes.forEach((p, idx) => {
      const card = el("article", "plan reveal" + (C.paquetes.length === 1 ? " plan--single" : ""));
      card.style.setProperty("--d", idx);
      const izq = el("div", "plan-main");
      izq.append(el("h3", null, p.nombre));
      if (p.personas) izq.append(el("p", "plan-meta", p.personas));
      const price = el("p", "price");
      conNumeros(price, money(p.precio).replace(` ${C.moneda}`, ""));
      price.append(el("small", null, ` ${C.moneda}`));
      izq.append(price);
      const der = el("div", "plan-detail");
      const ul = el("ul");
      if (p.duracion) ul.append(el("li", null, p.duracion));
      (p.incluye || []).forEach((t) => ul.append(el("li", null, t)));
      der.append(ul);
      if (C.anticipo) {
        const ap = el("p", "plan-anticipo");
        conNumeros(ap, `Apartas tu lugar con ${money(C.anticipo)}`);
        der.append(ap);
        if (C.notaAnticipo) der.append(el("p", "plan-meta", `(${C.notaAnticipo.toLowerCase()})`));
      }
      const a = el("a", "btn", "Agendar mi sesión");
      a.href = "#agenda";
      der.append(a);
      card.append(izq, der);
      grid.append(card);
    });
    // Resumen dentro del formulario
    const p = C.paquetes[0], r = $("#paquete-resumen");
    const top = el("div", "pkg-top");
    top.append(el("strong", null, p.nombre));
    const pr = el("span", "pkg-precio"); conNumeros(pr, money(p.precio)); top.append(pr);
    const lista = el("ul", "pkg-lista");
    [p.personas, p.duracion, ...(p.incluye || [])].filter(Boolean).forEach((t) => {
      const li = el("li"); conNumeros(li, t); lista.append(li);
    });
    r.append(top, lista);
  }

  /* ---------- Código de descuento ---------- */
  let cupon = null; // { codigo, monto }
  function buscarCodigo(txt) {
    const t = String(txt || "").trim().toLowerCase();
    const k = Object.keys(C.codigos || {}).find((c) => c.toLowerCase() === t);
    return k ? { codigo: k, monto: Number(C.codigos[k].monto) || 0 } : null;
  }
  function aplicarCodigo() {
    const inp = $("#codigo"), est = $("#codigo-estado");
    const t = inp.value.trim();
    est.className = "cupon-estado";
    if (!t) { cupon = null; est.textContent = ""; actualizarResumen(); return; }
    const c = buscarCodigo(t);
    if (c) {
      cupon = c; inp.value = c.codigo;
      est.textContent = `Código ${c.codigo} aplicado: −${money(c.monto)}`; est.classList.add("ok");
    } else {
      cupon = null; est.textContent = "Ese código no es válido."; est.classList.add("error");
    }
    actualizarResumen();
  }

  /* ---------- Extras y notas ---------- */
  const extrasSel = () => (C.extras || []).filter((x) => { const c = document.getElementById("extra-" + x.id); return c && c.checked; });
  function renderExtras() {
    const cont = $("#extras");
    if (!(C.extras || []).length) { $("#extras-field").hidden = true; return; }
    C.extras.forEach((x) => {
      const lab = el("label", "check");
      const inp = el("input"); inp.type = "checkbox"; inp.id = "extra-" + x.id; inp.value = x.id;
      inp.addEventListener("change", actualizarResumen);
      lab.append(inp, el("span", "check-box"), el("span", "check-text", x.nombre), el("span", "check-price", "+" + money(x.precio)));
      cont.append(lab);
    });
    const hd = C.extras[0];
    if ($("#nota-extras")) $("#nota-extras").textContent = `${hd.nombre}: +${money(hd.precio)} adicionales.`;
  }

  /* ---------- Ubicaciones ---------- */
  function renderUbicaciones() {
    const sel = $("#ubicacion");
    (C.ubicaciones || []).forEach((u) => sel.append(new Option(u, u)));
    if ((C.ubicaciones || []).length === 1) sel.value = C.ubicaciones[0];
    const hc = $("#hero-ciudades");
    if (hc && C.ubicaciones && C.ubicaciones.length) hc.textContent = C.ubicaciones.join(" y ");
  }

  /* ---------- Datos bancarios ---------- */
  function renderBanco() {
    const dl = $("#bank");
    const filas = [
      ["Banco", C.pago.banco],
      ["Titular", C.pago.titular],
      ["CLABE", C.pago.clabe, true],
      ["Cuenta", C.pago.cuenta, true],
      ["Concepto", C.pago.concepto],
    ].filter((f) => f[1]);
    filas.forEach(([k, v, copiable]) => {
      const dd = el("dd", null, v);
      if (copiable && navigator.clipboard) {
        const b = el("button", "copy", "Copiar");
        b.type = "button";
        b.addEventListener("click", async () => {
          try { await navigator.clipboard.writeText(v); b.textContent = "¡Copiado!"; setTimeout(() => (b.textContent = "Copiar"), 1500); } catch (_) {}
        });
        dd.append(b);
      }
      dl.append(el("dt", null, k), dd);
    });
  }

  function calcular() {
    const p = paqueteSel();
    const ex = extrasSel();
    const subtotal = (p ? p.precio : 0) + ex.reduce((s, x) => s + x.precio, 0);
    const descuento = cupon ? Math.min(cupon.monto, subtotal) : 0;
    const total = subtotal - descuento;
    const anticipo = C.anticipo ? (p ? Math.min(C.anticipo, total) : C.anticipo) : total;
    return { p, ex, subtotal, descuento, total, anticipo, resto: Math.max(0, total - anticipo) };
  }

  function actualizarResumen() {
    const { p, ex, descuento, total, anticipo, resto } = calcular();
    const dl = $("#desglose");
    dl.replaceChildren();
    const fila = (k, v, cls) => { dl.append(el("dt", cls, k), el("dd", cls, v)); };
    if (p) {
      fila(/^paquete/i.test(p.nombre) ? p.nombre : `Paquete ${p.nombre}`, money(p.precio));
      ex.forEach((x) => fila(x.nombre, "+" + money(x.precio)));
      if (descuento) fila(`Descuento ${cupon.codigo}`, "−" + money(descuento));
      fila("Total de la sesión", money(total), "strong");
      if (C.anticipo) fila("Resto, antes de iniciar", money(resto));
    }
    $("#total").textContent = money(anticipo);
    $("#anticipo-nota").textContent = C.anticipo ? (C.notaAnticipo || "") : "";
    const partes = [];
    if (p && C.paquetes.length > 1) partes.push(`Paquete ${p.nombre}`);
    if ($("#ubicacion").value) partes.push($("#ubicacion").value);
    if (state.fecha) partes.push(fechaLarga(state.fecha));
    if (state.hora) partes.push(hora12(state.hora));
    $("#resumen-cita").textContent = partes.join(" · ");
  }

  /* ---------- Disponibilidad ---------- */
  async function cargarDisponibilidad() {
    state.cargando = true; state.error = null;
    renderCalendario();
    try {
      const data = DEMO ? await demoDisponibilidad() : await (await fetch(`${C.appsScriptUrl}?action=disponibilidad`)).json();
      if (!data.ok) throw new Error(data.error || "No se pudo cargar la agenda");
      state.porUbicacion = {};
      Object.entries(data.ubicaciones || {}).forEach(([k, v]) => (state.porUbicacion[normLugar(k)] = v));
      state.desde = data.desde;
      state.hasta = data.hasta;
      aplicarUbicacion(false);
    } catch (err) {
      console.error(err);
      state.error = "No pudimos cargar los horarios. Revisa tu conexión e intenta de nuevo.";
    }
    state.cargando = false;
    renderCalendario();
    renderSlots();
    actualizarResumen();
  }

  /** Toma las fechas de la ubicación elegida y ubica el calendario en su primer mes con lugar. */
  function aplicarUbicacion(irAPrimerMes) {
    state.fechas = state.porUbicacion[normLugar($("#ubicacion").value)] || {};
    if (irAPrimerMes || !state.mes) {
      const primera = Object.keys(state.fechas).sort().find((f) => state.fechas[f].length) || state.desde;
      if (primera) { const d = parseYmd(primera); state.mes = new Date(d.getFullYear(), d.getMonth(), 1); }
    }
    // Si el horario elegido ya no existe, se limpia
    if (state.fecha && !(state.fechas[state.fecha] || []).includes(state.hora)) state.hora = null;
    if (state.fecha && !(state.fechas[state.fecha] || []).length) state.fecha = null;
  }

  function renderCalendario() {
    const cal = $("#calendar");
    cal.replaceChildren();

    if (state.cargando || state.error) {
      const box = el("div", "cal-msg");
      if (state.cargando) box.append(el("div", "spinner"), el("span", null, "Cargando disponibilidad…"));
      else {
        box.append(el("span", null, state.error));
        const b = el("button", "btn btn-sm btn-ghost", "Reintentar");
        b.type = "button"; b.onclick = cargarDisponibilidad; box.append(b);
      }
      cal.append(box);
      return;
    }

    const ubic = $("#ubicacion").value;
    if (!ubic) {
      const box = el("div", "cal-msg");
      box.append(el("span", null, "Primero elige una ubicación para ver las fechas disponibles."));
      cal.append(box);
      return;
    }

    const y = state.mes.getFullYear(), m = state.mes.getMonth();
    const hoy = ymd(new Date());
    const mesDesde = state.desde.slice(0, 7), mesHasta = state.hasta.slice(0, 7);
    const mesActual = `${y}-${pad(m + 1)}`;

    const head = el("div", "cal-head");
    const prev = el("button", "cal-nav", "‹"); prev.type = "button"; prev.setAttribute("aria-label", "Mes anterior");
    const next = el("button", "cal-nav", "›"); next.type = "button"; next.setAttribute("aria-label", "Mes siguiente");
    prev.disabled = mesActual <= mesDesde;
    next.disabled = mesActual >= mesHasta;
    prev.onclick = () => { state.mes = new Date(y, m - 1, 1); renderCalendario(); };
    next.onclick = () => { state.mes = new Date(y, m + 1, 1); renderCalendario(); };
    const titulo = el("span", "cal-title");
    conNumeros(titulo, state.mes.toLocaleDateString("es-MX", { month: "long", year: "numeric" }));
    head.append(prev, titulo, next);

    const grid = el("div", "cal-grid");
    ["L", "M", "M", "J", "V", "S", "D"].forEach((d) => grid.append(el("span", "cal-dow", d)));
    const offset = (new Date(y, m, 1).getDay() + 6) % 7;
    for (let i = 0; i < offset; i++) grid.append(el("span"));

    const diasMes = new Date(y, m + 1, 0).getDate();
    for (let d = 1; d <= diasMes; d++) {
      const key = `${mesActual}-${pad(d)}`;
      const slots = state.fechas[key];
      const enRango = key >= state.desde && key <= state.hasta;
      let estado = "off";
      if (enRango) estado = slots && slots.length ? "available" : "blocked";
      const b = el("button", `day ${estado}`, String(d));
      b.type = "button";
      if (key === hoy) b.classList.add("today");
      if (key === state.fecha) b.classList.add("selected");
      b.disabled = estado !== "available";
      b.setAttribute("aria-label", `${fechaLarga(key)}${estado === "available" ? ", disponible" : ", no disponible"}`);
      if (estado === "available") b.onclick = () => { state.fecha = key; state.hora = null; limpiarError("agenda"); renderCalendario(); renderSlots(); actualizarResumen(); };
      grid.append(b);
    }
    cal.append(head, grid);
  }

  function renderSlots() {
    const cont = $("#slots");
    cont.replaceChildren();
    const ubic = $("#ubicacion").value;
    if (ubic && !Object.values(state.fechas).some((s) => s.length)) {
      $("#slots-title").textContent = "Aún no hay fechas";
      cont.append(el("p", "slots-empty", `Todavía no abro agenda en ${ubic}. Escríbeme por WhatsApp al ${C.negocio.whatsapp} y te aviso en cuanto haya fechas.`));
      return;
    }
    if (!state.fecha) { $("#slots-title").textContent = "Elige un día disponible"; return; }
    conNumeros($("#slots-title"), fechaLarga(state.fecha));
    const slots = state.fechas[state.fecha] || [];
    if (!slots.length) { cont.append(el("p", "slots-empty", "Ya no hay horarios este día.")); return; }
    slots.forEach((h) => {
      const b = el("button", "slot" + (h === state.hora ? " selected" : ""), hora12(h));
      b.type = "button";
      b.setAttribute("aria-pressed", h === state.hora);
      b.onclick = () => { state.hora = h; limpiarError("agenda"); renderSlots(); actualizarResumen(); };
      cont.append(b);
    });
  }

  /* ---------- Validación ---------- */
  function setError(campo, msg) {
    const p = document.querySelector(`[data-error-for="${campo}"]`);
    if (p) { p.textContent = msg; p.closest(".field").classList.add("invalid"); }
  }
  function limpiarError(campo) {
    const p = document.querySelector(`[data-error-for="${campo}"]`);
    if (p) { p.textContent = ""; p.closest(".field").classList.remove("invalid"); }
  }

  function validar() {
    let ok = true;
    const f = (id) => $("#" + id).value.trim();
    ["nombre", "ubicacion", "agenda", "telefono", "correo", "comprobante"].forEach(limpiarError);

    if (f("nombre").split(/\s+/).length < 2) { setError("nombre", "Escribe tu nombre y apellido."); ok = false; }
    if (!f("ubicacion")) { setError("ubicacion", "Selecciona una ubicación."); ok = false; }
    if (!state.fecha || !state.hora) { setError("agenda", "Elige un día y un horario."); ok = false; }
    if (f("telefono").replace(/\D/g, "").length < 10) { setError("telefono", "Escribe un teléfono de 10 dígitos."); ok = false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f("correo"))) { setError("correo", "Revisa tu correo."); ok = false; }

    const file = $("#comprobante").files[0];
    if (!file) { setError("comprobante", "Adjunta tu comprobante de pago."); ok = false; }
    else if (file.size > C.maxComprobanteMB * 1024 * 1024) { setError("comprobante", `El archivo pesa más de ${C.maxComprobanteMB} MB.`); ok = false; }
    else if (!/^image\/|application\/pdf/.test(file.type)) { setError("comprobante", "Sube una imagen o un PDF."); ok = false; }

    if (!ok) {
      const primero = document.querySelector(".invalid");
      if (primero) primero.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    return ok;
  }

  const aBase64 = (file) => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });

  /* ---------- Envío ---------- */
  function setStatus(msg, tipo) { const s = $("#form-status"); s.textContent = msg || ""; s.className = "form-status" + (tipo ? " " + tipo : ""); }

  async function enviar(e) {
    e.preventDefault();
    setStatus("");
    if (!comprobanteValido()) { setError("comprobante", "Adjunta tu comprobante de pago para poder enviar."); actualizarBoton(); return; }
    if (!validar()) return;

    const btn = $("#submit");
    btn.disabled = true; btn.textContent = "Enviando…";
    try {
      const file = $("#comprobante").files[0];
      const p = paqueteSel();
      const payload = {
        nombre: $("#nombre").value.trim(),
        telefono: $("#telefono").value.trim(),
        correo: $("#correo").value.trim(),
        paqueteId: p.id,
        paquete: p.nombre,
        precio: p.precio,
        extras: extrasSel().map((x) => x.nombre).join(", "),
        codigo: cupon ? cupon.codigo : "",
        descuento: calcular().descuento,
        total: calcular().total,
        anticipo: calcular().anticipo,
        ubicacion: $("#ubicacion").value,
        fecha: state.fecha,
        hora: state.hora,
        preguntas: $("#preguntas").value.trim(),
        website: $('[name="website"]').value,
        comprobante: { nombre: file.name, tipo: file.type, base64: await aBase64(file) },
      };

      let res;
      if (DEMO) {
        await new Promise((r) => setTimeout(r, 900));
        res = { ok: true, folio: "DEMO-" + Math.floor(Math.random() * 9000 + 1000) };
      } else {
        // Sin encabezados personalizados = sin "preflight" CORS (Apps Script no lo soporta)
        const r = await fetch(C.appsScriptUrl, { method: "POST", body: JSON.stringify(payload) });
        res = await r.json();
      }

      if (!res.ok) {
        if (res.code === "OCUPADO") {
          setError("agenda", res.error);
          await cargarDisponibilidad();
          $("#calendar").scrollIntoView({ behavior: "smooth", block: "center" });
          return;
        }
        throw new Error(res.error || "No se pudo enviar.");
      }

      $("#success-text").textContent =
        `${payload.nombre.split(" ")[0]}, apartamos tu sesión ${p.nombre} en ${payload.ubicacion} el ${fechaLarga(payload.fecha)} a las ${hora12(payload.hora)}. Folio: ${res.folio}.`;
      $("#booking-form").hidden = true;
      $("#success").hidden = false;
      $("#success").scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (err) {
      console.error(err);
      setStatus("Algo salió mal al enviar. Intenta de nuevo o escríbeme por WhatsApp.", "error");
    } finally {
      actualizarBoton();
    }
  }

  function reiniciar() {
    const form = $("#booking-form");
    form.reset();
    $("#paquete").value = C.paquetes[0].id;
    cupon = null; $("#codigo-estado").textContent = "";
    actualizarResumen();
    state.fecha = null; state.hora = null; state.mes = null;
    $("#dropzone-text").textContent = "Toca para adjuntar imagen o PDF";
    $(".dropzone").classList.remove("has-file");
    actualizarBoton();
    $("#success").hidden = true;
    form.hidden = false;
    actualizarResumen();
    cargarDisponibilidad();
    form.scrollIntoView({ behavior: "smooth" });
  }

  /* ---------- Sin Google Sheets: usa la agenda escrita en config.js → disponibilidad ---------- */
  function demoDisponibilidad() {
    const hoy = new Date(); hoy.setHours(12, 0, 0, 0);
    const limite = Date.now() + (C.anticipacionHoras ?? 24) * 3600e3;
    const fin = new Date(hoy); fin.setDate(hoy.getDate() + 120);
    const ubicaciones = {};
    (C.disponibilidad || []).forEach((b) => {
      const lugar = b.ubicacion;
      ubicaciones[lugar] = ubicaciones[lugar] || {};
      const d = parseYmd(b.desde), hasta = parseYmd(b.hasta || b.desde);
      for (; d <= hasta; d.setDate(d.getDate() + 1)) {
        if (b.dias && !b.dias.includes(d.getDay())) continue;
        const key = ymd(d);
        const libres = (b.horarios || []).filter((h) => {
          const [hh, mm] = h.split(":").map(Number);
          return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh, mm).getTime() > limite;
        });
        ubicaciones[lugar][key] = [...new Set([...(ubicaciones[lugar][key] || []), ...libres])].sort();
      }
    });
    return Promise.resolve({ ok: true, desde: ymd(hoy), hasta: ymd(fin), ubicaciones });
  }

  /* ---------- Botón Enviar: bloqueado hasta adjuntar el comprobante ---------- */
  function comprobanteValido() {
    const f = $("#comprobante").files[0];
    return !!f && f.size <= C.maxComprobanteMB * 1024 * 1024 && /^image\/|application\/pdf/.test(f.type);
  }
  function actualizarBoton() {
    const btn = $("#submit");
    const ok = comprobanteValido();
    btn.disabled = !ok;
    btn.textContent = ok ? "Enviar" : "Adjunta tu comprobante para enviar";
  }

  /* ---------- Inicio ---------- */
  renderPaquetes();
  renderExtras();
  renderUbicaciones();
  renderBanco();
  actualizarResumen();
  cargarDisponibilidad();

  $("#aplicar-codigo").addEventListener("click", aplicarCodigo);
  $("#codigo").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); aplicarCodigo(); } });
  $("#codigo").addEventListener("input", () => {
    if (cupon && $("#codigo").value.trim().toLowerCase() !== cupon.codigo.toLowerCase()) { cupon = null; $("#codigo-estado").textContent = ""; actualizarResumen(); }
  });
  $("#ubicacion").addEventListener("change", () => {
    state.fecha = null; state.hora = null;
    aplicarUbicacion(true);
    renderCalendario(); renderSlots(); actualizarResumen();
    limpiarError("ubicacion"); limpiarError("agenda");
  });
  ["nombre", "telefono", "correo"].forEach((id) => $("#" + id).addEventListener("input", () => limpiarError(id)));
  $("#comprobante").addEventListener("change", (e) => {
    const f = e.target.files[0];
    $("#dropzone-text").textContent = f ? `📎 ${f.name}` : "Toca para adjuntar imagen o PDF";
    $(".dropzone").classList.toggle("has-file", !!f);
    limpiarError("comprobante");
    if (f && !comprobanteValido()) {
      setError("comprobante", f.size > C.maxComprobanteMB * 1024 * 1024 ? `El archivo pesa más de ${C.maxComprobanteMB} MB.` : "Sube una imagen o un PDF.");
    }
    actualizarBoton();
  });
  actualizarBoton();
  $("#booking-form").addEventListener("submit", enviar);
  $("#again").addEventListener("click", reiniciar);
})();
