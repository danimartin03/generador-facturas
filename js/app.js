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

// ---------- Arranque ----------

// Espero a DOMContentLoaded para que ya estén cargados todos los archivos JS
document.addEventListener('DOMContentLoaded', arrancar);

function arrancar() {
  pintarBotonTema();

  porId('botonTema').addEventListener('click', cambiarTema);
  porId('pestanas').addEventListener('click', alPulsarPestana);
  porId('vistas').addEventListener('click', alPulsarVista);
}
