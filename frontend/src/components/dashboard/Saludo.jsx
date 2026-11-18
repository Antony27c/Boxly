import { useNavigate } from 'react-router-dom'
import Button from '@/components/ui/Button'

function saludoSegunHora(hora) {
  if (hora < 13) return 'Buen día'
  if (hora < 20) return 'Buenas tardes'
  return 'Buenas noches'
}

function fechaLarga(fecha) {
  const texto = fecha.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/**
 * Encabezado del Dashboard: saludo según la hora, la fecha de hoy y el botón
 * principal para recibir un auto (abre el ingreso rápido de Órdenes).
 */
export default function Saludo({ nombre }) {
  const navigate = useNavigate()
  const ahora = new Date()
  const saludo = saludoSegunHora(ahora.getHours())
  const primero = nombre?.trim().split(/\s+/)[0]

  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          {primero ? `${saludo}, ${primero}` : saludo}
        </h1>
        <p className="mt-1.5 text-sm text-muted">{fechaLarga(ahora)}</p>
      </div>
      <Button icono="vehiculos" onClick={() => navigate('/ordenes?ingreso=1')}>
        Recibir un auto
      </Button>
    </div>
  )
}
