/* ==========================================================================
   Efectos de scroll: fade in / fade out (.reveal) y parallax ([data-parallax])
   - data-parallax="0.3"  → se mueve más lento que el scroll (positivo)
   - data-parallax="-0.15" → se mueve un poco más rápido / al revés
   ========================================================================== */
(() => {
  "use strict";
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const reveals = document.querySelectorAll(".reveal");
  if (reduce || !("IntersectionObserver" in window)) {
    reveals.forEach((el) => el.classList.add("is-visible"));
    return;
  }

  /* ---------- Fade in al entrar, fade out al salir ---------- */
  document.documentElement.classList.add("fx");
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => e.target.classList.toggle("is-visible", e.isIntersecting)),
    { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
  );
  reveals.forEach((el) => io.observe(el));

  /* ---------- Parallax ---------- */
  const capas = [...document.querySelectorAll("[data-parallax]")].map((el) => ({
    el, ref: el.parentElement, vel: parseFloat(el.dataset.parallax) || 0,
  }));
  let pendiente = false;
  function actualizar() {
    pendiente = false;
    const vh = innerHeight;
    for (const c of capas) {
      const r = c.ref.getBoundingClientRect(); // medimos al padre para no mezclar con nuestro propio movimiento
      if (r.bottom < -200 || r.top > vh + 200) continue;
      const centro = r.top + r.height / 2 - vh / 2;
      c.el.style.translate = `0 ${(-centro * c.vel).toFixed(1)}px`;
    }
  }
  const pedir = () => { if (!pendiente) { pendiente = true; requestAnimationFrame(actualizar); } };
  addEventListener("scroll", pedir, { passive: true });
  addEventListener("resize", pedir);
  actualizar();
})();
