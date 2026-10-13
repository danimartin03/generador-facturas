// Todo lo que tiene que ver con escribir y leer números y dinero.
//
// La regla de oro: por dentro trabajo SIEMPRE con números enteros.
//   - El dinero va en céntimos:                12,50 € = 1250
//   - Las cantidades van en milésimas:          1,5 horas = 1500
//   - Los porcentajes van en centésimas de %:   7,5 % = 750
// Si hiciera las cuentas con decimales, JavaScript me daría cosas como
// 0.1 + 0.2 = 0.30000000000000004 y las facturas no cuadrarían.
// Aquí no se toca la página: entran textos y salen números, o al revés.

// Paso lo que escribe la persona ("12,5", "1.234,56", "7") a un entero escalado.
// decimales dice cuántos decimales admito: 2 para dinero, 3 para cantidades.
// Devuelvo null si no es un número que entienda.
//
// En España el punto separa los miles y la coma los decimales, y la gente mezcla
// las dos formas. Mis reglas: si hay coma, la coma es el decimal y los puntos son miles;
// si no hay coma, un punto con tres cifras detrás ("1.234") son miles y con menos ("12.5") es decimal.
function leerDecimal(texto, decimales) {
  const limpio = texto.replace(/[\s€%]/g, '');
  let entera = limpio;
  let fraccion = '';

  if (limpio.includes(',')) {
    const partes = limpio.split(',');
    if (partes.length !== 2) return null;
    entera = partes[0];
    fraccion = partes[1];
    // Antes de la coma: solo cifras, o grupos de tres separados por puntos
    if (!/^(\d{1,3}(\.\d{3})+|\d+)$/.test(entera)) return null;
    entera = entera.replace(/\./g, '');
    if (fraccion === '') return null;
  } else if (/^[1-9]\d{0,2}(\.\d{3})+$/.test(limpio)) {
    // "1.234" o "1.234.567": son miles. (El primer grupo no puede empezar por 0:
    // "0.500" es medio, no quinientos.)
    entera = limpio.replace(/\./g, '');
  } else if (limpio.includes('.')) {
    const partes = limpio.split('.');
    if (partes.length !== 2) return null;
    entera = partes[0];
    fraccion = partes[1];
    if (fraccion === '') return null;
  }

  if (!/^\d+$/.test(entera)) return null;
  if (fraccion !== '' && !/^\d+$/.test(fraccion)) return null;
  if (fraccion.length > decimales) return null;
  // OJO: con demasiadas cifras el número ya no cabe bien en JavaScript. Mejor decir que no.
  if (entera.length > 10) return null;

  // No uso parseFloat(...) * 100 porque volvería a meter decimales raros
  // (19.99 * 100 da 1998.9999999999998). Junto las cifras como texto y las paso a número.
  return Number(entera + fraccion.padEnd(decimales, '0'));
}

function leerImporte(texto) {
  return leerDecimal(texto, 2);
}

function leerCantidad(texto) {
  return leerDecimal(texto, 3);
}

function leerPorcentaje(texto) {
  return leerDecimal(texto, 2);
}

// ---------- Escribir ----------

// "1234567" -> "1.234.567". Lo hago a mano porque toLocaleString('es-ES') no pone
// el punto en los números de cuatro cifras (da "1234") y en una factura quiero "1.234".
function ponerPuntos(cifras) {
  return cifras.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// 123456 con 2 decimales -> "1.234,56"
function formatearDecimal(valor, decimales) {
  const cifras = String(Math.abs(valor)).padStart(decimales + 1, '0');
  const entera = cifras.slice(0, cifras.length - decimales);
  const fraccion = cifras.slice(cifras.length - decimales);
  return ponerPuntos(entera) + ',' + fraccion;
}

// Quito los ceros que sobran al final: "1,500" -> "1,5" y "2,000" -> "2"
function quitarCerosDeSobra(texto) {
  return texto.replace(/,?0+$/, '');
}

// 123456 -> "1.234,56 €" y -30000 -> "−300,00 €"
function formatearImporte(centimos) {
  const signo = centimos < 0 ? '−' : '';
  return signo + formatearDecimal(centimos, 2) + ' €';
}

// 1500 -> "1,5"
function formatearCantidad(milesimas) {
  return quitarCerosDeSobra(formatearDecimal(milesimas, 3));
}

// 750 -> "7,5 %" y 1500 -> "15 %"
function formatearPorcentaje(centesimas) {
  return quitarCerosDeSobra(formatearDecimal(centesimas, 2)) + ' %';
}

// ---------- Para rellenar campos del formulario ----------

// Igual que formatear..., pero sin puntos de miles: así se puede volver a leer al editar.
function importeParaCampo(centimos) {
  return formatearDecimal(centimos, 2).replace(/\./g, '');
}

function cantidadParaCampo(milesimas) {
  return quitarCerosDeSobra(formatearDecimal(milesimas, 3).replace(/\./g, ''));
}

function porcentajeParaCampo(centesimas) {
  return quitarCerosDeSobra(formatearDecimal(centesimas, 2).replace(/\./g, ''));
}

// ---------- Fechas ----------

// "2026-03-15" -> "15/03/2026"
function formatearFecha(fecha) {
  const partes = fecha.split('-');
  return partes[2] + '/' + partes[1] + '/' + partes[0];
}

// La fecha de hoy con la forma que quiere el <input type="date">: 2026-03-15
function fechaDeHoy() {
  const hoy = new Date();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  return hoy.getFullYear() + '-' + mes + '-' + dia;
}

// ¿Es una fecha de verdad? No vale solo con que tenga la forma: "2026-02-31" no existe.
function esFechaReal(texto) {
  if (typeof texto !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const partes = texto.split('-').map(Number);
  // OJO: Date trata los años del 0 al 99 como 1900-1999, y una factura de esos años no tiene sentido.
  // Limito el año a un rango razonable y me quito el problema.
  if (partes[0] < 1900 || partes[0] > 2100) return false;
  // Si el día no existe, Date lo "arregla" pasándolo al mes siguiente, y entonces no coincide
  const fecha = new Date(partes[0], partes[1] - 1, partes[2]);
  return fecha.getFullYear() === partes[0] && fecha.getMonth() === partes[1] - 1 && fecha.getDate() === partes[2];
}
