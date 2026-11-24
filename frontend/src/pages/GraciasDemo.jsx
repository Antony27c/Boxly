import { useId, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import Textarea from '@/components/ui/Textarea'
import ElegirPlan from '@/components/suscripcion/ElegirPlan'
import { fechasFinDemo, DIAS_PARA_ELEGIR } from '@/components/suscripcion/finDemo'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import useSuscripcion from '@/hooks/useSuscripcion'
import { marcarEncuestaResuelta, responderEncuesta, saltearEncuesta } from '@/services/encuesta'

// "Gracias por probar Boxly" y la encuesta de fin de demo (docs/Oferta.md).

const MAX_TEXTO = 1000
const VACIO = { gusto: '', mejoras: '', sugerencias: '', puntaje: null, intencion: '' }

const PREGUNTAS_ABIERTAS = [
  { campo: 'gusto', label: '¿Qué te gustó?' },
  { campo: 'mejoras', label: '¿Qué mejorarías?' },
  { campo: 'sugerencias', label: '¿Alguna sugerencia?' },
]

const INTENCIONES = [
  { valor: 'contratar', texto: 'Sí' },
  { valor: 'tal_vez', texto: 'Tal vez' },
  { valor: 'no', texto: 'No' },
]

const ETIQUETAS_PUNTAJE = ['Muy malo', 'Malo', 'Regular', 'Bueno', 'Muy bueno']

function mensajeDeError(problema) {
  if (problema?.status === 0)
    return 'No pudimos conectarnos con Boxly. Revisá tu conexión y probá de nuevo.'
  if (problema?.status === 422) return 'Hay una respuesta que no pudimos aceptar. Revisala y probá de nuevo.'
  return problema?.message || 'No pudimos guardar la encuesta. Probá de nuevo en unos minutos.'
}

function Estrella({ llena }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-8 w-8">
      <path
        d="M12 2.8l2.8 5.7 6.3.9-4.6 4.4 1.1 6.3L12 17.1l-5.6 3 1.1-6.3L2.9 9.4l6.3-.9L12 2.8z"
        className={llena ? 'fill-amber stroke-amber' : 'fill-transparent stroke-graphite-500'}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/* Puntaje de 1 a 5 como grupo de radios nativo: las flechas cambian la
   estrella elegida y el lector de pantalla anuncia "3 de 5, Regular". */
function Puntaje({ valor, onCambiar, deshabilitado }) {
  const nombre = useId()
  const [resaltado, setResaltado] = useState(null)
  const visible = resaltado ?? valor ?? 0
  return (
    <fieldset disabled={deshabilitado}>
      <legend className="mb-1.5 text-sm font-medium text-ink">¿Qué puntaje le das a Boxly?</legend>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex" onMouseLeave={() => setResaltado(null)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <label
              key={n}
              className="cursor-pointer rounded-lg p-1 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-amber"
              onMouseEnter={() => setResaltado(n)}
            >
              <input
                type="radio"
                name={nombre}
                value={n}
                checked={valor === n}
                onChange={() => onCambiar(n)}
                className="sr-only"
              />
              <span className="sr-only">{`${n} de 5, ${ETIQUETAS_PUNTAJE[n - 1]}`}</span>
              <Estrella llena={n <= visible} />
            </label>
          ))}
        </div>
        <span className="text-sm text-muted" aria-hidden="true">
          {valor ? ETIQUETAS_PUNTAJE[valor - 1] : 'Sin puntaje'}
        </span>
        {valor && (
          <button
            type="button"
            onClick={() => onCambiar(null)}
            className="rounded-lg px-2 py-1 text-sm text-muted underline-offset-2 hover:text-ink hover:underline"
          >
            Quitar puntaje
          </button>
        )}
      </div>
    </fieldset>
  )
}

