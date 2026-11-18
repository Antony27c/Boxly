import { useId } from 'react'

// Bandera a cuadros (llegada). SVG propio, sin dependencias.
// Si recibe `titulo` se anuncia como imagen; si no, es decorativa.
const CUADROS = []
for (let fila = 0; fila < 4; fila++) {
  for (let col = 0; col < 5; col++) {
    if ((fila + col) % 2 === 0) CUADROS.push([col, fila])
  }
}

export default function BanderaCuadros({ className = 'h-10 w-10', titulo }) {
  const idTela = `bandera-tela-${useId().replace(/:/g, '')}`
  return (
    <svg
      viewBox="0 0 48 48"
      className={`shrink-0 ${className}`}
      aria-hidden={titulo ? undefined : 'true'}
      role={titulo ? 'img' : undefined}
    >
      {titulo && <title>{titulo}</title>}
      <rect x="7" y="4" width="2.5" height="41" rx="1.2" className="fill-graphite-500" />
      <path d="M9.5 6c6-2.5 10 2.5 17 0s10-1 14 1v20c-4-2-8-3-14-1s-11-2.5-17 0Z" fill="#fff" stroke="#1b1d21" strokeWidth="1" />
      <clipPath id={idTela}>
        <path d="M9.5 6c6-2.5 10 2.5 17 0s10-1 14 1v20c-4-2-8-3-14-1s-11-2.5-17 0Z" />
      </clipPath>
      <g clipPath={`url(#${idTela})`} fill="#1b1d21">
        {CUADROS.map(([c, f]) => (
          <rect key={`${c}-${f}`} x={9.5 + c * 6.2} y={4 + f * 6.2} width="6.2" height="6.2" />
        ))}
      </g>
    </svg>
  )
}
