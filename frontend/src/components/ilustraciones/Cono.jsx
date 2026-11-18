// Cono de tránsito. SVG propio, sin dependencias.
// Si recibe `titulo` se anuncia como imagen; si no, es decorativo.
export default function Cono({ className = 'h-10 w-10', titulo }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={`shrink-0 ${className}`}
      aria-hidden={titulo ? undefined : 'true'}
      role={titulo ? 'img' : undefined}
    >
      {titulo && <title>{titulo}</title>}
      <rect x="6" y="39" width="36" height="5" rx="1.5" className="fill-graphite-500" />
      <path d="M20.5 5h7l11 34h-29Z" fill="#ec6a1e" />
      <path d="M17.6 15h12.8l2.3 7H15.3ZM13.9 26.5h20.2l2.2 6.8H11.7Z" fill="#fff" />
      <path d="M20.5 5h7l11 34h-29Z" fill="none" stroke="#1b1d21" strokeOpacity="0.25" strokeWidth="1" />
    </svg>
  )
}
