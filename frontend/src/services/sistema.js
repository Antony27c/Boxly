import { api, ApiError } from '@/lib/api'

// Salud de la plataforma (superadmin) y respaldo del propio taller
// (administrador), docs/Plataforma.md P3.
const SISTEMA = '/api/v1/plataforma/sistema'
const RESPALDO = '/api/v1/taller/respaldo'
// Mismo origen que lib/api.js (la constante no está exportada).
const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

// El nombre del archivo viene en Content-Disposition, por ejemplo:
// attachment; filename="boxly-respaldo-20261123-1430.zip"
function nombreDelArchivo(headers) {
  const disposicion = headers.get('content-disposition') ?? ''
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(disposicion)
  if (utf8) {
    try {
      return decodeURIComponent(utf8[1].trim())
    } catch {
      // Si no se puede decodificar, se prueba con filename=.
    }
  }
  const simple = /filename="?([^";]+)"?/i.exec(disposicion)
  return simple ? simple[1].trim() : 'boxly-respaldo.zip'
}

/* Descarga el respaldo completo (ZIP con un CSV por tabla). Va con fetch
   directo porque api.* parsea la respuesta como JSON y acá llega binario.
   El nombre del archivo sale del header Content-Disposition. */
async function descargarRespaldo(token) {
  let response
  try {
    response = await fetch(`${BASE_URL}${RESPALDO}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
  } catch {
    throw new ApiError('No hay conexión con el servidor. Intentá de nuevo en unos minutos.', 0)
  }

  if (!response.ok) {
    const texto = await response.text()
    let datos
    try {
      datos = texto ? JSON.parse(texto) : null
    } catch {
      datos = null
    }
    const detail = datos?.detail
    const detalle = Array.isArray(detail) ? detail[0]?.msg : detail
    throw new ApiError(detalle ?? 'No pudimos completar la operación.', response.status)
  }

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombreDelArchivo(response.headers)
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  URL.revokeObjectURL(url)
}

export const sistemaService = {
  obtener: (token) => api.get(SISTEMA, token),
  descargarRespaldo,
}
