// Llave puesta en el contacto. Gira un cuarto de vuelta al pasar por encima del
// botón que la contiene (clase `group`) o cuando `girada` es true; solo si el
// usuario no pidió reducir el movimiento. Siempre decorativa.
export default function LlaveContacto({ className = 'h-5 w-5', girada = false }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
      data-girada={girada ? 'true' : 'false'}
    >
      <circle cx="12" cy="12" r="10.25" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.45" />
      <g
        className={`origin-center motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out motion-safe:group-hover:rotate-90 motion-safe:group-focus-visible:rotate-90 ${girada ? 'motion-safe:rotate-90' : ''}`}
      >
        <rect x="11" y="3.5" width="2" height="8.5" rx="0.6" fill="currentColor" />
        <rect x="13" y="5" width="1.3" height="1.6" fill="currentColor" />
        <rect x="13" y="8" width="1.3" height="1.6" fill="currentColor" />
        <rect x="8" y="11.5" width="8" height="8.5" rx="2.5" fill="currentColor" />
        <circle cx="12" cy="16.5" r="1.4" className="fill-amber" />
      </g>
    </svg>
  )
}
