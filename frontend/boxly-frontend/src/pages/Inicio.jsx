import { useAuth } from '@/context/AuthContext'

export default function Inicio() {
  const { usuario } = useAuth()
  const nombre = usuario?.nombre ?? usuario?.username ?? 'usuario'

  return (
    <div className="animate-bay-in">
      <h1 className="text-2xl font-semibold tracking-tight">Hola, {nombre}</h1>
      <p className="mt-2 text-muted">
        El login ya está integrado con la API. Los módulos de Clientes, Vehículos y Órdenes
        se incorporan en los próximos sprints.
      </p>

      <div className="mt-8 rounded-box border border-graphite-700 bg-graphite-800 p-6">
        <h2 className="font-semibold">Sesión activa</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted">Usuario</dt>
            <dd className="mt-0.5">{usuario?.username ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-muted">Rol</dt>
            <dd className="mt-0.5">{usuario?.rol ?? '—'}</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
