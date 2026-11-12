# Landing + Agenda de citas (Google Sheets + Vercel)

Landing page estática con hero, sobre mí, paquetes y un cuestionario de reserva con calendario que muestra días y horarios disponibles. Las citas se guardan en **Google Sheets**, los comprobantes en **Google Drive**, y los horarios reservados se bloquean automáticamente.

```
├── index.html               ← estructura y textos de la página
├── fonts.css                ← Didot y Acumin incrustadas (funcionan sin servidor)
├── styles.css               ← colores y diseño (variables al inicio)
├── config.js                ← ⭐ tu nombre, paquetes, precios, datos bancarios, URL de la API
├── app.js                   ← lógica del calendario y del formulario
├── galeria.js               ← carrusel de fotos del "Sobre mí"
├── efectos.js               ← parallax y fade in/out al hacer scroll
├── cinta.js                 ← cinta de texto en onda (config.js → cinta)
├── intro.js                 ← intro animada (tira de fotos + cortinilla)
├── assets/
│   ├── hero.jpg             ← imagen del banner principal
│   └── galeria/             ← fotos del carrusel (01.jpg, 02.jpg…)
└── google-apps-script/
    └── Code.gs              ← el "backend" que va dentro de tu Google Sheet
```

Sin `appsScriptUrl` en `config.js`, la página corre en **modo demo** (horarios falsos, nada se guarda) para que puedas ver el diseño.

---

## 1. Conectar Google Sheets (10 min)

1. Crea una hoja nueva en [sheets.new](https://sheets.new) y ponle nombre (ej. "Agenda").
2. Menú **Extensiones → Apps Script**.
3. Borra lo que haya, pega todo el contenido de `google-apps-script/Code.gs` y guarda (💾).
4. Ajusta el bloque `CONFIG` al inicio: días hacia adelante, anticipación mínima, tu correo en `EMAIL_DUENO` y `NOMBRE_NEGOCIO`.
5. Arriba elige la función **`setup`** y presiona **Ejecutar**. Acepta los permisos (Google mostrará "app no verificada": *Configuración avanzada → Ir a … (no seguro)*; es tu propio script).
   Esto crea las pestañas **Disponibilidad**, **Citas** y **Bloqueos**, la carpeta **Comprobantes de pago** en Drive y el disparador de correos.
6. **Implementar → Nueva implementación** → tipo **App web**:
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier usuario**
7. Copia la URL que termina en `/exec` y pégala en `config.js` → `appsScriptUrl`.

> Cada vez que cambies `Code.gs`: **Implementar → Gestionar implementaciones → ✏️ → Versión: Nueva versión → Implementar**. Así la URL no cambia.

## 2. Subir a GitHub y Vercel

```bash
git init
git add .
git commit -m "Landing con agenda"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
git push -u origin main
```

En [vercel.com/new](https://vercel.com/new) importa el repo. Framework preset: **Other**, sin build command. Deploy. Cada `git push` vuelve a publicar.

## 3. Cómo administras tu agenda (desde la hoja)

### Pestaña **Disponibilidad**: cuándo estás en cada ciudad

Solo se muestran los días y horarios que anotes aquí, separados por ciudad. Un renglón por bloque de fechas:

| Fecha | Hasta (opcional) | Ubicación | Días (opcional) | Horarios |
|---|---|---|---|---|
| 2026-11-16 | 2026-11-21 | Aguascalientes | L-S | 10:00, 12:00, 16:00 |
| 2026-11-23 | 2026-11-28 | Ciudad de México | L-V | 10:00, 12:00, 16:00, 18:00 |
| 2026-12-05 | | Ciudad de México | | 11:00, 13:00 |

- Sin **Hasta** = solo ese día.
- **Días** acepta `L-V`, `L, M, J`, `lunes, viernes`… (vacío = todos los días del rango).
- **Ubicación** debe coincidir con las de `config.js` (también acepta `CDMX` y `AGS`).
- **Horarios** son horas de inicio; acepta `16:00` o `4 pm`.
- Los cambios se reflejan en la página al recargarla; no hay que volver a implementar.
- Un horario reservado se bloquea en ambas ciudades (no puedes estar en dos lugares a la vez).

### Lo demás

| Quieres… | Haz esto |
|---|---|
| Confirmar un pago | Pestaña **Citas** → columna **Estado** → `Confirmada` (le llega correo al cliente) |
| Liberar un horario | Estado → `Cancelada` (vuelve a aparecer disponible) |
| Contestar una pregunta | Escribe en la columna **Respuesta** (se le envía por correo) |
| Bloquear un día | Pestaña **Bloqueos** → solo **Fecha** |
| Vacaciones | **Fecha** + **Hasta** |
| Bloquear un horario | **Fecha** + **Hora** (ej. `16:00`) |

Las fechas van en formato `2026-12-24` y las horas `16:00`.

## 4. Personalizar

- **Textos, nombre, paquetes, precios, anticipo, extras, banco y texto de la cinta:** `config.js`.
- **Copy del hero / sobre mí:** `index.html`.
- **Colores y tipografías:** variables `:root` en `styles.css`.
- **Imagen del hero:** reemplaza `assets/hero.jpg` (ideal 2000 px de ancho, menos de 400 KB).
- **Foto de Sobre mí:** guarda `assets/sobre-mi.jpg` y reemplaza el `div.photo-placeholder` por `<img src="assets/sobre-mi.jpg" class="photo photo-tall" alt="...">`.
- **Ubicaciones:** lista `ubicaciones` en `config.js`.
- **Intro:** en `config.js → intro` pon `activo: false` para quitarla, o agrega miniaturas en `fotos` (si está vacío usa la galería; si tampoco hay, recortes del hero). Se puede saltar con un clic, una tecla o un scroll.
- **Galería:** sube las fotos a `assets/galeria/` y llena `galeria` en `config.js` (`src`, `alt` y un `caption` opcional). Ideal: vertical 3:4, ~1200 px de alto, menos de 300 KB cada una.
- **Parallax:** cualquier elemento con `data-parallax="0.2"` se mueve al hacer scroll (más alto = más movimiento). El fade se activa con la clase `reveal`.
- **Tipografías:** Didot y Acumin están incrustadas en `fonts.css`. Revisa que tu licencia permita usarlas en web (ver nota abajo).

## Al subir cambios

Los archivos se cargan con `?v=7` en `index.html` (por ejemplo `styles.css?v=7`). Cuando cambies CSS o JS, sube ese número en todas las líneas (a `?v=8`) para que los navegadores no muestren la versión vieja guardada en caché.

## Notas

- Si dos personas eligen el mismo horario al mismo tiempo, el script lo detecta y le pide a la segunda elegir otro.
- Gmail gratuito permite ~100 correos/día desde Apps Script.
- El precio se toma de `config.js`; si cambias precios, actualízalo ahí.
- **Licencia de fuentes:** Didot (la de Mac) y Acumin (Adobe Fonts) normalmente no permiten subirse a un sitio público como archivo. La forma segura con Acumin es crear un *Web Project* en Adobe Fonts y pegar su `<link>` en `index.html`; para Didot, una licencia web de Linotype o una alternativa libre como *GFS Didot* o *Bodoni Moda* (Google Fonts).
