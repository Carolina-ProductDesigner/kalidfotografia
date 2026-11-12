/* ==========================================================================
   Cinta en onda: el texto corre de derecha a izquierda sobre una curva, sin detenerse.
   El texto se configura en config.js → cinta. Al pasar el mouse va más lento.
   ========================================================================== */
(() => {
  "use strict";
  const tp = document.getElementById("onda-texto");
  const path = document.getElementById("onda");
  if (!tp || !path) return;

  const frase = String((window.CONFIG || {}).cinta || "Aparta tu sesión con $600 pesos").toUpperCase();
  const NB = " ";
  const unidadTexto = frase + NB.repeat(3) + "•" + NB.repeat(3);
  const VELOCIDAD = 110; // unidades SVG por segundo

  const iniciar = () => {
    tp.textContent = unidadTexto;
    const unidad = tp.getComputedTextLength() || 900;
    const reps = Math.ceil(path.getTotalLength() / unidad) + 2;
    tp.textContent = unidadTexto.repeat(reps);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const cinta = tp.closest(".wave-marquee");
    let off = 0, last = performance.now(), visible = true, factor = 1, objetivo = 1;
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(cinta);
    cinta.addEventListener("mouseenter", () => (objetivo = 0.3));
    cinta.addEventListener("mouseleave", () => (objetivo = 1));

    const loop = (t) => {
      const dt = Math.min(64, t - last); last = t;
      factor += (objetivo - factor) * 0.06;
      if (visible) {
        off -= (VELOCIDAD * factor * dt) / 1000;
        if (off <= -unidad) off += unidad;
        tp.setAttribute("startOffset", off.toFixed(2));
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  };

  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(iniciar);
})();
