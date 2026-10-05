const CLAVE_FONDO = 'boxly_fondo'

export const FONDOS = [
  {
    id: 'blanco',
    nombre: 'Blanco',
    colores: {
      fondo: '255 255 255',
      superficie: '255 255 255',
      borde: '231 233 237',
      'borde-fuerte': '220 223 228',
      linea: '197 201 208',
      texto: '30 33 38',
      'texto-suave': '95 102 114',
    },
  },
  {
    id: 'negro',
    nombre: 'Negro',
    colores: {
      fondo: '0 0 0',
      superficie: '23 24 27',
      borde: '45 47 53',
      'borde-fuerte': '58 61 68',
      linea: '82 86 94',
      texto: '241 242 244',
      'texto-suave': '163 169 179',
    },
  },
]

export function fondoGuardado() {
  const id = localStorage.getItem(CLAVE_FONDO)
  return FONDOS.find((fondo) => fondo.id === id) ?? FONDOS[0]
}

export function aplicarFondo(fondo) {
  const raiz = document.documentElement
  for (const [nombre, valor] of Object.entries(fondo.colores)) {
    raiz.style.setProperty(`--color-${nombre}`, valor)
  }
  raiz.style.colorScheme = fondo.id === 'negro' ? 'dark' : 'light'
  localStorage.setItem(CLAVE_FONDO, fondo.id)
}
