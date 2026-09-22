import { Link } from 'react-router-dom'

export default function NoEncontrado() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-5 text-center">
      <p className="text-5xl font-bold text-amber">404</p>
      <h1 className="text-xl font-semibold">Esta página no existe</h1>
      <p className="max-w-sm text-muted">
        Puede que el enlace esté mal escrito o que la sección todavía no esté disponible.
      </p>
      <Link
        to="/inicio"
        className="mt-2 rounded-box bg-graphite-600 px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-graphite-500"
      >
        Volver al inicio
      </Link>
    </div>
  )
}
