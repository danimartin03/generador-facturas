// Comprobar un NIF español: DNI (personas), NIE (extranjeros) y CIF (empresas).
// Solo miro que el formato y la letra o el dígito de control cuadren. Que el NIF exista de
// verdad solo lo puede decir Hacienda. Aquí no se toca la página.

const LETRAS_DNI = 'TRWAGMYFPDXBNJZSQVHLCKE';
const LETRAS_CONTROL_CIF = 'JABCDEFGHI';

// Mayúsculas, sin espacios, puntos ni guiones, y sin el "ES" de delante de los NIF intracomunitarios
function limpiarNif(texto) {
  let limpio = texto.toUpperCase().replace(/[\s.\-]/g, '');
  if (/^ES[A-Z0-9]{9}$/.test(limpio)) limpio = limpio.slice(2);
  return limpio;
}

// La letra del DNI sale de dividir el número entre 23 y mirar el resto en esa lista
function letraDeDni(numero) {
  return LETRAS_DNI[numero % 23];
}

// Ocho números y una letra: 12345678Z
function esDniValido(nif) {
  return /^\d{8}[A-Z]$/.test(nif) && nif[8] === letraDeDni(Number(nif.slice(0, 8)));
}

// X, Y o Z, siete números y una letra: X1234567L
function esNieValido(nif) {
  if (!/^[XYZ]\d{7}[A-Z]$/.test(nif)) return false;
  // La X, la Y y la Z valen como 0, 1 y 2 delante de los siete números
  const numero = 'XYZ'.indexOf(nif[0]) + nif.slice(1, 8);
  return nif[8] === letraDeDni(Number(numero));
}

// Una letra, siete números y un control, que puede ser número o letra: B12345674
function esCifValido(nif) {
  if (!/^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$/.test(nif)) return false;

  // Los siete números de en medio. Los de lugar impar (1.º, 3.º, 5.º, 7.º) se doblan y se
  // suman las cifras del resultado; los de lugar par se suman tal cual.
  let suma = 0;
  for (let i = 0; i < 7; i++) {
    const cifra = Number(nif[i + 1]);
    if (i % 2 === 0) {
      const doble = cifra * 2;
      suma += Math.floor(doble / 10) + (doble % 10);
    } else {
      suma += cifra;
    }
  }
  const control = (10 - (suma % 10)) % 10;
  const comoLetra = LETRAS_CONTROL_CIF[control];
  const comoNumero = String(control);
  const ultimo = nif[8];

  // Según la letra de arranque, el control tiene que ser letra, número o cualquiera de los dos
  if ('PQRSNW'.includes(nif[0])) return ultimo === comoLetra;
  if ('ABEH'.includes(nif[0])) return ultimo === comoNumero;
  return ultimo === comoNumero || ultimo === comoLetra;
}

// Digo qué tipo de NIF es: 'DNI', 'NIE', 'CIF', o '' si no es válido
function tipoDeNif(texto) {
  const nif = limpiarNif(texto);
  if (esDniValido(nif)) return 'DNI';
  if (esNieValido(nif)) return 'NIE';
  if (esCifValido(nif)) return 'CIF';
  return '';
}

function esNifValido(texto) {
  return tipoDeNif(texto) !== '';
}
