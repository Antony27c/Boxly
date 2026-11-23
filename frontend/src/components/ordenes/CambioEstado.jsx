import { useEffect, useRef, useState } from 'react'
import BanderaCuadros from '@/components/ilustraciones/BanderaCuadros'
import LlaveEntregada from '@/components/ilustraciones/LlaveEntregada'
import { TAMANO_MAXIMO, TIPOS_IMAGEN } from '@/components/ordenes/ImagenesOrden'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import Field from '@/components/ui/Field'
import Textarea from '@/components/ui/Textarea'
import { useAuth } from '@/context/AuthContext'
import { DESCRIPCION_ESTADOS, ordenesService, proximosEstados } from '@/services/ordenes'
import '@/styles/ordenes.css'

// Comentarios listos para tocar según la etapa a la que se pasa la orden.
const SUGERENCIAS = {
  Ingresado: ['Auto recibido en el taller.', 'Auto recibido con turno.'],
  'En diagnóstico': ['Empiezo la revisión.', 'Se revisa la falla reportada.'],
  'Esperando repuestos': ['Se pidió el repuesto.', 'Falta repuesto, se avisa al cliente.'],
  Listo: ['Trabajo terminado, probado y listo para retirar.'],
  Entregado: ['Auto entregado al cliente.'],
  Cancelado: ['El cliente no aceptó el presupuesto.'],
}

// Guiño breve al cerrar el trabajo (Listo) o entregar el auto. El texto repite
// lo que dice el dibujo; con movimiento reducido no se muestra y el modal se
// cierra enseguida, como antes.
export const DURACION_GUINO = 1500
const GUINOS = {
  Listo: {
    texto: 'Auto listo para retirar.',
    Dibujo: BanderaCuadros,
    clase: 'guino-bandera',
  },
  Entregado: {
    texto: 'Auto entregado al cliente.',
    Dibujo: LlaveEntregada,
    clase: 'guino-llave',
  },
}

