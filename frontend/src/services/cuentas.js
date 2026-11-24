import { api } from '@/lib/api'

const RECURSO = '/api/v1/admin/usuarios'

/* Acciones de cuenta que solo puede pedir el superadmin (docs/SuperAdmin.md,
   sección B1): restablecer la contraseña —devuelve una temporal que se muestra
   una sola vez— y cerrar las sesiones abiertas del usuario. */
export const cuentasService = {
  restablecerPassword: (id, token) =>
    api.post(`${RECURSO}/${id}/restablecer-password`, {}, token),

  cerrarSesiones: (id, token) => api.post(`${RECURSO}/${id}/cerrar-sesiones`, {}, token),
}
