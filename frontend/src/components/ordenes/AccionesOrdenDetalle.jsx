import { useCallback, useId, useState } from 'react'
import Alert from '@/components/ui/Alert'
import BotonWhatsApp from '@/components/ui/BotonWhatsApp'
import Button from '@/components/ui/Button'
import Loader from '@/components/ui/Loader'
import Modal from '@/components/ui/Modal'
import Select from '@/components/ui/Select'
import { useAuth } from '@/context/AuthContext'
import useRecurso from '@/hooks/useRecurso'
import useTaller from '@/hooks/useTaller'
import { mensajeOrden, urlPortal } from '@/lib/plantillasWhatsapp'
import { puedeUsarWhatsApp } from '@/lib/whatsapp'
import { clientesService } from '@/services/clientes'
import { ordenesService } from '@/services/ordenes'

/**
 * Botones de la acción principal de la orden (la que decide `accionPrincipal`).
 * `onElegir` recibe el objeto de la acción ({ tipo, destino, texto, ... }).
 * Con `apilado` el principal ocupa todo el ancho y los extras van debajo en
 * una fila: es la barra fija de celular.
 */
export function BotonesAccion({ accion, onElegir, apilado = false, className = '' }) {
  const idMotivo = useId()
  if (!accion) return null
  const extras = [accion.secundaria, accion.trabajo].filter(Boolean)
  // Acción que todavía no se puede hacer (ej.: cobrar con líneas a cotizar):
  // botón deshabilitado y el motivo a la vista, asociado al botón.
  const deshabilitada = Boolean(accion.deshabilitada)
  const motivo = deshabilitada && accion.motivo && (
    <p id={idMotivo} className="w-full text-sm text-muted">
      {accion.motivo}
    </p>
  )
  const propsPrincipal = {
    onClick: () => onElegir(accion),
    disabled: deshabilitada,
    'aria-describedby': motivo ? idMotivo : undefined,
  }

  if (apilado) {
    return (
      <div className={`flex flex-col gap-2 ${className}`}>
        <Button className="min-h-12 w-full" {...propsPrincipal}>
          {accion.texto}
        </Button>
        {motivo}
        {extras.length > 0 && (
          <div className="flex gap-2">
            {extras.map((extra) => (
              <Button
                key={extra.texto}
                variante="secundario"
                className="min-h-11 flex-1"
                onClick={() => onElegir(extra)}
              >
                {extra.texto}
              </Button>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <Button {...propsPrincipal}>{accion.texto}</Button>
      {extras.map((extra) => (
        <Button key={extra.texto} variante="secundario" onClick={() => onElegir(extra)}>
          {extra.texto}
        </Button>
      ))}
      {motivo}
    </div>
  )
}

function nombreMecanico(mecanico) {
  return `${mecanico.apellido}, ${mecanico.nombre}`
}

/**
 * Modal chico para asignar (o reasignar) el mecánico de una orden.
 * Se monta solo cuando está abierto (`{conAsignar && <ModalAsignarMecanico …/>}`)
 * así la lista de mecánicos se pide recién al abrirlo.
 */
export function ModalAsignarMecanico({ orden, onCerrar, onListo }) {
  const { token } = useAuth()
  const [elegido, setElegido] = useState(() => (orden?.mecanico_id ? String(orden.mecanico_id) : ''))
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback((t) => ordenesService.mecanicos(t), [])
  const { datos: mecanicos, cargando, error: errorCarga, recargar } = useRecurso(cargar)

  const opciones = (mecanicos ?? []).map((mecanico) => ({
    valor: mecanico.id,
    texto: nombreMecanico(mecanico),
  }))
  // Si el mecánico actual no está en la lista (inactivo), se agrega para no perderlo.
  if (
    orden?.mecanico_id &&
    mecanicos &&
    !opciones.some((opcion) => opcion.valor === orden.mecanico_id)
  ) {
    opciones.push({ valor: orden.mecanico_id, texto: `${orden.mecanico || 'Mecánico asignado'} (inactivo)` })
  }

  async function asignar(evento) {
    evento.preventDefault()
    if (!elegido) {
      setError('Elegí un mecánico.')
      return
    }
    setGuardando(true)
    setError('')
    try {
      const mecanicoElegido = (mecanicos ?? []).find(
        (mecanico) => String(mecanico.id) === String(elegido),
      )
      const nombre = mecanicoElegido ? nombreMecanico(mecanicoElegido) : (orden.mecanico ?? '')
      await ordenesService.actualizar(orden.id, { ...orden, mecanico_id: elegido }, token)
      onListo(`Mecánico asignado: ${nombre}.`)
    } catch (problema) {
      setError(problema.message)
      setGuardando(false)
    }
  }

  return (
    <Modal
      abierto
      titulo={`Asignar mecánico a la orden ${orden.codigo ?? `#${orden.id}`}`}
      descripcion="El mecánico asignado ve la orden en su lista de trabajo."
      ancho="max-w-md"
      onCerrar={onCerrar}
    >
      <form onSubmit={asignar} noValidate className="space-y-4">
        {error && <Alert>{error}</Alert>}
        {errorCarga ? (
          <div className="space-y-4">
            <Alert>{errorCarga}</Alert>
            <Button variante="secundario" onClick={recargar}>
              Reintentar
            </Button>
          </div>
        ) : cargando ? (
          <Loader texto="Cargando mecánicos…" />
        ) : (
          <Select
            label="Mecánico"
            value={elegido}
            onChange={(evento) => {
              setElegido(evento.target.value)
              if (error) setError('')
            }}
            disabled={guardando}
            opciones={[{ valor: '', texto: 'Elegí un mecánico…' }, ...opciones]}
          />
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variante="fantasma" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button type="submit" cargando={guardando} disabled={cargando || Boolean(errorCarga)}>
            Asignar
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function BotonWhatsAppOrden({ orden, className }) {
  const { taller } = useTaller()
  const clienteId = orden.cliente_id
  const cargar = useCallback((t) => clientesService.obtener(clienteId, t), [clienteId])
  const { datos: cliente, cargando, error } = useRecurso(cargar)
  // Hasta tener el teléfono del cliente no se muestra nada; si no se pudo
  // leer, tampoco (no es que le falte el teléfono).
  if (cargando || error || !cliente) return null
  const mensaje = mensajeOrden(orden, {
    cliente: cliente.nombre,
    vehiculo: [orden.vehiculo_marca, orden.vehiculo_modelo].filter(Boolean).join(' '),
    patente: orden.vehiculo_patente,
    taller: taller?.nombre,
    portal: urlPortal(),
  })
  return <BotonWhatsApp telefono={cliente.telefono} mensaje={mensaje} className={className} />
}

/**
 * WhatsApp al cliente de la orden con el mensaje según el estado (recibido,
 * a cotizar, listo). Solo recepción y el administrador: el mecánico no lo ve.
 */
export function WhatsAppOrden({ orden, className = '' }) {
  const { usuario } = useAuth()
  if (!orden?.cliente_id || !puedeUsarWhatsApp(usuario?.rol)) return null
  return <BotonWhatsAppOrden orden={orden} className={className} />
}
