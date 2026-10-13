// Datos de ejemplo para probar la herramienta sin escribir nada.
// TODOS son ficticios: nombres inventados, direcciones que no existen, el teléfono a ceros y el
// correo con .invalid (una terminación reservada que nunca existe de verdad). Los NIF tienen un
// formato correcto para que la validación los dé por buenos, pero son números de ejemplo.
// Aquí no se toca la página.

const EMISOR_DE_EJEMPLO = {
  nombre: 'Estudio Demo (EJEMPLO)',
  nif: '12345678Z',
  direccion: 'Calle Inventada 1\n00000 Ciudad Ejemplo',
  email: 'demo@ejemplo.invalid',
  telefono: '000 000 000',
  iban: 'ES00 0000 0000 0000 0000 0000',
  logo: ''
};

// La fecha de hoy menos unos días, con la forma 2026-03-15
function fechaHaceDias(hoy, dias) {
  const partes = hoy.split('-').map(Number);
  const fecha = new Date(partes[0], partes[1] - 1, partes[2] - dias);
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return fecha.getFullYear() + '-' + mes + '-' + dia;
}

// Tres facturas con fechas de los últimos meses, para que la lista y la numeración tengan algo que enseñar
function crearDatosDeEjemplo(hoy) {
  const modelos = [
    {
      dias: 70,
      cliente: { nombre: 'Taller Mecánico Ficticio S.L.', nif: 'B12345674', direccion: 'Calle Falsa 123\n00001 Pueblo Inventado' },
      lineas: [
        { concepto: 'Diseño de página web de presentación', cantidad: 1000, precio: 45000, iva: 21 },
        { concepto: 'Sesión de fotografías de producto', cantidad: 12000, precio: 1850, iva: 21 }
      ],
      irpf: 1500, exencion: '', formaPago: 'Transferencia a 30 días', notas: 'Gracias por confiar en nosotros.'
    },
    {
      dias: 35,
      cliente: { nombre: 'María Ficticia Ejemplo', nif: '00000000T', direccion: 'Avenida de Ninguna Parte 7\n00002 Ciudad Imaginaria' },
      lineas: [{ concepto: 'Clases particulares de informática (10 horas)', cantidad: 10000, precio: 2500, iva: 0 }],
      irpf: 0, exencion: 'Operación exenta de IVA (texto de ejemplo: aquí va la disposición que la ampara)', formaPago: '', notas: ''
    },
    {
      dias: 7,
      cliente: { nombre: 'Cafetería Inventada S.A.', nif: 'A12345674', direccion: 'Plaza Mayor 1\n00003 Villa Ejemplo' },
      lineas: [
        { concepto: 'Mantenimiento mensual de la web', cantidad: 3000, precio: 6000, iva: 21 },
        { concepto: 'Servicio de catering de ejemplo', cantidad: 1000, precio: 12000, iva: 10 },
        { concepto: 'Libro de recetas', cantidad: 2000, precio: 1500, iva: 4 }
      ],
      irpf: 0, exencion: '', formaPago: 'Pago con tarjeta', notas: ''
    }
  ];

  const facturas = [];
  for (const modelo of modelos) {
    const fecha = fechaHaceDias(hoy, modelo.dias);
    const serie = serieDelAnio(fecha);
    facturas.push({
      id: facturas.length + 1,
      serie: serie,
      // Cada serie (cada año) empieza en 1 y sigue en orden
      numero: siguienteNumero(facturas, serie, null),
      fecha: fecha,
      fechaOperacion: '',
      emisor: {
        nombre: EMISOR_DE_EJEMPLO.nombre, nif: EMISOR_DE_EJEMPLO.nif, direccion: EMISOR_DE_EJEMPLO.direccion,
        email: EMISOR_DE_EJEMPLO.email, telefono: EMISOR_DE_EJEMPLO.telefono, iban: EMISOR_DE_EJEMPLO.iban
      },
      cliente: modelo.cliente,
      lineas: modelo.lineas,
      irpf: modelo.irpf,
      exencion: modelo.exencion,
      formaPago: modelo.formaPago,
      notas: modelo.notas
    });
  }
  return { emisor: Object.assign({}, EMISOR_DE_EJEMPLO), facturas: facturas };
}
