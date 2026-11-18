import { api } from '@/lib/api'

function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function aOpcion(item) {
  const nombre = typeof item === 'string' ? item : item.nombre
  return { valor: item.id ?? nombre, texto: nombre }
}

// Marca escrita (normalizada) -> id de la marca en la API (o null si no existe), para no
// volver a buscar la marca cada vez que se escribe una letra en el modelo.
const idsDeMarca = new Map()

async function idDeMarca(marca, token) {
  const clave = normalizar(marca)
  if (!clave) return null
  if (!idsDeMarca.has(clave)) {
    const marcas = await api.get(`/api/v1/catalogo/marcas?q=${encodeURIComponent(marca)}`, token)
    idsDeMarca.set(clave, marcas.find((item) => normalizar(item.nombre) === clave)?.id ?? null)
  }
  return idsDeMarca.get(clave)
}

export const catalogoService = {
  marcas: (q, token) =>
    api
      .get(`/api/v1/catalogo/marcas?q=${encodeURIComponent(q ?? '')}`, token)
      .then((lista) => lista.map(aOpcion)),

  modelos: (marca, q, token) =>
    idDeMarca(marca, token)
      .then((marcaId) => {
        const parametros = new URLSearchParams({ q: q ?? '' })
        if (marcaId) parametros.set('marca_id', marcaId)
        return api.get(`/api/v1/catalogo/modelos?${parametros}`, token)
      })
      .then((lista) => lista.slice(0, 8).map(aOpcion)),
}
