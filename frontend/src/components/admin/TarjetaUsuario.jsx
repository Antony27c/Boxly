import Button from '@/components/ui/Button'
import { BOTON_PIE, Chip, Chips, Ficha, FichaCabecera, FichaPie } from '@/components/ui/Ficha'
import { nombreRol } from '@/services/usuarios'
import { iniciales } from '@/utils/ficha'

// Acento por rol: administrador dorado, mecánico azul y recepción verde.
const ACENTO_ROL = {
  administrador: 'amber',
  mecanico: 'azul',
  recepcion: 'ok',
}

export default function TarjetaUsuario({ usuario, onEditar, onAlternarEstado, onEliminar }) {
  return (
    <Ficha acento={ACENTO_ROL[usuario.rol] ?? 'neutro'}>
      <FichaCabecera
        antetitulo={nombreRol(usuario.rol)}
        titulo={`${usuario.apellido}, ${usuario.nombre}`}
        aside={
          <span
            aria-hidden="true"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-amber text-sm font-bold text-sobre-amber"
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
        <Button variante="fantasma" className={BOTON_PIE} onClick={onEditar}>
          Editar
        </Button>
        <Button variante="fantasma" className={BOTON_PIE} onClick={onAlternarEstado}>
          {usuario.activo ? 'Desactivar' : 'Activar'}
        </Button>
        <Button variante="fantasma" className={`${BOTON_PIE} ml-auto hover:!text-danger`} onClick={onEliminar}>
          Eliminar
        </Button>
      </FichaPie>
    </Ficha>
  )
}