function Intencion({ valor, onCambiar, deshabilitado }) {
  const nombre = useId()
  return (
    <fieldset disabled={deshabilitado}>
      <legend className="mb-1.5 text-sm font-medium text-ink">¿Pensás contratar Boxly?</legend>
      <div className="flex flex-wrap gap-2">
        {INTENCIONES.map((opcion) => {
          const elegida = valor === opcion.valor
          return (
            <label
              key={opcion.valor}
              className={`inline-flex min-h-10 cursor-pointer items-center rounded-full border px-4 text-sm font-medium transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-amber ${
                elegida
                  ? 'border-amber bg-amber text-sobre-amber'
                  : 'border-graphite-600 bg-graphite-800 text-ink hover:border-graphite-500'
              }`}
            >
              <input
                type="radio"
                name={nombre}
                value={opcion.valor}
                checked={elegida}
                onChange={() => onCambiar(opcion.valor)}
                className="sr-only"
              />
              {opcion.texto}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

export default function GraciasDemo() {
  const { token } = useAuth()
  const { avisar } = useToast()
  const navegar = useNavigate()
  const { suscripcion, recargar } = useSuscripcion()
  const [datos, setDatos] = useState(VACIO)
  const [error, setError] = useState('')
  const [accion, setAccion] = useState(null) // 'enviar' | 'saltear' mientras espera
  const fechas = fechasFinDemo(suscripcion?.vence_en)
  const ocupado = accion !== null

  function cambiar(campo, valor) {
    setDatos((previo) => ({ ...previo, [campo]: valor }))
    if (error) setError('')
  }

  function irASuscripcion() {
    marcarEncuestaResuelta(token)
    navegar('/suscripcion', { replace: true })
  }

  async function ejecutar(tipo, pedido, aviso) {
    setAccion(tipo)
    setError('')
    try {
      await pedido()
      if (aviso) avisar(aviso)
      irASuscripcion()
    } catch (problema) {
      // 409: ya se respondió (quizás desde otra pestaña): no hay nada más que hacer acá.
      if (problema?.status === 409) {
        irASuscripcion()
        return
      }
      setError(mensajeDeError(problema))
      setAccion(null)
    }
  }

  function enviar(evento) {
    evento.preventDefault()
    if (ocupado) return
    const cuerpo = {}
    for (const { campo } of PREGUNTAS_ABIERTAS) {
      const valor = datos[campo].trim()
      if (valor) cuerpo[campo] = valor
    }
    if (datos.puntaje) cuerpo.puntaje = datos.puntaje
    if (datos.intencion) cuerpo.intencion = datos.intencion
    // Sin ninguna respuesta, "Enviar" equivale a saltearla.
    if (Object.keys(cuerpo).length === 0) {
      ejecutar('enviar', () => saltearEncuesta(token))
      return
    }
    ejecutar('enviar', () => responderEncuesta(cuerpo, token), '¡Gracias por tus respuestas!')
  }

  function ahoraNo() {
    if (ocupado) return
    ejecutar('saltear', () => saltearEncuesta(token))
  }

  return (
    <div className="animate-bay-in mx-auto max-w-2xl">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-texto">Fin de la demo</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Gracias por probar Boxly</h1>
      <p className="mt-3 text-muted">
        Nos alegra que le hayas dado una oportunidad en tu taller. Tu opinión nos ayuda a mejorarlo.
      </p>

      <div className="mt-6 rounded-box border border-amber/40 bg-amber/10 p-4 text-sm">
        <p className="font-semibold text-ink">
          {fechas ? `Tu demo terminó el ${fechas.termino}.` : 'Tu demo terminó.'}
        </p>
        <p className="mt-1 text-muted">
          {fechas
            ? `Tenés hasta el ${fechas.limite} para elegir un plan. Mientras tanto, Boxly queda en solo lectura: podés ver todo, pero no cargar nada nuevo.`
            : `Tenés ${DIAS_PARA_ELEGIR} días para elegir un plan. Mientras tanto, Boxly queda en solo lectura: podés ver todo, pero no cargar nada nuevo.`}{' '}
          Si no elegís uno, después el acceso se suspende.
        </p>
      </div>

      {/* Cómo seguir (V2): con la demo, Pro preseleccionado y destacado. */}
      {suscripcion && (
        <section aria-labelledby="como-seguir" className="mt-6">
          <h2 id="como-seguir" className="text-lg font-semibold">
            Cómo seguir
          </h2>
          <ElegirPlan
            suscripcion={suscripcion}
            onCambio={recargar}
            antesDeIrAPagar={() => marcarEncuestaResuelta(token)}
          />
        </section>
      )}

      <form
        onSubmit={enviar}
        noValidate
        aria-busy={ocupado}
        className="mt-6 space-y-5 rounded-box border border-graphite-600 bg-graphite-800 p-5 sm:p-6"
      >
        <div>
          <h2 className="text-lg font-semibold">Una encuesta cortita</h2>
          <p className="mt-1 text-sm text-muted">Todas las preguntas son opcionales.</p>
        </div>

        {error && <Alert>{error}</Alert>}

        {PREGUNTAS_ABIERTAS.map(({ campo, label }) => (
          <Textarea
            key={campo}
            label={label}
            rows={3}
            maxLength={MAX_TEXTO}
            value={datos[campo]}
            onChange={(e) => cambiar(campo, e.target.value)}
            disabled={ocupado}
          />
        ))}
        <Puntaje valor={datos.puntaje} onCambiar={(n) => cambiar('puntaje', n)} deshabilitado={ocupado} />
        <Intencion
          valor={datos.intencion}
          onCambiar={(v) => cambiar('intencion', v)}
          deshabilitado={ocupado}
        />

        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button type="button" variante="fantasma" onClick={ahoraNo} cargando={accion === 'saltear'} disabled={ocupado}>
            Ahora no
          </Button>
          <Button type="submit" cargando={accion === 'enviar'} disabled={ocupado}>
            {accion === 'enviar' ? 'Enviando…' : 'Enviar'}
          </Button>
        </div>
      </form>
    </div>
  )
}
