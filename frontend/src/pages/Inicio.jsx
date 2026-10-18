import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { ROLES_ADMIN, ROLES_MOSTRADOR, ROLES_TALLER, tieneAcceso } from '@/routes/navegacion'

const accesos = [
  {
    a: '/clientes',
    titulo: 'Clientes',
    texto: 'Alta, edición y búsqueda de los clientes del taller.',
    roles: ROLES_MOSTRADOR,
  },
  {
    a: '/vehiculos',
    titulo: 'Vehículos',
    texto: 'Ficha técnica, titular e historial de reparaciones.',
    roles: ROLES_TALLER,
  },
  {
    a: '/turnos',
    titulo: 'Agenda y turnos',
    texto: 'Disponibilidad semanal y estado de cada turno.',
    roles: ROLES_MOSTRADOR,
  },
  {
    a: '/ordenes',
    titulo: 'Órdenes de trabajo',
    texto: 'Trabajos del taller, estado de cada orden y presupuesto.',
    roles: ROLES_TALLER,
  },
  {
    a: '/admin',
    titulo: 'Administración',
    texto: 'Usuarios del sistema, roles y permisos de acceso.',
    roles: ROLES_ADMIN,
  },
]

export default function Inicio() {
  const { usuario } = useAuth()
  const nombre = usuario?.nombre ?? 'usuario'
  const visibles = accesos.filter((acceso) => tieneAcceso(acceso.roles, usuario?.rol))

  return (
    <div className="animate-bay-in">
      <h1 className="text-2xl font-semibold tracking-tight">Hola, {nombre}</h1>
      <p className="mt-2 text-muted">Elegí un módulo para empezar.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibles.map((acceso) => (
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
