import { useEffect } from 'react'

// Cambia el título de la pestaña mientras la página está montada y, al salir,
// deja el que había antes. Uso: useTituloPagina('Boxly · Gestión para talleres mecánicos')
export default function useTituloPagina(titulo) {
  useEffect(() => {
    if (!titulo) return undefined
    const anterior = document.title
    document.title = titulo
    return () => {
      document.title = anterior
    }
  }, [titulo])
}
