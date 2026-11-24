import { Link } from 'react-router-dom'
import BloquesDelDia from '@/components/hoy/BloquesDelDia'
import { fechaLarga } from '@/components/hoy/estilos'
import MiTrabajo from '@/components/hoy/MiTrabajo'
import useHoy from '@/components/hoy/useHoy'
import PrimerosPasos from '@/components/inicio/PrimerosPasos'
import Alert from '@/components/ui/Alert'
import Icono from '@/components/ui/Icono'
import Loader from '@/components/ui/Loader'
import { useAuth } from '@/context/AuthContext'
import { ROLES_MECANICO } from '@/routes/navegacion'

// Recepción y administrador: el resumen del día del taller. Los datos vienen
// de `useHoy` y los bloques, de `components/hoy/`.
function PanelTaller({ usuario }) {
  const dia = useHoy(usuario)

  return (
    <div className="animate-bay-in">
      <h1 className="text-2xl font-semibold tracking-tight">
        Hola, {usuario?.nombre ?? 'usuario'}
      </h1>
      <p className="mt-1.5 text-sm text-muted">{fechaLarga()}</p>

      {dia.esAdmin && <PrimerosPasos className="mb-6" />}

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          to="/ordenes?ingreso=1"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber px-6 py-3 text-base font-semibold tracking-wide text-sobre-amber transition motion-safe:active:scale-[0.98] hover:bg-amber-soft"
        >
          <Icono nombre="vehiculos" className="h-5 w-5" />
          Recibir un auto
        </Link>
        <Link
          to="/clientes?nuevo=1"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-graphite-600 px-6 py-3 text-base font-semibold tracking-wide text-ink transition motion-safe:active:scale-[0.98] hover:bg-graphite-500"
        >
          <Icono nombre="clientes" className="h-5 w-5" />
          Cliente nuevo
        </Link>
      </div>

      {dia.errores.map((mensaje, indice) => (
        <div key={indice} className="mt-4">
          <Alert>{mensaje}</Alert>
        </div>
      ))}

      {dia.esperando ? <Loader texto="Cargando el día…" /> : <BloquesDelDia dia={dia} />}
    </div>
  )
}

export default function Hoy() {
  const { usuario } = useAuth()

  if (ROLES_MECANICO.includes(usuario?.rol)) return <MiTrabajo usuario={usuario} />
  return <PanelTaller usuario={usuario} />
}
