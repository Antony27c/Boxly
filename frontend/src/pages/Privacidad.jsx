import { Link } from 'react-router-dom'
import Encabezado from '@/components/landing/Encabezado'
import Pie from '@/components/landing/Pie'
import Icono from '@/components/ui/Icono'
import useMetaPagina from '@/hooks/useMetaPagina'

// Política de privacidad pública y resumida (tarea L3, docs/Landing.md). Es un
// BORRADOR: dice lo que el sistema hace (docs/Plataforma.md) y tiene que revisarlo un
// abogado antes de publicarse.
const SECCIONES = [
  {
    id: 'ley',
    titulo: 'Marco legal',
    parrafos: [
      'Boxly trata los datos personales según la Ley 25.326 de Protección de los Datos Personales de la República Argentina y sus normas complementarias.',
    ],
  },
  {
    id: 'roles',
    titulo: 'Quién es responsable de qué',
    parrafos: [
      'Cada taller que usa Boxly es el responsable de los datos de sus clientes: decide qué datos carga y para qué los usa.',
      'Boxly es el encargado del tratamiento: guarda y procesa esos datos solo para prestarle el servicio al taller, siguiendo sus instrucciones, y no los usa para fines propios.',
      'Los datos de quienes nos piden una demo desde esta página son de Boxly, y los usamos solo para responder esa consulta.',
    ],
  },
  {
    id: 'datos',
    titulo: 'Qué datos se guardan y para qué',
    items: [
      'Clientes del taller: nombre, DNI, teléfono, correo y dirección, para identificarlos, avisarles del estado del trabajo y darles acceso a su portal.',
      'Vehículos: patente, marca, modelo y año, para el historial de reparaciones.',
      'Órdenes, turnos, fotos del trabajo, repuestos y cobros, que son la operación diaria del taller.',
      'Personal del taller: nombre, correo y rol, para el ingreso y los permisos. Las contraseñas se guardan con un hash, nunca en texto plano.',
      'Registro de auditoría: qué usuario hizo cada acción y cuándo, para la seguridad del taller.',
      'Pedidos de demo: nombre, taller, correo y, si los dejás, teléfono, ciudad y mensaje. También la dirección IP, solo para frenar envíos abusivos.',
    ],
    parrafos: [
      'Los pagos online se hacen en Mercado Pago: los datos de la tarjeta se cargan ahí y Boxly no los recibe.',
    ],
  },
  {
    id: 'seguridad',
    titulo: 'Cómo se protegen',
    items: [
      'Cada taller está aislado: nadie de otro taller puede ver sus datos.',
      'Dentro del taller, cada persona ve solo lo que su rol necesita.',
      'Boxly no ve los datos de los clientes de un taller. Solo puede entrar con un acceso de soporte que otorga el taller: temporal, de solo lectura, con los datos personales enmascarados, revocable y registrado.',
      'El historial de auditoría registra las acciones del taller y cada consulta de soporte.',
      'El taller descarga un respaldo con todos sus datos cuando quiere.',
    ],
  },
  {
    id: 'derechos',
    titulo: 'Tus derechos',
    parrafos: [
      'Como titular de los datos tenés derecho a acceder a ellos, pedir que se rectifiquen si están mal y pedir que se supriman, en forma gratuita y según los plazos de la Ley 25.326.',
      'Si sos cliente de un taller, hacé el pedido al taller, que es el responsable de tus datos; Boxly lo va a ayudar a cumplirlo. Si nos pediste una demo, escribinos directamente a nosotros.',
      'La Agencia de Acceso a la Información Pública, como órgano de control de la Ley 25.326, atiende las denuncias y reclamos por incumplimiento de las normas de protección de datos personales.',
    ],
  },
]

export default function Privacidad() {
  useMetaPagina('Política de privacidad · Boxly', { ruta: '/privacidad' })
  return (
    <div className="landing min-h-screen bg-graphite-900 text-ink">
      <Encabezado />
      <main id="contenido" className="landing-seccion">
        <article className="landing-caja max-w-3xl">
          <p className="landing-chip">
            Legal
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Política de privacidad
          </h1>
          <p className="mt-3 text-muted">
            Versión resumida: qué datos guarda Boxly, para qué y quién responde por ellos.
          </p>

          <div
            role="note"
            className="mt-6 flex items-start gap-2.5 rounded-box border border-amber/50 bg-amber/10 px-4 py-3 text-sm font-semibold text-amber-texto"
          >
            <Icono nombre="alerta" className="mt-0.5 h-4 w-4 shrink-0" />
            <p>Borrador: este texto debe revisarlo un abogado antes de publicarse.</p>
          </div>

          <div className="mt-10 space-y-10">
            {SECCIONES.map((seccion) => (
              <section key={seccion.id} aria-labelledby={`privacidad-${seccion.id}`}>
                <h2
                  id={`privacidad-${seccion.id}`}
                  className="text-xl font-semibold tracking-tight text-ink"
                >
                  {seccion.titulo}
                </h2>
                {seccion.items && (
                  <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted marker:text-amber-texto">
                    {seccion.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
                {seccion.parrafos?.map((parrafo) => (
                  <p key={parrafo} className="mt-3 text-sm leading-relaxed text-muted">
                    {parrafo}
                  </p>
                ))}
              </section>
            ))}

            <section aria-labelledby="privacidad-contacto">
              <h2
                id="privacidad-contacto"
                className="text-xl font-semibold tracking-tight text-ink"
              >
                Contacto
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                Para cualquier consulta sobre tus datos o esta política, escribinos desde el{' '}
                <Link
                  to="/boxly#contacto"
                  className="font-semibold text-amber-texto hover:underline"
                >
                  formulario de contacto
                </Link>
                . Si sos cliente de un taller, también podés hablar directamente con el taller.
              </p>
            </section>
          </div>
        </article>
      </main>
      <Pie />
    </div>
  )
}
