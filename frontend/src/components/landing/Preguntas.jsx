import { useId, useRef, useState } from 'react'
import Icono from '@/components/ui/Icono'

// Sección "preguntas" de la landing (tarea L3, docs/Landing.md). Respuestas basadas en
// docs/Suscripciones.md, docs/Plataforma.md y docs/Guia-de-uso.md.
// Acordeón accesible: cada pregunta es un <button aria-expanded> que controla su
// <div role="region">. Flechas arriba/abajo, Inicio y Fin se mueven entre preguntas.
// Los datos, el respaldo y el soporte se explican en la sección Seguridad: acá se remite.
function EnlaceSeguridad() {
  return (
    <a href="#seguridad" className="font-semibold text-amber-texto hover:underline">
      Seguridad y privacidad
    </a>
  )
}

const PREGUNTAS = [
  {
    pregunta: '¿Cómo funciona la prueba gratis?',
    respuesta: [
      'Son 30 días con todas las funciones, desde que damos de alta tu taller. Para empezar no tenés que pagar nada.',
      'Antes de que termine, elegís el plan según el tamaño de tu equipo y pagás el primer mes.',
    ],
  },
  {
    pregunta: '¿Qué pasa si me atraso con el pago?',
    respuesta: [
      'Durante los primeros 7 días después del vencimiento seguís trabajando normal, con un aviso para que regularices.',
      'Del día 8 al 30 el taller pasa a solo lectura: todos pueden mirar, pero no se registra nada nuevo. Desde el día 31 queda suspendido y solo el administrador entra, a la pantalla de suscripción, para pagar.',
      'Tus datos nunca se borran solos. Cuando pagás, todo vuelve a la normalidad.',
    ],
  },
  {
    pregunta: '¿Puedo cambiar de plan?',
    respuesta: [
      'Sí, cuando quieras, desde la pantalla de suscripción. El cambio rige en el momento y el precio nuevo se cobra desde el próximo período.',
      'Para bajar a un plan más chico, tu equipo activo tiene que entrar en el límite de ese plan.',
    ],
  },
  {
    pregunta: '¿Quién ve los datos de mis clientes?',
    respuesta: [
      'Tu equipo, y cada persona ve solo lo que necesita su rol.',
      <>
        Boxly no los ve, salvo que vos nos des acceso para ayudarte. Cómo funciona ese acceso
        lo contamos en <EnlaceSeguridad />.
      </>,
    ],
  },
  {
    pregunta: '¿Puedo llevarme mis datos?',
    respuesta: [
      <>
        Sí, cuando quieras y sin pedirnos nada: el administrador descarga el respaldo desde la
        app. Más detalles en <EnlaceSeguridad />.
      </>,
    ],
  },
  {
    pregunta: '¿En cuántos dispositivos lo puedo usar?',
    respuesta: [
      'En los que quieras. Boxly funciona en el navegador de la computadora, la tablet o el celular, y se adapta a la pantalla.',
      'El plan limita la cantidad de personas del equipo, no los dispositivos: cada persona entra con su usuario desde donde le quede cómodo.',
    ],
  },
  {
    pregunta: '¿Mis clientes tienen que instalar algo?',
    respuesta: [
      'No. Tus clientes entran a su portal desde el navegador con su correo y una contraseña que eligen ellos. Ahí ven el estado de su auto, las fotos del trabajo y pagan online si tu taller lo tiene habilitado.',
      'Si un cliente no quiere usar el portal, no pasa nada: lo atendés como siempre.',
    ],
  },
  {
    pregunta: '¿Cómo pago la suscripción?',
    respuesta: [
      'Todos los meses, en pesos, por transferencia o con débito automático de Mercado Pago. El débito automático lo activás o lo cancelás con un botón desde la pantalla de suscripción.',
    ],
  },
  {
    pregunta: '¿El mecánico ve o carga precios?',
    respuesta: [
      'No. El mecánico carga los trabajos y los repuestos que usó, pero sin precios: el repuesto toma el precio del inventario y la mano de obra queda "a cotizar".',
      'Recepción o el administrador le ponen precio, y mientras quede algo sin cotizar no se puede emitir el cobro.',
    ],
  },
]

export default function Preguntas() {
  const base = useId()
  const [abierta, setAbierta] = useState(null)
  const botones = useRef([])

  function alternar(indice) {
    setAbierta((actual) => (actual === indice ? null : indice))
  }

  function moverFoco(evento, indice) {
    const total = PREGUNTAS.length
    const destino = {
      ArrowDown: (indice + 1) % total,
      ArrowUp: (indice - 1 + total) % total,
      Home: 0,
      End: total - 1,
    }[evento.key]
    if (destino === undefined) return
    evento.preventDefault()
    botones.current[destino]?.focus()
  }

  return (
    <section
      id="preguntas"
      aria-labelledby="preguntas-titulo"
      className="landing-seccion scroll-mt-20"
    >
      <div className="landing-caja">
        <p className="landing-chip">
          Preguntas frecuentes
        </p>
        <h2
          id="preguntas-titulo"
          className="landing-titulo mt-3"
        >
          Lo que nos preguntan los talleres
        </h2>

        <div className="landing-tarjeta mt-10 max-w-3xl divide-y divide-graphite-600 !p-0 overflow-hidden">
          {PREGUNTAS.map((item, i) => {
            const idBoton = `${base}-pregunta-${i}`
            const idPanel = `${base}-respuesta-${i}`
            const expandida = abierta === i
            return (
              <div key={item.pregunta}>
                <h3>
                  <button
                    ref={(nodo) => {
                      botones.current[i] = nodo
                    }}
                    type="button"
                    id={idBoton}
                    aria-expanded={expandida}
                    aria-controls={idPanel}
                    onClick={() => alternar(i)}
                    onKeyDown={(evento) => moverFoco(evento, i)}
                    className="flex min-h-[44px] w-full items-center justify-between gap-4 px-5 py-4 text-left font-semibold text-ink transition hover:bg-graphite-700/60"
                  >
                    <span>{item.pregunta}</span>
                    <Icono
                      nombre="abajo"
                      className={`h-5 w-5 text-amber-texto transition-transform duration-200 ${
                        expandida ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                </h3>
                <div
                  id={idPanel}
                  role="region"
                  aria-labelledby={idBoton}
                  hidden={!expandida}
                  className="space-y-3 px-5 pb-5 text-sm leading-relaxed text-muted"
                >
                  {item.respuesta.map((parrafo, j) => (
                    <p key={j}>{parrafo}</p>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
