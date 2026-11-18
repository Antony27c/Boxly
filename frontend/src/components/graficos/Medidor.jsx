import { useEffect, useState } from 'react'
import useAnchoContenedor from '@/components/graficos/useAnchoContenedor'
import { movimientoReducido } from '@/components/graficos/useBarridoAguja'

// ---------- Utilidades internas ----------

// Pares texto/fondo por token de color (la leyenda necesita el punto con fondo).
const COLORES = {
  amber: { texto: 'text-amber', fondo: 'bg-amber' },
  ok: { texto: 'text-ok', fondo: 'bg-ok' },
  danger: { texto: 'text-danger', fondo: 'bg-danger' },
  muted: { texto: 'text-muted', fondo: 'bg-muted' },
  ink: { texto: 'text-ink', fondo: 'bg-ink' },
  'graphite-500': { texto: 'text-graphite-500', fondo: 'bg-graphite-500' },
  'graphite-600': { texto: 'text-graphite-600', fondo: 'bg-graphite-600' },
  'sobre-amber': { texto: 'text-sobre-amber', fondo: 'bg-sobre-amber' },
  'serie-1': { texto: 'text-serie-1', fondo: 'bg-serie-1' },
  'serie-2': { texto: 'text-serie-2', fondo: 'bg-serie-2' },
  'serie-3': { texto: 'text-serie-3', fondo: 'bg-serie-3' },
  'serie-4': { texto: 'text-serie-4', fondo: 'bg-serie-4' },
}
const parColor = (color) => COLORES[color] ?? COLORES.amber

const f2 = (v) => Math.round(v * 100) / 100
const GRADOS = 180
const SEPARACION_PX = 2

export function Medidor({ segmentos = [], centro, subtitulo, formato = (v) => v, titulo }) {
  const [contenedor, ancho] = useAnchoContenedor(340)
  const [listo, setListo] = useState(false)

  useEffect(() => {
    // Se difiere un tick para que la transición de entrada arranque desde el primer paint.
    const temporizador = setTimeout(() => setListo(true), 30)
    return () => clearTimeout(temporizador)
  }, [])

  const pad = ancho * 0.08
  const r = ancho / 2 - pad
  const alto = Math.round(ancho * 0.56)
  const cx = ancho / 2
  const cy = alto - pad * 0.75
  const sw = Math.max(10, ancho * 0.052)

  const items = segmentos.map((s) => ({ ...s, valor: Math.max(0, Number(s.valor) || 0) }))
  const total = items.reduce((acc, s) => acc + s.valor, 0)
  const visibles = items.filter((s) => s.valor > 0)

  // Separación de 2px entre segmentos, convertida a grados de arco.
  const gapDeg = (SEPARACION_PX / r) * (180 / Math.PI)
  const arcoUtil = GRADOS - Math.max(0, visibles.length - 1) * gapDeg

  const puntoArco = (grados) => {
    const rad = (grados * Math.PI) / 180
    return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) }
  }

  // Cada segmento ocupa un tramo del semicírculo (de 180° a 0°, de izquierda a derecha).
  const arcos = []
  if (total > 0) {
    let cursor = GRADOS
    for (const s of visibles) {
      const span = (s.valor / total) * arcoUtil
      const hasta = cursor - span
      arcos.push({ ...s, desde: cursor, hasta, span })
      cursor = hasta - gapDeg
    }
  }

  const izq = puntoArco(GRADOS)
  const der = puntoArco(0)
  const dPista = `M${f2(izq.x)} ${f2(izq.y)}A${f2(r)} ${f2(r)} 0 0 1 ${f2(der.x)} ${f2(der.y)}`

  const resumen = items.map((s) => `${s.etiqueta} ${formato(s.valor)}`).join(', ')
  const ariaLabel = total > 0 ? (titulo ? `${titulo}: ${resumen}` : resumen || 'Medidor') : 'Sin datos'

  const reducido = movimientoReducido()
  const topPct = ((cy - r * 0.45) / alto) * 100

  return (
    <div className="w-full">
      <div ref={contenedor} className="relative w-full">
        <svg
          viewBox={`0 0 ${ancho} ${alto}`}
          className="block w-full"
          height={alto}
          role="img"
          aria-label={ariaLabel}
          data-separacion={gapDeg}
        >
          <path d={dPista} fill="none" stroke="currentColor" className="text-graphite-600" strokeWidth={sw} />
          {arcos.map((s, idx) => {
            const p1 = puntoArco(s.desde)
            const p2 = puntoArco(s.hasta)
            return (
              <path
                key={idx}
                d={`M${f2(p1.x)} ${f2(p1.y)}A${f2(r)} ${f2(r)} 0 0 1 ${f2(p2.x)} ${f2(p2.y)}`}
                fill="none"
                stroke="currentColor"
                strokeWidth={sw}
                strokeLinecap="butt"
                className={parColor(s.color).texto}
                pathLength={1}
                strokeDasharray="1"
                strokeDashoffset={listo ? 0 : 1}
                data-largo={s.span}
                data-desde={s.desde}
                data-hasta={s.hasta}
                style={{ transition: `stroke-dashoffset 700ms ease-out ${reducido ? 0 : idx * 110}ms` }}
              >
                <title>{`${s.etiqueta}: ${formato(s.valor)}`}</title>
              </path>
            )
          })}
          {arcos.length > 0 && (
            <>
              <circle
                cx={f2(cx - r)}
                cy={f2(cy)}
                r={sw / 2}
                fill="currentColor"
                className={parColor(arcos[0].color).texto}
              />
              <circle
                cx={f2(cx + r)}
                cy={f2(cy)}
                r={sw / 2}
                fill="currentColor"
                className={parColor(arcos[arcos.length - 1].color).texto}
              />
            </>
          )}
        </svg>
        <div
          className="pointer-events-none absolute inset-x-0 text-center"
          style={{ top: `${topPct}%`, transform: 'translateY(-50%)' }}
        >
          {total > 0 ? (
            <>
              <div className="text-3xl font-semibold tracking-tight text-ink">{centro}</div>
              {subtitulo && <div className="mt-0.5 text-xs text-muted">{subtitulo}</div>}
            </>
          ) : (
            <>
              <div className="text-lg font-medium text-muted">Sin datos</div>
              {subtitulo && <div className="mt-0.5 text-xs text-muted">{subtitulo}</div>}
            </>
          )}
        </div>
      </div>
      {items.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {items.map((s, idx) => (
            <li key={`${s.etiqueta}-${idx}`} className="inline-flex items-center gap-1.5 text-xs">
              <span className={`h-2.5 w-2.5 rounded-full ${parColor(s.color).fondo}`} aria-hidden="true" />
              <span className="text-muted">{s.etiqueta}</span>
              <span className="font-medium text-ink">{formato(s.valor)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default Medidor
