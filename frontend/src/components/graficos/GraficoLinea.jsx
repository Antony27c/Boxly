import { useEffect, useId, useState } from 'react'
import useAnchoContenedor from '@/components/graficos/useAnchoContenedor'

// ---------- Utilidades internas (mismas que en GraficoBarras) ----------

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

function marcasEje(min, max) {
  const rango = max - min
  if (!(rango > 0)) return [min, max]
  const bruto = rango / 4
  const mag = Math.pow(10, Math.floor(Math.log10(bruto)))
  const norm = bruto / mag
  const paso = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag
  const inicio = Math.floor(min / paso) * paso
  const fin = Math.ceil(max / paso) * paso
  const total = Math.round((fin - inicio) / paso)
  const marcas = []
  for (let i = 0; i <= total; i += 1) marcas.push(Number((inicio + i * paso).toFixed(6)))
  return marcas
}

const formatoEje = new Intl.NumberFormat('es-AR', { notation: 'compact', maximumFractionDigits: 1 })
const ejeCorto = (v) => formatoEje.format(v)

// Curva cúbica monótona (Fritsch–Carlson): suave y sin pasarse de los datos.
function caminoSuave(puntos) {
  const n = puntos.length
  if (n === 0) return ''
  if (n === 1) return `M${puntos[0].x} ${puntos[0].y}`
  if (n === 2) return `M${puntos[0].x} ${puntos[0].y}L${puntos[1].x} ${puntos[1].y}`
  const dx = []
  const sec = []
  for (let i = 0; i < n - 1; i += 1) {
    dx[i] = puntos[i + 1].x - puntos[i].x
    sec[i] = dx[i] === 0 ? 0 : (puntos[i + 1].y - puntos[i].y) / dx[i]
  }
  const t = new Array(n).fill(0)
  t[0] = sec[0]
  t[n - 1] = sec[n - 2]
  for (let i = 1; i < n - 1; i += 1) {
    if (sec[i - 1] * sec[i] <= 0) {
      t[i] = 0
    } else {
      const w1 = 2 * dx[i] + dx[i - 1]
      const w2 = dx[i] + 2 * dx[i - 1]
      t[i] = (w1 + w2) / (w1 / sec[i - 1] + w2 / sec[i])
    }
  }
  for (let i = 0; i < n - 1; i += 1) {
    if (sec[i] === 0) {
      t[i] = 0
      t[i + 1] = 0
      continue
    }
    const a = t[i] / sec[i]
    const b = t[i + 1] / sec[i]
    const s = a * a + b * b
    if (s > 9) {
      const tau = 3 / Math.sqrt(s)
      t[i] = tau * a * sec[i]
      t[i + 1] = tau * b * sec[i]
    }
  }
  let d = `M${puntos[0].x} ${puntos[0].y}`
  for (let i = 0; i < n - 1; i += 1) {
    const h = dx[i]
    const c1x = puntos[i].x + h / 3
    const c1y = puntos[i].y + (t[i] * h) / 3
    const c2x = puntos[i + 1].x - h / 3
    const c2y = puntos[i + 1].y - (t[i + 1] * h) / 3
    d += `C${c1x} ${c1y} ${c2x} ${c2y} ${puntos[i + 1].x} ${puntos[i + 1].y}`
  }
  return d
}

function EjeY({ marcas, y, ML, plotW }) {
  const derecha = ML + plotW
  return (
    <g>
      {marcas.map((m) => {
        const gy = y(m)
        return (
          <g key={m}>
            <line
              x1={ML}
              x2={derecha}
              y1={gy}
              y2={gy}
              stroke="currentColor"
              className={m === marcas[0] ? 'text-graphite-600' : 'text-graphite-700'}
              strokeWidth={1}
            />
            <text x={ML - 6} y={gy + 3.5} textAnchor="end" fontSize={10} className="text-muted" fill="currentColor">
              {ejeCorto(m)}
            </text>
          </g>
        )
      })}
    </g>
  )
}

const redondear = (v) => Math.round(v * 100) / 100

