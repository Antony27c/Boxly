// Base de datos simulada para trabajar el frontend mientras el backend de
// Clientes, Vehículos y Turnos está en desarrollo. Los datos se guardan en
// localStorage para que las altas y ediciones sobrevivan a un refresco.
// Cuando la API esté publicada alcanza con poner VITE_USAR_MOCK=false.

const CLAVE = 'boxly_mock_db'
const DEMORA_MS = 320

const SEMILLA = {
  clientes: [
    {
      id: 1,
      nombre: 'Marina',
      apellido: 'Villagra',
      dni: '32458711',
      telefono: '3874112233',
      email: 'marina.villagra@gmail.com',
      direccion: 'Av. Belgrano 1450, Salta',
      creado_en: '2026-08-12T10:15:00',
    },
    {
      id: 2,
      nombre: 'Hernán',
      apellido: 'Quipildor',
      dni: '28991204',
      telefono: '3875448890',
      email: 'h.quipildor@hotmail.com',
      direccion: 'Los Lapachos 233, San Lorenzo',
      creado_en: '2026-08-20T09:40:00',
    },
    {
      id: 3,
      nombre: 'Transportes del Norte SRL',
      apellido: '—',
      dni: '30715522',
      telefono: '3874002211',
      email: 'flota@tdelnorte.com.ar',
      direccion: 'Parque Industrial, Lote 14',
      creado_en: '2026-09-01T16:05:00',
    },
  ],
  vehiculos: [
    {
      id: 1,
      cliente_id: 1,
      patente: 'AC482KL',
      marca: 'Volkswagen',
      modelo: 'Gol Trend',
      anio: 2017,
      color: 'Gris',
      kilometraje: 98400,
      combustible: 'Nafta',
      observaciones: 'Ruido en tren delantero al pasar lomos de burro.',
      creado_en: '2026-08-12T10:22:00',
    },
    {
      id: 2,
      cliente_id: 1,
      patente: 'MHT301',
      marca: 'Renault',
      modelo: 'Kangoo',
      anio: 2013,
      color: 'Blanco',
      kilometraje: 210500,
      combustible: 'Diésel',
      observaciones: '',
      creado_en: '2026-08-13T11:00:00',
    },
    {
      id: 3,
      cliente_id: 2,
      patente: 'AF119XQ',
      marca: 'Toyota',
      modelo: 'Hilux SRV',
      anio: 2021,
      color: 'Negro',
      kilometraje: 64200,
      combustible: 'Diésel',
      observaciones: 'Cliente pide siempre repuesto original.',
      creado_en: '2026-08-20T09:55:00',
    },
    {
      id: 4,
      cliente_id: 3,
      patente: 'AE770ZP',
      marca: 'Iveco',
      modelo: 'Daily 35',
      anio: 2019,
      color: 'Blanco',
      kilometraje: 158900,
      combustible: 'Diésel',
      observaciones: 'Unidad de flota N° 4.',
      creado_en: '2026-09-01T16:20:00',
    },
  ],
  ordenes: [
    {
      id: 1,
      vehiculo_id: 1,
      fecha: '2026-06-18',
      estado: 'Entregado',
      descripcion: 'Service completo: aceite, filtros y revisión de frenos.',
      total: 185000,
    },
    {
      id: 2,
      vehiculo_id: 1,
      fecha: '2026-09-02',
      estado: 'En diagnóstico',
      descripcion: 'Revisión de tren delantero por ruido.',
      total: 0,
    },
    {
      id: 3,
      vehiculo_id: 3,
      fecha: '2026-07-30',
      estado: 'Entregado',
      descripcion: 'Cambio de pastillas y discos delanteros.',
      total: 310000,
    },
    {
      id: 4,
      vehiculo_id: 4,
      fecha: '2026-09-10',
      estado: 'Esperando repuestos',
      descripcion: 'Reemplazo de bomba de agua.',
      total: 240000,
    },
  ],
  turnos: [
    {
      id: 1,
      cliente_id: 1,
      vehiculo_id: 1,
      fecha: proximoDia(1),
      hora: '09:00',
      servicio: 'Revisión de tren delantero',
      estado: 'confirmado',
      notas: 'Deja el vehículo a primera hora.',
    },
    {
      id: 2,
      cliente_id: 2,
      vehiculo_id: 3,
      fecha: proximoDia(1),
      hora: '11:30',
      servicio: 'Service de 60.000 km',
      estado: 'pendiente',
      notas: '',
    },
    {
      id: 3,
      cliente_id: 3,
      vehiculo_id: 4,
      fecha: proximoDia(3),
      hora: '14:00',
      servicio: 'Cambio de bomba de agua',
      estado: 'confirmado',
      notas: 'Repuesto ya pedido.',
    },
  ],
}

function proximoDia(dias) {
  const fecha = new Date()
  fecha.setDate(fecha.getDate() + dias)
  return fecha.toISOString().slice(0, 10)
}

function leer() {
  const guardado = localStorage.getItem(CLAVE)
  if (guardado) {
    try {
      return JSON.parse(guardado)
    } catch {
      // Datos corruptos: se regenera la semilla.
    }
  }
  const inicial = structuredClone(SEMILLA)
  localStorage.setItem(CLAVE, JSON.stringify(inicial))
  return inicial
}

function escribir(datos) {
  localStorage.setItem(CLAVE, JSON.stringify(datos))
}

function esperar() {
  return new Promise((resolve) => setTimeout(resolve, DEMORA_MS))
}

function proximoId(coleccion) {
  return coleccion.reduce((maximo, item) => Math.max(maximo, item.id), 0) + 1
}

export class MockError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.name = 'MockError'
    this.status = status
  }
}

// Ejecuta una operación sobre la base simulada respetando la demora de red.
export async function operar(callback) {
  await esperar()
  const datos = leer()
  const resultado = callback(datos)
  escribir(datos)
  return structuredClone(resultado ?? null)
}

export { proximoId }

export function reiniciarMock() {
  localStorage.removeItem(CLAVE)
}
