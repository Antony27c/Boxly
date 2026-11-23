import Badge from '@/components/ui/Badge'
import Icono from '@/components/ui/Icono'
import Patente from '@/components/ui/Patente'
import { pasosDesdeEstado } from '@/components/portal/pasosRuta'
import RutaSeguimiento from '@/components/portal/RutaSeguimiento'

// Maqueta del seguimiento del cliente en el celular, con datos ficticios.
// Reusa la ruta real del portal. Decorativa (aria-hidden en quien la usa).
export default function MaquetaPortal() {
  return (
    <div className="pointer-events-none mx-auto w-full max-w-[17rem] select-none rounded-[2rem] border-[6px] border-graphite-600 bg-graphite-900 p-3 shadow-lift">
      <div className="mx-auto mb-3 h-1.5 w-16 rounded-full bg-graphite-600" />
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-texto">Mis órdenes</p>

      <div className="mt-2 rounded-box border border-graphite-700 bg-graphite-800 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-amber-texto">Fiat</p>
            <p className="truncate text-lg font-extrabold leading-tight">Cronos</p>
          </div>
          <Patente valor="AB 123 CD" tamano="sm" />
        </div>

        <div className="mt-3">
          <RutaSeguimiento pasos={pasosDesdeEstado('en_diagnostico')} compacta />
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 text-xs">
          <Badge tono="ambar">En diagnóstico</Badge>
          <span className="text-muted">Entrega: jueves</span>
        </div>
      </div>

      <div className="mt-3 rounded-box border border-graphite-700 bg-graphite-800 p-3 text-xs">
        <p className="flex items-center gap-1.5 font-semibold">
          <Icono nombre="historial" className="h-3.5 w-3.5 text-amber-texto" />
          Última novedad
        </p>
        <p className="mt-1 text-muted">Revisamos los frenos: hay que cambiar las pastillas delanteras.</p>
        <div className="mt-2 flex gap-1.5">
          <span className="flex h-10 w-12 items-center justify-center rounded-box bg-graphite-600 text-muted">
            <Icono nombre="foto" className="h-4 w-4" />
          </span>
          <span className="flex h-10 w-12 items-center justify-center rounded-box bg-graphite-600 text-muted">
            <Icono nombre="foto" className="h-4 w-4" />
          </span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 rounded-box border border-graphite-700 bg-graphite-800 p-3 text-xs">
        <span className="text-muted">Total hasta ahora</span>
        <span className="font-mono font-semibold">$ 53.500</span>
      </div>
    </div>
  )
}
