// Roles del sistema (los valores que devuelve el backend) agrupados por permiso.
export const ROLES_SUPERADMIN = ['superadmin']
// El superadmin opera la plataforma: no está en los roles del taller (docs/Plataforma.md).
export const ROLES_ADMIN = ['admin', 'administrador']
export const ROLES_MOSTRADOR = [...ROLES_ADMIN, 'recepcion', 'recepcionista']
export const ROLES_MECANICO = ['mecanico', 'mecánico']
export const ROLES_TALLER = [...ROLES_MOSTRADOR, ...ROLES_MECANICO]
export const ROLES_CLIENTE = ['cliente']

// Etiqueta legible del rol para mostrar a las personas ("Recepción", no "recepcion").
export function etiquetaRol(rol) {
  if (ROLES_SUPERADMIN.includes(rol)) return 'Superadmin'
  if (ROLES_ADMIN.includes(rol)) return 'Administrador'
  if (ROLES_MECANICO.includes(rol)) return 'Mecánico'
  if (ROLES_MOSTRADOR.includes(rol)) return 'Recepción'
  if (ROLES_CLIENTE.includes(rol)) return 'Cliente'
  return rol ?? ''
}

// Menú por rol: lo que se usa todos los días va en la barra; el resto en "Más".
// Cada entrada es { a, texto, icono } (icono: nombre de components/ui/Icono); `principales` se muestra siempre y `mas` va
// detrás del desplegable (en el celular, en la hoja que abre "Más").
const PRINCIPALES_MOSTRADOR = [
  { a: '/hoy', texto: 'Hoy', icono: 'hoy' },
  { a: '/ordenes', texto: 'Órdenes', icono: 'ordenes' },
  { a: '/turnos', texto: 'Turnos', icono: 'turnos' },
  { a: '/clientes', texto: 'Clientes', icono: 'clientes' },
  { a: '/vehiculos', texto: 'Vehículos', icono: 'vehiculos' },
]

const MAS_MOSTRADOR = [
  { a: '/inventario', texto: 'Inventario', icono: 'inventario' },
  { a: '/horarios', texto: 'Horarios', icono: 'horarios' },
  { a: '/dashboard', texto: 'Dashboard', icono: 'dashboard' },
]

const MAS_ADMIN = [...MAS_MOSTRADOR, { a: '/usuarios', texto: 'Usuarios', icono: 'usuarios' }]

const MAS_ADMIN_TALLER = [
  ...MAS_ADMIN,
  { a: '/admin', texto: 'Panel del taller', icono: 'ajustes' },
  { a: '/suscripcion', texto: 'Suscripción', icono: 'dinero' },
]

const PRINCIPALES_SUPERADMIN = [
  { a: '/plataforma', texto: 'Talleres', icono: 'herramienta' },
  { a: '/plataforma/planes', texto: 'Planes', icono: 'dinero' },
  { a: '/plataforma/solicitudes', texto: 'Solicitudes', icono: 'clientes' },
  { a: '/plataforma/encuestas', texto: 'Encuestas', icono: 'info' },
  { a: '/plataforma/sistema', texto: 'Sistema', icono: 'dashboard' },
]

const PRINCIPALES_MECANICO = [
  { a: '/hoy', texto: 'Mi trabajo', icono: 'hoy' },
  { a: '/ordenes', texto: 'Órdenes', icono: 'ordenes' },
  { a: '/inventario', texto: 'Inventario', icono: 'inventario' },
]

const MAS_MECANICO = [{ a: '/horarios', texto: 'Horarios', icono: 'horarios' }]

// Devuelve { principales, mas } para el rol dado. Un rol desconocido no ve nada.
export function menuSegunRol(rol) {
  if (ROLES_SUPERADMIN.includes(rol)) {
    return { principales: [...PRINCIPALES_SUPERADMIN], mas: [] }
  }
  if (ROLES_ADMIN.includes(rol)) {
    return { principales: [...PRINCIPALES_MOSTRADOR], mas: MAS_ADMIN_TALLER }
  }
  if (ROLES_MECANICO.includes(rol)) {
    return { principales: [...PRINCIPALES_MECANICO], mas: [...MAS_MECANICO] }
  }
  if (ROLES_MOSTRADOR.includes(rol)) {
    return { principales: [...PRINCIPALES_MOSTRADOR], mas: [...MAS_MOSTRADOR] }
  }
  if (ROLES_CLIENTE.includes(rol)) {
    return { principales: [{ a: '/portal', texto: 'Mis órdenes', icono: 'portal' }], mas: [] }
  }
  return { principales: [], mas: [] }
}

// Pantalla a la que se llega después de iniciar sesión, según el rol.
// Todo el personal del taller arranca en "Hoy" (el resumen del día);
// el cliente sigue en su portal.
export function inicioSegunRol(rol) {
  if (ROLES_SUPERADMIN.includes(rol)) return '/plataforma'
  if (ROLES_CLIENTE.includes(rol)) return '/portal'
  if (ROLES_TALLER.includes(rol)) return '/hoy'
  return '/login'
}

// Menú completo plano (compatibilidad): todos los destinos con el rol que los ve.
export const navegacion = [
  { a: '/hoy', texto: 'Hoy', roles: ROLES_TALLER },
  { a: '/ordenes', texto: 'Órdenes', roles: ROLES_TALLER },
  { a: '/portal', texto: 'Mis órdenes', roles: ROLES_CLIENTE },
  { a: '/turnos', texto: 'Turnos', roles: ROLES_MOSTRADOR },
  { a: '/clientes', texto: 'Clientes', roles: ROLES_MOSTRADOR },
  { a: '/vehiculos', texto: 'Vehículos', roles: ROLES_TALLER },
  { a: '/inventario', texto: 'Inventario', roles: ROLES_TALLER },
  { a: '/horarios', texto: 'Horarios', roles: ROLES_TALLER },
  { a: '/dashboard', texto: 'Dashboard', roles: ROLES_MOSTRADOR },
  { a: '/usuarios', texto: 'Usuarios', roles: ROLES_ADMIN },
  { a: '/admin', texto: 'Panel del taller', roles: ROLES_ADMIN },
  { a: '/plataforma', texto: 'Talleres', roles: ROLES_SUPERADMIN },
  { a: '/plataforma/sistema', texto: 'Sistema', roles: ROLES_SUPERADMIN },
  { a: '/plataforma/planes', texto: 'Planes', roles: ROLES_SUPERADMIN },
  { a: '/plataforma/solicitudes', texto: 'Solicitudes', roles: ROLES_SUPERADMIN },
  { a: '/plataforma/encuestas', texto: 'Encuestas', roles: ROLES_SUPERADMIN },
  { a: '/suscripcion', texto: 'Suscripción', roles: ROLES_ADMIN },
]

export function tieneAcceso(roles, rol) {
  if (!roles) return true
  return Boolean(rol) && roles.includes(rol)
}
