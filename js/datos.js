// Guardar y leer en el navegador, y todo lo que tiene que ver con los datos de las facturas.

// Guardo cosas en localStorage. Va en try/catch porque en modo privado
// o con el almacenamiento lleno puede fallar, y no quiero que rompa la página.
// Devuelvo true o false para poder avisar si no se ha guardado.
function guardarDato(clave, valor) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
    return true;
  } catch (error) {
    console.warn('No he podido guardar en localStorage:', error);
    return false;
  }
}

// Leo lo guardado. Si no hay nada o está roto, devuelvo null y ya está.
function leerDato(clave) {
  try {
    return JSON.parse(localStorage.getItem(clave));
  } catch (error) {
    return null;
  }
}

// ---------- Número de factura ----------

const LIMITE_NUMERO = 999999;

// serie "2026-" y número 3 -> "2026-003"
function numeroCompleto(serie, numero) {
  return serie + String(numero).padStart(3, '0');
}

// ---------- Logo ----------

// El logo se guarda como un texto data:image/png;base64,... y se usa como dirección de una <img>.
// OJO: solo dejo pasar PNG, JPG y WebP. Nunca SVG, que puede llevar código dentro.
const LIMITE_LOGO = 400000; // caracteres del texto, unos 300 KB de imagen

function esLogoValido(logo) {
  return typeof logo === 'string' && logo.length <= LIMITE_LOGO &&
    /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(logo);
}

// ---------- Revisar una factura ----------

// Miro el formulario entero y digo dos cosas:
//   faltan: lo que hay que arreglar antes de guardar o descargar
//   avisos: cosas que conviene mirar pero que no impiden hacer la factura
// modelo es lo que devuelve leerFormulario() en app.js. Aquí no se toca la página.
function revisarFactura(modelo) {
  const faltan = [];
  const avisos = [];

  // --- Lo obligatorio (artículo 6 del Reglamento de facturación)
  if (modelo.numero === null) faltan.push('El número de la factura (de 1 a ' + LIMITE_NUMERO + ')');
  if (!esFechaReal(modelo.fecha)) faltan.push('La fecha de la factura');
  if (modelo.fechaOperacion !== '' && !esFechaReal(modelo.fechaOperacion)) faltan.push('La fecha de la operación (o déjala vacía)');

  if (modelo.emisor.nombre === '') faltan.push('Tu nombre o razón social (en «Mis datos»)');
  if (modelo.emisor.nif === '') faltan.push('Tu NIF (en «Mis datos»)');
  if (modelo.emisor.direccion === '') faltan.push('Tu dirección (en «Mis datos»)');
  if (modelo.cliente.nombre === '') faltan.push('El nombre del cliente');
  if (modelo.cliente.direccion === '') faltan.push('La dirección del cliente');

  const completas = modelo.lineas.filter(function (linea) { return linea.completa; });
  const conProblema = modelo.lineas.filter(function (linea) { return linea.problema !== ''; });
  for (const linea of conProblema) {
    faltan.push('Línea ' + linea.posicion + ': ' + problemaEnPalabras(linea.problema));
  }
  if (completas.length === 0 && conProblema.length === 0) {
    faltan.push('Al menos una línea con concepto y precio');
  }
  if (modelo.irpf.aplicar && !modelo.irpf.correcto) {
    faltan.push('El porcentaje de IRPF (de 0 a ' + formatearPorcentaje(IRPF_MAXIMO) + ')');
  }

  // --- Avisos
  if (modelo.emisor.nif !== '' && !esNifValido(modelo.emisor.nif)) {
    avisos.push('Tu NIF no parece válido. Revisa los números y la letra.');
  }
  if (modelo.cliente.nif === '') {
    avisos.push('No has puesto el NIF del cliente. Si es una empresa o un profesional, es obligatorio.');
  } else if (!esNifValido(modelo.cliente.nif)) {
    avisos.push('El NIF del cliente no parece válido. Si es de otro país, puede que esté bien.');
  }
  if (completas.some(function (linea) { return linea.iva === 0; }) && modelo.exencion === '') {
    avisos.push('Hay líneas exentas de IVA: indica el motivo de la exención, porque hay que citarlo en la factura.');
  }

  return { faltan: faltan, avisos: avisos };
}

// Lo que le pasa a una línea, dicho para una persona
function problemaEnPalabras(problema) {
  if (problema === 'concepto') return 'falta el concepto.';
  if (problema === 'cantidad') return 'revisa la cantidad (de 0,001 a ' + formatearCantidad(CANTIDAD_MAXIMA) + ').';
  if (problema === 'precio') return 'revisa el precio (hasta ' + formatearImporte(PRECIO_MAXIMO) + ').';
  return 'el importe de la línea es demasiado grande (máximo ' + formatearImporte(IMPORTE_LINEA_MAXIMO) + ').';
}
