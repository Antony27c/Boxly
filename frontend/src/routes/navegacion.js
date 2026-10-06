import IconoAuto from '@/components/ui/IconoAuto'

export const ROLES_ADMIN = ['admin', 'administrador']
export const ROLES_MOSTRADOR = [...ROLES_ADMIN, 'recepcion', 'recepcionista']
export const ROLES_TALLER = [...ROLES_MOSTRADOR, 'mecanico', 'mecánico']

export const navegacion = [
  { a: '/inicio', texto: 'Inicio' },
  { a: '/clientes', texto: 'Clientes', roles: ROLES_MOSTRADOR },
  { a: '/vehiculos', texto: 'Vehículos', roles: ROLES_TALLER, icono: IconoAuto },
  { a: '/turnos', texto: 'Turnos', roles: ROLES_MOSTRADOR },
  { a: '/ordenes', texto: 'Órdenes', roles: ROLES_TALLER },
  { a: '/admin', texto: 'Administración', roles: ROLES_ADMIN },
]

export function tieneAcceso(roles, rol) {
  if (!roles || !rol) return true
  return roles.includes(rol)
}
