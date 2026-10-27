export const ROLES_ADMIN = ['admin', 'administrador']
export const ROLES_MOSTRADOR = [...ROLES_ADMIN, 'recepcion', 'recepcionista']
export const ROLES_TALLER = [...ROLES_MOSTRADOR, 'mecanico', 'mecánico']
export const ROLES_CLIENTE = ['cliente']

export function inicioSegunRol(rol) {
  return ROLES_CLIENTE.includes(rol) ? '/portal' : '/inicio'
}

export const navegacion = [
  { a: '/inicio', texto: 'Inicio', roles: ROLES_TALLER },
  { a: '/dashboard', texto: 'Dashboard', roles: ROLES_ADMIN },
  { a: '/portal', texto: 'Mis órdenes', roles: ROLES_CLIENTE },
  { a: '/clientes', texto: 'Clientes', roles: ROLES_MOSTRADOR },
  { a: '/vehiculos', texto: 'Vehículos', roles: ROLES_TALLER },
  { a: '/turnos', texto: 'Turnos', roles: ROLES_MOSTRADOR },
  { a: '/ordenes', texto: 'Órdenes', roles: ROLES_TALLER },
  { a: '/inventario', texto: 'Inventario', roles: ROLES_TALLER },
  { a: '/horarios', texto: 'Horarios', roles: ROLES_TALLER },
  { a: '/usuarios', texto: 'Usuarios', roles: ROLES_ADMIN },
]

export function tieneAcceso(roles, rol) {
  if (!roles || !rol) return true
  return roles.includes(rol)
}
