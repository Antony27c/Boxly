import { useState } from 'react'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import Loader from '@/components/ui/Loader'
import AccionesSuscripcion from './suscripcion/AccionesSuscripcion'
import Adicionales from './suscripcion/Adicionales'
import EstadoSuscripcion from './suscripcion/EstadoSuscripcion'
import FuncionesIncluidas from './suscripcion/FuncionesIncluidas'
import HistorialPagos from './suscripcion/HistorialPagos'
import ModalesSuscripcion from './suscripcion/ModalesSuscripcion'
import useSuscripcionTaller from './suscripcion/useSuscripcionTaller'

/* Sección "Suscripción" del detalle del taller (S5 + C3): composición de las
   piezas de components/plataforma/suscripcion/. Los datos llegan de
   useSuscripcionTaller (suscripción + planes + adicionales) y las mutaciones
   pasan por `ejecutar`, que devuelve el error para mostrarlo en el modal. */
export default function SuscripcionTaller({ tallerId, onCambio }) {
  const { datos, cargando, error, recargar, ejecutar } = useSuscripcionTaller(tallerId, onCambio)

  const [accion, setAccion] = useState(null) // 'acceso' | 'plan' | 'pago' | 'vencimiento' | 'adicional'
  const [confirmandoVencimiento, setConfirmandoVencimiento] = useState(null) // fecha elegida
  const [confirmandoDesactivacion, setConfirmandoDesactivacion] = useState(null) // código
  const [guardando, setGuardando] = useState(false)
  const [errorAccion, setErrorAccion] = useState('')
  const [errorDesactivacion, setErrorDesactivacion] = useState('')

  function abrirAccion(nueva) {
    setErrorAccion('')
    setAccion(nueva)
  }

  function cerrarAccion() {
    setAccion(null)
    setErrorAccion('')
  }

  async function guardar(datosAccion) {
    setGuardando(true)
    setErrorAccion('')
    try {
      const problema = await ejecutar(accion, datosAccion)
      if (problema) {
        setErrorAccion(problema.message)
        return
      }
      setAccion(null)
      setConfirmandoVencimiento(null)
    } finally {
      setGuardando(false)
    }
  }

  async function confirmarDesactivacion() {
    setGuardando(true)
    setErrorDesactivacion('')
    try {
      const problema = await ejecutar('desactivarAdicional', confirmandoDesactivacion)
      if (problema) {
        setErrorDesactivacion(problema.message)
        return
      }
      setConfirmandoDesactivacion(null)
    } finally {
      setGuardando(false)
    }
  }

  if (cargando && !datos) return <Loader texto="Cargando suscripción…" />

  if (error) {
    return (
      <div className="space-y-4">
        <Alert>{error}</Alert>
        <Button variante="secundario" onClick={recargar}>
          Reintentar
        </Button>
      </div>
    )
  }

  if (!datos) return null

  const { suscripcion, planes, adicionales } = datos

  return (
    <div>
      <EstadoSuscripcion suscripcion={suscripcion} />
      <AccionesSuscripcion onSeleccionar={abrirAccion} />
      <FuncionesIncluidas funciones={suscripcion.funciones_efectivas ?? []} />
      <Adicionales
        adicionales={adicionales ?? []}
        onActivar={() => abrirAccion('adicional')}
        onDesactivar={(codigo) => {
          setErrorDesactivacion('')
          setConfirmandoDesactivacion(codigo)
        }}
      />
      <HistorialPagos pagos={suscripcion.pagos ?? []} />

      <ModalesSuscripcion
        accion={accion}
        onCerrarAccion={cerrarAccion}
        suscripcion={suscripcion}
        planes={planes}
        guardando={guardando}
        errorAccion={errorAccion}
        onGuardar={guardar}
        onSolicitarVencimiento={(vence) => {
          setErrorAccion('')
          setConfirmandoVencimiento(vence)
        }}
        confirmandoVencimiento={confirmandoVencimiento}
        onCerrarVencimiento={() => {
          setConfirmandoVencimiento(null)
          setErrorAccion('')
        }}
        onConfirmarVencimiento={() => guardar({ vence_en: confirmandoVencimiento })}
        confirmandoDesactivacion={confirmandoDesactivacion}
        errorDesactivacion={errorDesactivacion}
        onConfirmarDesactivacion={confirmarDesactivacion}
        onCerrarDesactivacion={() => {
          setConfirmandoDesactivacion(null)
          setErrorDesactivacion('')
        }}
      />
    </div>
  )
}
