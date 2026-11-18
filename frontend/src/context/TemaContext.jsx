import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const CLAVE = 'boxly.tema'
const TEMAS = ['claro', 'oscuro', 'sistema']
const TemaContext = createContext(null)

function leerGuardado() {
  try {
    const valor = localStorage.getItem(CLAVE)
    return TEMAS.includes(valor) ? valor : 'sistema'
  } catch {
    return 'sistema'
  }
}

function sistemaOscuro() {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-color-scheme: dark)').matches)
}

/**
 * Tema de la interfaz: 'claro', 'oscuro' o 'sistema' (sigue al dispositivo).
 * Pone o saca la clase .dark en <html>; los colores salen de variables CSS.
 *   const { tema, oscuro, setTema, alternar } = useTema()
 */
export function TemaProvider({ children }) {
  const [tema, setTemaEstado] = useState(leerGuardado)
  const [prefiereOscuro, setPrefiereOscuro] = useState(sistemaOscuro)
  const oscuro = tema === 'oscuro' || (tema === 'sistema' && prefiereOscuro)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', oscuro)
  }, [oscuro])

  // Si el tema es "sistema", seguir los cambios del dispositivo en vivo.
  useEffect(() => {
    const consulta = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!consulta) return undefined
    const alCambiar = (evento) => setPrefiereOscuro(evento.matches)
    consulta.addEventListener?.('change', alCambiar)
    return () => consulta.removeEventListener?.('change', alCambiar)
  }, [])

  const setTema = useCallback((nuevo) => {
    if (!TEMAS.includes(nuevo)) return
    setTemaEstado(nuevo)
    try {
      localStorage.setItem(CLAVE, nuevo)
    } catch {
      // Sin almacenamiento (modo privado): el tema dura lo que dure la sesión.
    }
  }, [])

  const alternar = useCallback(() => setTema(oscuro ? 'claro' : 'oscuro'), [oscuro, setTema])

  const valor = useMemo(() => ({ tema, oscuro, setTema, alternar }), [tema, oscuro, setTema, alternar])
  return <TemaContext.Provider value={valor}>{children}</TemaContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTema() {
  return useContext(TemaContext) ?? { tema: 'claro', oscuro: false, setTema: () => {}, alternar: () => {} }
}
