import { useEffect, useState } from 'react'

// Barrido de arranque: la aguja sube al máximo y vuelve al valor real, como
// el tablero de un auto al dar contacto. Una vez por sesión y por instrumento.
const PREFIJO_SESION = 'boxly.barridoAguja.'
const ESPERA_MS = 30
const SUBIDA_MS = 550
const PAUSA_MS = 150

export function movimientoReducido() {
  if (typeof document !== 'undefined' && document.documentElement.classList.contains('reducir-movimiento')) {
    return true
  }
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

// Sin sessionStorage (modo privado, bloqueado) el barrido queda por montaje.
function barridoHecho(clave) {
  try {
    return sessionStorage.getItem(PREFIJO_SESION + clave) === '1'
  } catch {
    return false
  }
}

function marcarBarrido(clave) {
  try {
    sessionStorage.setItem(PREFIJO_SESION + clave, '1')
  } catch {
    // Sin almacenamiento se vuelve a barrer en el próximo montaje.
  }
}

/**
 * Devuelve la fase de la aguja (`reposo`, `maximo` o `valor`) y la transición
 * CSS que le toca. Con movimiento reducido arranca directo en `valor` y sin
 * transición. `transicionValor` es la transición normal hacia el valor real.
 */
export default function useBarridoAguja(clave, transicionValor) {
  const [inicio] = useState(() => {
    const reducido = movimientoReducido()
    return { reducido, barrer: !reducido && !barridoHecho(clave) }
  })
  const [fase, setFase] = useState(inicio.reducido ? 'valor' : 'reposo')

  useEffect(() => {
    if (inicio.reducido) return undefined
    if (inicio.barrer) marcarBarrido(clave)
    const temporizadores = [setTimeout(() => setFase(inicio.barrer ? 'maximo' : 'valor'), ESPERA_MS)]
    if (inicio.barrer) {
      temporizadores.push(setTimeout(() => setFase('valor'), ESPERA_MS + SUBIDA_MS + PAUSA_MS))
    }
    return () => temporizadores.forEach(clearTimeout)
  }, [clave, inicio])

  let transicion = transicionValor
  if (inicio.reducido) transicion = 'none'
  else if (fase === 'maximo') transicion = `transform ${SUBIDA_MS}ms cubic-bezier(0.45, 0, 0.55, 1)`

  return { fase, transicion }
}
