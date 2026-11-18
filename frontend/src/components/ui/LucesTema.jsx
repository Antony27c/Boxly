import Icono from '@/components/ui/Icono'
import { useTema } from '@/context/TemaContext'

// Cada tema es un testigo del tablero: luces bajas de día, altas de noche y
// automáticas para seguir al dispositivo. El color es el del testigo real.
const OPCIONES = [
  {
    valor: 'claro',
    texto: 'Claro',
    corto: 'Claro',
    luces: 'Luces bajas',
    descripcion: 'Fondo claro, ideal con luz.',
    color: 'text-ok',
  },
  {
    valor: 'oscuro',
    texto: 'Oscuro',
    corto: 'Oscuro',
    luces: 'Luces altas',
    descripcion: 'Fondo oscuro, ideal de noche.',
    color: 'text-serie-1',
  },
  {
    valor: 'sistema',
    texto: 'Automático',
    corto: 'Auto',
    luces: 'Luces automáticas',
    descripcion: 'Sigue al dispositivo.',
    color: 'text-amber-texto',
  },
]

function Testigo({ valor, encendido, className = '' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {/* Faro con el lado plano hacia donde sale la luz. */}
      <path
        d="M13 6c4.4 0 8 2.7 8 6s-3.6 6-8 6c-.8 0-1.2-.5-1.2-1.2V7.2C11.8 6.5 12.2 6 13 6Z"
        fill="currentColor"
        fillOpacity={encendido ? 0.25 : 0}
      />
      {valor === 'oscuro' ? (
        <path d="M9 8H3M9 12H3M9 16H3" />
      ) : (
        <path d="M9 7.5 3 9.5M9 11.5 3 13.5M9 15.5 3 17.5" />
      )}
      {valor === 'sistema' && <path d="M14.6 15 16.4 9l1.8 6M15.2 13h2.4" strokeWidth="1.4" />}
    </svg>
  )
}

function claseTestigo(opcion, activo) {
  return activo
    ? `${opcion.color} drop-shadow-[0_0_3px_currentColor] motion-safe:animate-luz-on`
    : 'opacity-60'
}

/**
 * Selector de tema como los testigos de luces del tablero. Dice en texto qué
 * tema quedó activo (y, en automático, cuál está usando ahora).
 *   variante="compacta": fila de tres (menú de usuario).
 *   variante="amplia": tarjetas con vistaPrevia(valor) opcional (Configuración).
 */
export default function LucesTema({ variante = 'compacta', etiqueta = 'Tema', onCambiar, vistaPrevia }) {
  const { tema, oscuro, setTema } = useTema()
  const activa = OPCIONES.find((opcion) => opcion.valor === tema) ?? OPCIONES[2]
  const amplia = variante === 'amplia'

  const estado =
    tema === 'sistema'
      ? `Tema activo: automático (ahora ${oscuro ? 'oscuro' : 'claro'}), ${activa.luces.toLowerCase()}.`
      : `Tema activo: ${activa.texto.toLowerCase()}, ${activa.luces.toLowerCase()}.`

  function elegir(valor) {
    if (valor === tema) return
    setTema(valor)
    onCambiar?.(valor)
  }

  return (
    <div>
      <div
        role="radiogroup"
        aria-label={etiqueta}
        className={
          amplia ? 'grid gap-3 sm:grid-cols-3' : 'grid grid-cols-3 gap-1 rounded-box bg-graphite-700 p-1'
        }
      >
        {OPCIONES.map((opcion) => {
          const activo = tema === opcion.valor
          if (amplia) {
            return (
              <button
                key={opcion.valor}
                type="button"
                role="radio"
                aria-checked={activo}
                onClick={() => elegir(opcion.valor)}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  activo
                    ? 'border-amber bg-amber/10'
                    : 'border-graphite-600 hover:border-graphite-500 hover:bg-graphite-700'
                }`}
              >
                {vistaPrevia?.(opcion.valor)}
                <span className="mt-2.5 flex items-start gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-graphite-900 ring-1 ring-graphite-600">
                    <Testigo
                      valor={opcion.valor}
                      encendido={activo}
                      className={`h-5 w-5 ${activo ? claseTestigo(opcion, true) : 'text-muted opacity-60'}`}
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">{opcion.texto}</span>
                    <span className="block text-xs text-muted">
                      {opcion.luces} · {opcion.descripcion}
                    </span>
                  </span>
                  {activo && <Icono nombre="check" className="mt-0.5 h-5 w-5 shrink-0 text-amber-texto" />}
                </span>
              </button>
            )
          }
          return (
            <button
              key={opcion.valor}
              type="button"
              role="radio"
              aria-checked={activo}
              aria-label={`${opcion.corto}, ${opcion.luces.toLowerCase()}`}
              onClick={() => elegir(opcion.valor)}
              className={`flex flex-col items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-all duration-200 ${
                activo ? 'bg-graphite-800 text-ink shadow-sm' : 'text-muted hover:text-ink'
              }`}
            >
              <Testigo valor={opcion.valor} encendido={activo} className={`h-5 w-5 ${claseTestigo(opcion, activo)}`} />
              {opcion.corto}
            </button>
          )
        })}
      </div>
      <p role="status" className={amplia ? 'mt-3 text-sm text-muted' : 'mt-2 text-xs text-muted'}>
        {estado}
      </p>
    </div>
  )
}
