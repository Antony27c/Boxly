// Bloques grises que imitan una tarjeta mientras carga el bloque de datos.
export default function EsqueletoTarjeta() {
  return (
    <div className="space-y-3" aria-hidden="true">
      <div className="h-4 w-1/3 animate-pulse rounded bg-graphite-700" />
      <div className="h-9 w-2/3 animate-pulse rounded bg-graphite-700" />
      <div className="h-3 w-1/2 animate-pulse rounded bg-graphite-700" />
      <div className="h-24 w-full animate-pulse rounded bg-graphite-700" />
      <div className="h-3 w-2/5 animate-pulse rounded bg-graphite-700" />
    </div>
  )
}
