import { useRef, useState } from 'react'
import Icono from '@/components/ui/Icono'

// Funciones por rol (docs/Landing.md, tarea L2). Todo sale de lo que Boxly hace
// hoy: el menú de cada rol (routes/navegacion.js) y docs/Guia-de-uso.md.
// No sumar nada que el sistema no tenga.
const ROLES_LANDING = [
  {
    id: 'recepcion',
    nombre: 'Recepción',
    resumen: 'El mostrador: turnos, clientes, órdenes y cobros en una sola pantalla.',
    funciones: [
      {
        icono: 'turnos',
        titulo: 'Turnos sin superposiciones',
        texto: 'Agenda de lunes a sábado con un auto por horario. Cuando el cliente llega, "Recibir auto" abre la orden con todo cargado.',
      },
      {
        icono: 'clientes',
        titulo: 'Alta de cliente y vehículo',
        texto: 'Un asistente de tres pasos. Si el DNI o el teléfono ya existen, Boxly te avisa para no cargarlo dos veces.',
      },
      {
        icono: 'vehiculos',
        titulo: 'Recibir un auto con la patente',
        texto: 'Escribís la patente y Boxly busca el resto. Contás el trabajo, elegís mecánico y entrega estimada.',
      },
      {
        icono: 'dinero',
        titulo: 'Cotizar y cobrar',
        texto: 'Le ponés precio a las líneas "a cotizar" y emitís el cobro. Con el cobro online habilitado, el cliente lo paga desde su portal.',
      },
      {
        icono: 'inventario',
        titulo: 'Repuestos con stock',
        texto: 'Inventario de repuestos con su precio y su stock, y aviso de stock bajo en la pantalla de hoy.',
      },
    ],
  },
  {
    id: 'mecanico',
    nombre: 'Mecánico',
    resumen: 'Su trabajo del día, ordenado, sin precios ni planillas.',
    funciones: [
      {
        icono: 'hoy',
        titulo: 'Mi trabajo',
        texto: 'Solo sus órdenes abiertas, ordenadas por lo que hay que hacer primero y con el botón de la acción que le toca.',
      },
      {
        icono: 'ordenes',
        titulo: 'Etapas con comentario',
        texto: 'Ingresado, en diagnóstico, esperando repuestos, listo. Cada paso deja un comentario que el cliente ve en su seguimiento.',
      },
      {
        icono: 'foto',
        titulo: 'Fotos de cada etapa',
        texto: 'Sube fotos desde el celular al cambiar de etapa o desde la pestaña Fotos de la orden.',
      },
      {
        icono: 'herramienta',
        titulo: 'Trabajos y repuestos sin precio',
        texto: 'Carga lo que hizo y lo que usó del inventario. El repuesto toma su precio solo y la mano de obra queda "a cotizar".',
      },
      {
        icono: 'horarios',
        titulo: 'Su horario',
        texto: 'Ve las franjas que le cargó el administrador.',
      },
    ],
  },
  {
    id: 'administrador',
    nombre: 'Administrador',
    resumen: 'Todo lo de recepción, más el control del negocio y de los datos.',
    funciones: [
      {
        icono: 'dashboard',
        titulo: 'Métricas del taller',
        texto: 'Órdenes cerradas, facturado, tiempo promedio de trabajo y órdenes por mecánico, comparando períodos.',
      },
      {
        icono: 'usuarios',
        titulo: 'Personal y horarios',
        texto: 'Alta y baja de usuarios del taller y las franjas horarias de cada mecánico.',
      },
      {
        icono: 'dinero',
        titulo: 'Tu suscripción',
        texto: 'Ves tu plan, hasta cuándo está pago y el historial de pagos, y activás o cancelás el débito automático con Mercado Pago.',
      },
    ],
    // Respaldo, auditoría y soporte se cuentan una sola vez, en la sección Seguridad.
    enlace: { href: '#seguridad', texto: 'Respaldo, auditoría y acceso de soporte bajo tu control' },
  },
  {
    id: 'cliente',
    nombre: 'Cliente',
    resumen: 'Tus clientes siguen su auto desde el celular, sin llamar al taller.',
    funciones: [
      {
        icono: 'portal',
        titulo: 'Portal propio',
        texto: 'Entra con su correo y ve sus órdenes: la etapa actual, la entrega estimada y el total.',
      },
      {
        icono: 'historial',
        titulo: 'Seguimiento del trabajo',
        texto: 'El recorrido completo de la orden, con la descripción y las fotos que subió el taller en cada etapa.',
      },
      {
        icono: 'correo',
        titulo: 'Avisos por correo',
        texto: 'Le llega un correo cuando su orden cambia de etapa y cuando el taller emite el cobro.',
      },
      {
        icono: 'dinero',
        titulo: 'Pago online',
        texto: 'Paga el cobro con Mercado Pago desde el portal, si el taller tiene el cobro online habilitado.',
      },
    ],
  },
]

