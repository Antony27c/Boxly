import { useState } from 'react'
import Button from '@/components/ui/Button'
import Confirmacion from '@/components/ui/Confirmacion'
import { useAuth } from '@/context/AuthContext'
import { ordenesService } from '@/services/ordenes'
import { pesos } from '@/utils/formato'

/* Anular el cobro emitido de una orden sin pagar (administración o recepción).
   Pide confirmación porque el link de pago que tenga el cliente deja de
   servir; después se pueden volver a cambiar las líneas y emitir otro. */
export default function AnularCobro({ orden, onListo, disabled = false }) {
  const { token } = useAuth()
  const [abierto, setAbierto] = useState(false)
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState('')

  async function anular() {
    setProcesando(true)
    setError('')
    try {
      await ordenesService.anularCobro(orden.id, token)
      setAbierto(false)
      onListo?.('Cobro anulado. Ya podés cambiar las líneas y emitir otro.')
    } catch (problema) {
      setError(problema.message)
    } finally {
      setProcesando(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        variante="fantasma"
        disabled={disabled}
        onClick={() => {
          setError('')
          setAbierto(true)
        }}
      >
        Anular cobro
      </Button>
      <Confirmacion
        abierto={abierto}
        titulo="Anular el cobro"
        mensaje={`Se anula el cobro de ${pesos(orden.costo_final)}; el link de pago que tenga el cliente deja de servir.`}
        error={error}
        procesando={procesando}
        textoConfirmar="Anular cobro"
        onConfirmar={anular}
        onCerrar={() => (procesando ? null : setAbierto(false))}
      />
    </>
  )
}
