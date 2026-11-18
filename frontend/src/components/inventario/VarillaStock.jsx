// Zona de la varilla donde se dibuja la escala (desde la punta hasta el mango).
const X0 = 4
const ANCHO = 90

const COLOR = { ok: 'fill-ok', amber: 'fill-amber', danger: 'fill-danger' }

/** Nivel de la varilla y el texto que lo describe. */
function nivelStock(stock, minimo) {
  if (stock <= 0) return { nivel: 'danger', texto: 'sin stock' }
  if (stock < minimo) return { nivel: 'danger', texto: 'bajo el mínimo' }
  if (stock === minimo) return { nivel: 'amber', texto: 'en el mínimo' }
  if (stock <= minimo * 1.5) return { nivel: 'amber', texto: 'cerca del mínimo' }
  return { nivel: 'ok', texto: 'nivel correcto' }
}

/**
 * Stock como varilla de aceite: la punta queda a la izquierda y el "aceite"
 * sube hacia el mango. La marca MIN es el stock mínimo del repuesto; la MAX
 * va en el triple del mínimo, que es lo que suele reponerse de una vez.
 */
export default function VarillaStock({ stock, minimo, className = 'h-auto w-24' }) {
  const s = Math.max(0, Number(stock) || 0)
  const m = Math.max(0, Number(minimo) || 0)
  const maximo = Math.max(m * 3, 1)
  // La escala pasa un poco del MAX para que la marca no quede pegada al mango.
  const escala = maximo * 1.15
  const x = (v) => X0 + ANCHO * Math.min(1, v / escala)
  const { nivel, texto } = nivelStock(s, m)
  const xMin = x(m)
  const xMax = x(maximo)

  const rayas = []
  for (let r = xMin + 2; r < xMax; r += 3) rayas.push(r)

  return (
    <svg
      viewBox="0 0 120 22"
      className={`shrink-0 ${className}`}
      role="img"
      aria-label={`Stock ${s}, mínimo ${m}: ${texto}`}
    >
      {/* Hoja de la varilla, vara y mango */}
      <rect x={X0} y="10" width={ANCHO + 2} height="6" rx="3" className="fill-graphite-700" />
      <rect x={X0 + ANCHO} y="12" width="9" height="2" className="fill-graphite-600" />
      <circle cx="109" cy="13" r="4.5" strokeWidth="2" className="fill-none stroke-graphite-600" />
      {/* Aceite hasta el nivel del stock */}
      {s > 0 && (
        <rect x={X0} y="10" width={Math.max(x(s) - X0, 3)} height="6" rx="3" className={COLOR[nivel]} />
      )}
      {/* Rayado entre MIN y MAX, como en las varillas reales */}
      <g className="stroke-ink" strokeWidth="0.6" opacity="0.3">
        {rayas.map((r) => (
          <line key={r} x1={r - 1.5} y1="15.5" x2={r + 1.5} y2="10.5" />
        ))}
      </g>
      {[
        [xMin, 'MIN'],
        [xMax, 'MAX'],
      ].map(([posicion, etiqueta]) => (
        <g key={etiqueta}>
          <line x1={posicion} y1="8.5" x2={posicion} y2="17.5" strokeWidth="0.9" className="stroke-ink" />
          <text
            x={Math.max(posicion, 9)}
            y="6"
            textAnchor="middle"
            className="fill-muted font-mono text-[5.5px] font-semibold"
          >
            {etiqueta}
          </text>
        </g>
      ))}
    </svg>
  )
}