export function GraficoLinea({
  puntos = [],
  formato = (v) => v,
  color = 'amber',
  conArea = true,
  alto = 120,
  marcarUltimo = true,
  titulo,
}) {
  const [contenedor, ancho] = useAnchoContenedor(320)
  const [activo, setActivo] = useState(null)
  const [listo, setListo] = useState(false)
  const gradiente = useId()

  useEffect(() => {
    // Se difiere un tick para que la transición de entrada arranque desde el primer paint.
    const temporizador = setTimeout(() => setListo(true), 30)
    return () => clearTimeout(temporizador)
  }, [])

  const n = puntos.length
  const ML = 46
  const MR = 14
  const MT = 32
  const MB = 22
  const plotW = ancho - ML - MR
  const plotH = alto - MT - MB
  const baseY = MT + plotH

  if (n > 0 && puntos.every((p) => !Number(p.valor))) return <p className="flex items-center justify-center rounded-box border border-dashed border-graphite-700 px-4 text-center text-sm text-muted" style={{ minHeight: alto }}>Sin movimientos en este período.</p>
  if (n === 0 || plotW <= 0 || plotH <= 0) return null

  const vals = puntos.map((p) => Number(p.valor) || 0)
  let minV = Math.min(...vals)
  let maxV = Math.max(...vals)
  if (minV === maxV) {
    const delta = (Math.abs(minV) || 1) * 0.2
    minV -= delta
    maxV += delta
  } else {
    const pad = (maxV - minV) * 0.12
    minV -= pad
    maxV += pad
  }
  // Si todos los valores son positivos, el eje no baja de 0 (la curva no inventa negativos).
  if (Math.min(...vals) >= 0) minV = Math.max(0, minV)
  const marcas = marcasEje(minV, maxV)
  const yMin = marcas[0]
  const yMax = marcas[marcas.length - 1]

  const x = (i) => (n === 1 ? ML + plotW / 2 : ML + (i * plotW) / (n - 1))
  const y = (v) => MT + ((yMax - v) / (yMax - yMin)) * plotH
  const coords = puntos.map((p, i) => ({ x: redondear(x(i)), y: redondear(y(vals[i])) }))

  const linea = caminoSuave(coords)
  const baseArea = yMin <= 0 && yMax >= 0 ? y(0) : baseY

  const resumen = puntos.map((p, i) => `${p.etiqueta} ${formato(vals[i])}`).join(', ')
  const ariaLabel = titulo ? `${titulo}: ${resumen}` : resumen

  // Punto destacado: el que está en hover/focus o, si no, el último.
  const idxDestacado = activo ?? (marcarUltimo ? n - 1 : -1)
  let burbuja = null
  if (idxDestacado >= 0 && n > 0) {
    const c = coords[idxDestacado]
    const etiqueta = puntos[idxDestacado].etiqueta
    const bw = Math.max(36, etiqueta.length * 6.4 + 16)
    const bh = 18
    const bx = Math.min(Math.max(c.x, bw / 2 + 4), ancho - bw / 2 - 4)
    let by = c.y - 16
    if (by - bh < 4) by = c.y + 22
    burbuja = { c, etiqueta, bw, bh, bx, by }
  }

  let tooltip = null
  if (activo !== null && puntos[activo]) {
    const c = coords[activo]
    const texto = `${puntos[activo].etiqueta} · ${formato(vals[activo])}`
    const mitad = (texto.length * 6.5 + 24) / 2
    const leftPx = Math.min(Math.max(c.x, mitad + 6), ancho - mitad - 6)
    const fondoPx = Math.max(c.y - 8, 40)
    tooltip = { leftPct: (leftPx / ancho) * 100, topPct: (fondoPx / alto) * 100, texto }
  }

  const pasoX = Math.ceil(n / 5)
  const dArea =
    n > 1 && conArea
      ? `${linea}L${coords[n - 1].x} ${baseArea}L${coords[0].x} ${baseArea}Z`
      : ''

  return (
    <div ref={contenedor} className="relative w-full">
      <svg viewBox={`0 0 ${ancho} ${alto}`} className="block w-full" height={alto} role="img" aria-label={ariaLabel}>
        <EjeY marcas={marcas} y={y} ML={ML} plotW={plotW} />
        <g className={claseTexto(color)}>
          <defs>
            <linearGradient id={gradiente} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.15" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          {dArea && (
            <path
              d={dArea}
              fill={`url(#${gradiente})`}
              style={{ opacity: listo ? 1 : 0, transition: 'opacity 900ms ease-out 200ms' }}
            />
          )}
          {n > 1 && (
            <path
              d={linea}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
              strokeDasharray="1"
              strokeDashoffset={listo ? 0 : 1}
              style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(0.4, 0, 0.2, 1)' }}
            />
          )}
          {activo !== null && n > 1 && (
            <line
              x1={coords[activo].x}
              x2={coords[activo].x}
              y1={MT}
              y2={baseY}
              stroke="currentColor"
              className="text-muted"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          )}
          {idxDestacado >= 0 && (
            <circle
              cx={coords[idxDestacado].x}
              cy={coords[idxDestacado].y}
              r={n === 1 ? 4 : 5}
              fill="currentColor"
              className="stroke-graphite-800"
              strokeWidth={2}
            />
          )}
          {burbuja && (
            <g>
              <rect
                x={burbuja.bx - burbuja.bw / 2}
                y={burbuja.by - burbuja.bh}
                width={burbuja.bw}
                height={burbuja.bh}
                rx={6}
                className="fill-graphite-800 stroke-graphite-600"
                strokeWidth={1}
              />
              <text
                x={burbuja.bx}
                y={burbuja.by - burbuja.bh / 2 + 3.6}
                textAnchor="middle"
                fontSize={10}
                className="text-ink"
                fill="currentColor"
              >
                {burbuja.etiqueta}
              </text>
            </g>
          )}
        </g>
        {coords.map((c, i) => {
          if (!(i % pasoX === 0 || i === n - 1)) return null
          const esPrimero = i === 0
          const esUltimo = i === n - 1
          const ancla = n === 1 ? 'middle' : esPrimero ? 'start' : esUltimo ? 'end' : 'middle'
          const tx = c.x + (ancla === 'start' ? 3 : ancla === 'end' ? -3 : 0)
          return (
            <text
              key={`x-${i}`}
              x={tx}
              y={baseY + 15}
              textAnchor={ancla}
              fontSize={10}
              className="text-muted"
              fill="currentColor"
            >
              {puntos[i].etiqueta}
            </text>
          )
        })}
        {coords.map((c, i) => (
          <g
            key={`p-${i}`}
            tabIndex={0}
            aria-label={`${puntos[i].etiqueta}: ${formato(vals[i])}`}
            onMouseEnter={() => setActivo(i)}
            onMouseLeave={() => setActivo(null)}
            onFocus={() => setActivo(i)}
            onBlur={() => setActivo(null)}
          >
            <circle cx={c.x} cy={c.y} r={14} fill="transparent" />
          </g>
        ))}
      </svg>
      {tooltip && (
        <div
          className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-box border border-graphite-600 bg-graphite-800 px-2.5 py-1.5 text-xs text-ink shadow-lg"
          style={{ left: `${tooltip.leftPct}%`, top: `${tooltip.topPct}%` }}
        >
          {tooltip.texto}
        </div>
      )}
    </div>
  )
}

export default GraficoLinea
