// Llave de auto con el llavero del taller y un tilde: el auto ya se entregó.
// SVG propio, sin dependencias. Si recibe `titulo` se anuncia como imagen;
// si no, es decorativa.
export default function LlaveEntregada({ className = 'h-10 w-10', titulo }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={`shrink-0 ${className}`}
      aria-hidden={titulo ? undefined : 'true'}
      role={titulo ? 'img' : undefined}
    >
      {titulo && <title>{titulo}</title>}
      {/* Argolla y llavero ámbar del taller */}
      <circle cx="10" cy="22" r="5.5" fill="none" strokeWidth="2" className="stroke-graphite-500" />
      <path d="M6.5 26.5 3 37.5l6.5 2 3.5-11Z" className="fill-amber" />
      <circle cx="7.6" cy="35.2" r="1.1" className="fill-graphite-900" />
      {/* Cabeza de la llave (control) */}
      <rect x="14" y="15.5" width="15" height="13" rx="4.5" className="fill-graphite-700 stroke-graphite-500" strokeWidth="1.5" />
      <circle cx="20" cy="22" r="2" className="fill-graphite-500" />
      <circle cx="25" cy="22" r="1.4" className="fill-graphite-500" />
      {/* Hoja metálica con dientes */}
      <path
        d="M29 19.5h13l2.5 2.5-2.5 2.5h-2.5l-1.2-1.6-1.2 1.6h-2.2l-1.2-1.6-1.2 1.6H29Z"
        fill="#c9ccd1"
        stroke="#1b1d21"
        strokeOpacity="0.35"
        strokeWidth="0.8"
      />
      {/* Tilde de entregada */}
      <circle cx="37" cy="10" r="6.5" className="fill-ok" />
      <path d="m33.8 10.2 2.2 2.2 4.2-4.6" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="stroke-sobre-ok" />
    </svg>
  )
}
