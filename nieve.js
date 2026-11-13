/* ==========================================================================
   Nieve sutil, solo en el hero.
   Copos en el color de contraste con poca opacidad (sobre fondo blanco).
   Se pausa cuando el hero no está a la vista. Ajustes rápidos abajo.
   ========================================================================== */
(() => {
  "use strict";
  const canvas = document.getElementById("nieve");
  if (!canvas || !canvas.getContext) return;

  const AJUSTES = {
    color: "77, 30, 30",   // #4D1E1E en RGB
    densidad: 1 / 20000,   // copos por píxel de pantalla (más chico = menos copos)
    maxCopos: 80,
    opacidad: [0.12, 0.42],
    velocidad: [12, 38],   // píxeles por segundo
  };

  const ctx = canvas.getContext("2d");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const rand = (a, b) => a + Math.random() * (b - a);
  let W = 0, H = 0, dpr = 1, copos = [], visible = true, viento = 0, vientoObj = 0;

  function nuevoCopo(arriba) {
    const grande = Math.random() < 0.18;               // algunos son "copitos" con forma
    return {
      x: rand(0, W),
      y: arriba ? rand(-40, -5) : rand(0, H),
      r: grande ? rand(3, 5.2) : rand(0.8, 2.2),
      grande,
      vy: rand(...AJUSTES.velocidad) * (grande ? 0.8 : 1),
      amp: rand(8, 26), fase: rand(0, Math.PI * 2), frec: rand(0.25, 0.7),
      giro: rand(0, Math.PI), vg: rand(-0.4, 0.4),
      a: rand(...AJUSTES.opacidad),
    };
  }

  function medir() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.min(AJUSTES.maxCopos, Math.round(W * H * AJUSTES.densidad));
    while (copos.length < n) copos.push(nuevoCopo(false));
    copos.length = n;
  }

  function dibujar(c, t) {
    const x = c.x + Math.sin(t * c.frec + c.fase) * c.amp;
    ctx.globalAlpha = c.a;
    if (!c.grande) {
      ctx.beginPath(); ctx.arc(x, c.y, c.r, 0, Math.PI * 2); ctx.fill();
      return;
    }
    // copo de seis brazos
    ctx.save();
    ctx.translate(x, c.y); ctx.rotate(c.giro + t * c.vg);
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      ctx.moveTo(0, 0); ctx.lineTo(0, -c.r);
      ctx.moveTo(0, -c.r * 0.55); ctx.lineTo(c.r * 0.28, -c.r * 0.8);
      ctx.moveTo(0, -c.r * 0.55); ctx.lineTo(-c.r * 0.28, -c.r * 0.8);
      ctx.rotate(Math.PI / 3);
    }
    ctx.stroke();
    ctx.restore();
  }

  let last = performance.now();
  function cuadro(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const t = now / 1000;
    viento += (vientoObj - viento) * 0.02;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = ctx.strokeStyle = `rgb(${AJUSTES.color})`;
    ctx.lineWidth = 0.8; ctx.lineCap = "round";
    for (let i = 0; i < copos.length; i++) {
      const c = copos[i];
      if (!reduce) {
        c.y += c.vy * dt;
        c.x += viento * dt * (c.grande ? 0.6 : 1);
        if (c.y - c.r > H) copos[i] = nuevoCopo(true);
        if (c.x < -40) c.x = W + 30; else if (c.x > W + 40) c.x = -30;
      }
      dibujar(copos[i], t);
    }
    ctx.globalAlpha = 1;
    if (visible && !reduce) requestAnimationFrame(cuadro);
  }

  medir();
  cuadro(performance.now()); // con "reducir movimiento" se dibujan quietos, una sola vez
  if (reduce) return;

  // Pausa fuera de pantalla
  new IntersectionObserver(([e]) => {
    const antes = visible;
    visible = e.isIntersecting;
    if (visible && !antes) { last = performance.now(); requestAnimationFrame(cuadro); }
  }).observe(canvas);

  // Una brisa muy leve hacia donde está el mouse
  const hero = canvas.parentElement;
  hero.addEventListener("pointermove", (e) => {
    const r = hero.getBoundingClientRect();
    vientoObj = ((e.clientX - r.left) / r.width - 0.5) * 30;
  });
  hero.addEventListener("pointerleave", () => (vientoObj = 0));

  let to;
  addEventListener("resize", () => { clearTimeout(to); to = setTimeout(medir, 150); });
})();
