import { useState } from 'react'
import { TAMANO_MAXIMO, TIPOS_IMAGEN } from '@/components/ordenes/ImagenesOrden'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import Field from '@/components/ui/Field'
import Textarea from '@/components/ui/Textarea'
import { useAuth } from '@/context/AuthContext'
import { DESCRIPCION_ESTADOS, ordenesService, proximosEstados } from '@/services/ordenes'

export default function CambioEstado({ orden, puedeCobrar = false, onListo, onCancelar }) {
  const { token } = useAuth()
  const opciones = proximosEstados(orden.estado)
  const [nuevo, setNuevo] = useState(opciones.find((estado) => estado !== 'Cancelado') ?? opciones[0] ?? '')
  const [descripcion, setDescripcion] = useState('')
  const [monto, setMonto] = useState(() => String(Number(orden.costo_final) || orden.total || ''))
  const [errorMonto, setErrorMonto] = useState('')
  const [fotos, setFotos] = useState([])
  const [error, setError] = useState('')
  const [errorApi, setErrorApi] = useState('')
  const [guardando, setGuardando] = useState(false)

  const pideMonto = puedeCobrar && nuevo === 'Listo'

  async function enviar(evento) {
    evento.preventDefault()
    const texto = descripcion.trim()
    if (texto.length < 5) {
      setError('Contá qué se hizo en esta etapa (mínimo 5 caracteres).')
      return
    }
    if (pideMonto && !(Number(monto) > 0)) {
      setErrorMonto('Poné el monto final que va a pagar el cliente.')
      return
    }

    setGuardando(true)
    setErrorApi('')
    try {
      await ordenesService.cambiarEstado(orden.id, nuevo, texto, token, pideMonto ? monto : null)
    } catch (problema) {
      setErrorApi(problema.message)
      setGuardando(false)
      return
    }

    // El cambio de etapa ya quedó guardado: si alguna foto falla, reintentar todo duplicaría
    // las fotos que sí subieron (y el mock rechaza el cambio repetido). Se avisa cuáles faltan
    // y se cierra igual.
    const fallidas = []
    for (const foto of fotos) {
      try {
        await ordenesService.subirImagen(orden.id, foto, nuevo, token)
      } catch {
        fallidas.push(foto.name)
      }
    }
    setGuardando(false)
    onListo(nuevo, fallidas)
  }

  return (
    <form onSubmit={enviar} noValidate className="space-y-5">
      {errorApi && <Alert>{errorApi}</Alert>}

      <div className="rounded-box border border-graphite-700 bg-graphite-900 p-3 text-sm">
        <p className="font-medium">Etapa actual: {orden.estado}</p>
        <p className="mt-0.5 text-muted">{DESCRIPCION_ESTADOS[orden.estado]}</p>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">Pasar a</legend>
        <div className="space-y-2">
          {opciones.map((estado) => (
            <label
              key={estado}
              className={`flex cursor-pointer gap-3 rounded-box border p-3 text-sm transition-colors ${
                nuevo === estado
                  ? estado === 'Cancelado'
                    ? 'border-danger bg-danger/10'
                    : 'border-amber bg-amber/10'
                  : 'border-graphite-600 hover:border-graphite-500'
              }`}
            >
              <input
                type="radio"
                name="estado"
                value={estado}
                checked={nuevo === estado}
                onChange={() => setNuevo(estado)}
                disabled={guardando}
                className="mt-1 accent-amber"
              />
              <span>
                <span className="block font-medium">{estado}</span>
                <span className="block text-muted">{DESCRIPCION_ESTADOS[estado]}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <Textarea
        label="Descripción de la etapa"
        value={descripcion}
        onChange={(e) => {
          setDescripcion(e.target.value)
          if (error) setError('')
        }}
        error={error}
        disabled={guardando}
        placeholder="Se revisó el tren delantero: bujes gastados, hay que cambiarlos."
        ayuda="Queda guardada en el historial de la orden."
      />

      {pideMonto && (
        <Field
          label="Monto final a cobrar"
          inputMode="numeric"
          value={monto}
          onChange={(e) => {
            setMonto(e.target.value)
            if (errorMonto) setErrorMonto('')
          }}
          error={errorMonto}
          disabled={guardando}
          placeholder="185000"
          ayuda="Con este monto el cliente puede pagar online desde su portal."
        />
      )}
      {nuevo === 'Listo' && !puedeCobrar && (
        <Alert tipo="info">Recepción va a fijar el monto final a cobrar antes de que el cliente pueda pagar.</Alert>
      )}

      <div>
        <label className="mb-1.5 block text-sm font-medium text-ink">
          Fotos de la etapa (opcional)
        </label>
        <input
          type="file"
          accept={TIPOS_IMAGEN}
          capture="environment"
          multiple
          disabled={guardando}
          onChange={(e) => {
            const elegidas = [...(e.target.files ?? [])]
            const mala = elegidas.find(
              (foto) => !TIPOS_IMAGEN.split(',').includes(foto.type) || foto.size > TAMANO_MAXIMO,
            )
            if (mala) {
              setErrorApi(`"${mala.name}" tiene que ser JPG, PNG o WEBP de hasta 5 MB.`)
              e.target.value = ''
              setFotos([])
              return
            }
            setErrorApi('')
            setFotos(elegidas)
          }}
          className="block w-full text-sm text-muted file:mr-3 file:rounded-box file:border-0 file:bg-graphite-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-ink"
        />
        {fotos.length > 0 && (
          <p className="mt-1.5 text-sm text-muted">
            {fotos.length} {fotos.length === 1 ? 'foto elegida' : 'fotos elegidas'}
          </p>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variante="fantasma" onClick={onCancelar} disabled={guardando}>
          Cancelar
        </Button>
        <Button
          type="submit"
          variante={nuevo === 'Cancelado' ? 'peligro' : 'primario'}
          cargando={guardando}
          disabled={!nuevo}
        >
          {guardando ? 'Guardando…' : `Pasar a ${nuevo}`}
        </Button>
      </div>
    </form>
  )
}
