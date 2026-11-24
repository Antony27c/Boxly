import { Link } from 'react-router-dom'
import Badge from '@/components/ui/Badge'
import Icono from '@/components/ui/Icono'

// Tarjeta con contador y link al tablero/pantalla filtrada. Si no hay items,
// explica el vacío en una línea en lugar de mostrar una lista vacía.
// `delay` (ms) escalona la aparición de los bloques al cargar la página.
export default function Bloque({ titulo, icono, destino, cantidad, vacio, delay, children }) {
  return (
    <section
      className={`min-w-0 rounded-box border border-graphite-700 bg-graphite-800 p-4 ${
        delay != null ? 'animate-bay-in' : ''
      }`}
      style={delay != null ? { animationDelay: `${delay}ms` } : undefined}
    >
      <header className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          {icono && <Icono nombre={icono} className="h-4 w-4 text-amber-texto" />}
          {titulo}
          <Badge tono={cantidad > 0 ? 'ambar' : 'neutro'}>{cantidad}</Badge>
        </h2>
        <Link to={destino} className="shrink-0 text-xs font-medium text-amber-texto hover:underline">
          Ver todo
        </Link>
      </header>
      <div className="mt-3">
        {cantidad === 0 ? (
          <p className="text-sm text-muted">{vacio}</p>
        ) : (
          <ul className="space-y-2">{children}</ul>
        )}
      </div>
    </section>
  )
}
