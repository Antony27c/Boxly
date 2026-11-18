import { useEffect, useState } from 'react'
import useAnchoContenedor from '@/components/graficos/useAnchoContenedor'

// ---------- Utilidades internas de los gráficos ----------

// Ancho real del contenedor: el viewBox queda 1:1 con los píxeles y las
// etiquetas no se deforman al estirar el SVG.
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

// Paleta: solo tokens del tema (src/index.css). Orden fijo, nunca se cicla.
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
const FONDOS = {
  amber: 'bg-amber',
  ok: 'bg-ok',
  danger: 'bg-danger',
  muted: 'bg-muted',
  ink: 'bg-ink',
  'graphite-500': 'bg-graphite-500',
  'graphite-600': 'bg-graphite-600',
  'sobre-amber': 'bg-sobre-amber',
  'serie-1': 'bg-serie-1',
  'serie-2': 'bg-serie-2',
  'serie-3': 'bg-serie-3',
  'serie-4': 'bg-serie-4',
}
const claseTexto = (color) =>
  TEXTO[color] ?? (typeof color === 'string' && color.startsWith('text-') ? color : 'text-amber')
const claseFondo = (color) =>
  FONDOS[color] ?? (typeof color === 'string' && color.startsWith('bg-') ? color : 'bg-amber')
const NEUTROS = new Set(['muted', 'ink', 'graphite-500', 'graphite-600'])
const esNeutro = (color) => NEUTROS.has(color)

// Marcas "redondas" del eje Y (unas 5 líneas como máximo).
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

// Etiquetas del eje en notación compacta ("1,5 M") para que entren sin deformar.
const formatoEje = new Intl.NumberFormat('es-AR', { notation: 'compact', maximumFractionDigits: 1 })
const ejeCorto = (v) => formatoEje.format(v)

// Barra vertical con el extremo superior redondeado (4px) y base plana.
function pathBarra(x, y, ancho, alto, radio = 4) {
  if (alto <= 0 || ancho <= 0) return ''
  const r = Math.min(radio, ancho / 2, alto)
  return `M${x} ${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}L${x + ancho - r} ${y}A${r} ${r} 0 0 1 ${x + ancho} ${y + r}L${x + ancho} ${y + alto}L${x} ${y + alto}Z`
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
              className={m === 0 ? 'text-graphite-600' : 'text-graphite-700'}
              strokeWidth={1}
            />
            <text
              x={ML - 6}
              y={gy + 3.5}
              textAnchor="end"
              fontSize={10}
              className="text-muted"
              fill="currentColor"
            >
              {ejeCorto(m)}
            </text>
          </g>
        )
      })}
    </g>
  )
}

function Tooltip({ leftPct, topPct, children }) {
  return (
    <div
      className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-box border border-graphite-600 bg-graphite-800 px-2.5 py-1.5 text-xs text-ink shadow-lg"
      style={{ left: `${leftPct}%`, top: `${topPct}%` }}
    >
      {children}
    </div>
  )
}

// ---------- GraficoBarras ----------

