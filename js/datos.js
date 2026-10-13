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
// contexto lleva las facturas ya guardadas y el id de la que estoy editando (o null),
// para mirar que el número no se repita ni se salte ninguno.
function revisarFactura(modelo, contexto) {
  const facturas = contexto ? contexto.facturas : [];
  const idEditando = contexto ? contexto.idEditando : null;
  const faltan = [];
  const avisos = [];

  // --- Lo obligatorio (artículo 6 del Reglamento de facturación)
  if (modelo.numero === null) faltan.push('El número de la factura (de 1 a ' + LIMITE_NUMERO + ')');
  if (!esFechaReal(modelo.fecha)) faltan.push('La fecha de la factura');
  if (modelo.fechaOperacion !== '' && !esFechaReal(modelo.fechaOperacion)) faltan.push('La fecha de la operación (o déjala vacía)');

  // Dos facturas no pueden tener el mismo número. Si me salto alguno, solo aviso.
  if (modelo.numero !== null) {
    if (buscarRepetida(facturas, modelo.serie, modelo.numero, idEditando)) {
      faltan.push('Ya existe la factura ' + numeroCompleto(modelo.serie, modelo.numero) + ': cambia el número o la serie');
    } else {
      avisos.push(...avisosDeSalto(facturas, modelo.serie, modelo.numero, idEditando));
    }
  }

  if (idEditando === null && facturas.length >= LIMITE_FACTURAS) {
    faltan.push('Has llegado al máximo de ' + LIMITE_FACTURAS + ' facturas guardadas: borra alguna para guardar más');
  }

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

// ---------- Numeración ----------

// La serie que propongo por defecto es el año de la factura: "2026-"
function serieDelAnio(fecha) {
  return fecha.slice(0, 4) + '-';
}

// El mayor número que hay en una serie, sin contar la factura que estoy editando.
// Si todavía no hay ninguna, 0.
function mayorNumeroDeLaSerie(facturas, serie, idExcluido) {
  let mayor = 0;
  for (const factura of facturas) {
    if (factura.serie === serie && factura.id !== idExcluido && factura.numero > mayor) mayor = factura.numero;
  }
  return mayor;
}

// El número que toca poner ahora: el siguiente al mayor de la serie
function siguienteNumero(facturas, serie, idExcluido) {
  return Math.min(mayorNumeroDeLaSerie(facturas, serie, idExcluido) + 1, LIMITE_NUMERO);
}

// Devuelvo la factura que ya tiene ese número en esa serie, o null
function buscarRepetida(facturas, serie, numero, idExcluido) {
  return facturas.find(function (factura) {
    return factura.id !== idExcluido && factura.serie === serie && factura.numero === numero;
  }) || null;
}

// La numeración tiene que ser correlativa: aviso si este número se salta alguno
function avisosDeSalto(facturas, serie, numero, idExcluido) {
  const mayor = mayorNumeroDeLaSerie(facturas, serie, idExcluido);
  if (numero <= mayor + 1) return [];

  if (mayor === 0) {
    return ['Es la primera factura de la serie «' + serie + '» y no empieza en 1. La numeración tiene que ser correlativa.'];
  }
  return ['Te saltas números: la última de la serie es la ' + numeroCompleto(serie, mayor) +
    ' y la siguiente sería la ' + numeroCompleto(serie, mayor + 1) + '. La numeración tiene que ser correlativa.'];
}

// ---------- Comprobar lo que viene de fuera ----------

// Todo lo que lea del almacenamiento del navegador o de un archivo importado puede estar
// viejo, roto o tocado a mano. Por eso no me fío de nada: lo reviso y me quedo con una
// copia limpia que solo tiene los campos que conozco.

const NOMBRE_APP = 'generador-facturas';
const CLAVE_DATOS = 'generador-facturas:datos';
const CLAVE_COPIA_DANADA = 'generador-facturas:datos-danados';
const LIMITE_FACTURAS = 500;
const LIMITE_SERIE = 10;
const LIMITE_CONCEPTO = 200;
const LIMITE_NOMBRE = 100;
const LIMITE_NIF = 20;
const LIMITE_DIRECCION = 200;
const LIMITE_EMAIL = 100;
const LIMITE_TELEFONO = 30;
const LIMITE_IBAN = 40;
const LIMITE_TEXTO_CORTO = 200;
const LIMITE_NOTAS = 500;

function esObjeto(valor) {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

// Un texto sin espacios de sobra y recortado. Si no es texto, ''.
function limpiarTexto(valor, maximo) {
  if (typeof valor !== 'string') return '';
  return valor.trim().slice(0, maximo);
}

// Para los campos que pueden faltar: si no está, ''. Si está pero no es texto, null (y se rechaza todo).
function textoOpcional(valor, maximo) {
  if (valor === undefined) return '';
  if (typeof valor !== 'string') return null;
  return valor.trim().slice(0, maximo);
}

function emisorVacio() {
  return { nombre: '', nif: '', direccion: '', email: '', telefono: '', iban: '', logo: '' };
}

// Los datos de quien emite. Aquí soy tolerante: lo que no valga se queda vacío.
function validarEmisor(datos) {
  if (!esObjeto(datos)) return emisorVacio();
  return {
    nombre: limpiarTexto(datos.nombre, LIMITE_NOMBRE),
    nif: limpiarTexto(datos.nif, LIMITE_NIF),
    direccion: limpiarTexto(datos.direccion, LIMITE_DIRECCION),
    email: limpiarTexto(datos.email, LIMITE_EMAIL),
    telefono: limpiarTexto(datos.telefono, LIMITE_TELEFONO),
    iban: limpiarTexto(datos.iban, LIMITE_IBAN),
    logo: esLogoValido(datos.logo) ? datos.logo : ''
  };
}

function validarLinea(datos) {
  if (!esObjeto(datos)) return null;
  const concepto = limpiarTexto(datos.concepto, LIMITE_CONCEPTO);
  if (concepto === '') return null;
  if (!Number.isInteger(datos.cantidad) || !Number.isInteger(datos.precio)) return null;
  if (!TIPOS_IVA.includes(datos.iva)) return null;
  if (problemaDeLinea(datos.cantidad, datos.precio) !== '') return null;
  return { concepto: concepto, cantidad: datos.cantidad, precio: datos.precio, iva: datos.iva };
}

// Una factura guardada. Aquí soy estricto: tiene que estar completa, como cuando se guardó.
// Devuelvo la copia limpia (con id 0, que se pone después) o null si algo no cuadra.
function validarFactura(datos) {
  if (!esObjeto(datos)) return null;

  if (typeof datos.serie !== 'string' || datos.serie.trim().length > LIMITE_SERIE) return null;
  if (!Number.isInteger(datos.numero) || datos.numero < 1 || datos.numero > LIMITE_NUMERO) return null;
  if (!esFechaReal(datos.fecha)) return null;
  const fechaOperacion = datos.fechaOperacion === undefined ? '' : datos.fechaOperacion;
  if (fechaOperacion !== '' && !esFechaReal(fechaOperacion)) return null;

  const emisor = validarEmisor(datos.emisor);
  if (emisor.nombre === '' || emisor.nif === '' || emisor.direccion === '') return null;
  // El logo no va dentro de cada factura: se usa el que haya en "Mis datos"
  delete emisor.logo;

  if (!esObjeto(datos.cliente)) return null;
  const cliente = {
    nombre: limpiarTexto(datos.cliente.nombre, LIMITE_NOMBRE),
    nif: limpiarTexto(datos.cliente.nif, LIMITE_NIF),
    direccion: limpiarTexto(datos.cliente.direccion, LIMITE_DIRECCION)
  };
  if (cliente.nombre === '' || cliente.direccion === '') return null;

  if (!Array.isArray(datos.lineas) || datos.lineas.length < 1 || datos.lineas.length > LIMITE_LINEAS) return null;
  const lineas = [];
  for (const dato of datos.lineas) {
    const linea = validarLinea(dato);
    if (!linea) return null;
    lineas.push(linea);
  }

  if (!Number.isInteger(datos.irpf) || datos.irpf < 0 || datos.irpf > IRPF_MAXIMO) return null;

  const exencion = textoOpcional(datos.exencion, LIMITE_TEXTO_CORTO);
  const formaPago = textoOpcional(datos.formaPago, LIMITE_TEXTO_CORTO);
  const notas = textoOpcional(datos.notas, LIMITE_NOTAS);
  if (exencion === null || formaPago === null || notas === null) return null;

  return {
    id: 0,
    serie: datos.serie.trim(),
    numero: datos.numero,
    fecha: datos.fecha,
    fechaOperacion: fechaOperacion,
    emisor: emisor,
    cliente: cliente,
    lineas: lineas,
    irpf: datos.irpf,
    exencion: exencion,
    formaPago: formaPago,
    notas: notas
  };
}

// ---------- Pasar del formulario a una factura guardada y al revés ----------

// Lo que se guarda de una factura. modelo viene de leerFormulario(). Solo guardo las líneas
// completas, y el IRPF como un número (0 si no se aplica).
function crearRegistroDeFactura(modelo, id) {
  const emisor = Object.assign({}, modelo.emisor);
  delete emisor.logo;

  return {
    id: id,
    serie: modelo.serie,
    numero: modelo.numero,
    fecha: modelo.fecha,
    fechaOperacion: modelo.fechaOperacion,
    emisor: emisor,
    cliente: Object.assign({}, modelo.cliente),
    lineas: modelo.lineas.filter(function (linea) { return linea.completa; }).map(function (linea) {
      return { concepto: linea.concepto, cantidad: linea.cantidad, precio: linea.precio, iva: linea.iva };
    }),
    irpf: modelo.irpf.aplicar ? modelo.irpf.valor : 0,
    exencion: modelo.exencion,
    formaPago: modelo.formaPago,
    notas: modelo.notas
  };
}

// El total de una factura guardada, para enseñarlo en la lista
function totalDeFactura(factura) {
  return calcularFactura(factura.lineas, factura.irpf).total;
}

// El id siguiente al más alto de la lista
function nuevoId(facturas) {
  let mayor = 0;
  for (const factura of facturas) {
    if (factura.id > mayor) mayor = factura.id;
  }
  return mayor + 1;
}

// ---------- Guardar y leer todo ----------

function guardarEstado(estado) {
  return guardarDato(CLAVE_DATOS, { emisor: estado.emisor, facturas: estado.facturas });
}

// Leo lo que hubiera guardado. Si alguna factura está dañada, la salto y la cuento en "descartadas".
// OJO: en ese caso guardo antes una copia de lo que había, para no perderlo del todo
// la próxima vez que se guarde algo.
function leerEstado() {
  const resultado = { emisor: emisorVacio(), facturas: [], descartadas: 0 };
  const guardado = leerDato(CLAVE_DATOS);
  if (!esObjeto(guardado)) return resultado;

  resultado.emisor = validarEmisor(guardado.emisor);
  const lista = Array.isArray(guardado.facturas) ? guardado.facturas : [];
  const usados = new Set();

  for (const datos of lista) {
    const factura = validarFactura(datos);
    const clave = factura ? factura.serie + '\u0000' + factura.numero : '';
    if (!factura || usados.has(clave) || resultado.facturas.length >= LIMITE_FACTURAS) {
      resultado.descartadas++;
      continue;
    }
    usados.add(clave);
    // Los id los pongo yo de nuevo, así no hace falta comprobar que no se repiten
    factura.id = resultado.facturas.length + 1;
    resultado.facturas.push(factura);
  }

  if (resultado.descartadas > 0) guardarDato(CLAVE_COPIA_DANADA, guardado);
  return resultado;
}

// ---------- Exportar e importar ----------

const TAMANO_MAXIMO_ARCHIVO = 5 * 1024 * 1024; // 5 MB, de sobra para 500 facturas

// Todo lo mío en un texto JSON. Le pongo delante el nombre de la página y una versión
// para poder reconocer el archivo al importarlo.
function exportarDatos(estado) {
  return JSON.stringify({ app: NOMBRE_APP, version: 1, emisor: estado.emisor, facturas: estado.facturas }, null, 2);
}

// Paso el texto de un archivo a mis datos. Devuelvo { estado, error }.
// OJO: aquí soy estricto. Si UNA factura no cuadra, rechazo el archivo entero, porque al
// importar se sustituye todo y no quiero dejar a medias una copia de seguridad.
function importarDatos(texto) {
  let datos = null;
  try {
    datos = JSON.parse(texto);
  } catch (error) {
    return { estado: null, error: 'El archivo no es un JSON válido.' };
  }

  if (!esObjeto(datos) || datos.app !== NOMBRE_APP) {
    return { estado: null, error: 'Este archivo no es una copia de seguridad de esta página.' };
  }
  if (datos.version !== 1) {
    return { estado: null, error: 'Esta copia es de una versión que no sé leer.' };
  }
  if (!Array.isArray(datos.facturas) || datos.facturas.length > LIMITE_FACTURAS) {
    return { estado: null, error: 'El archivo no tiene una lista de facturas válida (como mucho ' + LIMITE_FACTURAS + ').' };
  }

  const facturas = [];
  const usados = new Set();
  for (let i = 0; i < datos.facturas.length; i++) {
    const factura = validarFactura(datos.facturas[i]);
    if (!factura) {
      return { estado: null, error: 'La factura ' + (i + 1) + ' del archivo tiene datos que no cuadran y no he importado nada.' };
    }
    const clave = factura.serie + '\u0000' + factura.numero;
    if (usados.has(clave)) {
      return { estado: null, error: 'Hay dos facturas con el número ' + numeroCompleto(factura.serie, factura.numero) + ' y no he importado nada.' };
    }
    usados.add(clave);
    factura.id = i + 1;
    facturas.push(factura);
  }

  return { estado: { emisor: validarEmisor(datos.emisor), facturas: facturas, descartadas: 0 }, error: '' };
}

// Borro lo que he guardado en el navegador (menos el tema)
function borrarDatosGuardados() {
  try {
    localStorage.removeItem(CLAVE_DATOS);
    localStorage.removeItem(CLAVE_COPIA_DANADA);
    return true;
  } catch (error) {
    return false;
  }
}

// ¿Hay algo guardado que se pueda perder?
function hayDatos(estado) {
  return estado.facturas.length > 0 || estado.emisor.nombre !== '' || estado.emisor.nif !== '' ||
    estado.emisor.direccion !== '' || estado.emisor.logo !== '';
}
