import SieteSegmentos from '@/components/graficos/SieteSegmentos'
import useBarridoAguja from '@/components/graficos/useBarridoAguja'

// Colores aceptados para las zonas (clases literales para que Tailwind las genere).
const TEXTO = {
  'serie-1': 'text-serie-1',
  'serie-2': 'text-serie-2',
  'serie-3': 'text-serie-3',
  'serie-4': 'text-serie-4',
  amber: 'text-amber',
  muted: 'text-muted',
}
const FONDO = {
  'serie-1': 'bg-serie-1',
  'serie-2': 'bg-serie-2',
  'serie-3': 'bg-serie-3',
  'serie-4': 'bg-serie-4',
  amber: 'bg-amber',
  muted: 'bg-muted',
}

// Geometría del dial: 240° de recorrido, de abajo a la izquierda a abajo a la derecha.
const CX = 120
const CY = 112
const R = 96
const INICIO = 150
const BARRIDO = 240

function punto(angulo, radio) {
  const rad = (angulo * Math.PI) / 180
  return [CX + radio * Math.cos(rad), CY + radio * Math.sin(rad)]
}

function arco(a0, a1, radio) {
  const [x0, y0] = punto(a0, radio)
  const [x1, y1] = punto(a1, radio)
  const grande = a1 - a0 > 180 ? 1 : 0
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${radio} ${radio} 0 ${grande} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`
}

// Escala "redonda" con lugar por encima del valor: 10, 15, 20, 25...
function escalaVelocimetro(total) {
  return Math.max(10, Math.ceil((total * 1.25) / 5) * 5)
}

/**
 * Velocímetro: dial de 240° con marcas, números, zona roja y aguja animada.
 * La banda de color muestra cuánto aporta cada zona (por ejemplo, cada etapa
 * del taller) y la aguja marca el total. La leyenda repite cada valor en
 * texto, así la lectura nunca depende solo del color.
 */
export default function Velocimetro({ segmentos = [], subtitulo = '', titulo = 'Velocímetro', maximo }) {
  const total = segmentos.reduce((s, x) => s + (Number(x.valor) || 0), 0)
  const escala = maximo ?? escalaVelocimetro(total)
  const angulo = (v) => INICIO + (BARRIDO * Math.min(v, escala)) / escala

  // La aguja arranca en 0, barre hasta el tope y vuelve al total.
  const { fase, transicion } = useBarridoAguja('velocimetro', 'transform 1.2s cubic-bezier(0.22, 1, 0.36, 1)')

  // Zonas de color apiladas desde 0 hasta el total, con 1.5° de separación.
  const positivos = segmentos.filter((s) => Number(s.valor) > 0)
  const zonas = positivos.map((s, i) => {
    const desde = positivos.slice(0, i).reduce((suma, x) => suma + Number(x.valor), 0)
    const a0 = angulo(desde)
    const a1 = angulo(desde + Number(s.valor))
    return { ...s, a0, a1: Math.max(a0 + 0.5, a1 - 1.5) }
  })

  const mayores = [0, 1, 2, 3, 4, 5].map((i) => (escala * i) / 5)
  const menores = [0, 1, 2, 3, 4].map((i) => (escala * (i + 0.5)) / 5)
  const inicioRoja = escala * 0.8
  const destino = { reposo: INICIO, maximo: INICIO + BARRIDO, valor: angulo(total) }[fase]
  const giro = destino - 270

  const resumen = `${titulo}: ${total} ${subtitulo}. ${segmentos
    .map((s) => `${s.etiqueta} ${s.valor}`)
    .join(', ')}`

  return (
    <div>
      <svg viewBox="0 0 240 178" className="mx-auto block w-full max-w-[320px]" role="img" aria-label={resumen}>
        {/* Pista completa */}
        <path d={arco(INICIO, INICIO + BARRIDO, R)} className="fill-none stroke-graphite-700" strokeWidth="12" />

        {/* Zonas por etapa */}
        {zonas.map((z) => (
          <path
            key={z.etiqueta}
            d={arco(z.a0, z.a1, R)}
            className={`fill-none stroke-current ${TEXTO[z.color] ?? 'text-amber'}`}
            strokeWidth="12"
          />
        ))}

        {/* Zona roja al final de la escala */}
        <path
          d={arco(angulo(inicioRoja), INICIO + BARRIDO, R - 13)}
          className="fill-none stroke-danger/70"
          strokeWidth="3"
        />

        {/* Marcas menores */}
        {menores.map((v) => {
          const [x0, y0] = punto(angulo(v), R - 17)
          const [x1, y1] = punto(angulo(v), R - 11)
          return (
            <line
              key={`m${v}`}
              x1={x0}
              y1={y0}
              x2={x1}
              y2={y1}
              strokeWidth="1.5"
              className={v >= inicioRoja ? 'stroke-danger' : 'stroke-graphite-500'}
            />
          )
        })}

        {/* Marcas mayores con su número */}
        {mayores.map((v) => {
          const a = angulo(v)
          const [x0, y0] = punto(a, R - 22)
          const [x1, y1] = punto(a, R - 11)
          const [tx, ty] = punto(a, R - 34)
          const roja = v >= inicioRoja && v > 0
          return (
            <g key={`M${v}`}>
              <line
                x1={x0}
                y1={y0}
                x2={x1}
                y2={y1}
                strokeWidth="2.5"
                strokeLinecap="round"
                className={roja ? 'stroke-danger' : 'stroke-ink'}
              />
              <text
                x={tx}
                y={ty}
                textAnchor="middle"
                dominantBaseline="central"
                className={`text-[11px] font-semibold tabular-nums ${roja ? 'fill-danger' : 'fill-muted'}`}
              >
                {Math.round(v)}
              </text>
            </g>
          )
        })}

        {/* Aguja: apunta hacia arriba y gira hasta el total */}
        <g
          data-aguja={fase}
          style={{
            transform: `rotate(${giro}deg)`,
            transformOrigin: `${CX}px ${CY}px`,
            transition: transicion,
          }}
        >
          <polygon
            points={`${CX - 3.5},${CY} ${CX},${CY - (R - 20)} ${CX + 3.5},${CY}`}
            className="fill-amber"
          />
          <line x1={CX} y1={CY} x2={CX} y2={CY + 14} strokeWidth="3.5" strokeLinecap="round" className="stroke-amber" />
        </g>
        <circle cx={CX} cy={CY} r="9" className="fill-graphite-600 stroke-amber" strokeWidth="2.5" />
        <circle cx={CX} cy={CY} r="3" className="fill-amber" />

        {/* Lectura digital abajo, como el display de 7 segmentos del tablero */}
        <rect x={CX - 30} y={CY + 26} width="60" height="30" rx="6" className="fill-sobre-amber stroke-graphite-600" strokeWidth="1" />
        <SieteSegmentos valor={String(total).padStart(3, ' ')} x={CX - 25} y={CY + 30} width="50" height="22" />
        {subtitulo && (
          <text x={CX} y={CY + 66} textAnchor="middle" className="fill-muted text-[10px]">
            {subtitulo}
          </text>
        )}
      </svg>

      <ul className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-sm">
        {segmentos.map((s) => (
          <li key={s.etiqueta} className="flex items-center gap-1.5">
            <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${FONDO[s.color] ?? 'bg-amber'}`} />
            <span className="text-muted">{s.etiqueta}</span>
            <span className="font-semibold tabular-nums text-ink">{s.valor}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
