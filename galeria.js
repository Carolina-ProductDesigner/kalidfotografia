/* ==========================================================================
   Galería — carrusel 3D con arrastre, autoplay, inclinación y pantalla completa.
   Las fotos se configuran en config.js → galeria
   ========================================================================== */
(() => {
  "use strict";
  const fotos = (window.CONFIG.galeria || []).slice(0, 24);
  const root = document.getElementById("galeria");
  if (!root) return;
  if (!fotos.length) { root.hidden = true; return; }

  const stage = document.getElementById("gal-stage");
  const progress = document.getElementById("gal-progress");
  const lightbox = document.getElementById("lightbox");
  const lbFigure = document.getElementById("lb-figure");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const AUTOPLAY_MS = 4000;
  const n = fotos.length;
  const pad = (i) => String(i + 1).padStart(2, "0");

  // Contenido de cada foto (o un placeholder elegante si aún no hay imagen)
  function contenido(f, i, grande) {
    if (f.src) {
      const img = new Image();
      img.src = f.src; img.alt = f.alt || ""; img.draggable = false;
      if (!grande) img.loading = i < 3 ? "eager" : "lazy";
      return img;
    }
    const ph = document.createElement("div");
    ph.className = "gal-ph";
    const l = 16 + ((i * 7) % 5) * 7; // variaciones del color de contraste
    ph.style.background = `linear-gradient(${140 + i * 17}deg, hsl(0 44% ${l}%), hsl(${i % 2 ? 8 : 352} 32% ${l + 22}%))`;
    // recuadro de ejemplo (sin texto) mientras no haya foto
    return ph;
  }

  const items = fotos.map((f, i) => {
    const fig = document.createElement("figure");
    fig.className = "gal-item";
    fig.setAttribute("role", "group");
    fig.setAttribute("aria-label", `Foto ${i + 1} de ${n}`);
    const card = document.createElement("div");
    card.className = "gal-card";
    card.append(contenido(f, i));
    if (f.caption) { const c = document.createElement("figcaption"); c.className = "gal-caption"; c.textContent = f.caption; card.append(c); }
    fig.append(card);
    stage.append(fig);
    return fig;
  });

  const barras = !progress ? [] : fotos.map((_, i) => {
    const b = document.createElement("button");
    b.type = "button"; b.setAttribute("aria-label", `Ir a la foto ${i + 1}`);
    b.addEventListener("click", () => irA(i));
    progress.append(b);
    return b;
  });
  const gTotal = document.getElementById("gal-total");
  if (gTotal) gTotal.textContent = String(n).padStart(2, "0");

  /* ---------- Posición y animación ---------- */
  let pos = 0, target = 0, W = 300, raf = null, activo = -1;
  const medir = () => { W = items[0].offsetWidth || 300; };
  const wrap = (d) => d - n * Math.round(d / n); // distancia circular (carrusel infinito)
  const indice = () => ((Math.round(pos) % n) + n) % n;

  function layout() {
    const paso = W * 0.66, mob = innerWidth < 680;
    items.forEach((el, i) => {
      const d = wrap(i - pos), ad = Math.abs(d), s = Math.sign(d);
      const x = s * (ad < 1 ? ad * paso : paso + (ad - 1) * paso * (mob ? 0.5 : 0.62));
      const rot = -s * Math.min(ad, 1) * 42;
      const z = -Math.min(ad, 4) * 170;
      const sc = 1 - Math.min(ad, 3) * 0.06;
      const op = ad > 3.4 ? 0 : ad > 2.4 ? 1 - (ad - 2.4) : 1;
      el.style.transform = `translate(-50%,-50%) translate3d(${x}px,0,${z}px) rotateY(${rot}deg) scale(${sc})`;
      el.style.opacity = op;
      el.style.zIndex = String(100 - Math.round(ad * 10));
      el.style.pointerEvents = op < 0.1 ? "none" : "";
    });
    const i = indice();
    if (i !== activo) {
      activo = i;
      items.forEach((el, k) => el.classList.toggle("is-active", k === i));
      barras.forEach((b, k) => b.classList.toggle("is-active", k === i));
      const gAct = document.getElementById("gal-actual");
      if (gAct) gAct.textContent = pad(i);
      reiniciarBarra();
    }
  }

  function animar() {
    pos += (target - pos) * (reduce ? 1 : 0.11);
    if (Math.abs(target - pos) < 0.001) pos = target;
    layout();
    raf = pos !== target ? requestAnimationFrame(animar) : null;
  }
  const mover = () => { if (!raf) raf = requestAnimationFrame(animar); };
  /* ---------- Celular: la galería avanza con el scroll vertical ---------- */
  const mqScroll = matchMedia("(max-width: 680px)");
  let scrollMode = false;
  const rangoScroll = () => {
    const r = root.getBoundingClientRect();
    return { inicio: r.top + scrollY, total: Math.max(1, r.height - innerHeight) };
  };
  function onScroll() {
    if (!scrollMode) return;
    const { inicio, total } = rangoScroll();
    const prog = Math.min(1, Math.max(0, (scrollY - inicio) / total));
    target = prog * (n - 1);
    mover();
  }
  function setModo() {
    scrollMode = mqScroll.matches;
    root.classList.toggle("scroll-mode", scrollMode);
    root.style.setProperty("--gal-pasos", n);
    if (scrollMode) onScroll(); else { target = Math.round(pos); mover(); }
    reprogramar();
  }
  addEventListener("scroll", onScroll, { passive: true });

  function irA(i) {
    if (scrollMode) { // en celular, "ir a una foto" = desplazar la página a su punto
      const { inicio, total } = rangoScroll();
      scrollTo({ top: inicio + (i / (n - 1)) * total, behavior: "smooth" });
      return;
    }
    target = Math.round(pos) + wrap(i - indice()); mover(); reprogramar();
  }
  const siguiente = () => { if (scrollMode) return irA((indice() + 1) % n); target = Math.round(target) + 1; mover(); };
  const anterior = () => { if (scrollMode) return irA((indice() - 1 + n) % n); target = Math.round(target) - 1; mover(); };

  /* ---------- Autoplay (se pausa al interactuar o si no está a la vista) ---------- */
  let timer = null, pausado = false, visible = false;
  function reprogramar() {
    clearTimeout(timer);
    const corre = !reduce && !scrollMode && !pausado && visible && !document.hidden && !lightbox.open;
    barras.forEach((b) => b.classList.toggle("playing", corre));
    if (corre) timer = setTimeout(() => { siguiente(); reprogramar(); }, AUTOPLAY_MS);
  }
  function reiniciarBarra() {
    const b = barras[activo]; if (!b) return;
    b.style.setProperty("--dur", AUTOPLAY_MS + "ms");
    b.classList.remove("playing"); void b.offsetWidth;
    if (!pausado && visible && !reduce && !scrollMode) b.classList.add("playing");
  }
  root.addEventListener("mouseenter", () => { pausado = true; reprogramar(); });
  root.addEventListener("mouseleave", () => { pausado = false; reprogramar(); });
  document.addEventListener("visibilitychange", reprogramar);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; reprogramar(); }, { threshold: 0.3 }).observe(stage);

  /* ---------- Arrastrar / deslizar ---------- */
  let drag = null;
  stage.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    drag = { x: e.clientX, y: e.clientY, pos, t: performance.now(), v: 0, lastX: e.clientX, movido: false, item: e.target.closest(".gal-item") };
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener("pointermove", (e) => {
    if (drag) {
      const dx = e.clientX - drag.x;
      if (!drag.movido && (Math.abs(dx) > 6 || Math.abs(e.clientY - drag.y) > 6)) {
        drag.movido = true;
        if (!scrollMode) { stage.classList.add("dragging"); pausado = true; reprogramar(); }
      }
      if (drag.movido && !scrollMode) {
        const now = performance.now();
        drag.v = (e.clientX - drag.lastX) / Math.max(1, now - drag.t);
        drag.lastX = e.clientX; drag.t = now;
        pos = target = drag.pos - dx / (W * 0.66);
        layout();
      }
      return;
    }
    // Inclinación 3D y brillo sobre la foto activa
    const card = e.target.closest(".gal-item.is-active .gal-card");
    items.forEach((el) => { const c = el.firstChild; if (c !== card) { c.style.removeProperty("--rx"); c.style.removeProperty("--ry"); } });
    if (card && !reduce && e.pointerType === "mouse") {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      card.style.setProperty("--ry", `${(px - 0.5) * 14}deg`);
      card.style.setProperty("--rx", `${(0.5 - py) * 14}deg`);
      card.style.setProperty("--gx", `${px * 100}%`);
      card.style.setProperty("--gy", `${py * 100}%`);
    }
  });
  function soltar() {
    if (!drag) return;
    const d = drag; drag = null;
    stage.classList.remove("dragging");
    if (d.movido && scrollMode) {
      // en celular el movimiento lo controla el scroll
    } else if (d.movido) {
      target = Math.round(pos - d.v * 9); // un poco de inercia
      mover();
      pausado = root.matches(":hover"); reprogramar();
    } else if (d.item) {
      const i = items.indexOf(d.item);
      if (i === indice()) abrir(i); else irA(i);
    }
  }
  stage.addEventListener("pointerup", soltar);
  stage.addEventListener("pointercancel", soltar);
  stage.addEventListener("pointerleave", (e) => {
    if (drag) return;
    items.forEach((el) => { el.firstChild.style.removeProperty("--rx"); el.firstChild.style.removeProperty("--ry"); });
  });

  // Rueda / trackpad horizontal
  let wheelLock = 0;
  stage.addEventListener("wheel", (e) => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || Math.abs(e.deltaX) < 12) return;
    e.preventDefault();
    const now = Date.now(); if (now - wheelLock < 380) return; wheelLock = now;
    e.deltaX > 0 ? siguiente() : anterior(); reprogramar();
  }, { passive: false });

  const bNext = document.getElementById("gal-next"), bPrev = document.getElementById("gal-prev");
  if (bNext) bNext.addEventListener("click", () => { siguiente(); reprogramar(); });
  if (bPrev) bPrev.addEventListener("click", () => { anterior(); reprogramar(); });
  root.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") { siguiente(); reprogramar(); }
    if (e.key === "ArrowLeft") { anterior(); reprogramar(); }
    if (e.key === "Enter" && e.target === root) abrir(indice());
  });

  /* ---------- Pantalla completa ---------- */
  let lbIndex = 0;
  function pintarLb() {
    lbFigure.replaceChildren(contenido(fotos[lbIndex], lbIndex, true));
    lbFigure.style.animation = "none"; void lbFigure.offsetWidth; lbFigure.style.animation = "";
  }
  function abrir(i) {
    if (typeof lightbox.showModal !== "function") return;
    lbIndex = i; pintarLb(); lightbox.showModal(); reprogramar();
  }
  const lbMover = (paso) => { lbIndex = (lbIndex + paso + n) % n; pintarLb(); irA(lbIndex); };
  lightbox.querySelector(".lb-close").addEventListener("click", () => lightbox.close());
  lightbox.querySelector(".lb-prev").addEventListener("click", () => lbMover(-1));
  lightbox.querySelector(".lb-next").addEventListener("click", () => lbMover(1));
  lightbox.addEventListener("click", (e) => { if (e.target === lightbox) lightbox.close(); });
  lightbox.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") lbMover(1);
    if (e.key === "ArrowLeft") lbMover(-1);
  });
  let lbX = null;
  lightbox.addEventListener("touchstart", (e) => { lbX = e.touches[0].clientX; }, { passive: true });
  lightbox.addEventListener("touchend", (e) => {
    if (lbX == null) return;
    const dx = e.changedTouches[0].clientX - lbX; lbX = null;
    if (Math.abs(dx) > 50) lbMover(dx < 0 ? 1 : -1);
  });
  lightbox.addEventListener("close", reprogramar);

  /* ---------- Inicio ---------- */
  medir(); layout();
  setModo();
  mqScroll.addEventListener("change", setModo);
  addEventListener("resize", () => { medir(); layout(); onScroll(); });
})();
