import { useState } from 'react'

// Frases de taller para cuando no se indica qué se está cargando.
const FRASES = ['Cargando…', 'Calentando el motor…', 'Ajustando tuercas…']

// Rayos de la llanta: cinco, repartidos cada 72°.
const RAYOS = [0, 1, 2, 3, 4].map((i) => {
  const rad = ((90 + i * 72) * Math.PI) / 180
  const punto = (r) => [20 + r * Math.cos(rad), 20 - r * Math.sin(rad)].map((v) => Math.round(v * 100) / 100)
  return [...punto(3.5), ...punto(7.5)]
})

// Neumático que gira mientras carga. Con "reducir movimiento" (del sistema o
// de la app) queda quieto: motion-safe y la regla global de index.css.
function Neumatico() {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      stroke="currentColor"
      className="h-10 w-10 motion-safe:animate-[spin_1.4s_linear_infinite]"
      aria-hidden="true"
    >
      <circle cx="20" cy="20" r="15" strokeWidth="6" className="text-graphite-600" />
      <circle
        cx="20"
        cy="20"
        r="17"
        strokeWidth="2"
        pathLength="32"
        strokeDasharray="1 1"
        className="text-graphite-500"
      />
      <circle cx="20" cy="20" r="8.5" strokeWidth="2" className="text-amber" />
      <g strokeWidth="2" strokeLinecap="round" className="text-amber">
        {RAYOS.map(([x1, y1, x2, y2]) => (
          <line key={`${x1}-${y1}`} x1={x1} y1={y1} x2={x2} y2={y2} />
        ))}
      </g>
      <circle cx="20" cy="20" r="2" fill="currentColor" stroke="none" className="text-amber" />
    </svg>
  )
}

export default function Loader({ texto }) {
  // Se elige una sola vez al montar para que no cambie en cada render.
  const [frase] = useState(() => FRASES[Math.floor(Math.random() * FRASES.length)])
  return (
    <div role="status" className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-muted">
      <Neumatico />
      <p className="text-sm">{texto ?? frase}</p>
    </div>
  )
}
