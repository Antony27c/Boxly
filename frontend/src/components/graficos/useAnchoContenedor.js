import { useLayoutEffect, useState } from 'react'

/**
 * Mide el ancho del contenedor de un gráfico y lo sigue con ResizeObserver.
 * Devuelve [ref, ancho]: `ref` es una callback ref, así el gráfico se mide
 * aunque el contenedor aparezca recién después (por ejemplo, tras un estado
 * vacío o de carga).
 */
export default function useAnchoContenedor(defecto = 320) {
  const [elemento, setElemento] = useState(null)
  const [ancho, setAncho] = useState(defecto)

  useLayoutEffect(() => {
    if (!elemento) return undefined
    const medir = (w) => {
      if (w > 0) setAncho(Math.round(w))
    }
    medir(elemento.clientWidth || elemento.getBoundingClientRect().width)
    if (typeof ResizeObserver === 'undefined') return undefined
    const observador = new ResizeObserver((entradas) => medir(entradas[0]?.contentRect.width ?? 0))
    observador.observe(elemento)
    return () => observador.disconnect()
  }, [elemento])

  return [setElemento, ancho]
}