export function GraficoBarras({
  datos = [],
  formato = (v) => v,
  alto = 160,
  color = 'amber',
  etiquetaArriba = true,
  titulo,
}) {
  const [contenedor, ancho] = useAnchoContenedor(320)
  const [activo, setActivo] = useState(null)
  const [listo, setListo] = useState(false)

  useEffect(() => {
    // Se difiere un tick para que la transición de entrada arranque desde el primer paint.
    const temporizador = setTimeout(() => setListo(true), 30)
    return () => clearTimeout(temporizador)
  }, [])

  const total = datos.length
  const ML = 46
  const MR = 10
  const MT = 26
  const MB = 22
  const plotW = ancho - ML - MR
  const plotH = alto - MT - MB

  if (total > 0 && datos.every((d) => !(Number(d.valor) > 0))) return <p className="flex items-center justify-center rounded-box border border-dashed border-graphite-700 px-4 text-center text-sm text-muted" style={{ minHeight: alto }}>Sin movimientos en este período.</p>
  if (total === 0 || plotW <= 0 || plotH <= 0) return null

  const valores = datos.map((d) => Number(d.valor) || 0)
  const maxValor = Math.max(0, ...valores)
  const tope = maxValor > 0 ? maxValor : 1
  const marcas = marcasEje(0, tope)
  const yMax = marcas[marcas.length - 1]
  const baseY = MT + plotH
  const y = (v) => baseY - (v / yMax) * plotH

  const slotW = plotW / total
  const barW = Math.max(2, Math.min(48, slotW * 0.6, slotW - 2))
  const mostrarValores = etiquetaArriba && total <= 6
  const hayResaltado = datos.some((d) => d.resaltado)
  const neutro = esNeutro(color)
  const reducido = movimientoReducido()

  const resumen = datos.map((d, i) => `${d.etiqueta} ${formato(valores[i])}`).join(', ')
  const ariaLabel = titulo ? `${titulo}: ${resumen}` : resumen

  let tooltip = null
  if (activo !== null && datos[activo]) {
    const xc = ML + activo * slotW + slotW / 2
    const texto = `${datos[activo].etiqueta} · ${formato(valores[activo])}`
    const mitad = (texto.length * 6.5 + 24) / 2
    const leftPx = Math.min(Math.max(xc, mitad + 6), ancho - mitad - 6)
    const fondoPx = Math.max(y(Math.max(0, valores[activo])) - 6, 38)
    tooltip = { leftPct: (leftPx / ancho) * 100, topPct: (fondoPx / alto) * 100, texto }
  }

  return (
    <div ref={contenedor} className="relative w-full">
      <svg viewBox={`0 0 ${ancho} ${alto}`} className="block w-full" height={alto} role="img" aria-label={ariaLabel}>
        <EjeY marcas={marcas} y={y} ML={ML} plotW={plotW} />
        {datos.map((d, i) => {
          const v = valores[i]
          const h = (Math.max(0, v) / yMax) * plotH
          const bx = ML + i * slotW + (slotW - barW) / 2
          const by = baseY - h
          const atenuada = hayResaltado && !d.resaltado
          const neutra = atenuada && neutro
          const esPrimero = i === 0
          const esUltimo = i === total - 1
          const ancla = esPrimero ? 'start' : esUltimo ? 'end' : 'middle'
          const tx = ML + i * slotW + (esPrimero ? 4 : esUltimo ? slotW - 4 : slotW / 2)
          return (
            <g
              key={`${d.etiqueta}-${i}`}
              tabIndex={0}
              aria-label={`${d.etiqueta}: ${formato(v)}`}
              onMouseEnter={() => setActivo(i)}
              onMouseLeave={() => setActivo(null)}
              onFocus={() => setActivo(i)}
              onBlur={() => setActivo(null)}
            >
              <rect
                x={ML + i * slotW}
                y={MT - 8}
                width={slotW}
                height={plotH + 30}
                fill="transparent"
              />
              <path
                d={pathBarra(bx, by, barW, h)}
                fill="currentColor"
                fillOpacity={atenuada && !neutro ? 0.35 : 1}
                className={neutra ? 'text-graphite-500' : claseTexto(color)}
                style={{
                  transformBox: 'fill-box',
                  transformOrigin: '50% 100%',
                  transform: listo ? 'scaleY(1)' : 'scaleY(0)',
                  transition: `transform 480ms cubic-bezier(0.2, 0.7, 0.3, 1) ${reducido ? 0 : i * 45}ms`,
                }}
              />
              {mostrarValores && (
                <text
                  x={bx + barW / 2}
                  y={Math.max(by - 5, 11)}
                  textAnchor="middle"
                  fontSize={10}
                  className="text-ink"
                  fill="currentColor"
                >
                  {formato(v)}
                </text>
              )}
              <text
                x={tx}
                y={baseY + 15}
                textAnchor={ancla}
                fontSize={10}
                className="text-muted"
                fill="currentColor"
              >
                {d.etiqueta}
              </text>
            </g>
          )
        })}
      </svg>
      {tooltip && <Tooltip leftPct={tooltip.leftPct} topPct={tooltip.topPct}>{tooltip.texto}</Tooltip>}
    </div>
  )
}

// ---------- GraficoBarrasDobles ----------

