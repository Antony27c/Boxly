// Estante de depósito vacío: solo quedan las etiquetas de cada lugar.
// SVG propio. Si recibe `titulo` se anuncia como imagen.
const ESTANTES = [
  { y: 24, etiqueta: 34 },
  { y: 44, etiqueta: 62 },
  { y: 64, etiqueta: 46 },
]

export default function Estante({ className = 'h-20 w-28', titulo }) {
  return (
    <svg
      viewBox="0 0 112 80"
      className={`shrink-0 ${className}`}
      aria-hidden={titulo ? undefined : 'true'}
      role={titulo ? 'img' : undefined}
    >
      {titulo && <title>{titulo}</title>}
      <rect x="22" y="6" width="4" height="68" rx="1" className="fill-graphite-600" />
      <rect x="86" y="6" width="4" height="68" rx="1" className="fill-graphite-600" />
      <rect x="22" y="6" width="68" height="3" rx="1" className="fill-graphite-500" />
      {ESTANTES.map(({ y, etiqueta }) => (
        <g key={y}>
          <rect x="22" y={y} width="68" height="3" rx="1" className="fill-graphite-500" />
          <rect x={etiqueta} y={y + 3} width="9" height="4" rx="0.8" className="fill-amber" opacity="0.85" />
        </g>
      ))}
      <rect x="6" y="74" width="100" height="1.5" rx="0.75" className="fill-graphite-500" />
    </svg>
  )
}
