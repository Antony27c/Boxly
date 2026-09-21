// Cliente HTTP único del frontend. Todas las llamadas a la API pasan por acá.
const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function mensajeSegunEstado(status, detalle) {
  if (detalle) return detalle
  if (status === 401) return 'Usuario o contraseña incorrectos.'
  if (status === 403) return 'Tu usuario no tiene permiso para esta acción.'
  if (status === 404) return 'No encontramos el recurso solicitado.'
  if (status >= 500) return 'El servidor no responde. Intentá de nuevo en unos minutos.'
  return 'No pudimos completar la operación.'
}

async function request(path, { method = 'GET', body, token, form = false } = {}) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`

  let payload
  if (form) {
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
    throw new ApiError('No hay conexión con el servidor. Verificá que la API esté levantada.', 0)
  }

  const texto = await response.text()
  const datos = texto ? JSON.parse(texto) : null

  if (!response.ok) {
    // FastAPI devuelve el error en "detail" (string o lista de errores de Pydantic)
    const detail = datos?.detail
    const detalle = Array.isArray(detail) ? detail[0]?.msg : detail
    throw new ApiError(mensajeSegunEstado(response.status, detalle), response.status)
  }

  return datos
}

export const api = {
  get: (path, token) => request(path, { token }),
  post: (path, body, token) => request(path, { method: 'POST', body, token }),
  put: (path, body, token) => request(path, { method: 'PUT', body, token }),
  del: (path, token) => request(path, { method: 'DELETE', token }),
}

// --- Endpoints de autenticación (Sprint 1) ---
// El backend expone /api/v1/auth/login con JSON { email, password } y devuelve
// { access_token, token_type, usuario }.
export const authApi = {
  login: ({ email, password }) => api.post('/api/v1/auth/login', { email, password }),
  perfil: (token) => api.get('/api/v1/auth/me', token),
}
