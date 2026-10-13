// Aquí va todo lo que toca la página: pestañas, formularios, lista de facturas y archivos.

const CLAVE_TEMA = 'generador-facturas:tema';

// ---------- Ayudas pequeñas ----------

// Atajo para no escribir document.getElementById cien veces
function porId(id) {
  return document.getElementById(id);
}

// Escribo en la zona aria-live para que el lector de pantalla cuente lo que pasa
function decirEstado(texto) {
  porId('mensajeEstado').textContent = texto;
}

// ---------- Tema claro / oscuro ----------

// El tema ya lo ha puesto el script del <head> (para que no parpadee).
// Aquí solo dejo el botón con el texto que toca.
function pintarBotonTema() {
  const esOscuro = document.documentElement.dataset.tema === 'oscuro';
  porId('botonTema').textContent = esOscuro ? 'Tema claro' : 'Tema oscuro';
  porId('botonTema').setAttribute('aria-pressed', esOscuro);
}

function cambiarTema() {
  const esOscuro = document.documentElement.dataset.tema === 'oscuro';
  const temaNuevo = esOscuro ? 'claro' : 'oscuro';
  document.documentElement.dataset.tema = temaNuevo;
  guardarDato(CLAVE_TEMA, temaNuevo);
  pintarBotonTema();
}

// ---------- Secciones ----------

const SECCIONES = ['factura', 'facturas', 'datos'];

// Enseño una sección y escondo las otras dos
function cambiarSeccion(seccion) {
  for (const nombre of SECCIONES) {
    const id = 'seccion' + nombre.charAt(0).toUpperCase() + nombre.slice(1);
    porId(id).hidden = nombre !== seccion;
  }
  for (const boton of porId('pestanas').querySelectorAll('button')) {
    boton.setAttribute('aria-pressed', boton.dataset.seccion === seccion);
  }
}

function alPulsarPestana(evento) {
  const boton = evento.target.closest('button');
  if (boton) cambiarSeccion(boton.dataset.seccion);
}

// En el móvil, dentro de "Factura", se ve el formulario o la vista previa
function cambiarVista(vista) {
  porId('zonas').dataset.vista = vista;
  for (const boton of porId('vistas').querySelectorAll('button')) {
    boton.setAttribute('aria-pressed', boton.dataset.vista === vista);
  }
}

function alPulsarVista(evento) {
  const boton = evento.target.closest('button');
  if (boton) cambiarVista(boton.dataset.vista);
}

// ---------- Líneas de la factura ----------

// Cada línea es una fila del formulario, y la saco de un molde (<template>) del HTML.
let contadorDeLineas = 0; // para que cada campo de cada línea tenga un id distinto

function crearFilaLinea() {
  contadorDeLineas++;
  const fila = porId('plantillaLinea').content.firstElementChild.cloneNode(true);
  // Cada etiqueta se une a su campo por el id, y los ids no se pueden repetir
  for (const campo of fila.querySelectorAll('input, select')) {
    campo.id = 'linea-' + contadorDeLineas + '-' + campo.dataset.campo;
    campo.parentElement.querySelector('label').htmlFor = campo.id;
  }
  return fila;
}

function campoDeLinea(fila, nombre) {
  return fila.querySelector('[data-campo="' + nombre + '"]');
}

// datos son textos tal como van en los campos: { concepto, cantidad, precio, iva }.
// Sin datos, creo una línea en blanco.
function anadirLinea(datos) {
  const lista = porId('listaLineas');
  if (lista.children.length >= LIMITE_LINEAS) return null;

  const anterior = lista.lastElementChild;
  const fila = crearFilaLinea();
  campoDeLinea(fila, 'concepto').value = datos ? datos.concepto : '';
  campoDeLinea(fila, 'cantidad').value = datos ? datos.cantidad : '1';
  campoDeLinea(fila, 'precio').value = datos ? datos.precio : '';
  // Una línea nueva empieza con el mismo IVA que la anterior, que casi siempre es el mismo
  campoDeLinea(fila, 'iva').value = datos ? datos.iva : (anterior ? campoDeLinea(anterior, 'iva').value : '21');
  lista.append(fila);
  numerarLineas();
  return fila;
}

// Dejo la lista con una sola línea en blanco
function vaciarLineas() {
  porId('listaLineas').textContent = '';
  anadirLinea();
}

// Pongo a cada línea su número para los lectores de pantalla, y activo o no los botones
function numerarLineas() {
  const filas = Array.from(porId('listaLineas').children);
  filas.forEach(function (fila, posicion) {
    fila.setAttribute('role', 'group');
    fila.setAttribute('aria-label', 'Línea ' + (posicion + 1));
    const boton = fila.querySelector('[data-accion="quitar"]');
    boton.setAttribute('aria-label', 'Quitar la línea ' + (posicion + 1));
    // Siempre tiene que quedar al menos una línea
    boton.disabled = filas.length === 1;
  });
  porId('botonAnadirLinea').disabled = filas.length >= LIMITE_LINEAS;
}

function alPulsarEnLineas(evento) {
  const boton = evento.target.closest('[data-accion="quitar"]');
  if (!boton) return;

  const fila = boton.closest('.linea');
  const filas = Array.from(porId('listaLineas').children);
  const posicion = filas.indexOf(fila);
  fila.remove();
  numerarLineas();
  actualizar();

  // Dejo el foco en la línea que ha ocupado su sitio, para no perderlo
  const restantes = porId('listaLineas').children;
  campoDeLinea(restantes[Math.min(posicion, restantes.length - 1)], 'concepto').focus();
  decirEstado('Línea quitada. Quedan ' + restantes.length + '.');
}

