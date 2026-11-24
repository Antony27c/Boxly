import BotonWhatsApp from '@/components/ui/BotonWhatsApp'
import { useAuth } from '@/context/AuthContext'
import useTaller from '@/hooks/useTaller'
import { mensajeTurno } from '@/lib/plantillasWhatsapp'
import { puedeUsarWhatsApp } from '@/lib/whatsapp'

function BotonTurno({ turno, cliente, vehiculo, className }) {
  const { taller } = useTaller()
  const mensaje = mensajeTurno(turno, {
    cliente: cliente?.nombre,
    vehiculo: vehiculo ? [vehiculo.marca, vehiculo.modelo].filter(Boolean).join(' ') : '',
    patente: vehiculo?.patente,
    fecha: turno.fecha,
    hora: turno.hora,
    taller: taller?.nombre,
  })
  if (!mensaje) return null
  return <BotonWhatsApp telefono={cliente?.telefono} mensaje={mensaje} className={className} />
}

/**
 * WhatsApp para un turno: confirmación si está pendiente y recordatorio si ya
 * está confirmado. Solo recepción y el administrador; sin cliente no se muestra.
 */
export default function WhatsAppTurno({ turno, cliente, vehiculo, className = '' }) {
  const { usuario } = useAuth()
  if (!turno || !cliente || !puedeUsarWhatsApp(usuario?.rol)) return null
  return <BotonTurno turno={turno} cliente={cliente} vehiculo={vehiculo} className={className} />
}
