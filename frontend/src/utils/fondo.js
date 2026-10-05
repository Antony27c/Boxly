const CLAVE_FONDO = 'boxly_fondo'

export const FONDOS = [
  { id: 'gris', nombre: 'Gris', color: '#F1F2F4' },
  { id: 'crema', nombre: 'Crema', color: '#FAF4E6' },
  { id: 'celeste', nombre: 'Celeste', color: '#E6F0FA' },
  { id: 'menta', nombre: 'Menta', color: '#E5F4EC' },
  { id: 'lavanda', nombre: 'Lavanda', color: '#EFEAF8' },
  { id: 'rosa', nombre: 'Rosa', color: '#FBEAEE' },
]

function aRgb(hex) {
  const numero = parseInt(hex.slice(1), 16)
  return `${(numero >> 16) & 255} ${(numero >> 8) & 255} ${numero & 255}`
}

export function fondoGuardado() {
  const id = localStorage.getItem(CLAVE_FONDO)
  return FONDOS.find((fondo) => fondo.id === id) ?? FONDOS[0]
}

export function aplicarFondo(fondo) {
  document.documentElement.style.setProperty('--color-fondo', aRgb(fondo.color))
  localStorage.setItem(CLAVE_FONDO, fondo.id)
}
