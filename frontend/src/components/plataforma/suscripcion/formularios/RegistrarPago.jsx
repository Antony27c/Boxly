import { useState } from 'react'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import Field from '@/components/ui/Field'
import Select from '@/components/ui/Select'
import { hoyAR } from '@/lib/fechas'
import { formatearMontoAR, MENSAJE_MONTO_INVALIDO, parsearMontoAR } from '@/lib/montos'

const MESES = Array.from({ length: 12 }, (_, i) => ({
  valor: String(i + 1),
  texto: i + 1 === 1 ? '1 mes' : `${i + 1} meses`,
}))

/* Registro de pago manual o cortesía: monto sugerido = precio del plan ×
   meses (editable, formato argentino), meses 1–12, fecha y referencia
   opcional. Monto 0 = cortesía. */
export default function RegistrarPago({ precioMensual, guardando, error, onGuardar, onCancelar }) {
  const [meses, setMeses] = useState('1')
  const [monto, setMonto] = useState(() =>
    formatearMontoAR(Number(precioMensual ?? 0)),
  )
  const [referencia, setReferencia] = useState('')
  const [fecha, setFecha] = useState(hoyAR)
  const [errorMonto, setErrorMonto] = useState('')

  // El monto sugerido es el precio del plan por la cantidad de meses; queda
  // editable por si el pago fue otro monto (señas, descuentos, cortesía = 0).
  function cambiarMeses(valor) {
    setMeses(valor)
    setMonto(formatearMontoAR(Number(precioMensual ?? 0) * Number(valor)))
  }

  function enviar(e) {
    e.preventDefault()
    if (monto.trim() === '') {
      setErrorMonto('Ingresá el monto del pago.')
      return
    }
    const numero = parsearMontoAR(monto)
    if (numero === null) {
      setErrorMonto(MENSAJE_MONTO_INVALIDO)
      return
    }
    setErrorMonto('')
    onGuardar({
      monto: numero,
      meses: Number(meses),
      fecha: fecha || undefined,
      referencia: referencia.trim() || undefined,
    })
  }

  return (
    <form onSubmit={enviar} noValidate className="space-y-4">
      {error && <Alert>{error}</Alert>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select
          label="Meses"
          value={meses}
          onChange={(e) => cambiarMeses(e.target.value)}
          opciones={MESES}
          disabled={guardando}
        />
        <Field
          label="Monto"
          inputMode="decimal"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          error={errorMonto}
          disabled={guardando}
          placeholder="Ej.: 79.000 o 79.000,50"
          ayuda="Sugerido: precio del plan × meses. 0 si es una cortesía."
        />
      </div>

      <Field
        label="Fecha del pago"
        type="date"
        value={fecha}
        onChange={(e) => setFecha(e.target.value)}
        disabled={guardando}
      />

      <Field
        label="Referencia"
        value={referencia}
        onChange={(e) => setReferencia(e.target.value)}
        disabled={guardando}
        placeholder="Ej.: n.º de comprobante"
        ayuda="Opcional: comprobante, captura o nota."
      />

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variante="fantasma" onClick={onCancelar} disabled={guardando}>
          Cancelar
        </Button>
        <Button type="submit" cargando={guardando}>
          Registrar
        </Button>
      </div>
    </form>
  )
}
