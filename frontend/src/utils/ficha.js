// Ayudas de las tarjetas tipo ficha (components/ui/Ficha.jsx).

// Muestras para los colores que se cargan a mano; si no se reconoce, no se dibuja muestra.
const MUESTRAS = {
  blanco: '#f4f5f7',
  negro: '#16181c',
  gris: '#8a9099',
  plata: '#c3c8cf',
  plateado: '#c3c8cf',
  rojo: '#c8323a',
  bordo: '#6e1f2c',
  azul: '#2a5bb8',
  celeste: '#6fb3e6',
  verde: '#2f8a57',
  amarillo: '#e6c229',
  naranja: '#e5762a',
  marron: '#6f4a2f',
  beige: '#d8c7a3',
  dorado: '#c9a227',
}

export function muestraDeColor(color) {
  const clave = color
    ?.trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/\s+/)[0]
  return MUESTRAS[clave]
}

export function iniciales(persona) {
  if (!persona) return ''
  if (typeof persona === 'string') {
    const partes = persona.trim().split(/[\s,]+/).filter(Boolean)
    return partes.slice(0, 2).map((p) => p[0]).join('').toUpperCase()
  }
  return `${persona.nombre?.[0] ?? ''}${persona.apellido?.[0] ?? ''}`.toUpperCase()
}