// Pestañas accesibles (patrón tablist de WAI-ARIA): foco itinerante, flechas,
// Inicio y Fin. Todos los paneles están en el HTML; los inactivos van `hidden`.
export default function Funciones() {
  const [activo, setActivo] = useState(0)
  const pestanas = useRef([])

  function elegir(indice) {
    const total = ROLES_LANDING.length
    const siguiente = (indice + total) % total
    setActivo(siguiente)
    pestanas.current[siguiente]?.focus()
  }

  function alTeclear(evento) {
    const acciones = {
      ArrowRight: () => elegir(activo + 1),
      ArrowDown: () => elegir(activo + 1),
      ArrowLeft: () => elegir(activo - 1),
      ArrowUp: () => elegir(activo - 1),
      Home: () => elegir(0),
      End: () => elegir(ROLES_LANDING.length - 1),
    }
    const accion = acciones[evento.key]
    if (!accion) return
    evento.preventDefault()
    accion()
  }

  return (
    <section id="funciones" aria-labelledby="funciones-titulo" className="landing-seccion scroll-mt-20">
      <div className="landing-caja">
        <p className="landing-chip">Funciones</p>
        <h2 id="funciones-titulo" className="landing-titulo mt-3">
          Cada uno ve lo que necesita
        </h2>
        <p className="landing-bajada">
          Recepción, mecánicos, el dueño y tus clientes usan el mismo sistema. Cada rol tiene su menú y solo lo que
          puede usar.
        </p>

        <div
          role="tablist"
          aria-label="Funciones por rol"
          aria-orientation="horizontal"
          className="mt-8 grid grid-cols-2 gap-2 sm:inline-grid sm:grid-cols-4"
        >
          {ROLES_LANDING.map((rol, indice) => {
            const seleccionada = indice === activo
            return (
              <button
                key={rol.id}
                ref={(nodo) => {
                  pestanas.current[indice] = nodo
                }}
                type="button"
                role="tab"
                id={`funciones-pestana-${rol.id}`}
                aria-selected={seleccionada}
                aria-controls={`funciones-panel-${rol.id}`}
                tabIndex={seleccionada ? 0 : -1}
                onClick={() => setActivo(indice)}
                onKeyDown={alTeclear}
                className={`min-h-11 rounded-box border px-4 py-2 text-sm font-semibold transition-colors ${
                  seleccionada
                    ? 'border-amber bg-amber text-sobre-amber'
                    : 'border-graphite-700 bg-graphite-800 text-ink hover:border-graphite-500'
                }`}
              >
                {rol.nombre}
              </button>
            )
          })}
        </div>

        {ROLES_LANDING.map((rol, indice) => (
          <div
            key={rol.id}
            role="tabpanel"
            id={`funciones-panel-${rol.id}`}
            aria-labelledby={`funciones-pestana-${rol.id}`}
            hidden={indice !== activo}
            tabIndex={0}
            className="mt-6 rounded-box"
          >
            <p className="font-semibold">{rol.resumen}</p>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rol.funciones.map((funcion) => (
                <li
                  key={funcion.titulo}
                  className="landing-tarjeta relative overflow-hidden"
                >
                  <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-amber" />
                  <span
                    aria-hidden="true"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-box border border-amber/40 bg-amber/10 text-amber-texto"
                  >
                    <Icono nombre={funcion.icono} className="h-5 w-5" />
                  </span>
                  <h3 className="mt-3 text-base font-bold">{funcion.titulo}</h3>
                  <p className="mt-1 text-sm text-muted">{funcion.texto}</p>
                </li>
              ))}
            </ul>
            {rol.enlace && (
              <a
                href={rol.enlace.href}
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-amber-texto hover:underline"
              >
                {rol.enlace.texto}
                <Icono nombre="flecha" className="h-4 w-4" />
              </a>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
