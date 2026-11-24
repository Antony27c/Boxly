import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { CODIGOS_ERROR, alErrorDeAcceso, tieneCodigo } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { suscripcionService } from '@/services/suscripcion'
import { ROLES_TALLER } from '@/routes/navegacion'

/* Estado de la suscripción del taller compartido por toda la app: se pide una
   sola vez por sesión (por token) y todos los consumidores ven lo mismo —
   AppLayout lo usa para el aviso global y /suscripcion para el panel.
   Solo lo carga el personal del taller: clientes y superadmin no. */

let estado = { token: null, datos: null, cargando: false, error: null }
let peticion = 0
let tokenActual = null
const oyentes = new Set()

function emitir() {
  oyentes.forEach((fn) => fn())
}

function suscribir(fn) {
  oyentes.add(fn)
  return () => oyentes.delete(fn)
}

async function cargar(token, forzar = false) {
  if (!token) return
  if (!forzar && estado.token === token && (estado.cargando || estado.datos)) return
  const actual = ++peticion
  tokenActual = token
  estado = { ...estado, token, cargando: true, error: null }
  emitir()
  try {
    const datos = await suscripcionService.obtener(token)
    if (actual === peticion) {
      estado = { token, datos, cargando: false, error: null }
      emitir()
    }
  } catch (error) {
    if (actual !== peticion) return
    // Con la suscripción suspendida el backend responde 403 a todo el personal
    // salvo al administrador, también a este GET: sin esto el aviso nunca se
    // enteraba y recepción y el mecánico quedaban con pantallas que fallan.
    if (esSuspension(error)) {
      estado = { token, datos: { estado: 'suspendida' }, cargando: false, error: null }
    } else {
      estado = { ...estado, cargando: false, error }
    }
    emitir()
  }
}

function esSuspension(error) {
  return tieneCodigo(error, CODIGOS_ERROR.suscripcionSuspendida)
}

/* Los 403 de suscripción (códigos `suscripcion_solo_lectura` y
   `suscripcion_suspendida`) significan que el estado cambió en el servidor:
   hay que recargar la suscripción para que el aviso y el bloqueo se
   actualicen. Se escuchan con alErrorDeAcceso de api.js. */
function esBloqueo(error) {
  return esSuspension(error) || tieneCodigo(error, CODIGOS_ERROR.suscripcionSoloLectura)
}

/* Sin estos dos cortes había un bucle: el GET /suscripcion de un taller
   suspendido también responde 403, que volvía a disparar la recarga, y cada
   pantalla abierta en solo lectura recargaba por cada 403 aunque el aviso ya
   estuviera puesto. */
function esDeLaSuscripcion(ruta) {
  return typeof ruta === 'string' && ruta.startsWith('/api/v1/suscripcion')
}

function bloqueoYaConocido(error) {
  if (estado.cargando) return true
  const actual = estado.datos?.estado
  if (esSuspension(error)) return actual === 'suspendida'
  return actual === 'solo_lectura' || actual === 'suspendida'
}

/* Cada componente montado escucha los 403 con su propia forma de recargar.
   Si hay varios, el primero pone `cargando` y los demás ven el bloqueo como
   ya conocido: se recarga una sola vez. */
function oyenteDeBloqueo(recargar) {
  return (error, { ruta } = {}) => {
    if (!esBloqueo(error) || esDeLaSuscripcion(ruta) || bloqueoYaConocido(error)) return
    recargar()
  }
}

export default function useSuscripcion() {
  const { token, usuario } = useAuth()
  const esPersonal = ROLES_TALLER.includes(usuario?.rol)

  useEffect(() => {
    if (!esPersonal || !token) return undefined
    const desuscribir = alErrorDeAcceso(oyenteDeBloqueo(() => cargar(tokenActual ?? token, true)))
    void cargar(token)
    return desuscribir
  }, [esPersonal, token])

  const instantanea = useSyncExternalStore(suscribir, () => estado)
  const recargar = useCallback(() => {
    if (esPersonal) void cargar(token, true)
  }, [esPersonal, token])

  if (!esPersonal) {
    return { suscripcion: null, cargando: false, error: null, recargar }
  }
  return {
    suscripcion: instantanea.datos,
    cargando: instantanea.cargando,
    error: instantanea.error,
    recargar,
  }
}

// Solo para tests: limpia la caché compartida entre casos.
export function reiniciarSuscripcion() {
  estado = { token: null, datos: null, cargando: false, error: null }
  tokenActual = null
  emitir()
}
