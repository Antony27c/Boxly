/* Estados de la suscripción y de los pagos, en un solo lugar
   (docs/Suscripciones.md y docs/Oferta.md). El estado y las fechas límite los
   calcula el backend; acá solo se traducen a etiquetas, tonos de chip y textos.

   - `texto`: etiqueta completa (plataforma del superadmin).
   - `corto`: etiqueta del chip en la pantalla del taller.
   - `tono`: tono del Badge/Chip de components/ui.
   - `detalle`: explicación para el superadmin. */
export const ESTADOS_SUSCRIPCION = {
  al_dia: { texto: 'Al día', corto: 'Al día', tono: 'ok', detalle: null },
  gracia: {
    texto: 'En gracia',
    corto: 'En gracia',
    tono: 'ambar',
    detalle: 'El taller tiene unos días de gracia; después pasa a solo lectura.',
  },
  solo_lectura: {
    texto: 'Solo lectura',
    corto: 'Solo lectura',
    tono: 'peligro',
    detalle: 'El personal y los clientes solo pueden leer hasta que se regularice el pago.',
  },
  suspendida: {
    texto: 'Suspendida por falta de pago',
    corto: 'Suspendida',
    tono: 'peligro',
    detalle: 'Solo el administrador puede entrar, y solo a la sección de suscripción.',
  },
}

export function estadoSuscripcion(codigo) {
  return ESTADOS_SUSCRIPCION[codigo] ?? { texto: codigo ?? '—', corto: codigo ?? '—', tono: 'neutro', detalle: null }
}

export const ESTADOS_PAGO = {
  aprobado: { texto: 'Aprobado', tono: 'ok' },
  pendiente: { texto: 'Pendiente', tono: 'ambar' },
  rechazado: { texto: 'Rechazado', tono: 'peligro' },
}

export function estadoPago(codigo) {
  return ESTADOS_PAGO[codigo] ?? { texto: codigo ?? '—', tono: 'peligro' }
}

export const MEDIOS_PAGO = { manual: 'Manual', mercadopago: 'Mercado Pago' }

export function medioPago(codigo) {
  return MEDIOS_PAGO[codigo] ?? codigo ?? '—'
}

/* ---- Fechas límite ----
   El backend manda `fin_gracia` (último día de gracia) y `fin_acceso` (último
   día antes de la suspensión), como YYYY-MM-DD. Mientras no vengan, se calculan
   desde el vencimiento con las reglas de docs/Oferta.md §4. */

// TODO quitar cuando el backend mande fin_gracia y fin_acceso
const DIAS_GRACIA = 7
const DIAS_HASTA_SUSPENSION = { pago: 30, piloto: 30, demo: 3 }

function sumarDias(iso, dias) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''))
  if (!m) return null
  const fecha = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + dias, 12)
  const mm = String(fecha.getMonth() + 1).padStart(2, '0')
  const dd = String(fecha.getDate()).padStart(2, '0')
  return `${fecha.getFullYear()}-${mm}-${dd}`
}

// Último día de gracia (YYYY-MM-DD) o null. Una demo no tiene gracia.
export function finGracia(suscripcion) {
  if (suscripcion?.fin_gracia) return String(suscripcion.fin_gracia).slice(0, 10)
  // TODO quitar cuando el backend mande fin_gracia
  if (suscripcion?.tipo_acceso === 'demo') return null
  return sumarDias(suscripcion?.vence_en, DIAS_GRACIA)
}

// Último día con acceso, aunque sea en solo lectura (YYYY-MM-DD) o null.
export function finAcceso(suscripcion) {
  if (suscripcion?.fin_acceso) return String(suscripcion.fin_acceso).slice(0, 10)
  // TODO quitar cuando el backend mande fin_acceso
  const dias = DIAS_HASTA_SUSPENSION[suscripcion?.tipo_acceso] ?? DIAS_HASTA_SUSPENSION.pago
  return sumarDias(suscripcion?.vence_en, dias)
}

// "23/12" a partir de "2026-12-23", sin pasar por la zona horaria.
export function diaMes(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''))
  return m ? `${m[3]}/${m[2]}` : '—'
}

/* ---- Textos ---- */

// Frase grande del estado en /suscripcion (sin el caso de demo vencida, que va en finDemo.js).
export function fraseEstado(suscripcion) {
  const dias = Math.abs(suscripcion?.dias_para_vencer ?? 0)
  switch (suscripcion?.estado) {
    case 'al_dia':
      return `Al día hasta el ${diaMes(suscripcion.vence_en)}`
    case 'gracia':
      return `Venció hace ${dias} días: tenés hasta el ${diaMes(finGracia(suscripcion))} para pagar sin cortes`
    case 'solo_lectura':
      return `Solo lectura por falta de pago: venció hace ${dias} días`
    case 'suspendida':
      return `Suscripción suspendida: venció hace ${dias} días`
    default:
      return ''
  }
}

// Texto de la franja global (AvisoSuscripcion) para gracia y solo lectura.
export function textoAviso(suscripcion) {
  if (suscripcion?.estado === 'solo_lectura') return 'La suscripción está en solo lectura por falta de pago'
  return `La suscripción venció; regularizala hasta el ${diaMes(finGracia(suscripcion))} para evitar cortes`
}
