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

  /* ---------- Textos desde config ---------- */
  document.querySelectorAll("[data-bind]").forEach((n) => { const v = getPath(n.dataset.bind); if (v != null) n.textContent = v; });
  document.title = `${C.negocio.nombre} · Agenda tu sesión`;
  $("#year").textContent = new Date().getFullYear();
  if (DEMO) $("#demo-banner").hidden = false;

  /* ---------- Paquetes ---------- */
  function renderPaquetes() {
    const grid = $("#paquetes-grid");
    const select = $("#paquete");
    C.paquetes.forEach((p) => {
      const card = el("article", "plan reveal" + (p.destacado ? " plan--featured" : ""));
      card.style.setProperty("--d", C.paquetes.indexOf(p));
      if (p.destacado) card.append(el("span", "badge", "Más popular"));
      card.append(el("h3", null, p.nombre));
      if (p.descripcion) card.append(el("p", "plan-desc", p.descripcion));
      const price = el("p", "price", money(p.precio).replace(` ${C.moneda}`, ""));
      price.append(el("small", null, ` ${C.moneda}`));
      card.append(price);
      if (p.duracion) card.append(el("p", "plan-meta", p.duracion));
      const ul = el("ul");
      (p.incluye || []).forEach((i) => ul.append(el("li", null, i)));
      card.append(ul);
      const a = el("a", "btn" + (p.destacado ? "" : " btn-ghost"), "Elegir");
      a.href = "#agenda";
      a.addEventListener("click", () => { select.value = p.id; actualizarResumen(); limpiarError("paquete"); });
      card.append(a);
      grid.append(card);
      select.append(new Option(`${p.nombre} — ${money(p.precio)}`, p.id));
    });
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
    $("#nota-extras").textContent = `${hd.nombre}: +${money(hd.precio)} adicionales en cualquier paquete.`;
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
    const total = (p ? p.precio : 0) + ex.reduce((s, x) => s + x.precio, 0);
    const anticipo = C.anticipo ? (p ? Math.min(C.anticipo, total) : C.anticipo) : total;
    return { p, ex, total, anticipo, resto: Math.max(0, total - anticipo) };
  }

  function actualizarResumen() {
    const { p, ex, total, anticipo, resto } = calcular();
    const dl = $("#desglose");
    dl.replaceChildren();
    const fila = (k, v, cls) => { dl.append(el("dt", cls, k), el("dd", cls, v)); };
    if (p) {
      fila(`Paquete ${p.nombre}`, money(p.precio));
      ex.forEach((x) => fila(x.nombre, "+" + money(x.precio)));
      fila("Total de la sesión", money(total), "strong");
      if (C.anticipo) fila("Resto el día de la sesión", money(resto));
    }
    $("#total").textContent = money(anticipo);
    $("#anticipo-nota").textContent = C.anticipo ? (C.regaloAnticipo || "") : "";
    const partes = [];
    if (p) partes.push(`Paquete ${p.nombre}`);
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
    const hayFechas = Object.values(state.fechas).some((s) => s.length);
    if (!ubic || !hayFechas) {
      const box = el("div", "cal-msg");
      box.append(el("span", null, !ubic
        ? "Primero elige una ubicación para ver las fechas disponibles."
        : `Por ahora no hay fechas abiertas en ${ubic}. Escríbeme por WhatsApp al ${C.negocio.whatsapp}.`));
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
    head.append(prev, el("span", "cal-title", state.mes.toLocaleDateString("es-MX", { month: "long", year: "numeric" })), next);

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
    if (!state.fecha) { $("#slots-title").textContent = "Elige un día disponible"; return; }
    $("#slots-title").textContent = fechaLarga(state.fecha);
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
    ["nombre", "paquete", "ubicacion", "agenda", "telefono", "correo", "comprobante"].forEach(limpiarError);

    if (f("nombre").split(/\s+/).length < 2) { setError("nombre", "Escribe tu nombre y apellido."); ok = false; }
    if (!f("paquete")) { setError("paquete", "Selecciona un paquete."); ok = false; }
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
      btn.disabled = false; btn.textContent = "Enviar";
    }
  }

  function reiniciar() {
    const form = $("#booking-form");
    form.reset();
    actualizarResumen();
    state.fecha = null; state.hora = null; state.mes = null;
    $("#dropzone-text").textContent = "Toca para adjuntar imagen o PDF";
    $(".dropzone").classList.remove("has-file");
    $("#success").hidden = true;
    form.hidden = false;
    actualizarResumen();
    cargarDisponibilidad();
    form.scrollIntoView({ behavior: "smooth" });
  }

  /* ---------- Datos de prueba (modo demo) ---------- */
  // Semanas alternadas: una en la primera ubicación, la siguiente en la segunda.
  function demoDisponibilidad() {
    const lugares = C.ubicaciones || [];
    const ubicaciones = {};
    lugares.forEach((l) => (ubicaciones[l] = {}));
    const hoy = new Date(); hoy.setHours(12, 0, 0, 0);
    const hash = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 1000, 7);
    let ultimo = hoy;
    for (let i = 1; i <= 90; i++) {
      const d = new Date(hoy); d.setDate(hoy.getDate() + i); ultimo = d;
      const dow = d.getDay();
      if (dow === 0 || !lugares.length) continue;
      const lugar = lugares[Math.floor((i + ((hoy.getDay() + 6) % 7)) / 7) % lugares.length];
      const key = ymd(d);
      let slots = dow === 6 ? ["10:00", "12:00"] : ["10:00", "12:00", "16:00", "18:00"];
      slots = slots.filter((h) => hash(key + h) % 10 > 2);
      if (hash(key) % 9 === 0) slots = [];
      ubicaciones[lugar][key] = slots;
    }
    return new Promise((r) => setTimeout(() => r({ ok: true, desde: ymd(hoy), hasta: ymd(ultimo), ubicaciones }), 500));
  }

  /* ---------- Inicio ---------- */
  renderPaquetes();
  renderExtras();
  renderUbicaciones();
  renderBanco();
  actualizarResumen();
  cargarDisponibilidad();

  $("#paquete").addEventListener("change", () => { actualizarResumen(); limpiarError("paquete"); });
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
  });
  $("#booking-form").addEventListener("submit", enviar);
  $("#again").addEventListener("click", reiniciar);
})();
