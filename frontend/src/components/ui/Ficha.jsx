import { Link } from 'react-router-dom'
import Icono from '@/components/ui/Icono'
import { iniciales, muestraDeColor } from '@/utils/ficha'

// Piezas de las tarjetas tipo "ficha" del taller (vehículos, órdenes, clientes…):
// barra de acento a la izquierda, cabecera con antetítulo chico y título grande,
// chips de datos, una fila de persona con iniciales y un pie con acciones.
//
//   <Ficha acento="amber">
//     <FichaCabecera antetitulo="Toyota" titulo="Corolla" aside={<Patente … />} silueta>
//       <Chips><Chip mono>2019</Chip><Chip color="Gris">Gris</Chip></Chips>
//     </FichaCabecera>
//     <FichaPersona etiqueta="Cliente" persona={cliente} />
//     <FichaPie><FichaLink to="/vehiculos/7">Ver ficha</FichaLink>…</FichaPie>
//   </Ficha>

const ACENTOS = {
  amber: 'bg-amber',
  ok: 'bg-ok',
  danger: 'bg-danger',
  neutro: 'bg-graphite-500',
  azul: 'bg-serie-1',
}

export function Ficha({ as: Etiqueta = 'li', acento = 'amber', className = '', children, ...props }) {
  return (
    <Etiqueta
      className={`group relative flex flex-col overflow-hidden rounded-box border border-graphite-700 bg-graphite-800 shadow-[0_1px_2px_rgba(16,18,22,0.06)] transition hover:border-graphite-500 hover:shadow-lift motion-safe:hover:-translate-y-0.5 ${className}`}
      {...props}
    >
      <span aria-hidden="true" className={`pointer-events-none absolute inset-y-0 left-0 z-20 w-1 ${ACENTOS[acento] ?? ACENTOS.amber}`} />
      {children}
    </Etiqueta>
  )
}

export function FichaCabecera({
  antetitulo,
  titulo,
  nivel: Titulo = 'h3',
  aside,
  silueta = false,
  className = '',
  children,
}) {
  return (
    <div className={`relative px-5 pb-4 pt-5 ${className}`}>
      {silueta && (
        <SiluetaAuto className="pointer-events-none absolute -bottom-3 -right-4 h-24 w-48 text-graphite-700 transition-colors group-hover:text-graphite-600" />
      )}
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          {antetitulo && (
            <p className="truncate text-xs font-semibold uppercase tracking-[0.18em] text-amber-texto">{antetitulo}</p>
          )}
          <Titulo className="mt-0.5 truncate text-2xl font-extrabold leading-tight tracking-tight">{titulo}</Titulo>
        </div>
        {aside && <div className="relative z-10 flex shrink-0 items-center gap-1">{aside}</div>}
      </div>
      {children}
    </div>
  )
}

export function Chips({ className = '', children }) {
  return <div className={`relative mt-3 flex flex-wrap gap-2 text-xs ${className}`}>{children}</div>
}

const TONOS_CHIP = {
  neutro: 'border-graphite-600 bg-graphite-900',
  ambar: 'border-amber/40 bg-amber/10 text-amber-deep',
  ok: 'border-ok/40 bg-ok/10 text-ok',
  peligro: 'border-danger/40 bg-danger/10 text-danger',
}

// `color` dibuja la muestra del color del auto si se reconoce.
export function Chip({ tono = 'neutro', mono = false, color, icono, className = '', children }) {
  const muestra = color ? muestraDeColor(color) : null
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${
        mono ? 'font-mono font-semibold' : 'font-medium'
      } ${TONOS_CHIP[tono] ?? TONOS_CHIP.neutro} ${className}`}
    >
      {muestra && (
        <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full ring-1 ring-ink/20" style={{ backgroundColor: muestra }} />
      )}
      {icono && <Icono nombre={icono} className="h-3.5 w-3.5" />}
      {children}
    </span>
  )
}

export function FichaSeccion({ className = '', children }) {
  return <div className={`relative border-t border-graphite-700 px-5 py-3 ${className}`}>{children}</div>
}

// Fila con avatar de iniciales. `persona` puede ser { nombre, apellido } o un texto.
// `texto` reemplaza el nombre mostrado; sin persona ni texto muestra "—".
export function FichaPersona({ etiqueta, persona, texto, icono = 'clientes', destacado = false, aside, className = '' }) {
  const nombre = texto ?? (persona && typeof persona === 'object' ? `${persona.apellido}, ${persona.nombre}` : persona)
  const letras = iniciales(persona)
  return (
    <FichaSeccion className={`flex items-center gap-3 ${className}`}>
      <span
        aria-hidden="true"
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          destacado ? 'bg-amber text-sobre-amber' : 'bg-amber/15 text-amber-texto'
        }`}
      >
        {letras || <Icono nombre={icono} className="h-4 w-4" />}
      </span>
      <div className="min-w-0 flex-1 text-sm">
        {etiqueta && <p className="text-xs text-muted">{etiqueta}</p>}
        <p className="truncate font-semibold">{nombre || '—'}</p>
      </div>
      {aside && <div className="relative z-10 shrink-0">{aside}</div>}
    </FichaSeccion>
  )
}

export function FichaPie({ className = '', children }) {
  return (
    <div
      className={`relative z-10 mt-auto flex flex-wrap items-center gap-1 border-t border-graphite-700 bg-graphite-900/50 px-3 py-2 ${className}`}
    >
      {children}
    </div>
  )
}

export function FichaLink({ to, className = '', children, ...props }) {
  return (
    <Link
      to={to}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-amber-texto transition-colors hover:bg-amber/10 ${className}`}
      {...props}
    >
      {children}
      <Icono nombre="flecha" className="h-4 w-4 transition-transform motion-safe:group-hover:translate-x-0.5" />
    </Link>
  )
}

// Clases para botones discretos del pie (sobre Button variante="fantasma").
export const BOTON_PIE = '!px-3 !py-2'

export function SiluetaAuto({ className }) {
  return (
    <svg viewBox="0 0 200 90" className={className} aria-hidden="true" fill="currentColor">
      <path d="M14 62c0-6 4-10 10-11l26-5 24-18c5-4 11-6 18-6h40c8 0 14 3 19 8l15 16 14 3c6 1 10 6 10 12v6c0 3-2 5-5 5h-12a20 20 0 0 0-39 0H76a20 20 0 0 0-39 0H19c-3 0-5-2-5-5Zm70-30-17 13h43V26H96c-5 0-9 2-12 6Zm33-6v19h41l-12-13c-3-4-8-6-13-6Z" />
      <circle cx="56.5" cy="72" r="14" />
      <circle cx="153.5" cy="72" r="14" />
      <circle cx="56.5" cy="72" r="5" className="fill-graphite-800" />
      <circle cx="153.5" cy="72" r="5" className="fill-graphite-800" />
    </svg>
  )
}