function movimientoReducido() {
  if (typeof document !== 'undefined' && document.documentElement.classList.contains('reducir-movimiento')) {
    return true
  }
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export default function CambioEstado({ orden, puedeCobrar = false, destinoInicial = '', onListo, onCancelar }) {
  const { token } = useAuth()
  const [guino, setGuino] = useState('')
  const alListo = useRef(onListo)
  const guinoPendiente = useRef(null)

  useEffect(() => {
    alListo.current = onListo
  })

  // Si el modal se cierra durante el guiño el cambio ya está guardado:
  // se avisa igual para que la pantalla se recargue.
  useEffect(
    () => () => {
      const pendiente = guinoPendiente.current
      if (!pendiente) return
      guinoPendiente.current = null
      clearTimeout(pendiente.temporizador)
      alListo.current(...pendiente.resultado)
    },
    [],
  )

  const opciones = proximosEstados(orden.estado)
  const [nuevo, setNuevo] = useState(() => {
    if (destinoInicial && opciones.includes(destinoInicial)) return destinoInicial
    return opciones.find((estado) => estado !== 'Cancelado') ?? opciones[0] ?? ''
  })
  const [descripcion, setDescripcion] = useState('')
  const [monto, setMonto] = useState(() => String(Number(orden.costo_estimado) || ''))
  const [errorMonto, setErrorMonto] = useState('')
  const [fotos, setFotos] = useState([])
  const [error, setError] = useState('')
  const [errorApi, setErrorApi] = useState('')
  const [guardando, setGuardando] = useState(false)

  // El monto a cobrar solo lo cargan recepción y administración: el mecánico
  // no pone precios ni emite cobros (S3, el backend le responde 403). Con
  // líneas a cotizar el cobro lo rechaza el backend (409): tampoco se pide.
  const pideMonto =
    puedeCobrar &&
    nuevo === 'Listo' &&
    !orden.cobro_estado &&
    !orden.pagada &&
    !(Number(orden.lineas_a_cotizar ?? 0) > 0)

  async function enviar(evento) {
    evento.preventDefault()
    const texto = descripcion.trim()
    if (texto.length < 5) {
      setError('Contá qué se hizo en esta etapa (mínimo 5 caracteres).')
      return
    }
    if (pideMonto && String(monto).trim() !== '' && !(Number(monto) > 0)) {
      setErrorMonto('El monto tiene que ser mayor a 0, o dejalo vacío para emitirlo después.')
      return
    }

    setGuardando(true)
    setErrorApi('')
    try {
      await ordenesService.cambiarEstado(orden.id, nuevo, texto, token)
    } catch (problema) {
      setErrorApi(problema.message)
      setGuardando(false)
      return
    }

    let errorCobro = ''
    if (pideMonto && Number(monto) > 0) {
      try {
        await ordenesService.emitirCobro(orden.id, monto, token)
      } catch (problema) {
        errorCobro = problema.message
      }
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
    const resultado = [nuevo, fallidas, errorCobro]
    if (!GUINOS[nuevo] || movimientoReducido()) {
      onListo(...resultado)
      return
    }
    setGuino(nuevo)
    guinoPendiente.current = {
      resultado,
      temporizador: setTimeout(() => {
        guinoPendiente.current = null
        alListo.current(...resultado)
      }, DURACION_GUINO),
    }
  }

  const datosGuino = GUINOS[guino]
  const ocupado = guardando || Boolean(guino)

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
                disabled={ocupado}
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

      {(SUGERENCIAS[nuevo] ?? []).length > 0 && (
        <div>
          <p className="mb-1.5 text-sm font-medium text-ink">Comentarios rápidos</p>
          <div className="flex flex-wrap gap-2">
            {SUGERENCIAS[nuevo].map((texto) => (
              <button
                key={texto}
                type="button"
                onClick={() => {
                  setDescripcion(texto)
                  if (error) setError('')
                }}
                className="rounded-full border border-graphite-600 px-3 py-1.5 text-xs text-muted transition-colors hover:border-amber hover:text-ink"
              >
                {texto}
              </button>
            ))}
          </div>
        </div>
      )}

      <Textarea
        label="Descripción de la etapa"
        value={descripcion}
        onChange={(e) => {
          setDescripcion(e.target.value)
          if (error) setError('')
        }}
        error={error}
        disabled={ocupado}
        placeholder="Se revisó el tren delantero: bujes gastados, hay que cambiarlos."
        ayuda="Queda guardada en el historial de la orden."
      />

      {pideMonto && (
        <Field
          label={puedeCobrar ? 'Monto a cobrar (opcional)' : 'Monto a cobrar (opcional, lo aprueba recepción)'}
          inputMode="numeric"
          value={monto}
          onChange={(e) => {
            setMonto(e.target.value)
            if (errorMonto) setErrorMonto('')
          }}
          error={errorMonto}
          disabled={ocupado}
          placeholder="Ej.: 185000"
          ayuda={
            puedeCobrar
              ? 'Si lo completás, el cobro le llega al cliente y puede pagarlo online.'
              : 'Queda pendiente hasta que administración o recepción lo apruebe.'
          }
        />
      )}

      <div>
        <label className="mb-1.5 block text-sm font-medium text-ink">
          Fotos de la etapa (opcional)
        </label>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          disabled={ocupado}
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

      {datosGuino && (
        <div
          role="status"
          className="flex items-center gap-3 rounded-box border border-ok/40 bg-ok/10 p-3 text-sm font-medium text-ok"
        >
          <datosGuino.Dibujo className={`h-9 w-9 ${datosGuino.clase}`} />
          {datosGuino.texto}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variante="fantasma" onClick={onCancelar} disabled={ocupado}>
          Cancelar
        </Button>
        <Button
          type="submit"
          variante={nuevo === 'Cancelado' ? 'peligro' : 'primario'}
          cargando={guardando}
          disabled={!nuevo || Boolean(guino)}
        >
          {guardando ? 'Guardando…' : `Pasar a ${nuevo}`}
        </Button>
      </div>
    </form>
  )
}
