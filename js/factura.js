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

// Una pareja "nombre / valor" para las listas de totales
function crearFilaDeResumen(lista, nombre, valor, clase) {
  const fila = crearElemento('div', clase || '');
  fila.append(crearElemento('dt', '', nombre), crearElemento('dd', '', valor));
  lista.append(fila);
}

// El bloque con los totales: el desglose por tipo de IVA y, debajo, el resumen.
// Lo uso en la vista previa de la factura y en el resumen que sale junto al formulario.
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
