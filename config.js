/* ==========================================================================
   CONFIGURACIÓN — edita este archivo para personalizar tu landing
   ========================================================================== */
window.CONFIG = {
  // 1) Pega aquí la URL de tu App web de Google Apps Script (ver README).
  //    Mientras esté vacía, la página funciona en MODO DEMO con datos de prueba.
  appsScriptUrl: "",

  negocio: {
    nombre: "Kalid Studio",
    especialidad: "Sesiones fotográficas",
    ciudad: "CDMX",
    whatsapp: "+52 55 0000 0000",
    correo: "hola@tudominio.com",
    instagram: "@tuusuario",
  },

  moneda: "MXN",

  // Agenda que se muestra MIENTRAS la página no esté conectada a Google Sheets.
  // (Ya conectada, manda la pestaña "Disponibilidad" de tu hoja.)
  // Una ciudad sin bloques aparece con todas sus fechas bloqueadas.
  // dias (opcional): 0 = domingo … 6 = sábado, ej. [1,2,3,4,5,6]
  disponibilidad: [
    {
      ubicacion: "Aguascalientes",
      desde: "2026-12-15",
      hasta: "2026-12-23",
      horarios: ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"],
    },
    // { ubicacion: "Ciudad de México", desde: "2027-01-10", hasta: "2027-01-15", horarios: ["10:00", "12:00"] },
  ],
  anticipacionHoras: 24,

  // Opciones del selector "Ubicación" en el formulario.
  ubicaciones: ["Aguascalientes", "Ciudad de México"],

  // Paquetes. El "id" no debe repetirse. "destacado: true" muestra la etiqueta "Más popular".
  paquetes: [
    { id: "una", nombre: "Una persona", precio: 2400, incluye: ["10 fotos retocadas", "Galería digital"] },
    { id: "dos", nombre: "Dos personas", precio: 2800, incluye: ["14 fotos retocadas", "Galería digital"] },
    { id: "tres", nombre: "Tres personas", precio: 3200, incluye: ["16 fotos retocadas", "Galería digital"] },
    { id: "cuatro-cinco", nombre: "4 / 5 personas", precio: 3800, incluye: ["18 fotos retocadas", "Galería digital"] },
  ],
  notaPaquetes: "Grupos o familias numerosas: cotización personalizada.",

  // Anticipo para apartar la fecha (lo que se transfiere al reservar).
  anticipo: 600,
  regaloAnticipo: "Incluye una polaroid el día de la sesión",

  // Extras opcionales que se suman al total.
  extras: [
    { id: "galeria-hd", nombre: "Galería completa en alta resolución sin edición", precio: 800 },
  ],

  // Texto de la cinta en onda debajo de los paquetes.
  cinta: "Aparta tu sesión con $600 pesos",

  // Intro animada al cargar (tira de miniaturas que se abre en cortinilla al hero).
  // activo: false para quitarla. "fotos" son las miniaturas de la tira; si está vacía,
  // usa las fotos de la galería, y si tampoco hay, recortes de la imagen del hero.
  intro: {
    activo: true,
    // Foto que queda al centro al final, justo antes de abrirse la cortinilla
    centro: "assets/intro/01.jpg",
    // Miniaturas de la tira (se repiten solas si hacen falta para llenar la pantalla)
    fotos: [
      "assets/intro/01.jpg", "assets/intro/02.jpg", "assets/intro/03.jpg", "assets/intro/04.jpg",
      "assets/intro/05.jpg", "assets/intro/06.jpg", "assets/intro/07.jpg", "assets/intro/08.jpg",
      "assets/intro/09.jpg", "assets/intro/10.jpg", "assets/intro/11.jpg", "assets/intro/12.jpg",
    ],
  },

  // Galería del "Sobre mí" (hasta ~20 fotos). Guarda tus fotos en assets/galeria/
  // y escribe la ruta en "src". Mientras "src" esté vacío se muestra un recuadro de ejemplo.
  // "caption" es opcional: un texto corto que aparece sobre la foto activa.
  galeria: [
    { src: "assets/galeria/01.jpg", alt: "Pareja esperando bebé junto al árbol", caption: "" },
    { src: "assets/galeria/02.jpg", alt: "Familia riendo en la escalera navideña", caption: "" },
    { src: "assets/galeria/03.jpg", alt: "Niña con regalo junto al cascanueces", caption: "" },
    { src: "assets/galeria/04.jpg", alt: "Niño saltando frente al árbol", caption: "" },
    { src: "assets/galeria/05.jpg", alt: "Pareja sentada espalda con espalda", caption: "" },
    { src: "assets/galeria/06.jpg", alt: "Mamá e hijo junto al árbol", caption: "" },
    { src: "assets/galeria/07.jpg", alt: "Familia con bebé frente al árbol", caption: "" },
    { src: "assets/galeria/08.jpg", alt: "Pareja abrazada junto al árbol", caption: "" },
    { src: "assets/galeria/09.jpg", alt: "Hermanas con vestidos blancos", caption: "" },
    { src: "assets/galeria/10.jpg", alt: "Bebé sonriendo frente al árbol", caption: "" },
    { src: "assets/galeria/11.jpg", alt: "Retrato con vestido de lentejuelas", caption: "" },
    { src: "assets/galeria/12.jpg", alt: "Familia decorando el árbol", caption: "" },
    { src: "assets/galeria/13.jpg", alt: "Pareja frente al árbol nevado", caption: "" },
    { src: "assets/galeria/14.jpg", alt: "Pareja abrazada en el set", caption: "" },
    { src: "assets/galeria/15.jpg", alt: "Mamá e hijo en la escalera", caption: "" },
    { src: "assets/galeria/16.jpg", alt: "Retrato junto al árbol dorado", caption: "" },
  ],
  // Ejemplo con foto: { src: "assets/galeria/01.jpg", alt: "Sesión en estudio", caption: "Aguascalientes 2026" },

  // Datos bancarios que se muestran en las instrucciones de pago.
  pago: {
    banco: "Nombre del banco",
    titular: "Nombre del titular",
    clabe: "000000000000000000",
    cuenta: "0000000000",
    concepto: "Tu nombre completo",
  },

  // Tamaño máximo del comprobante (MB).
  maxComprobanteMB: 5,
};
