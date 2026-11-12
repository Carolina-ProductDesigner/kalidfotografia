/* ==========================================================================
   Intro: una tira de miniaturas entra de izquierda a derecha, se desvanece
   hacia el centro y la cortinilla abre el hero. Después, la imagen del hero
   flota suavemente siguiendo el mouse.
   Se configura en config.js → intro
   ========================================================================== */
(() => {
  "use strict";
  const html = document.documentElement;
  const intro = document.getElementById("intro");
  const C = window.CONFIG || {};
  const cfg = C.intro || {};
  const HERO = "assets/hero.jpg";
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ---------- El lettering flota suave siguiendo el mouse ---------- */
  function heroInteractivo() {
    const hero = document.querySelector(".hero");
    const img = document.querySelector(".hero-lettering img");
    if (!hero || !img || !matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    hero.addEventListener("pointermove", (e) => {
      const r = hero.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      img.style.setProperty("--tx", `${(x * 18).toFixed(1)}px`);
      img.style.setProperty("--ty", `${(y * 12).toFixed(1)}px`);
    });
    hero.addEventListener("pointerleave", () => {
      img.style.removeProperty("--tx"); img.style.removeProperty("--ty");
    });
  }

  let terminado = false;
  function fin() {
    if (terminado) return;
    terminado = true;
    clearTimeout(window.__introFailsafe);
    html.classList.remove("intro-on", "intro-lock");
    html.classList.add("hero-ready");
    if (intro) intro.remove();
    window.scrollTo(0, 0);
    setTimeout(() => html.classList.add("hero-settled"), 2600);
    heroInteractivo();
  }

  if (!intro || !html.classList.contains("intro-on") || cfg.activo === false) { fin(); return; }
  clearTimeout(window.__introFailsafe);
  window.scrollTo(0, 0);

  /* ---------- Construir la tira ---------- */
  const strip = intro.querySelector(".intro-strip");
  const fotos = (cfg.fotos || []).concat((C.galeria || []).map((f) => f.src)).filter(Boolean);
  const tw = Math.round(Math.min(96, Math.max(52, innerWidth * 0.058)));
  strip.style.setProperty("--tw", tw + "px");
  let n = Math.ceil(innerWidth / (tw + 4)) + 2;
  if (n % 2 === 0) n++;
  const mid = (n - 1) / 2;

  const thumbs = [];
  for (let i = 0; i < n; i++) {
    const t = document.createElement("div");
    t.className = "intro-thumb";
    if (i === mid) {
      t.classList.add("is-center");
      t.style.backgroundImage = `url("${HERO}")`;
    } else if (fotos.length) {
      t.style.backgroundImage = `url("${fotos[i % fotos.length]}")`;
    } else {
      // Sin fotos propias: recortes distintos de la imagen del hero
      t.style.backgroundImage = `url("${HERO}")`;
      t.style.backgroundSize = `${380 + (i * 53) % 260}%`;
      t.style.backgroundPosition = `${(i * 37) % 100}% ${(i * 61) % 100}%`;
    }
    strip.append(t);
    thumbs.push(t);
  }

  /* ---------- Saltar la intro (clic, tecla, rueda o toque) ---------- */
  const ctrl = new AbortController();
  const saltar = () => {
    if (terminado) return;
    ctrl.abort();
    intro.classList.add("skip");
    setTimeout(fin, 560);
  };
  ["click", "keydown", "wheel", "touchmove"].forEach((ev) =>
    addEventListener(ev, saltar, { once: true, passive: true, signal: ctrl.signal }));

  /* ---------- Línea de tiempo ---------- */
  const precarga = (src) => {
    const img = new Image(); img.src = src;
    return img.decode ? img.decode().catch(() => {}) : Promise.resolve();
  };
  const listo = Promise.race([
    Promise.all([HERO].concat(fotos.slice(0, 8)).map(precarga)),
    wait(2500),
  ]);

  (async () => {
    await listo;
    await wait(250);
    if (terminado) return;

    // 1. Entran de izquierda a derecha
    const paso = Math.min(42, 1400 / n);
    thumbs.forEach((t, i) => (t.style.transitionDelay = `${i * paso}ms`));
    intro.classList.add("step-in");
    await wait(n * paso + 800);
    if (terminado) return;

    // 2. Se desvanecen desde las orillas hacia el centro
    thumbs.forEach((t, i) => (t.style.transitionDelay = `${(mid - Math.abs(i - mid)) * 18}ms`));
    intro.classList.add("step-out");
    await wait(mid * 18 + 650);
    if (terminado) return;

    // 3. Cortinilla: la miniatura central se aplasta y el hero sube desde abajo
    thumbs[mid].style.transitionDelay = "0ms";
    intro.classList.add("step-curtain");
    html.classList.add("hero-ready"); // la foto del hero se va "asentando" mientras sube la cortinilla
    ctrl.abort();
    await wait(1200);
    fin();
  })();
})();
