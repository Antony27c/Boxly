import { api, ApiError } from '@/lib/api'

// Dos ámbitos (docs/Plataforma.md, P3): la auditoría del propio taller
// (administrador) y la de toda la plataforma (superadmin, filtro taller_id).
const RECURSOS = {
  taller: '/api/v1/taller/auditoria',
  plataforma: '/api/v1/plataforma/auditoria',
}

function recurso(ambito) {
  return RECURSOS[ambito] ?? RECURSOS.taller
}

// Mismo origen que lib/api: en dev vite proxea /api al backend.
const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

/* Query del listado y de la exportación: limit/offset más los filtros del
   contrato (entidad, metodo, desde, hasta, solo_errores y, solo en plataforma,
   taller_id). Los valores vacíos no viajan, igual que en services/usuarios.js. */
function aParams({ limit, offset, ...filtros }) {
  const params = new URLSearchParams()
  if (limit != null) params.set('limit', limit)
  if (offset != null) params.set('offset', offset)
  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor !== undefined && valor !== null && valor !== '') params.set(clave, valor)
  }
  return params
}

// taller_id solo existe en la auditoría de plataforma; en la del taller el
// servidor ya la limita a la sesión y el filtro no aplica.
function consulta(ambito, params) {
  const limpio = { ...params }
  if (ambito !== 'plataforma') delete limpio.taller_id
  const texto = aParams(limpio).toString()
  return texto ? `?${texto}` : ''
}

// "attachment; filename=\"auditoria-20261123.csv\"" -> "auditoria-20261123.csv"
function nombreDeDescarga(headers) {
  const disposicion = headers.get('content-disposition') ?? ''
  return /filename="?([^";]+)"?/i.exec(disposicion)?.[1] ?? 'auditoria.csv'
}

function descargarCsv(blob, nombre) {
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombre
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export const auditoriaService = {
  // Listado paginado: devuelve { items, total } (total del header X-Total-Count).
  listar: (ambito, params = {}, token) => {
    return api.getConTotal(`${recurso(ambito)}${consulta(ambito, params)}`, token)
  },

  /* El CSV no es JSON: va con fetch directo y los mismos filtros (sin
     paginar, el servidor corta en 10.000 filas). El archivo se descarga con
     el nombre que manda Content-Disposition. */
  exportar: async (ambito, params = {}, token) => {
    const ruta = `${recurso(ambito)}/exportar${consulta(ambito, params)}`
    let response
    try {
      response = await fetch(`${BASE_URL}${ruta}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
    } catch {
      throw new ApiError('No hay conexión con el servidor. Intentá de nuevo en unos minutos.', 0)
    }
    if (!response.ok) {
      let detalle = ''
      try {
        const datos = await response.json()
        const detail = datos?.detail
        detalle = Array.isArray(detail) ? detail[0]?.msg : detail
      } catch {
        // Error sin cuerpo JSON: se usa el mensaje genérico.
      }
      throw new ApiError(detalle || 'No pudimos exportar la auditoría.', response.status)
    }
    const blob = await response.blob()
    if (typeof URL.createObjectURL === 'function') {
      descargarCsv(blob, nombreDeDescarga(response.headers))
    }
  },
}
