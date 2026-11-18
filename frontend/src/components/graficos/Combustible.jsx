import useBarridoAguja from '@/components/graficos/useBarridoAguja'

const CX = 60
const CY = 60
const R = 46
const INICIO = 200
const BARRIDO = 140

function punto(angulo, radio) {
  const rad = (angulo * Math.PI) / 180
  return [CX + radio * Math.cos(rad), CY + radio * Math.sin(rad)]
}

/**
 * Indicador de combustible (E a F). `fraccion` va de 0 a 1; la aguja se
 * mueve hasta ahí (al entrar barre hasta F y vuelve). El primer cuarto se
 * marca como reserva.
 */
export default function Combustible({ fraccion = 0, etiqueta = 'Nivel' }) {
  const f = Math.min(1, Math.max(0, Number(fraccion) || 0))
  const { fase, transicion } = useBarridoAguja('combustible', 'transform 1.1s cubic-bezier(0.22, 1, 0.36, 1)')

  const angulo = (v) => INICIO + BARRIDO * v
  const [ax, ay] = punto(INICIO, R)
  const [bx, by] = punto(INICIO + BARRIDO, R)
  const giro = angulo({ reposo: 0, maximo: 1, valor: f }[fase]) - 270

  return (
    <svg viewBox="0 0 120 84" className="h-auto w-28 shrink-0" role="img" aria-label={`${etiqueta}: ${Math.round(f * 100)}%`}>
      <path d={`M ${ax} ${ay} A ${R} ${R} 0 0 1 ${bx} ${by}`} className="fill-none stroke-graphite-700" strokeWidth="4" strokeLinecap="round" />
      {[0, 0.25, 0.5, 0.75, 1].map((v) => {
        const [x0, y0] = punto(angulo(v), R - 9)
        const [x1, y1] = punto(angulo(v), R - 2)
        return (
          <line
            key={v}
            x1={x0}
            y1={y0}
            x2={x1}
            y2={y1}
            strokeWidth={v === 0.5 ? 1.5 : 2.5}
            strokeLinecap="round"
            className={v < 0.25 ? 'stroke-danger' : 'stroke-ink'}
          />
        )
      })}
      <text x={punto(INICIO, R - 18)[0] + 2} y={punto(INICIO, R - 18)[1]} className="fill-danger text-[11px] font-bold" dominantBaseline="central">
        E
      </text>
      <text x={punto(INICIO + BARRIDO, R - 18)[0] - 8} y={punto(INICIO + BARRIDO, R - 18)[1]} className="fill-ink text-[11px] font-bold" dominantBaseline="central">
        F
      </text>
      {/* Surtidor */}
      <g transform={`translate(${CX - 5} ${CY + 9})`} className="fill-muted">
        <rect x="0" y="0" width="8" height="11" rx="1.5" />
        <rect x="1.8" y="1.8" width="4.4" height="3.2" rx="0.6" className="fill-graphite-800" />
        <path d="M8 3 h2 l1.5 2 v5 a1 1 0 0 1 -2 0 v-3 h-1.5" className="fill-none stroke-muted" strokeWidth="1.1" />
      </g>
      <g
        data-aguja={fase}
        style={{
          transform: `rotate(${giro}deg)`,
          transformOrigin: `${CX}px ${CY}px`,
          transition: transicion,
        }}
      >
        <line x1={CX} y1={CY} x2={CX} y2={CY - R + 6} strokeWidth="2.5" strokeLinecap="round" className="stroke-amber" />
      </g>
      <circle cx={CX} cy={CY} r="4.5" className="fill-graphite-600 stroke-amber" strokeWidth="1.5" />
    </svg>
  )
}
