import Icono from '@/components/ui/Icono'
import Patente from '@/components/ui/Patente'

// Maqueta de la pantalla "Hoy" (el tablero del día de recepción) con datos
// ficticios. Mismos bloques que pages/Hoy.jsx. Decorativa (aria-hidden afuera).
const BLOQUES = [
  {
    titulo: 'Turnos de hoy',
    icono: 'turnos',
    filas: [
      { hora: '09:00', texto: 'Service · Ana G.', patente: 'AC 456 EF' },
      { hora: '11:30', texto: 'Frenos · Juan P.', patente: 'AB 123 CD' },
    ],
  },
  {
    titulo: 'Listos para entregar',
    icono: 'check',
    filas: [{ texto: 'Peugeot 208 · Marta S.', patente: 'AD 789 GH' }],
  },
  {
    titulo: 'Cobros por aprobar',
    icono: 'dinero',
    filas: [{ texto: 'OT-0039 · propuesto por Leo R.' }],
  },
  {
    titulo: 'Stock bajo',
    icono: 'inventario',
    filas: [{ texto: 'Filtro de aceite · quedan 2' }],
  },
]

export default function MaquetaHoy() {
  return (
    <div className="pointer-events-none select-none rounded-box border border-graphite-700 bg-graphite-900 p-4 shadow-lift">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xl font-extrabold tracking-tight">Hoy</p>
        <p className="text-xs text-muted">martes</p>
      </div>
      <div className="mt-3 grid gap-3">
        {BLOQUES.map((bloque) => (
          <div key={bloque.titulo} className="rounded-box border border-graphite-700 bg-graphite-800 p-3">
            <p className="flex items-center justify-between gap-2 text-sm font-semibold">
              <span className="flex items-center gap-2">
                <Icono nombre={bloque.icono} className="h-4 w-4 text-amber-texto" />
                {bloque.titulo}
              </span>
              <span className="rounded-full bg-graphite-700 px-2 font-mono text-xs">{bloque.filas.length}</span>
            </p>
            <ul className="mt-2 space-y-1.5 text-xs">
              {bloque.filas.map((fila) => (
                <li key={fila.texto} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate">
                    {fila.hora && <span className="mr-1.5 font-mono font-semibold">{fila.hora}</span>}
                    {fila.texto}
                  </span>
                  {fila.patente && <Patente valor={fila.patente} tamano="sm" />}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
