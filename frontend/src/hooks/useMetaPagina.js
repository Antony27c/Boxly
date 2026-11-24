import { useEffect } from 'react'

// Dominio público de Boxly. Provisorio: cuando se confirme, cambiarlo acá (y en
// index.html, public/robots.txt y public/sitemap.xml, que son estáticos).
export const DOMINIO_PUBLICO = 'https://boxly.com.ar'

// URL absoluta de una ruta pública: urlPublica('/privacidad') → https://boxly.com.ar/privacidad
export function urlPublica(ruta = '/') {
  const limpia = ruta.startsWith('/') ? ruta : `/${ruta}`
  return `${DOMINIO_PUBLICO}${limpia}`
}

// Busca la etiqueta del <head>; si no existe la crea y avisa para borrarla al salir.
function etiqueta(selector, crear) {
  const existente = document.head.querySelector(selector)
  if (existente) return { nodo: existente, creada: false }
  const nodo = crear()
  document.head.appendChild(nodo)
  return { nodo, creada: true }
}

// Título, canonical y og:url de una página pública mientras está montada; al
// salir restaura lo que había. `ruta` es la URL canónica (la landing se ve en
// "/" y en "/boxly", y las dos apuntan a "/").
// Uso: useMetaPagina('Política de privacidad · Boxly', { ruta: '/privacidad' })
export default function useMetaPagina(titulo, { ruta } = {}) {
  const destino = ruta ?? window.location.pathname

  useEffect(() => {
    if (!titulo) return undefined
    const anterior = document.title
    document.title = titulo
    return () => {
      document.title = anterior
    }
  }, [titulo])

  useEffect(() => {
    const url = urlPublica(destino)
    const canonical = etiqueta('link[rel="canonical"]', () => {
      const link = document.createElement('link')
      link.rel = 'canonical'
      return link
    })
    const ogUrl = etiqueta('meta[property="og:url"]', () => {
      const meta = document.createElement('meta')
      meta.setAttribute('property', 'og:url')
      return meta
    })
    const hrefAnterior = canonical.nodo.getAttribute('href')
    const contenidoAnterior = ogUrl.nodo.getAttribute('content')
    canonical.nodo.setAttribute('href', url)
    ogUrl.nodo.setAttribute('content', url)

    return () => {
      if (canonical.creada) canonical.nodo.remove()
      else canonical.nodo.setAttribute('href', hrefAnterior)
      if (ogUrl.creada) ogUrl.nodo.remove()
      else ogUrl.nodo.setAttribute('content', contenidoAnterior)
    }
  }, [destino])
}
