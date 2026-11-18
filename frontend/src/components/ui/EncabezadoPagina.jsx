import Icono from '@/components/ui/Icono'

export default function EncabezadoPagina({ titulo, descripcion, acciones, icono }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight">
          {icono && <Icono nombre={icono} className="h-6 w-6 text-amber-texto" />}
          {titulo}
        </h1>
        {descripcion && <p className="mt-1.5 text-sm text-muted">{descripcion}</p>}
      </div>
      {acciones && <div className="flex gap-2">{acciones}</div>}
    </div>
  )
}
