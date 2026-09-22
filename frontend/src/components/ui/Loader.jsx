export default function Loader({ texto = 'Cargando…' }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-muted">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-graphite-600 border-t-amber" />
      <p className="text-sm">{texto}</p>
    </div>
  )
}
