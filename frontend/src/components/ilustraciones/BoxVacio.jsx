// Box de estacionamiento vacío visto desde arriba: líneas pintadas, tope de rueda
// y la silueta punteada del auto que falta. SVG propio. Si recibe `titulo` se
// anuncia como imagen.
export default function BoxVacio({ className = 'h-20 w-28', titulo }) {
  return (
    <svg
      viewBox="0 0 112 80"
      className={`shrink-0 ${className}`}
      aria-hidden={titulo ? undefined : 'true'}
      role={titulo ? 'img' : undefined}
    >
      {titulo && <title>{titulo}</title>}
      <rect x="10" y="6" width="92" height="70" rx="3" className="fill-graphite-700" opacity="0.6" />
      <rect x="26" y="10" width="3" height="62" rx="1" className="fill-graphite-500" />
      <rect x="83" y="10" width="3" height="62" rx="1" className="fill-graphite-500" />
      <rect x="26" y="10" width="60" height="3" rx="1" className="fill-graphite-500" />
      <rect x="44" y="18" width="24" height="4" rx="2" className="fill-amber" />
      <rect
        x="39"
        y="28"
        width="34"
        height="38"
        rx="9"
        fill="none"
        strokeWidth="1.5"
        strokeDasharray="3 3"
        className="stroke-graphite-500"
      />
    </svg>
  )
}
