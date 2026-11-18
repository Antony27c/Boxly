// Escena sobria del taller para el login: panel perforado con herramientas,
// caja de herramientas y un auto arriba del elevador. SVG propio.
// Si recibe `titulo` se anuncia como imagen; si no, es decorativa.
const AGUJEROS = []
for (let fila = 0; fila < 10; fila++) {
  for (let col = 0; col < 11; col++) AGUJEROS.push([24 + col * 10.4, 24 + fila * 10])
}

export default function TallerLogin({ className = 'w-full max-w-sm', titulo }) {
  return (
    <svg
      viewBox="0 0 360 200"
      className={`h-auto shrink-0 ${className}`}
      aria-hidden={titulo ? undefined : 'true'}
      role={titulo ? 'img' : undefined}
    >
      {titulo && <title>{titulo}</title>}

      {/* Panel perforado */}
      <rect x="14" y="14" width="124" height="112" rx="4" strokeWidth="1.5" className="fill-graphite-700 stroke-graphite-600" />
      <g className="fill-graphite-900" opacity="0.7">
        {AGUJEROS.map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="1.3" />
        ))}
      </g>
      {/* Llave combinada */}
      <circle cx="40" cy="38" r="8" className="fill-graphite-500" />
      <rect x="37" y="27" width="6" height="9" className="fill-graphite-700" />
      <rect x="37" y="42" width="6" height="52" rx="3" className="fill-graphite-500" />
      <circle cx="40" cy="98" r="6.5" className="fill-graphite-500" />
      <circle cx="40" cy="98" r="3" className="fill-graphite-700" />
      {/* Destornillador */}
      <rect x="65" y="32" width="10" height="28" rx="4" className="fill-amber" />
      <rect x="67" y="60" width="6" height="4" className="fill-graphite-500" />
      <rect x="68.8" y="64" width="2.4" height="36" rx="1" className="fill-graphite-500" />
      {/* Martillo */}
      <rect x="90" y="32" width="28" height="9" rx="2" className="fill-graphite-500" />
      <rect x="101" y="41" width="6" height="58" rx="3" strokeWidth="1" className="fill-graphite-600 stroke-graphite-500" />

      {/* Caja de herramientas */}
      <rect x="28" y="142" width="84" height="6" rx="2" className="fill-amber-deep" />
      <rect x="30" y="148" width="80" height="34" rx="2" className="fill-graphite-600" />
      <path d="M30 159.5h80M30 170.5h80" strokeWidth="1" className="stroke-graphite-500" />
      <rect x="62" y="152" width="16" height="3" rx="1.5" className="fill-graphite-500" />
      <rect x="62" y="163" width="16" height="3" rx="1.5" className="fill-graphite-500" />
      <rect x="62" y="174" width="16" height="3" rx="1.5" className="fill-graphite-500" />

      {/* Elevador */}
      <rect x="164" y="30" width="182" height="6" rx="2" className="fill-graphite-600" />
      <rect x="164" y="36" width="10" height="144" className="fill-graphite-600" />
      <rect x="336" y="36" width="10" height="144" className="fill-graphite-600" />
      <rect x="164" y="160" width="10" height="4" className="fill-amber" />
      <rect x="164" y="168" width="10" height="4" className="fill-amber" />
      <rect x="336" y="160" width="10" height="4" className="fill-amber" />
      <rect x="336" y="168" width="10" height="4" className="fill-amber" />
      <rect x="162" y="106" width="14" height="16" rx="1.5" className="fill-graphite-500" />
      <rect x="334" y="106" width="14" height="16" rx="1.5" className="fill-graphite-500" />
      <rect x="174" y="114" width="66" height="4" rx="2" className="fill-graphite-500" />
      <rect x="270" y="114" width="66" height="4" rx="2" className="fill-graphite-500" />
      <rect x="234" y="108" width="8" height="6" rx="1" className="fill-amber" />
      <rect x="268" y="108" width="8" height="6" rx="1" className="fill-amber" />

      {/* Auto arriba del elevador */}
      <path
        d="M190 108v-14q0-4 4-5l18-4 18-16q3-3 7-3h44q4 0 7 3l16 15 12 3q4 1 4 5v16Z"
        strokeWidth="1.5"
        strokeLinejoin="round"
        className="fill-graphite-600 stroke-graphite-500"
      />
      <path d="M234 84l12-13h18v13ZM270 84v-13h11q2 0 3.5 1.5l11 11.5Z" className="fill-graphite-800" />
      <rect x="191" y="93" width="6" height="3" rx="1" className="fill-amber" />
      <circle cx="218" cy="108" r="11" strokeWidth="2" className="fill-graphite-900 stroke-graphite-500" />
      <circle cx="218" cy="108" r="4" className="fill-graphite-500" />
      <circle cx="292" cy="108" r="11" strokeWidth="2" className="fill-graphite-900 stroke-graphite-500" />
      <circle cx="292" cy="108" r="4" className="fill-graphite-500" />

      {/* Piso */}
      <rect x="158" y="178" width="22" height="4" rx="1" className="fill-graphite-500" />
      <rect x="330" y="178" width="22" height="4" rx="1" className="fill-graphite-500" />
      <rect x="8" y="182" width="344" height="2" rx="1" className="fill-graphite-600" />
    </svg>
  )
}
