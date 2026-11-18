// Elevador de dos columnas sin auto: los brazos abiertos y la silueta punteada
// del auto que falta. SVG propio. Si recibe `titulo` se anuncia como imagen.
export default function Elevador({ className = 'h-20 w-28', titulo }) {
  return (
    <svg
      viewBox="0 0 112 80"
      className={`shrink-0 ${className}`}
      aria-hidden={titulo ? undefined : 'true'}
      role={titulo ? 'img' : undefined}
    >
      {titulo && <title>{titulo}</title>}
      <path
        d="M28 42v-6l6-2 7-7h26l9 7 6 2v6Z"
        fill="none"
        strokeWidth="1.5"
        strokeDasharray="3 3"
        strokeLinejoin="round"
        className="stroke-graphite-500"
      />
      <rect x="14" y="10" width="7" height="62" rx="1" className="fill-graphite-600" />
      <rect x="91" y="10" width="7" height="62" rx="1" className="fill-graphite-600" />
      <rect x="12" y="7" width="11" height="4" rx="1" className="fill-graphite-500" />
      <rect x="89" y="7" width="11" height="4" rx="1" className="fill-graphite-500" />
      <rect x="14" y="60" width="7" height="3" className="fill-amber" />
      <rect x="14" y="65" width="7" height="3" className="fill-amber" />
      <rect x="91" y="60" width="7" height="3" className="fill-amber" />
      <rect x="91" y="65" width="7" height="3" className="fill-amber" />
      <rect x="12" y="44" width="11" height="8" rx="1" className="fill-graphite-500" />
      <rect x="89" y="44" width="11" height="8" rx="1" className="fill-graphite-500" />
      <rect x="22" y="47" width="26" height="3" rx="1.5" className="fill-graphite-500" />
      <rect x="64" y="47" width="26" height="3" rx="1.5" className="fill-graphite-500" />
      <rect x="43" y="44" width="6" height="3" rx="1" className="fill-amber" />
      <rect x="63" y="44" width="6" height="3" rx="1" className="fill-amber" />
      <rect x="6" y="72" width="100" height="1.5" rx="0.75" className="fill-graphite-500" />
    </svg>
  )
}
