const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

let onNoAutorizado = null
export function setUnauthorizedHandler(fn) {
  onNoAutorizado = fn
}

/* Modo soporte (P6): el SoporteContext fija el taller visitado y cada
   request del taller sale con el header X-Taller-Soporte. */
let tallerSoporte = null
export function setTallerSoporte(id) {
  tallerSoporte = id ?? null
}

/* Cuando el backend responde 403 con "acceso de soporte" (el taller revocó
   o venció el acceso), el contexto sale del modo soporte con un aviso. */
let onSoportePerdido = null
export function setSoportePerdidoHandler(fn) {
  onSoportePerdido = fn
}

function mensajeSegunEstado(status, detalle) {
  if (detalle) return detalle
  if (status === 401) return 'Tu sesion vencio. Inicia sesion de nuevo.'
  if (status === 403) return 'Tu usuario no tiene permiso para esta acción.'
  if (status === 404) return 'No encontramos el recurso solicitado.'
  if (status >= 500) return 'El servidor no responde. Intentá de nuevo en unos minutos.'
  return 'No pudimos completar la operación.'
}

export function urlArchivo(ruta) {
  if (!ruta || /^(https?:|data:|blob:)/.test(ruta)) return ruta
  return `${BASE_URL}${ruta.startsWith('/') ? '' : '/'}${ruta}`
}

async function enviar(path, { method = 'GET', body, token, form = false } = {}) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (tallerSoporte != null) headers['X-Taller-Soporte'] = String(tallerSoporte)

  let payload
  if (body instanceof FormData) {
    payload = body
  } else if (form) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
    payload = new URLSearchParams(body).toString()
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }

  let response
  try {
    response = await fetch(`${BASE_URL}${path}`, { method, headers, body: payload })
  } catch {
    throw new ApiError('No hay conexión con el servidor. Intentá de nuevo en unos minutos.', 0)
  }

  const texto = await response.text()
  let datos
  try {
    datos = texto ? JSON.parse(texto) : null
  } catch {
    datos = null
  }

  if (!response.ok) {
    const detail = datos?.detail
    let detalle = Array.isArray(detail) ? detail[0]?.msg : detail
    const campo = datos?.errores?.[0]?.campo?.split(' -> ').pop()
    const base = detalle ?? 'Hay un error en los datos enviados'
    if (campo) detalle = `${base}: revisá el campo ${campo}.`
    if (response.status === 401 && token && onNoAutorizado) onNoAutorizado()
    if (
      response.status === 403 &&
      onSoportePerdido &&
      /acceso de soporte/i.test(String(detalle ?? ''))
    ) {
      onSoportePerdido(detalle)
    }
    throw new ApiError(mensajeSegunEstado(response.status, detalle), response.status)
  }

  return { datos, headers: response.headers }
}

async function request(path, opciones = {}) {
  return (await enviar(path, opciones)).datos
}

export const api = {
  get: (path, token) => request(path, { token }),
  /* Para listados paginados: devuelve { items, total } donde total sale del
     header X-Total-Count (o de la cantidad de items si el header no llega). */
  getConTotal: async (path, token) => {
    const { datos, headers } = await enviar(path, { token })
    const items = Array.isArray(datos) ? datos : []
    const total = Number.parseInt(headers.get('x-total-count') ?? '', 10)
    return { items, total: Number.isNaN(total) ? items.length : total }
  },
  post: (path, body, token) => request(path, { method: 'POST', body, token }),
  put: (path, body, token) => request(path, { method: 'PUT', body, token }),
  patch: (path, body, token) => request(path, { method: 'PATCH', body, token }),
  del: (path, token) => request(path, { method: 'DELETE', token }),
  subir: (path, formData, token) => request(path, { method: 'POST', body: formData, token }),
}

export const authApi = {
  login: ({ email, password }) => api.post('/api/v1/auth/login', { email, password }),
  perfil: (token) => api.get('/api/v1/auth/me', token),
  activacionInfo: (token) => api.get(`/api/v1/auth/activacion?token=${encodeURIComponent(token)}`),
  activar: (datos) => api.post('/api/v1/auth/activacion', datos),
}
