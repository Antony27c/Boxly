import { useCallback, useState } from 'react'

/* Estado de paginación del lado del cliente: guarda la página pedida y el
   total que informa el servidor (X-Total-Count). La página efectiva se
   recalcula sola si el total baja (ej. después de borrar), así nunca queda
   un offset fuera de rango. */
export default function usePaginacion(tamaño = 20) {
  const porPagina = Math.max(1, Math.floor(Number(tamaño)) || 20)
  const [pagina, setPaginaInterna] = useState(1)
  const [total, setTotal] = useState(0)

  const paginas = Math.max(1, Math.ceil(total / porPagina))
  const paginaActual = Math.min(pagina, paginas)
  const offset = (paginaActual - 1) * porPagina
  const desde = total === 0 ? 0 : offset + 1
  const hasta = Math.min(offset + porPagina, total)

  const setPagina = useCallback((nueva) => {
    const n = Math.floor(Number(nueva))
    if (Number.isFinite(n) && n >= 1) setPaginaInterna(n)
  }, [])

  const reiniciar = useCallback(() => setPaginaInterna(1), [])

  return {
    pagina: paginaActual,
    setPagina,
    reiniciar,
    total,
    setTotal,
    paginas,
    offset,
    limite: porPagina,
    desde,
    hasta,
  }
}
