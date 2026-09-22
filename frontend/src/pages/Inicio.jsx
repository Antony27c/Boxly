import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { USAR_MOCK } from '@/services/config'

const accesos = [
  {
    a: '/clientes',
    titulo: 'Clientes',
    texto: 'Alta, edición y búsqueda de los clientes del taller.',
  },
  {
    a: '/vehiculos',
    titulo: 'Vehículos',
    texto: 'Ficha técnica, titular e historial de reparaciones.',
  },
  {
    a: '/turnos',
    titulo: 'Agenda y turnos',
    texto: 'Disponibilidad semanal y estado de cada turno.',
  },
]

export default function Inicio() {
  const { usuario } = useAuth()
  const nombre = usuario?.nombre ?? 'usuario'

  return (
    <div className="animate-bay-in">
      <h1 className="text-2xl font-semibold tracking-tight">Hola, {nombre}</h1>
      <p className="mt-2 text-muted">
        Desde acá entrás a los módulos de Clientes, Vehículos y Turnos. Las órdenes de trabajo
        y el inventario se incorporan en los próximos sprints.
      </p>

      {USAR_MOCK && (
        <p className="mt-4 text-sm text-muted">
          Clientes, Vehículos y Turnos trabajan con datos de prueba guardados en el navegador
          hasta que estén publicados sus endpoints.
        </p>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {accesos.map((acceso) => (
          <Link
            key={acceso.a}
            to={acceso.a}
            className="rounded-box border border-graphite-700 bg-graphite-800 p-5 transition-colors hover:border-amber"
          >
            <h2 className="font-semibold">{acceso.titulo}</h2>
            <p className="mt-1.5 text-sm text-muted">{acceso.texto}</p>
          </Link>
        ))}
      </div>

      <div className="mt-8 rounded-box border border-graphite-700 bg-graphite-800 p-6">
        <h2 className="font-semibold">Sesión activa</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted">Usuario</dt>
            <dd className="mt-0.5">
              {usuario ? `${usuario.nombre} ${usuario.apellido ?? ''}`.trim() : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Correo</dt>
            <dd className="mt-0.5">{usuario?.email ?? '—'}</dd>
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
