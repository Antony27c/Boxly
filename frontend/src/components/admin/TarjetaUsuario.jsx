import Button from '@/components/ui/Button'
import { BOTON_PIE, Chip, Chips, Ficha, FichaCabecera, FichaPie } from '@/components/ui/Ficha'
import { nombreRol } from '@/services/usuarios'
import { iniciales } from '@/utils/ficha'

// Acento por rol: el superadmin va en grafito (por encima del administrador
// dorado), mecánico azul y recepción verde.
const ACENTO_ROL = {
  superadmin: 'neutro',
  administrador: 'amber',
  mecanico: 'azul',
  recepcion: 'ok',
}

// El avatar de iniciales acompaña al acento; solo el superadmin se despega del dorado.
const FONDO_AVATAR = {
  superadmin: 'bg-graphite-600 text-ink',
}

/* Tarjeta de un usuario del sistema.
   - `esPropio`: es la cuenta del usuario logueado (sin Desactivar ni Cerrar sesiones).
   - `soloSuperadmin`: quien mira es administrador y la cuenta es de un admin o
     superadmin: se ve la ficha pero sin acciones, con el chip "Solo superadmin".
   - `esSuperadmin`: quien mira es superadmin: ve además Restablecer contraseña
     y Cerrar sesiones. */
export default function TarjetaUsuario({
  usuario,
  esPropio = false,
  soloSuperadmin = false,
  esSuperadmin = false,
  onEditar,
  onAlternarEstado,
  onEliminar,
  onRestablecer,
  onCerrarSesiones,
}) {
  return (
    <Ficha acento={ACENTO_ROL[usuario.rol] ?? 'neutro'}>
      <FichaCabecera
        antetitulo={nombreRol(usuario.rol)}
        titulo={`${usuario.apellido}, ${usuario.nombre}`}
        aside={
          <span
            aria-hidden="true"
            className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${
              FONDO_AVATAR[usuario.rol] ?? 'bg-amber text-sobre-amber'
            }`}
          >
            {iniciales(usuario)}
          </span>
        }
      >
        <Chips>
          {usuario.email && (
            <Chip icono="correo" className="min-w-0 max-w-full">
              <span className="truncate">{usuario.email}</span>
            </Chip>
          )}
          <Chip tono={usuario.activo ? 'ok' : 'peligro'}>{usuario.activo ? 'Activo' : 'Inactivo'}</Chip>
        </Chips>
      </FichaCabecera>

      <FichaPie>
        {soloSuperadmin ? (
          <Chip tono="ambar">Solo superadmin</Chip>
        ) : (
          <>
            <Button variante="fantasma" className={BOTON_PIE} onClick={onEditar}>
              Editar
            </Button>
            {esSuperadmin && (
              <Button variante="fantasma" className={BOTON_PIE} icono="llave" onClick={onRestablecer}>
                Restablecer contraseña
              </Button>
            )}
            {esSuperadmin && !esPropio && (
              <Button variante="fantasma" className={BOTON_PIE} icono="salir" onClick={onCerrarSesiones}>
                Cerrar sesiones
              </Button>
            )}
            {!esPropio && (
              <Button variante="fantasma" className={BOTON_PIE} onClick={onAlternarEstado}>
                {usuario.activo ? 'Desactivar' : 'Activar'}
              </Button>
            )}
            <Button variante="fantasma" className={`${BOTON_PIE} ml-auto hover:!text-danger`} onClick={onEliminar}>
              Eliminar
            </Button>
          </>
        )}
      </FichaPie>
    </Ficha>
  )
}
