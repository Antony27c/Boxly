import { useState } from 'react'
import TarjetaDash from '@/components/dashboard/TarjetaDash'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { sistemaService } from '@/services/sistema'

/**
 * Pestaña "Respaldo" del panel del taller (administrador): descarga los CSV
 * del propio taller desde /api/v1/taller/respaldo. Contrato en
 * docs/Plataforma.md (P3).
 */
export default function RespaldoTaller() {
  const { token } = useAuth()
  const { avisar } = useToast()
  const [descargando, setDescargando] = useState(false)
  const [error, setError] = useState('')

  async function descargar() {
    setDescargando(true)
    setError('')
    try {
      await sistemaService.descargarRespaldo(token)
      avisar('Respaldo descargado.')
    } catch (problema) {
      setError(problema.message ?? 'No pudimos descargar el respaldo.')
    } finally {
      setDescargando(false)
    }
  }

  return (
    <div className="animate-bay-in">
      <TarjetaDash titulo="Respaldo de tu taller" icono="descarga" indice={0}>
        <p className="text-sm text-muted">
          Descargá todos los datos de tu taller en planillas: un CSV por tabla con
          clientes, vehículos, órdenes, turnos, inventario y pagos. No incluye
          contraseñas ni tokens.
        </p>
        <div className="mt-4">
          <Button
            variante="secundario"
            icono="descarga"
            cargando={descargando}
            onClick={descargar}
          >
            Descargar respaldo
          </Button>
        </div>
        {error && (
          <div className="mt-3">
            <Alert>{error}</Alert>
          </div>
        )}
      </TarjetaDash>
    </div>
  )
}
