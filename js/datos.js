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