function alPulsarAnadirLinea() {
  const fila = anadirLinea();
  if (fila) {
    campoDeLinea(fila, 'concepto').focus();
    actualizar();
  }
}

// Leo lo que hay escrito en una línea y digo si está completa y, si no, qué le pasa
function leerLinea(fila) {
  const concepto = campoDeLinea(fila, 'concepto').value.trim();
  const textoCantidad = campoDeLinea(fila, 'cantidad').value.trim();
  const textoPrecio = campoDeLinea(fila, 'precio').value.trim();
  const cantidad = leerCantidad(textoCantidad);
  const precio = leerImporte(textoPrecio);

  // Una línea sin concepto y sin precio es una línea en blanco: no cuenta
  const vacia = concepto === '' && textoPrecio === '';
  let problema = '';
  if (!vacia) problema = concepto === '' ? 'concepto' : problemaDeLinea(cantidad, precio);

  return {
    fila: fila,
    concepto: concepto,
    cantidad: cantidad,
    precio: precio,
    iva: Number(campoDeLinea(fila, 'iva').value),
    textoCantidad: textoCantidad,
    textoPrecio: textoPrecio,
    vacia: vacia,
    problema: problema,
    completa: !vacia && problema === ''
  };
}

function leerLineas() {
  return Array.from(porId('listaLineas').children).map(leerLinea);
}

// Marco en rojo los campos que no se entienden y escribo el importe de la línea.
// importe es null si la línea no está completa.
function pintarLinea(linea, importe) {
  const cantidadMal = linea.problema === 'cantidad' && linea.textoCantidad !== '';
  const precioMal = (linea.problema === 'precio' || linea.problema === 'importe') && linea.textoPrecio !== '';
  campoDeLinea(linea.fila, 'cantidad').setAttribute('aria-invalid', cantidadMal);
  campoDeLinea(linea.fila, 'precio').setAttribute('aria-invalid', precioMal);

  let texto = '—';
  if (importe !== null) texto = formatearImporte(importe);
  if (linea.problema === 'importe') texto = 'Demasiado grande';
  campoDeLinea(linea.fila, 'importe').textContent = texto;
}

// ---------- Impuestos ----------

// Leo la retención de IRPF. valor son centésimas de por ciento (1500 = 15 %).
// Si el porcentaje no se entiende, no retengo nada hasta que se arregle.
function leerIrpf() {
  if (!porId('campoIrpf').checked) return { aplicar: false, valor: 0, correcto: true };

  const valor = leerPorcentaje(porId('campoIrpfPorcentaje').value);
  const correcto = valor !== null && valor <= IRPF_MAXIMO;
  return { aplicar: true, valor: correcto ? valor : 0, correcto: correcto };
}

function alCambiarIrpf() {
  const aplicar = porId('campoIrpf').checked;
  porId('grupoIrpf').hidden = !aplicar;
  // Si lo activan y el campo está vacío, propongo el 15 %, que es el general
  if (aplicar && porId('campoIrpfPorcentaje').value.trim() === '') {
    porId('campoIrpfPorcentaje').value = '15';
  }
  actualizar();
}

function alPulsarPorcentajeRapido(evento) {
  const boton = evento.target.closest('[data-irpf]');
  if (!boton) return;
  porId('campoIrpfPorcentaje').value = boton.dataset.irpf;
  actualizar();
}

// ---------- Totales a la vista ----------

function pintarTotalesVivos(hayLineas, totales, irpf) {
  const zona = porId('totalesVivo');
  if (!hayLineas) {
    zona.replaceChildren(crearElemento('p', 'sin-totales', 'Los totales aparecerán cuando completes una línea.'));
    return;
  }
  zona.replaceChildren(crearBloqueDeTotales(totales, irpf));
}

// ---------- Recalcular todo ----------

// Se llama cada vez que cambia algo del formulario: vuelve a leerlo y a calcularlo todo.
// Son pocas cuentas, así que no hace falta ser más listo que esto.
function actualizar() {
  const lineas = leerLineas();
  const completas = lineas.filter(function (linea) { return linea.completa; });
  const irpf = leerIrpf();
  const totales = calcularFactura(completas, irpf.valor);

  // totales.importes va en el mismo orden que las líneas completas
  let posicion = 0;
  for (const linea of lineas) {
    pintarLinea(linea, linea.completa ? totales.importes[posicion++] : null);
  }

  porId('campoIrpfPorcentaje').setAttribute('aria-invalid', !irpf.correcto);
  // El motivo de la exención solo hace falta si hay alguna línea exenta
  porId('grupoExencion').hidden = !completas.some(function (linea) { return linea.iva === 0; });
  pintarTotalesVivos(completas.length > 0, totales, irpf);
}

// ---------- Arranque ----------

// Espero a DOMContentLoaded para que ya estén cargados todos los archivos JS
document.addEventListener('DOMContentLoaded', arrancar);

function arrancar() {
  pintarBotonTema();

  porId('botonTema').addEventListener('click', cambiarTema);
  porId('pestanas').addEventListener('click', alPulsarPestana);
  porId('vistas').addEventListener('click', alPulsarVista);

  anadirLinea();
  porId('botonAnadirLinea').addEventListener('click', alPulsarAnadirLinea);
  porId('listaLineas').addEventListener('click', alPulsarEnLineas);
  porId('campoIrpf').addEventListener('change', alCambiarIrpf);
  porId('grupoIrpf').addEventListener('click', alPulsarPorcentajeRapido);
  // El evento input salta con cualquier campo del formulario, así me vale un solo listener
  porId('formularioFactura').addEventListener('input', actualizar);
  porId('formularioFactura').addEventListener('submit', function (evento) { evento.preventDefault(); });
  actualizar();
}