export function GraficoBarrasDobles({ datos = [], series = [], formato = (v) => v, alto = 180, titulo }) {
  const [contenedor, ancho] = useAnchoContenedor(320)
  const [activo, setActivo] = useState(null)
  const [listo, setListo] = useState(false)

  useEffect(() => {
    // Se difiere un tick para que la transición de entrada arranque desde el primer paint.
    const temporizador = setTimeout(() => setListo(true), 30)
    return () => clearTimeout(temporizador)
  }, [])

  const n = datos.length
  const k = series.length
  const ML = 46
  const MR = 10
  const MT = 18
  const MB = 22
  const plotW = ancho - ML - MR
  const plotH = alto - MT - MB

  if (n > 0 && datos.every((d) => series.every((s) => !(Number(d?.[s.clave]) > 0)))) return <p className="flex items-center justify-center rounded-box border border-dashed border-graphite-700 px-4 text-center text-sm text-muted" style={{ minHeight: alto }}>Sin movimientos en este período.</p>
  if (n === 0 || k === 0 || plotW <= 0 || plotH <= 0) return null

  const numero = (d, clave) => Number(d?.[clave]) || 0
  const maxValor = Math.max(0, ...datos.flatMap((d) => series.map((s) => numero(d, s.clave))))
  const tope = maxValor > 0 ? maxValor : 1
  const marcas = marcasEje(0, tope)
  const yMax = marcas[marcas.length - 1]
  const baseY = MT + plotH
  const y = (v) => baseY - (v / yMax) * plotH

  const slotW = plotW / n
  const barW = Math.max(2, Math.min(30, (slotW * 0.72 - (k - 1) * 2) / k))
  const grupoW = k * barW + (k - 1) * 2

  const reducido = movimientoReducido()

  const resumen = datos
    .map((d) => `${d.etiqueta}: ${series.map((s) => `${s.texto} ${formato(numero(d, s.clave))}`).join(', ')}`)
    .join('; ')
  const ariaLabel = titulo ? `${titulo}: ${resumen}` : resumen

  let tooltip = null
  if (activo !== null && datos[activo]) {
    const d = datos[activo]
    const xc = ML + activo * slotW + slotW / 2
    let minTop = baseY
    series.forEach((s) => {
      minTop = Math.min(minTop, y(numero(d, s.clave)))
    })
    const lineas = series.map((s) => `${s.texto} ${formato(numero(d, s.clave))}`)
    const masLarga = Math.max(d.etiqueta.length, ...lineas.map((l) => l.length))
    const mitad = (masLarga * 6.5 + 30) / 2
    const leftPx = Math.min(Math.max(xc, mitad + 6), ancho - mitad - 6)
    const fondoPx = Math.max(minTop - 6, 44)
    tooltip = { leftPct: (leftPx / ancho) * 100, topPct: (fondoPx / alto) * 100, d, lineas }
  }

  return (
    <div className="w-full">
      <div className="mb-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
        {series.map((s) => (
          <span key={s.clave} className="inline-flex items-center gap-1.5 text-xs text-muted">
            <span className={`h-2.5 w-2.5 rounded-full ${claseFondo(s.color)}`} aria-hidden="true" />
            {s.texto}
          </span>
        ))}
      </div>
      <div ref={contenedor} className="relative">
        <svg viewBox={`0 0 ${ancho} ${alto}`} className="block w-full" height={alto} role="img" aria-label={ariaLabel}>
          <EjeY marcas={marcas} y={y} ML={ML} plotW={plotW} />
          {datos.map((d, i) => {
            const grupoX = ML + i * slotW + slotW / 2
            const inicioX = grupoX - grupoW / 2
            const esPrimero = i === 0
            const esUltimo = i === n - 1
            const ancla = esPrimero ? 'start' : esUltimo ? 'end' : 'middle'
            const tx = ML + i * slotW + (esPrimero ? 4 : esUltimo ? slotW - 4 : slotW / 2)
            return (
              <g
                key={`${d.etiqueta}-${i}`}
                tabIndex={0}
                aria-label={`${d.etiqueta}: ${series.map((s) => `${s.texto} ${formato(numero(d, s.clave))}`).join(', ')}`}
                onMouseEnter={() => setActivo(i)}
                onMouseLeave={() => setActivo(null)}
                onFocus={() => setActivo(i)}
                onBlur={() => setActivo(null)}
              >
                <rect x={ML + i * slotW} y={MT - 8} width={slotW} height={plotH + 30} fill="transparent" />
                {series.map((s, j) => {
                  const v = numero(d, s.clave)
                  const h = (Math.max(0, v) / yMax) * plotH
                  const bx = inicioX + j * (barW + 2)
                  const by = baseY - h
                  return (
                    <path
                      key={s.clave}
                      d={pathBarra(bx, by, barW, h)}
                      fill="currentColor"
                      fillOpacity={1}
                      className={claseTexto(s.color)}
                      style={{
                        transformBox: 'fill-box',
                        transformOrigin: '50% 100%',
                        transform: listo ? 'scaleY(1)' : 'scaleY(0)',
                        transition: `transform 480ms cubic-bezier(0.2, 0.7, 0.3, 1) ${reducido ? 0 : i * 45 + j * 25}ms`,
                      }}
                    />
                  )
                })}
                <text x={tx} y={baseY + 15} textAnchor={ancla} fontSize={10} className="text-muted" fill="currentColor">
                  {d.etiqueta}
                </text>
              </g>
            )
          })}
        </svg>
        {tooltip && (
          <Tooltip leftPct={tooltip.leftPct} topPct={tooltip.topPct}>
            <div className="font-medium">{tooltip.d.etiqueta}</div>
            {series.map((s) => (
              <div key={s.clave} className="mt-0.5 flex items-center gap-1.5">
                <span className={`h-2 w-2 shrink-0 rounded-full ${claseFondo(s.color)}`} aria-hidden="true" />
                <span className="text-muted">{s.texto}</span>
                <span className="font-medium">{formato(numero(tooltip.d, s.clave))}</span>
              </div>
            ))}
          </Tooltip>
        )}
      </div>
    </div>
  )
}

export default GraficoBarras
