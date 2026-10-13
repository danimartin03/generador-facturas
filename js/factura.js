// Dibujar cosas de la factura: la hoja y el bloque de totales.
// OJO: todo lo que escribe una persona (nombres, conceptos, direcciones...) entra con
// textContent, nunca con innerHTML, para que no se pueda colar HTML.

// Creo un elemento con su clase y su texto de una vez
function crearElemento(etiqueta, clase, texto) {
  const elemento = document.createElement(etiqueta);
  if (clase) elemento.className = clase;
  if (texto !== undefined && texto !== '') elemento.textContent = texto;
  return elemento;
}

// Si falta un dato, dejo escrito en rojo qué falta en vez de dejar un hueco en blanco
function textoOFalta(texto, queFalta) {
  if (texto !== '') return texto;
  return crearElemento('span', 'falta', '(falta ' + queFalta + ')');
}

// Un párrafo con un rótulo opcional delante: "NIF: 12345678Z"
function crearParrafoConDato(clase, rotulo, texto, queFalta) {
  const parrafo = crearElemento('p', clase);
  if (rotulo) parrafo.append(rotulo + ' ');
  parrafo.append(textoOFalta(texto, queFalta));
  return parrafo;
}

// Una pareja "nombre / valor" para las listas de totales. El valor puede ser texto o un elemento.
function crearFilaDeResumen(lista, nombre, valor, clase) {
  const fila = crearElemento('div', clase || '');
  const dato = crearElemento('dd');
  dato.append(valor);
  fila.append(crearElemento('dt', '', nombre), dato);
  lista.append(fila);
}

// ---------- Totales ----------

// El bloque con los totales: el desglose por tipo de IVA y, debajo, el resumen.
// Lo uso en la factura y en el resumen que sale junto al formulario.
// irpf es { aplicar: true/false, valor: centésimas }
function crearBloqueDeTotales(totales, irpf) {
  const bloque = crearElemento('div', 'totales');

  const tabla = crearElemento('table', 'totales-iva');
  tabla.append(crearElemento('caption', 'solo-lectores', 'Desglose por tipo de IVA'));

  const cabecera = document.createElement('tr');
  for (const titulo of ['Tipo', 'Base', 'Cuota']) {
    const celda = crearElemento('th', '', titulo);
    celda.scope = 'col';
    cabecera.append(celda);
  }
  const encabezado = document.createElement('thead');
  encabezado.append(cabecera);
  tabla.append(encabezado);

  const cuerpo = document.createElement('tbody');
  for (const parte of totales.desglose) {
    const fila = document.createElement('tr');
    fila.append(
      crearElemento('td', '', textoDeIva(parte.tipo)),
      crearElemento('td', 'cifra', formatearImporte(parte.base)),
      crearElemento('td', 'cifra', formatearImporte(parte.cuota))
    );
    cuerpo.append(fila);
  }
  tabla.append(cuerpo);
  bloque.append(tabla);

  const resumen = crearElemento('dl', 'totales-resumen');
  crearFilaDeResumen(resumen, 'Base imponible', formatearImporte(totales.base));
  crearFilaDeResumen(resumen, 'IVA', formatearImporte(totales.iva));
  if (irpf.aplicar) {
    crearFilaDeResumen(resumen, 'Retención IRPF (' + formatearPorcentaje(irpf.valor) + ')', formatearImporte(-totales.retencion));
  }
  crearFilaDeResumen(resumen, 'Total', formatearImporte(totales.total), 'total');
  bloque.append(resumen);

  return bloque;
}

// ---------- La hoja ----------

// Dibujo la factura entera dentro de "hoja".
// modelo es lo que devuelve leerFormulario(); completas son las líneas que están bien
// y totales lo que sale de calcularFactura() con ellas.
function pintarHoja(hoja, modelo, completas, totales) {
  const zonaTotales = crearElemento('div', 'hoja-totales');
  zonaTotales.append(crearBloqueDeTotales(totales, modelo.irpf));

  hoja.replaceChildren(
    crearCabeceraDeHoja(modelo),
    crearBloqueDeCliente(modelo.cliente),
    crearTablaDeLineas(completas, totales.importes),
    zonaTotales,
    crearPieDeHoja(modelo, completas)
  );
}

