// Preferencias de accesibilidad guardadas en el navegador.
// Se aplican como clases en <html> (ver el final de src/index.css) y las
// funciones toleran que localStorage no exista o falle (modo privado,
// almacenamiento bloqueado): en ese caso la preferencia dura la sesión.

export const CLAVE_REDUCIR_MOVIMIENTO = 'boxly.reducirMovimiento'
export const CLAVE_TEXTO_GRANDE = 'boxly.textoGrande'

const CLASES_HTML = {
  [CLAVE_REDUCIR_MOVIMIENTO]: 'reducir-movimiento',
  [CLAVE_TEXTO_GRANDE]: 'texto-grande',
}

function leer(clave) {
  try {
    return localStorage.getItem(clave) === '1'
  } catch {
    return false
  }
}

export function leerPreferencias() {
  return {
    reducirMovimiento: leer(CLAVE_REDUCIR_MOVIMIENTO),
    textoGrande: leer(CLAVE_TEXTO_GRANDE),
  }
}

export function guardarPreferencia(clave, valor) {
  try {
    if (valor) localStorage.setItem(clave, '1')
    else localStorage.removeItem(clave)
  } catch {
    // Sin almacenamiento la preferencia no sobrevive a recargar la página.
  }
}

export function aplicarPreferencias() {
  if (typeof document === 'undefined') return
  const html = document.documentElement
  for (const [clave, clase] of Object.entries(CLASES_HTML)) {
    html.classList.toggle(clase, leer(clave))
  }
}
