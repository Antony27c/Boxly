// Portapapeles sin hojas: la tabla, el clip y el lugar punteado de la planilla.
// SVG propio. Si recibe `titulo` se anuncia como imagen.
export default function Portapapeles({ className = 'h-20 w-28', titulo }) {
  return (
    <svg
      viewBox="0 0 112 80"
      className={`shrink-0 ${className}`}
      aria-hidden={titulo ? undefined : 'true'}
      role={titulo ? 'img' : undefined}
    >
      {titulo && <title>{titulo}</title>}
      <rect x="34" y="10" width="44" height="64" rx="4" strokeWidth="1.5" className="fill-graphite-600 stroke-graphite-500" />
      <rect
        x="40"
        y="22"
        width="32"
        height="44"
        rx="1"
        fill="none"
        strokeWidth="1.5"
        strokeDasharray="3 3"
        className="stroke-graphite-500"
      />
      <rect x="45" y="5" width="22" height="11" rx="2.5" className="fill-graphite-500" />
      <rect x="50" y="8" width="12" height="3" rx="1.5" className="fill-graphite-700" />
      <circle cx="56" cy="14" r="1.4" className="fill-amber" />
    </svg>
  )
}
