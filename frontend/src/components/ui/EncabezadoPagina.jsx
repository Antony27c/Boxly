export default function EncabezadoPagina({ titulo, descripcion, acciones, icono: Icono }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight">
          {Icono && <Icono className="h-7 w-7 text-amber" />}
          {titulo}
        </h1>
        {descripcion && <p className="mt-1.5 text-sm text-muted">{descripcion}</p>}
      </div>
      {acciones && <div className="flex gap-2">{acciones}</div>}
    </div>
  )
}
