import { useEffect, useState } from 'react'
import useAnchoContenedor from '@/components/graficos/useAnchoContenedor'

// ---------- Utilidades internas ----------

const TEXTO = {
  amber: 'text-amber',
  ok: 'text-ok',
  danger: 'text-danger',
  muted: 'text-muted',
  ink: 'text-ink',
  'graphite-500': 'text-graphite-500',
  'graphite-600': 'text-graphite-600',
  'sobre-amber': 'text-sobre-amber',
  'serie-1': 'text-serie-1',
  'serie-2': 'text-serie-2',
  'serie-3': 'text-serie-3',
  'serie-4': 'text-serie-4',
}
const claseTexto = (color) =>
  TEXTO[color] ?? (typeof color === 'string' && color.startsWith('text-') ? color : 'text-amber')

const redondear = (v) => Math.round(v * 100) / 100

/**
 * Línea mínima sin ejes para tarjetas. Decorativa (aria-hidden) salvo que se
 * pase `etiqueta`, en cuyo caso queda como role="img" con ese aria-label.
 */
export function Sparkline({ puntos = [], color = 'amber', alto = 32, etiqueta }) {
  const [contenedor, ancho] = useAnchoContenedor(140)
  const [listo, setListo] = useState(false)

  useEffect(() => {
    // Se difiere un tick para que la transición de entrada arranque desde el primer paint.
    const temporizador = setTimeout(() => setListo(true), 30)
    return () => clearTimeout(temporizador)
  }, [])

  const vals = (puntos ?? []).map((v) => Number(v)).filter((v) => Number.isFinite(v))
  if (vals.length === 0) return null

  const pad = 3
  let minV = Math.min(...vals)
  let maxV = Math.max(...vals)
  if (minV === maxV) {
    minV -= 1
    maxV += 1
  }
  const y = (v) => pad + ((maxV - v) / (maxV - minV)) * (alto - pad * 2)
  const n = vals.length
  const coords = vals.map((v, i) => ({
    x: redondear(n === 1 ? ancho / 2 : 2 + (i * (ancho - 4)) / (n - 1)),
    y: redondear(y(v)),
  }))
  const d = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x} ${c.y}`).join('')


  return (
    <div ref={contenedor} className="w-full">
      <svg
        viewBox={`0 0 ${ancho} ${alto}`}
        className="block w-full"
        height={alto}
        aria-hidden={etiqueta ? undefined : 'true'}
        role={etiqueta ? 'img' : undefined}
        aria-label={etiqueta}
      >
        {n === 1 ? (
          <circle
            cx={coords[0].x}
            cy={coords[0].y}
            r={2.5}
            fill="currentColor"
            className={claseTexto(color)}
            style={{ opacity: listo ? 1 : 0, transition: 'opacity 400ms ease-out' }}
          />
        ) : (
          <path
            d={d}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={claseTexto(color)}
            pathLength={1}
            strokeDasharray="1"
            strokeDashoffset={listo ? 0 : 1}
            style={{ transition: 'stroke-dashoffset 600ms ease-out' }}
          />
        )}
      </svg>
    </div>
  )
}

export default Sparkline
