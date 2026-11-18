import { useEffect, useState } from 'react'

const CX = 60
const CY = 60
const R = 46
const INICIO = 200
const BARRIDO = 140
// Último cuarto de la escala: zona caliente, en rojo.
const ZONA_CALIENTE = 0.75

function movimientoReducido() {
  if (typeof document !== 'undefined' && document.documentElement.classList.contains('reducir-movimiento')) {
    return true
  }
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

function punto(angulo, radio) {
  const rad = (angulo * Math.PI) / 180
  return [CX + radio * Math.cos(rad), CY + radio * Math.sin(rad)]
}

const arco = (desde, hasta) => {
  const [ax, ay] = punto(desde, R)
  const [bx, by] = punto(hasta, R)
  return `M ${ax} ${ay} A ${R} ${R} 0 0 1 ${bx} ${by}`
}

/**
 * Indicador de temperatura (C a H), como el del tablero de un auto.
 * `fraccion` va de 0 (frío) a 1 (caliente); el último cuarto es la zona roja.
 */
export default function Termometro({ fraccion = 0, etiqueta = 'Carga del taller', className = 'w-20' }) {
  const f = Math.min(1, Math.max(0, Number(fraccion) || 0))
  const [listo, setListo] = useState(movimientoReducido)
  useEffect(() => {
    const t = setTimeout(() => setListo(true), 30)
    return () => clearTimeout(t)
  }, [])

  const angulo = (v) => INICIO + BARRIDO * v
  const giro = (listo ? angulo(f) : INICIO) - 270
  const caliente = f >= ZONA_CALIENTE

  return (
    <svg
      viewBox="0 0 120 80"
      className={`h-auto shrink-0 ${className}`}
      role="img"
      aria-label={`${etiqueta}: ${Math.round(f * 100)}%`}
    >
      <path d={arco(INICIO, angulo(ZONA_CALIENTE))} className="fill-none stroke-graphite-600" strokeWidth="5" strokeLinecap="round" />
      <path d={arco(angulo(ZONA_CALIENTE), angulo(1))} className="fill-none stroke-danger" strokeWidth="5" strokeLinecap="round" />
      {[0, 0.5, 1].map((v) => {
        const [x0, y0] = punto(angulo(v), R - 10)
        const [x1, y1] = punto(angulo(v), R - 4)
        return <line key={v} x1={x0} y1={y0} x2={x1} y2={y1} strokeWidth="2" strokeLinecap="round" className="stroke-muted" />
      })}
      <text x={punto(INICIO, R - 20)[0] + 2} y={punto(INICIO, R - 20)[1]} className="fill-muted text-[13px] font-bold" dominantBaseline="central">
        C
      </text>
      <text x={punto(INICIO + BARRIDO, R - 20)[0] - 10} y={punto(INICIO + BARRIDO, R - 20)[1]} className="fill-danger text-[13px] font-bold" dominantBaseline="central">
        H
      </text>
      {/* Termómetro en el agua, el pictograma de siempre. */}
      <g transform={`translate(${CX - 7} ${CY + 6})`} className="fill-none stroke-muted" strokeWidth="1.4" strokeLinecap="round">
        <path d="M5.5 6.5V1.2a1.5 1.5 0 0 1 3 0v5.3a2.4 2.4 0 1 1-3 0z" />
        <path d="M0 11.5c1.2 0 1.2-.8 2.4-.8M11.6 10.7c1.2 0 1.2.8 2.4.8" />
      </g>
      <g
        style={{
          transform: `rotate(${giro}deg)`,
          transformOrigin: `${CX}px ${CY}px`,
          transition: 'transform 1.1s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        <line
          x1={CX}
          y1={CY}
          x2={CX}
          y2={CY - R + 7}
          strokeWidth="3"
          strokeLinecap="round"
          className={caliente ? 'stroke-danger' : 'stroke-amber'}
        />
      </g>
      <circle cx={CX} cy={CY} r="4.5" className={`fill-graphite-600 ${caliente ? 'stroke-danger' : 'stroke-amber'}`} strokeWidth="1.5" />
    </svg>
  )
}
