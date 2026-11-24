import { useState } from 'react'
import { repuestosService } from '@/services/repuestos'
import { STOCK_MAXIMO } from '@/utils/validation'

/* Ingreso de mercadería de un repuesto: cantidad, validación y guardado. */
export default function useIngresoStock({ token, setAviso, recargarTodo }) {
  const [repuesto, setRepuesto] = useState(null)
  const [cantidad, setCantidad] = useState('')
  const [errorCantidad, setErrorCantidad] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  function abrir(elegido) {
    setRepuesto(elegido)
    setCantidad('')
    setErrorCantidad('')
    setError('')
  }

  function cambiarCantidad(valor) {
    setCantidad(valor)
    if (errorCantidad) setErrorCantidad('')
  }

  async function ingresar(evento) {
    evento.preventDefault()
    const numero = Number(cantidad)
    if (!Number.isInteger(numero) || numero < 1) {
      setErrorCantidad('Ingresá una cantidad entera mayor a 0.')
      return
    }
    if (Number(repuesto.stock) + numero > STOCK_MAXIMO) {
      setErrorCantidad('Con esa cantidad el stock supera el máximo permitido.')
      return
    }
    setGuardando(true)
    setError('')
    try {
      await repuestosService.ingresarStock(repuesto, numero, token)
      setAviso(`Ingresaron ${numero} unidades de ${repuesto.nombre}.`)
      setRepuesto(null)
      await recargarTodo()
    } catch (problema) {
      setError(problema.message)
    } finally {
      setGuardando(false)
    }
  }

  return {
    repuesto,
    cantidad,
    errorCantidad,
    error,
    guardando,
    abrir,
    cambiarCantidad,
    ingresar,
    cerrar: () => setRepuesto(null),
  }
}
