import { etiquetaFuncion } from '@/components/plataforma/funciones'

/* Oferta comercial para las pantallas públicas y del taller (docs/Oferta.md).
   Las etiquetas de cada código salen del mapa del superadmin
   (components/plataforma/funciones.js) para no tener dos nombres por función. */
export { etiquetaFuncion }

// Planes de menor a mayor. Si la API no manda `funciones`, se usan estas.
export const PLANES_RESPALDO = [
  {
    codigo: 'esencial',
    nombre: 'Esencial',
    precio_mensual: null,
    max_personal: 3,
    funciones: ['gestion', 'whatsapp_manual'],
  },
  {
    codigo: 'pro',
    nombre: 'Pro',
    precio_mensual: null,
    max_personal: 10,
    funciones: [
      'gestion',
      'whatsapp_manual',
      'whatsapp_automatico',
      'telegram_automatico',
      'arca',
    ],
  },
  {
    codigo: 'profesional',
    nombre: 'Profesional',
    precio_mensual: null,
    max_personal: null,
    funciones: [
      'gestion',
      'whatsapp_manual',
      'whatsapp_automatico',
      'telegram_automatico',
      'arca',
      'recordatorios_service',
      'marca_propia',
    ],
  },
]

/* Funciones que todavía no existen en Boxly: se muestran con "Próximamente".
   Sale de docs/Disponibilidad.md (C1) más lo construido después: WhatsApp
   manual (W1), pago en el local (W2) y avisos de stock mínimo (W3) ya existen.
   Sin fechas: cuando una función se construye, se saca de acá. */
export const PROXIMAMENTE = new Set([
  'whatsapp_automatico',
  'telegram_automatico',
  'arca',
  'recordatorios_service',
  'marca_propia',
])

export function esProximamente(codigo) {
  return PROXIMAMENTE.has(codigo)
}

// Lo que cubre "gestion" (la gestión diaria), contado en la landing.
export const DETALLE_GESTION = [
  'Clientes, vehículos y turnos',
  'Órdenes con fotos e historial de órdenes del vehículo',
  'Inventario con avisos de stock mínimo',
  'Cobros con registro del pago en el local y métricas básicas',
  'Portal del cliente y avisos por email',
]

const ORDEN_FUNCIONES = PLANES_RESPALDO[PLANES_RESPALDO.length - 1].funciones

// Funciones del plan: las de la API o, si no vienen, las del respaldo por código.
export function funcionesDePlan(plan) {
  const lista = Array.isArray(plan?.funciones)
    ? plan.funciones
    : (PLANES_RESPALDO.find((p) => p.codigo === plan?.codigo)?.funciones ?? [])
  return ordenar(lista)
}

export function ordenar(funciones) {
  const posicion = (codigo) => {
    const indice = ORDEN_FUNCIONES.indexOf(codigo)
    return indice === -1 ? ORDEN_FUNCIONES.length : indice
  }
  return [...funciones].sort((a, b) => posicion(a) - posicion(b))
}

/* Nombre legible de un código de plan cuando no hay API a mano (por ejemplo,
   el plan que llega en el hash del formulario de contacto). */
export function nombreDePlan(codigo) {
  const conocido = PLANES_RESPALDO.find((p) => p.codigo === codigo)
  if (conocido) return conocido.nombre
  const texto = String(codigo ?? '').replace(/[-_]+/g, ' ')
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}
