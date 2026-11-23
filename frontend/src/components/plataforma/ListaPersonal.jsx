import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { BOTON_PIE } from '@/components/ui/Ficha'
import { etiquetaRol } from '@/routes/navegacion'
import { haceCuanto } from './formatos'

/* Personal del taller (administradores, recepción y mecánicos; nunca clientes).
   Cada fila muestra rol, estado, último ingreso y las acciones que solo puede
   pedir el superadmin: restablecer contraseña y cerrar sesiones. */
export default function ListaPersonal({ personal, onRestablecer, onCerrarSesiones }) {
  const lista = personal ?? []

  if (lista.length === 0) {
    return <p className="mt-4 text-sm text-muted">Este taller todavía no tiene personal.</p>
  }

  return (
    <ul className="mt-4 divide-y divide-graphite-700">
      {lista.map((usuario) => (
        <li
          key={usuario.id}
          className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0"
        >
          <div className="min-w-0 flex-1 basis-48">
            <p className="truncate text-sm font-semibold text-ink">
              {usuario.apellido}, {usuario.nombre}
            </p>
            <p className="truncate text-xs text-muted">{usuario.email}</p>
          </div>
          <span className="text-sm text-muted">{etiquetaRol(usuario.rol)}</span>
          <Badge tono={usuario.activo ? 'ok' : 'neutro'}>
            {usuario.activo ? 'Activo' : 'Inactivo'}
          </Badge>
          <span className="text-xs text-muted">
            Último ingreso: {usuario.ultimo_ingreso ? haceCuanto(usuario.ultimo_ingreso) : 'nunca'}
          </span>
          <div className="flex flex-wrap gap-1">
            <Button
              variante="fantasma"
              className={BOTON_PIE}
              icono="llave"
              onClick={() => onRestablecer(usuario)}
            >
              Restablecer contraseña
            </Button>
            <Button
              variante="fantasma"
              className={BOTON_PIE}
              icono="salir"
              onClick={() => onCerrarSesiones(usuario)}
            >
              Cerrar sesiones
            </Button>
          </div>
        </li>
      ))}
    </ul>
  )
}