function crearCabeceraDeHoja(modelo) {
  const emisor = modelo.emisor;

  const datosEmisor = crearElemento('div', 'hoja-emisor');
  // El logo es un texto data:image/...; solo lo uso si es de un tipo que acepto
  if (esLogoValido(emisor.logo)) {
    const logo = crearElemento('img', 'hoja-logo');
    logo.src = emisor.logo;
    logo.alt = 'Logo de ' + (emisor.nombre || 'quien emite la factura');
    datosEmisor.append(logo);
  }
  datosEmisor.append(
    crearParrafoConDato('hoja-nombre', '', emisor.nombre, 'tu nombre'),
    crearParrafoConDato('', 'NIF:', emisor.nif, 'tu NIF'),
    crearParrafoConDato('direccion', '', emisor.direccion, 'tu dirección')
  );
  const contacto = [emisor.email, emisor.telefono].filter(function (dato) { return dato !== ''; });
  if (contacto.length > 0) datosEmisor.append(crearElemento('p', '', contacto.join(' · ')));

  const titulo = crearElemento('div', 'hoja-titulo');
  titulo.append(crearElemento('h2', '', 'Factura'));
  const datos = crearElemento('dl', 'hoja-datos');
  const numero = modelo.numero === null ? '' : numeroCompleto(modelo.serie, modelo.numero);
  crearFilaDeResumen(datos, 'Número', textoOFalta(numero, 'el número'));
  crearFilaDeResumen(datos, 'Fecha', textoOFalta(esFechaReal(modelo.fecha) ? formatearFecha(modelo.fecha) : '', 'la fecha'));
  // La fecha de la operación solo sale si es distinta de la de la factura
  if (esFechaReal(modelo.fechaOperacion) && modelo.fechaOperacion !== modelo.fecha) {
    crearFilaDeResumen(datos, 'Fecha de la operación', formatearFecha(modelo.fechaOperacion));
  }
  titulo.append(datos);

  const cabecera = crearElemento('header', 'hoja-cabecera');
  cabecera.append(datosEmisor, titulo);
  return cabecera;
}

function crearBloqueDeCliente(cliente) {
  const bloque = crearElemento('section', 'hoja-cliente');
  bloque.append(
    crearElemento('h3', '', 'Cliente'),
    crearParrafoConDato('hoja-nombre-cliente', '', cliente.nombre, 'el nombre del cliente'),
    crearParrafoConDato('', 'NIF:', cliente.nif, 'el NIF del cliente'),
    crearParrafoConDato('direccion', '', cliente.direccion, 'la dirección del cliente')
  );
  return bloque;
}

function crearTablaDeLineas(completas, importes) {
  const tabla = crearElemento('table', 'hoja-lineas');
  tabla.append(crearElemento('caption', 'solo-lectores', 'Líneas de la factura'));

  const cabecera = document.createElement('tr');
  for (const [titulo, numerica] of [['Concepto', false], ['Cantidad', true], ['Precio', true], ['IVA', true], ['Importe', true]]) {
    const celda = crearElemento('th', numerica ? 'num' : '', titulo);
    celda.scope = 'col';
    cabecera.append(celda);
  }
  const encabezado = document.createElement('thead');
  encabezado.append(cabecera);
  tabla.append(encabezado);

  const cuerpo = document.createElement('tbody');
  completas.forEach(function (linea, posicion) {
    const fila = document.createElement('tr');
    fila.append(
      crearElemento('td', 'concepto', linea.concepto),
      crearElemento('td', 'num', formatearCantidad(linea.cantidad)),
      crearElemento('td', 'num', formatearImporte(linea.precio)),
      crearElemento('td', 'num', textoDeIva(linea.iva)),
      crearElemento('td', 'num', formatearImporte(importes[posicion]))
    );
    cuerpo.append(fila);
  });
  if (completas.length === 0) {
    const fila = document.createElement('tr');
    const celda = crearElemento('td', 'falta', 'Todavía no hay ninguna línea completa.');
    celda.colSpan = 5;
    fila.append(celda);
    cuerpo.append(fila);
  }
  tabla.append(cuerpo);
  return tabla;
}

// Lo de debajo: motivo de la exención, forma de pago, IBAN y notas
function crearPieDeHoja(modelo, completas) {
  const pie = crearElemento('footer', 'hoja-pie');

  if (completas.some(function (linea) { return linea.iva === 0; })) {
    pie.append(crearParrafoConDato('', 'Operaciones exentas de IVA:', modelo.exencion, 'el motivo de la exención'));
  }
  if (modelo.formaPago !== '') pie.append(crearElemento('p', '', 'Forma de pago: ' + modelo.formaPago));
  if (modelo.emisor.iban !== '') pie.append(crearElemento('p', '', 'IBAN: ' + modelo.emisor.iban));
  if (modelo.notas !== '') pie.append(crearElemento('p', 'direccion', modelo.notas));
  return pie;
}
