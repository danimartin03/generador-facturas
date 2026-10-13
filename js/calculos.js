// Las cuentas de la factura: importe de cada línea, IVA por tipo, retención y total.
// Aquí no se toca la página: entran números y salen números.
// Todo va en enteros (mira dinero.js): céntimos, milésimas y centésimas de por ciento.

// Estos límites no son un capricho: hacen que ninguna cuenta se acerque al mayor entero
// que JavaScript guarda sin perder cifras (unos 9.000 billones). Con ellos, la cuenta
// más grande (la base por el IRPF) llega como mucho a 2,5 billones.
const LIMITE_LINEAS = 50;
const CANTIDAD_MAXIMA = 10000000;          // 10.000 unidades, en milésimas
const PRECIO_MAXIMO = 100000000;           // 1.000.000,00 €, en céntimos
const IMPORTE_LINEA_MAXIMO = 10000000000;  // 100.000.000,00 €, en céntimos
const IRPF_MAXIMO = 5000;                  // 50 %, en centésimas de por ciento
const TIPOS_IVA = [21, 10, 4, 0];          // el 0 significa "exento"

// Divido y redondeo al entero más cercano; si queda justo la mitad, hacia arriba (2,5 -> 3).
// OJO: no hago Math.round(numerador / denominador) porque con números muy grandes la
// división normal puede redondear mal. Con el resto (%) la cuenta es exacta:
// si lo que sobra es la mitad del divisor o más, sumo uno.
function redondearDivision(numerador, denominador) {
  const resto = numerador % denominador;
  const cociente = (numerador - resto) / denominador;
  return cociente + (2 * resto >= denominador ? 1 : 0);
}

// cantidad (en milésimas) por precio (en céntimos) da milésimas de céntimo,
// así que divido entre 1000 para volver a céntimos
function importeDeLinea(cantidad, precio) {
  return redondearDivision(cantidad * precio, 1000);
}

// Digo qué campo de una línea está mal, o '' si está bien.
// cantidad y precio llegan ya como números, o como null si no se entendieron.
function problemaDeLinea(cantidad, precio) {
  if (cantidad === null || cantidad <= 0 || cantidad > CANTIDAD_MAXIMA) return 'cantidad';
  if (precio === null || precio < 0 || precio > PRECIO_MAXIMO) return 'precio';
  if (importeDeLinea(cantidad, precio) > IMPORTE_LINEA_MAXIMO) return 'importe';
  return '';
}

// Las cuentas de toda la factura.
// lineas: lista de { cantidad, precio, iva } que ya están bien.
// irpf: porcentaje de retención en centésimas (1500 = 15 %), o 0 si no hay.
//
// Cómo lo hago:
//   1. Cada línea se redondea al céntimo.
//   2. Sumo las líneas de cada tipo de IVA: esa es la base de ese tipo.
//   3. El IVA se calcula UNA vez por tipo sobre su base (no línea a línea) y se redondea.
//   4. La retención es un porcentaje de la base total, redondeado una vez.
//   5. Total = base + IVA - retención.
function calcularFactura(lineas, irpf) {
  const importes = lineas.map(function (linea) {
    return importeDeLinea(linea.cantidad, linea.precio);
  });

  const bases = {};
  lineas.forEach(function (linea, posicion) {
    bases[linea.iva] = (bases[linea.iva] || 0) + importes[posicion];
  });

  // Solo salen los tipos que se usan, en el orden de siempre: 21, 10, 4 y exento
  const desglose = TIPOS_IVA
    .filter(function (tipo) { return bases[tipo] !== undefined; })
    .map(function (tipo) {
      return { tipo: tipo, base: bases[tipo], cuota: redondearDivision(bases[tipo] * tipo, 100) };
    });

  let base = 0;
  let iva = 0;
  for (const parte of desglose) {
    base += parte.base;
    iva += parte.cuota;
  }
  const retencion = redondearDivision(base * irpf, 10000);

  return {
    importes: importes,
    desglose: desglose,
    base: base,
    iva: iva,
    retencion: retencion,
    total: base + iva - retencion
  };
}

// Cómo se escribe un tipo de IVA: 21 -> "21 %" y 0 -> "Exento"
function textoDeIva(tipo) {
  return tipo === 0 ? 'Exento' : tipo + ' %';
}
