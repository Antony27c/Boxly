import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { ApiError, api } from '@/lib/api'
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

const PATRON_SUSPENDIDA = /suscripción del taller está vencida/i

function esSuspension(error) {
  return error instanceof ApiError && error.status === 403 && PATRON_SUSPENDIDA.test(error.message)
}

/* Los 403 de suscripción ("solo lectura por falta de pago" /
   "suscripción del taller está vencida") significan que el estado cambió en
   el servidor: hay que recargar la suscripción para que el aviso y el
   bloqueo se actualicen. api.js no admite otro handler en esta tarea, así
   que se envuelven una vez los métodos del cliente api (mismo patrón que
   setUnauthorizedHandler). */
const PATRON_BLOQUEO = /solo lectura por falta de pago|suscripción del taller está vencida/i
let alBloquear = null
let interceptorListo = false

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

function instalarInterceptor() {
  if (interceptorListo) return
  interceptorListo = true
  for (const nombre of ['get', 'post', 'put', 'patch', 'del', 'subir', 'getConTotal']) {
    const original = api[nombre]
    api[nombre] = async (...args) => {
      try {
        return await original(...args)
      } catch (error) {
        if (
          error instanceof ApiError &&
          error.status === 403 &&
          PATRON_BLOQUEO.test(error.message) &&
          alBloquear &&
          !esDeLaSuscripcion(args[0]) &&
          !bloqueoYaConocido(error)
        ) {
          alBloquear()
        }
        throw error
      }
    }
  }
}

export default function useSuscripcion() {
  const { token, usuario } = useAuth()
  const esPersonal = ROLES_TALLER.includes(usuario?.rol)

  useEffect(() => {
    if (!esPersonal || !token) return undefined
    instalarInterceptor()
    const disparar = () => cargar(tokenActual ?? token, true)
    alBloquear = disparar
    void cargar(token)
    return () => {
      if (alBloquear === disparar) alBloquear = null
    }
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
