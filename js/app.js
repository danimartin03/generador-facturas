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

// Cada línea lleva también su posición (1, 2, 3...) para poder decir "Línea 2: ..."
function leerLineas() {
  return Array.from(porId('listaLineas').children).map(function (fila, posicion) {
    const linea = leerLinea(fila);
    linea.posicion = posicion + 1;
    return linea;
  });
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

// ---------- Leer todo el formulario ----------

// El logo elegido, como texto data:image/... (o '' si no hay). Se guarda con "Mis datos".
let logoActual = '';

// El número tiene que ser un entero entre 1 y 999999. Si no, null.
function leerNumero() {
  const texto = porId('campoNumero').value.trim();
  if (!/^\d{1,6}$/.test(texto)) return null;
  const numero = Number(texto);
  return numero >= 1 ? numero : null;
}

// Lo que hay escrito ahora mismo en "Mis datos"
function leerEmisorDelFormulario() {
  return {
    nombre: porId('campoEmisorNombre').value.trim(),
    nif: porId('campoEmisorNif').value.trim(),
    direccion: porId('campoEmisorDireccion').value.trim(),
    email: porId('campoEmisorEmail').value.trim(),
    telefono: porId('campoEmisorTelefono').value.trim(),
    iban: porId('campoEmisorIban').value.trim(),
    logo: logoActual
  };
}

// El emisor que sale en la factura. Una factura ya guardada se queda con los datos de quien
// la emitió ese día (emisorCongelado), aunque luego cambies "Mis datos". El logo sí es siempre el actual.
function leerEmisor() {
  if (emisorCongelado) return Object.assign({}, emisorCongelado, { logo: logoActual });
  return leerEmisorDelFormulario();
}

// Recojo todo lo que hay escrito en una sola "foto" de la factura.
// Con ella se calcula, se dibuja la hoja y se revisa lo que falta.
function leerFormulario() {
  return {
    serie: porId('campoSerie').value.trim(),
    numero: leerNumero(),
    fecha: porId('campoFecha').value,
    fechaOperacion: porId('campoFechaOperacion').value,
    emisor: leerEmisor(),
    cliente: {
      nombre: porId('campoClienteNombre').value.trim(),
      nif: porId('campoClienteNif').value.trim(),
      direccion: porId('campoClienteDireccion').value.trim()
    },
    lineas: leerLineas(),
    irpf: leerIrpf(),
    exencion: porId('campoExencion').value.trim(),
    formaPago: porId('campoFormaPago').value.trim(),
    notas: porId('campoNotas').value.trim()
  };
}

// Valores con los que arranca una factura nueva: la serie es el año, y el número, el siguiente
function iniciarFormulario() {
  const hoy = fechaDeHoy();
  porId('campoSerie').value = serieDelAnio(hoy);
  porId('campoFecha').value = hoy;
  fechaAnterior = hoy;
  proponerNumero();
}

// Pongo en el número el que toca después del último de la serie
function proponerNumero() {
  const serie = porId('campoSerie').value.trim();
  porId('campoNumero').value = String(siguienteNumero(estado.facturas, serie, idEditando));
}

// Si cambian la fecha a otro año y la serie era la de por defecto, la cambio también.
// Así al empezar el año las facturas vuelven solas al 001.
let fechaAnterior = '';

function ajustarSerieSegunLaFecha() {
  const nueva = porId('campoFecha').value;
  if (!esFechaReal(nueva)) return;

  const eraLaDeSiempre = esFechaReal(fechaAnterior) && porId('campoSerie').value.trim() === serieDelAnio(fechaAnterior);
  if (idEditando === null && eraLaDeSiempre && serieDelAnio(nueva) !== serieDelAnio(fechaAnterior)) {
    porId('campoSerie').value = serieDelAnio(nueva);
    proponerNumero();
  }
  fechaAnterior = nueva;
}

// ---------- Lo que falta y los avisos ----------

function pintarRevision(revision) {
  porId('resumenFaltan').hidden = revision.faltan.length === 0;
  porId('listaFaltan').replaceChildren(...revision.faltan.map(function (texto) {
    return crearElemento('li', '', texto);
  }));
  porId('listaAvisos').replaceChildren(...revision.avisos.map(function (texto) {
    return crearElemento('li', '', texto);
  }));

  // Sin lo obligatorio no se puede guardar ni descargar
  const incompleta = revision.faltan.length > 0;
  porId('botonGuardar').disabled = incompleta;
  porId('botonPdf').disabled = incompleta;
}

// Debajo del NIF de "Mis datos" digo si parece válido
function pintarAyudaDelNif(nif) {
  let texto = '';
  if (nif !== '') {
    const tipo = tipoDeNif(nif);
    texto = tipo !== '' ? 'Parece un ' + tipo + ' válido.' : 'No parece un NIF válido. Revisa los números y la letra.';
  }
  porId('ayudaEmisorNif').textContent = texto;
}

// ---------- Recalcular todo ----------

// Se llama cada vez que cambia algo del formulario: vuelve a leerlo y a calcularlo todo.
// Son pocas cuentas, así que no hace falta ser más listo que esto.
function actualizar() {
  const modelo = leerFormulario();
  const completas = modelo.lineas.filter(function (linea) { return linea.completa; });
  const totales = calcularFactura(completas, modelo.irpf.valor);

  // totales.importes va en el mismo orden que las líneas completas
  let posicion = 0;
  for (const linea of modelo.lineas) {
    pintarLinea(linea, linea.completa ? totales.importes[posicion++] : null);
  }

  porId('campoIrpfPorcentaje').setAttribute('aria-invalid', !modelo.irpf.correcto);
  // El motivo de la exención solo hace falta si hay alguna línea exenta
  porId('grupoExencion').hidden = !completas.some(function (linea) { return linea.iva === 0; });
  pintarTotalesVivos(completas.length > 0, totales, modelo.irpf);

  pintarHoja(porId('hoja'), modelo, completas, totales);
  pintarRevision(revisarFactura(modelo, { facturas: estado.facturas, idEditando: idEditando }));
  pintarAyudaDelNif(modelo.emisor.nif);
}

// ---------- Lo que hay guardado ----------

// Todo lo que guarda la página: mis datos de emisor y las facturas hechas
let estado = { emisor: emisorVacio(), facturas: [], descartadas: 0 };
// La factura guardada que tengo abierta en el formulario (null si es una nueva)
let idEditando = null;
// Los datos de emisor con los que se guardó la factura abierta (null si es una nueva)
let emisorCongelado = null;
// Para avisar antes de perder lo que se ha escrito
let hayCambiosSinGuardar = false;

// Guardo y, si el navegador no deja, enseño el aviso de arriba
function guardarTodo() {
  const bien = guardarEstado(estado);
  porId('avisoGuardado').hidden = bien;
  return bien;
}

function buscarFactura(id) {
  return estado.facturas.find(function (factura) { return factura.id === id; }) || null;
}

// ---------- Ventana de confirmar ----------

// Abro la ventana y espero la respuesta. Devuelvo true si aceptan.
// Los botones están dentro de un <form method="dialog">, así que al pulsarlos
// el navegador cierra la ventana y me deja en returnValue el value del botón.
function confirmar(pregunta, textoBoton) {
  const dialogo = porId('dialogoConfirmar');
  porId('textoConfirmar').textContent = pregunta;
  porId('botonConfirmar').textContent = textoBoton;

  return new Promise(function (resolver) {
    // Lo vacío antes, porque si cierran con Escape se queda el valor de la vez anterior
    dialogo.returnValue = '';
    dialogo.showModal();
    dialogo.addEventListener('close', function () {
      resolver(dialogo.returnValue === 'aceptar');
    }, { once: true });
  });
}

// Si hay cambios sin guardar, pregunto antes de tirarlos
async function confirmarDescartar() {
  if (!hayCambiosSinGuardar) return true;
  return confirmar('Tienes cambios sin guardar en la factura. ¿Quieres descartarlos?', 'Descartar');
}

// ---------- Cambios en el formulario ----------

function alCambiarFormulario(evento) {
  hayCambiosSinGuardar = true;
  // Si cambian la serie de una factura nueva, el número que toca es otro
  if (evento.target.id === 'campoSerie' && idEditando === null) proponerNumero();
  if (evento.target.id === 'campoFecha') ajustarSerieSegunLaFecha();
  actualizar();
}

// Mis datos se guardan solos, a cada cambio
function alCambiarDatos() {
  estado.emisor = leerEmisorDelFormulario();
  guardarTodo();
  actualizar();
}

// Si cierran la pestaña con cambios sin guardar, el navegador pregunta
window.addEventListener('beforeunload', function (evento) {
  if (hayCambiosSinGuardar) {
    evento.preventDefault();
    evento.returnValue = '';
  }
});

// ---------- Abrir, duplicar y empezar una factura ----------

// Pongo una factura guardada dentro del formulario
function rellenarFormulario(factura) {
  porId('campoSerie').value = factura.serie;
  porId('campoNumero').value = String(factura.numero);
  porId('campoFecha').value = factura.fecha;
  porId('campoFechaOperacion').value = factura.fechaOperacion;
  porId('campoClienteNombre').value = factura.cliente.nombre;
  porId('campoClienteNif').value = factura.cliente.nif;
  porId('campoClienteDireccion').value = factura.cliente.direccion;

  porId('listaLineas').textContent = '';
  for (const linea of factura.lineas) {
    anadirLinea({
      concepto: linea.concepto,
      cantidad: cantidadParaCampo(linea.cantidad),
      precio: importeParaCampo(linea.precio),
      iva: String(linea.iva)
    });
  }

  porId('campoIrpf').checked = factura.irpf > 0;
  porId('grupoIrpf').hidden = factura.irpf === 0;
  porId('campoIrpfPorcentaje').value = factura.irpf > 0 ? porcentajeParaCampo(factura.irpf) : '';
  porId('campoExencion').value = factura.exencion;
  porId('campoFormaPago').value = factura.formaPago;
  porId('campoNotas').value = factura.notas;
}

// Lo que se ve tras cambiar de factura: la pestaña de la factura, con el foco en su título
function irALaFactura() {
  cambiarSeccion('factura');
  cambiarVista('datos');
  pintarAvisoDeEdicion();
  actualizar();
  const titulo = porId('tituloFactura');
  titulo.tabIndex = -1;
  titulo.focus();
}

async function abrirFactura(id) {
  if (!(await confirmarDescartar())) return;
  const factura = buscarFactura(id);
  if (!factura) return;

  rellenarFormulario(factura);
  idEditando = factura.id;
  emisorCongelado = factura.emisor;
  fechaAnterior = factura.fecha;
  hayCambiosSinGuardar = false;
  irALaFactura();
  decirEstado('Factura ' + numeroCompleto(factura.serie, factura.numero) + ' abierta.');
}

// Una copia: mismos datos, pero con el número que toca y la fecha de hoy
async function duplicarFactura(id) {
  if (!(await confirmarDescartar())) return;
  const factura = buscarFactura(id);
  if (!factura) return;

  rellenarFormulario(factura);
  idEditando = null;
  emisorCongelado = null;
  const hoy = fechaDeHoy();
  porId('campoSerie').value = serieDelAnio(hoy);
  porId('campoFecha').value = hoy;
  porId('campoFechaOperacion').value = '';
  fechaAnterior = hoy;
  proponerNumero();
  hayCambiosSinGuardar = true;
  irALaFactura();
  decirEstado('Copia de la factura ' + numeroCompleto(factura.serie, factura.numero) + ' lista para editar.');
}

async function nuevaFactura() {
  if (!(await confirmarDescartar())) return;

  idEditando = null;
  emisorCongelado = null;
  for (const id of ['campoClienteNombre', 'campoClienteNif', 'campoClienteDireccion', 'campoFechaOperacion', 'campoExencion', 'campoFormaPago', 'campoNotas', 'campoIrpfPorcentaje']) {
    porId(id).value = '';
  }
  porId('campoIrpf').checked = false;
  porId('grupoIrpf').hidden = true;
  vaciarLineas();
  iniciarFormulario();
  hayCambiosSinGuardar = false;
  irALaFactura();
  decirEstado('Factura nueva.');
}

// El aviso que sale cuando la factura abierta ya estaba guardada
function pintarAvisoDeEdicion() {
  const factura = idEditando === null ? null : buscarFactura(idEditando);
  porId('avisoEdicion').hidden = factura === null;
  if (!factura) return;

  porId('textoEdicion').textContent = 'La factura ' + numeroCompleto(factura.serie, factura.numero) +
    ' ya está guardada. Si la cambias y la vuelves a guardar, se sobrescribe: una factura emitida se rectifica con otra, no se modifica.' +
    (emisorCongelado ? ' Se usan los datos de emisor que tenía al guardarla.' : '');
  porId('botonDatosActuales').hidden = emisorCongelado === null;
}

function usarMisDatosActuales() {
  emisorCongelado = null;
  hayCambiosSinGuardar = true;
  pintarAvisoDeEdicion();
  actualizar();
  decirEstado('Ahora la factura usa tus datos actuales.');
}

// ---------- Guardar ----------

function guardarFactura() {
  const modelo = leerFormulario();
  const revision = revisarFactura(modelo, { facturas: estado.facturas, idEditando: idEditando });
  // El botón ya está desactivado si falta algo, pero compruebo por si acaso
  if (revision.faltan.length > 0) return;

  const id = idEditando === null ? nuevoId(estado.facturas) : idEditando;
  const factura = crearRegistroDeFactura(modelo, id);
  if (idEditando === null) {
    estado.facturas.push(factura);
  } else {
    estado.facturas[estado.facturas.findIndex(function (otra) { return otra.id === id; })] = factura;
  }

  // Desde ahora la factura se queda con los datos de emisor de hoy
  idEditando = id;
  emisorCongelado = factura.emisor;
  hayCambiosSinGuardar = false;
  guardarTodo();
  pintarAvisoDeEdicion();
  pintarListaFacturas();
  actualizar();
  decirEstado('Factura ' + numeroCompleto(factura.serie, factura.numero) + ' guardada.');
}

// ---------- Mis facturas ----------

// Las más recientes primero; si tienen la misma fecha, las de número más alto
function ordenarFacturas(facturas) {
  return facturas.slice().sort(function (a, b) {
    if (a.fecha !== b.fecha) return a.fecha < b.fecha ? 1 : -1;
    if (a.serie !== b.serie) return a.serie < b.serie ? 1 : -1;
    return b.numero - a.numero;
  });
}

function crearBotonDeFicha(texto, accion, factura, numero) {
  const boton = crearElemento('button', 'boton boton-pequeno', texto);
  boton.type = 'button';
  boton.dataset.accion = accion;
  boton.dataset.id = factura.id;
  boton.setAttribute('aria-label', texto + ' la factura ' + numero);
  return boton;
}

function crearFichaDeFactura(factura) {
  const numero = numeroCompleto(factura.serie, factura.numero);
  const ficha = crearElemento('li', 'ficha');

  const texto = crearElemento('div');
  texto.append(
    crearElemento('p', 'ficha-numero', numero),
    crearElemento('p', 'ficha-detalle', formatearFecha(factura.fecha) + ' · ' + factura.cliente.nombre)
  );
  const botones = crearElemento('div', 'ficha-botones');
  botones.append(
    crearBotonDeFicha('Abrir', 'abrir', factura, numero),
    crearBotonDeFicha('Duplicar', 'duplicar', factura, numero),
    crearBotonDeFicha('Borrar', 'borrar', factura, numero)
  );

  ficha.append(texto, crearElemento('p', 'ficha-total', formatearImporte(totalDeFactura(factura))), botones);
  return ficha;
}

function pintarListaFacturas() {
  porId('sinFacturas').hidden = estado.facturas.length > 0;
  porId('listaFacturas').replaceChildren(...ordenarFacturas(estado.facturas).map(crearFichaDeFactura));
}

// Un solo listener para todos los botones de la lista
function alPulsarEnFacturas(evento) {
  const boton = evento.target.closest('button[data-accion]');
  if (!boton) return;
  const id = Number(boton.dataset.id);

  if (boton.dataset.accion === 'abrir') abrirFactura(id);
  if (boton.dataset.accion === 'duplicar') duplicarFactura(id);
  if (boton.dataset.accion === 'borrar') borrarFactura(id);
}

async function borrarFactura(id) {
  const factura = buscarFactura(id);
  if (!factura) return;

  const numero = numeroCompleto(factura.serie, factura.numero);
  const seguro = await confirmar('¿Borrar la factura ' + numero + '? No se puede deshacer, y la numeración se quedará con un hueco.', 'Borrar factura');
  if (!seguro) return;

  estado.facturas = estado.facturas.filter(function (otra) { return otra.id !== id; });
  // Si era la que tenía abierta, el formulario se queda como una factura nueva con sus mismos datos
  if (idEditando === id) {
    idEditando = null;
    emisorCongelado = null;
    hayCambiosSinGuardar = true;
  }
  guardarTodo();
  pintarListaFacturas();
  pintarAvisoDeEdicion();
  actualizar();
  decirEstado('Factura ' + numero + ' borrada.');
  const titulo = porId('tituloFacturas');
  titulo.tabIndex = -1;
  titulo.focus();
}

// ---------- Mis datos y el logo ----------

function pintarEmisorEnFormulario(emisor) {
  porId('campoEmisorNombre').value = emisor.nombre;
  porId('campoEmisorNif').value = emisor.nif;
  porId('campoEmisorDireccion').value = emisor.direccion;
  porId('campoEmisorEmail').value = emisor.email;
  porId('campoEmisorTelefono').value = emisor.telefono;
  porId('campoEmisorIban').value = emisor.iban;
  logoActual = emisor.logo;
  pintarLogo();
}

function pintarLogo() {
  const imagen = porId('imagenLogo');
  const hayLogo = logoActual !== '';
  imagen.hidden = !hayLogo;
  if (hayLogo) imagen.src = logoActual; else imagen.removeAttribute('src');
  porId('botonLogo').textContent = hayLogo ? 'Cambiar imagen' : 'Elegir imagen';
  porId('botonQuitarLogo').hidden = !hayLogo;
}

function mostrarErrorDeLogo(mensaje) {
  porId('errorLogo').textContent = mensaje;
  porId('errorLogo').hidden = mensaje === '';
}

const TIPOS_DE_LOGO = ['image/png', 'image/jpeg', 'image/webp'];
const PESO_MAXIMO_LOGO = 1024 * 1024; // 1 MB
const LADO_MAXIMO_LOGO = 400;         // píxeles

function alElegirLogo() {
  const campo = porId('campoLogo');
  const archivo = campo.files[0];
  // Vacío el campo para que se pueda volver a elegir el mismo archivo
  campo.value = '';
  if (!archivo) return;

  if (!TIPOS_DE_LOGO.includes(archivo.type)) {
    mostrarErrorDeLogo('Elige una imagen PNG, JPG o WebP.');
    return;
  }
  if (archivo.size > PESO_MAXIMO_LOGO) {
    mostrarErrorDeLogo('La imagen pesa más de 1 MB. Elige una más ligera.');
    return;
  }

  // Leo el archivo dentro del navegador (no se sube a ningún sitio)
  const lector = new FileReader();
  lector.onerror = function () {
    mostrarErrorDeLogo('No he podido leer ese archivo.');
  };
  lector.onload = function () {
    const imagen = new Image();
    imagen.onerror = function () {
      mostrarErrorDeLogo('No he podido abrir esa imagen. Puede que esté dañada.');
    };
    imagen.onload = function () {
      const reducido = reducirLogo(imagen);
      if (!reducido) {
        mostrarErrorDeLogo('La imagen sigue pesando demasiado aunque se reduzca. Prueba con otra.');
        return;
      }
      mostrarErrorDeLogo('');
      logoActual = reducido;
      pintarLogo();
      alCambiarDatos();
    };
    imagen.src = lector.result;
  };
  lector.readAsDataURL(archivo);
}

// Reduzco el logo para que no llene el almacenamiento del navegador.
// Primero lo intento en PNG, que conserva la transparencia; si pesa demasiado, lo paso a JPG.
function reducirLogo(imagen) {
  const escala = Math.min(1, LADO_MAXIMO_LOGO / Math.max(imagen.width, imagen.height));
  const ancho = Math.max(1, Math.round(imagen.width * escala));
  const alto = Math.max(1, Math.round(imagen.height * escala));

  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;
  const contexto = lienzo.getContext('2d');
  contexto.drawImage(imagen, 0, 0, ancho, alto);

  let resultado = lienzo.toDataURL('image/png');
  if (resultado.length > LIMITE_LOGO) {
    // En JPG no hay transparencia: pinto un fondo blanco DETRÁS de lo que ya hay
    contexto.globalCompositeOperation = 'destination-over';
    contexto.fillStyle = '#ffffff';
    contexto.fillRect(0, 0, ancho, alto);
    resultado = lienzo.toDataURL('image/jpeg', 0.85);
  }
  return esLogoValido(resultado) ? resultado : null;
}

function quitarLogo() {
  logoActual = '';
  mostrarErrorDeLogo('');
  pintarLogo();
  alCambiarDatos();
  porId('botonLogo').focus();
}

// ---------- Arranque ----------

// Espero a DOMContentLoaded para que ya estén cargados todos los archivos JS
document.addEventListener('DOMContentLoaded', arrancar);

function arrancar() {
  pintarBotonTema();

  estado = leerEstado();
  if (estado.descartadas > 0) {
    porId('avisoDanadas').textContent = estado.descartadas === 1
      ? '1 factura guardada estaba dañada y no se ha podido cargar. Se ha dejado una copia de lo que había en este navegador.'
      : estado.descartadas + ' facturas guardadas estaban dañadas y no se han podido cargar. Se ha dejado una copia de lo que había en este navegador.';
    porId('avisoDanadas').hidden = false;
  }
  pintarEmisorEnFormulario(estado.emisor);

  porId('botonTema').addEventListener('click', cambiarTema);
  porId('pestanas').addEventListener('click', alPulsarPestana);
  porId('vistas').addEventListener('click', alPulsarVista);

  anadirLinea();
  porId('botonAnadirLinea').addEventListener('click', alPulsarAnadirLinea);
  porId('listaLineas').addEventListener('click', alPulsarEnLineas);
  porId('campoIrpf').addEventListener('change', alCambiarIrpf);
  porId('grupoIrpf').addEventListener('click', alPulsarPorcentajeRapido);
  // El evento input salta con cualquier campo del formulario, así me vale un solo listener
  porId('formularioFactura').addEventListener('input', alCambiarFormulario);
  porId('formularioFactura').addEventListener('submit', function (evento) { evento.preventDefault(); });
  // Los datos del emisor están en otra pestaña, pero salen en la factura
  porId('formularioDatos').addEventListener('input', alCambiarDatos);
  porId('formularioDatos').addEventListener('submit', function (evento) { evento.preventDefault(); });
  porId('botonLogo').addEventListener('click', function () { porId('campoLogo').click(); });
  porId('campoLogo').addEventListener('change', alElegirLogo);
  porId('botonQuitarLogo').addEventListener('click', quitarLogo);

  porId('botonNuevaFactura').addEventListener('click', nuevaFactura);
  porId('botonGuardar').addEventListener('click', guardarFactura);
  porId('botonDatosActuales').addEventListener('click', usarMisDatosActuales);
  porId('listaFacturas').addEventListener('click', alPulsarEnFacturas);

  iniciarFormulario();
  pintarListaFacturas();
  pintarAvisoDeEdicion();
  actualizar();
}
