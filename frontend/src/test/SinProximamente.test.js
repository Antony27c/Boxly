import { describe, expect, it } from 'vitest'

// Decisión del dueño (2026-11-23): "próximamente" no aparece en ningún lado de la
// app. Las funciones de cada plan se muestran como parte del plan. Este test lee
// el código fuente de src (fuera de los tests) y falla si vuelve la palabra.
const fuentes = import.meta.glob(['../**/*.{js,jsx,ts,tsx,css,html,json}', '!./**'], {
  query: '?raw',
  import: 'default',
  eager: true,
})

describe('sin "próximamente" en la app', () => {
  it('ningún archivo de src fuera de los tests dice "próximamente"', () => {
    const rutas = Object.keys(fuentes)
    expect(rutas.length).toBeGreaterThan(50)
    expect(rutas).toContain('../components/landing/Planes.jsx')
    expect(rutas).toContain('../components/ayuda/preguntas.js')
    expect(rutas.some((ruta) => ruta.includes('/test/'))).toBe(false)

    const conLaPalabra = rutas.filter((ruta) => /pr[oó]ximamente/i.test(fuentes[ruta]))
    expect(conLaPalabra).toEqual([])
  })
})
