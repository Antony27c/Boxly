import { Link } from 'react-router-dom'
import Button from '@/components/ui/Button'
import { BOTON_PIE, Chip, Chips, Ficha, FichaCabecera, FichaPie } from '@/components/ui/Ficha'

// Acento según el acceso al portal: verde con cuenta, dorado con la
// verificación del correo pendiente y neutro si no dejó correo.
function acentoDe(cliente) {
  if (cliente.tiene_cuenta) return 'ok'
  return cliente.email ? 'amber' : 'neutro'
}

export default function TarjetaCliente({ cliente, vehiculos = 0, invitando = false, onInvitar, onEditar, onEliminar }) {
  const pendiente = Boolean(cliente.email && !cliente.tiene_cuenta)
  return (
    <Ficha acento={acentoDe(cliente)}>
      <FichaCabecera
        antetitulo={cliente.dni ? `DNI/CUIT ${cliente.dni}` : 'Cliente'}
        titulo={`${cliente.apellido}, ${cliente.nombre}`}
      >
        {cliente.direccion && <p className="mt-0.5 truncate text-sm text-muted">{cliente.direccion}</p>}
        <Chips>
          {cliente.telefono && <Chip mono>{cliente.telefono}</Chip>}
          {cliente.email && (
            <Chip icono="correo" className="min-w-0 max-w-full">
              <span className="truncate">{cliente.email}</span>
            </Chip>
          )}
          <Link
            to={`/vehiculos?cliente=${cliente.id}`}
            className="rounded-full transition-opacity hover:opacity-80"
          >
            <Chip tono="ambar" icono="vehiculos">
              {vehiculos} {vehiculos === 1 ? 'vehículo' : 'vehículos'}
            </Chip>
          </Link>
          {cliente.tiene_cuenta ? (
            <Chip tono="ok">Con acceso al portal</Chip>
          ) : (
            pendiente && <Chip tono="ambar">Verificación pendiente</Chip>
          )}
        </Chips>
      </FichaCabecera>

      <FichaPie>
        {pendiente && (
          <Button variante="fantasma" className={BOTON_PIE} cargando={invitando} onClick={onInvitar}>
            Reenviar correo de verificación
          </Button>
        )}
        <span className="ml-auto flex gap-1">
          <Button variante="fantasma" className={BOTON_PIE} onClick={onEditar}>
            Editar
          </Button>
          <Button variante="fantasma" className={`${BOTON_PIE} hover:!text-danger`} onClick={onEliminar}>
            Eliminar
          </Button>
        </span>
      </FichaPie>
    </Ficha>
  )
}
