import BotonWhatsApp from '@/components/ui/BotonWhatsApp'
import { useAuth } from '@/context/AuthContext'
import useTaller from '@/hooks/useTaller'
import { saludo } from '@/lib/plantillasWhatsapp'
import { puedeUsarWhatsApp } from '@/lib/whatsapp'

function BotonCliente({ cliente, className }) {
  const { taller } = useTaller()
  const mensaje = saludo({ cliente: cliente.nombre, taller: taller?.nombre })
  return <BotonWhatsApp telefono={cliente.telefono} mensaje={mensaje} className={className} />
}

/** WhatsApp con un saludo libre para la ficha del cliente (recepción y admin). */
export default function WhatsAppCliente({ cliente, className = '' }) {
  const { usuario } = useAuth()
  if (!cliente || !puedeUsarWhatsApp(usuario?.rol)) return null
  return <BotonCliente cliente={cliente} className={className} />
}
