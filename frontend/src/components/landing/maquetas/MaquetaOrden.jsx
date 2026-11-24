import Badge from '@/components/ui/Badge'
import { Chip, Chips, Ficha, FichaCabecera } from '@/components/ui/Ficha'
import Icono from '@/components/ui/Icono'
import Patente from '@/components/ui/Patente'

// Maqueta de la orden (pestaña Trabajo) con datos ficticios. Decorativa: quien
// la usa la envuelve en aria-hidden y pone el texto alternativo al lado.
const LINEAS = [
  { tipo: 'Trabajo', descripcion: 'Cambio de pastillas delanteras', precio: null },
  { tipo: 'Repuesto', descripcion: 'Pastillas de freno x2', precio: '$ 38.500' },
  { tipo: 'Trabajo', descripcion: 'Revisión de discos', precio: '$ 15.000' },
]

export default function MaquetaOrden() {
  return (
    <Ficha as="div" acento="amber" className="pointer-events-none select-none">
      <FichaCabecera
        nivel="p"
        antetitulo="Fiat"
        titulo="Cronos"
        aside={<Patente valor="AB 123 CD" tamano="sm" />}
        className="!pb-3"
      >
        <Chips>
          <Chip mono>OT-0042</Chip>
          <Chip icono="clientes">Juan P.</Chip>
          <Chip icono="llave_inglesa">Mecánico: Leo R.</Chip>
        </Chips>
      </FichaCabecera>

      <div className="flex items-center justify-between gap-2 border-t border-graphite-700 px-5 py-3">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Etapa</span>
        <Badge tono="ambar">En diagnóstico</Badge>
      </div>

      <div className="border-t border-graphite-700 px-5 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Trabajo</p>
        <ul className="mt-2 divide-y divide-graphite-700 text-sm">
          {LINEAS.map((linea) => (
            <li key={linea.descripcion} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0">
                <span className="block truncate font-medium">{linea.descripcion}</span>
                <span className="block text-xs text-muted">{linea.tipo}</span>
              </span>
              {linea.precio ? (
                <span className="shrink-0 font-mono font-semibold">{linea.precio}</span>
              ) : (
                <Badge tono="ambar" className="shrink-0">
                  A cotizar
                </Badge>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-center gap-2 border-t border-graphite-700 bg-amber/10 px-5 py-3 text-sm text-amber-deep">
        <Icono nombre="alerta" className="h-4 w-4" />
        Falta cotizar 1 línea para emitir el cobro.
      </div>
    </Ficha>
  )
}
