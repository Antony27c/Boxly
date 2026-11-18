import '@/styles/testigos.css'

// Dibujos de 24x24 en trazo, como los pictogramas del tablero de un auto.
const DIBUJOS = {
  motor: (
    <>
      <path d="M10 5h4M12 5v2" />
      <path d="M3.5 10v5M3.5 12.5H6" />
      <path d="M6 9h2.5l1-2h5l1 2H17v2h1.5V10H20.5v6H18.5v-1H17v2.5h-2.5l-1.5 1.5H9l-3-3z" />
    </>
  ),
  aceite: (
    <>
      <path d="M8 10V8.5h3V10M7 8.5h5" />
      <path d="M5 10h10l5.5-3v1.5L15.5 15H5z" />
      <path d="M5 11H3.5a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1H5" />
      <path d="M20.5 13a1 1 0 0 1-2 0c0-.7 1-2 1-2s1 1.3 1 2z" />
    </>
  ),
  bateria: (
    <>
      <rect x="3" y="7" width="18" height="12" rx="1" />
      <path d="M6.5 7V5h3v2M14.5 7V5h3v2" />
      <path d="M6 13h3M15 13h3M16.5 11.5v3" />
    </>
  ),
  temperatura: (
    <>
      <path d="M10.5 13.5V5a1.5 1.5 0 0 1 3 0v8.5a2.5 2.5 0 1 1-3 0z" />
      <path d="M13.5 7h2M13.5 10h2" />
      <path d="M3 20.5c1.5 0 1.5-1 3-1s1.5 1 3 1M15 20.5c1.5 0 1.5-1 3-1s1.5 1 3 1" />
    </>
  ),
}

const CLASES = {
  apagado: { caja: 'border-graphite-700 bg-graphite-800', dibujo: 'text-graphite-500' },
  advertencia: { caja: 'border-amber/40 bg-amber/10', dibujo: 'text-amber' },
  critico: { caja: 'border-danger/40 bg-danger/10', dibujo: 'text-danger' },
}

/**
 * Fila de luces testigo, como las del tablero de un auto. Cada luz recibe
 * `nivel` ('apagado', 'advertencia' en ámbar o 'critico' en rojo) y una
 * `descripcion` que se lee como "Aceite: stock bajo en 3 repuestos". Apagada
 * dice "sin alertas"; en rojo se agrega "(crítico)" para no depender del color.
 *
 * @param {{ luces: Array<{ clave: 'motor'|'aceite'|'bateria'|'temperatura', nombre: string, nivel?: string, descripcion?: string }> }} props
 */
export default function LucesTestigo({ luces = [], className = '' }) {
  return (
    <ul className={`flex shrink-0 items-center gap-1.5 ${className}`} aria-label="Luces testigo">
      {luces.map((luz) => {
        const nivel = CLASES[luz.nivel] ? luz.nivel : 'apagado'
        const encendida = nivel !== 'apagado'
        const texto = encendida
          ? `${luz.nombre}: ${luz.descripcion || 'encendida'}${nivel === 'critico' ? ' (crítico)' : ''}`
          : `${luz.nombre}: sin alertas`
        return (
          <li key={luz.clave}>
            <span
              role="img"
              aria-label={texto}
              title={texto}
              data-nivel={nivel}
              className={`flex h-8 w-8 items-center justify-center rounded-box border transition-colors ${CLASES[nivel].caja}`}
            >
              <svg
                viewBox="0 0 24 24"
                className={`h-5 w-5 ${CLASES[nivel].dibujo} ${encendida ? 'testigo-brillo' : ''}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {DIBUJOS[luz.clave]}
              </svg>
            </span>
          </li>
        )
      })}
    </ul>
  )
}
