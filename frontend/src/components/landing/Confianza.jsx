import { Link } from 'react-router-dom'
import Icono from '@/components/ui/Icono'

// Sección "seguridad" de la landing (tarea L3, docs/Landing.md). Solo dice lo que el
// sistema hace de verdad (docs/Plataforma.md): nada de sellos ni certificaciones.
const PUNTOS = [
  {
    icono: 'usuarios',
    titulo: 'Tus datos son tuyos',
    texto:
      'El taller es el responsable de los datos de sus clientes y Boxly es el encargado del tratamiento: los guardamos para que vos trabajes, no para usarlos nosotros.',
  },
  {
    icono: 'llave',
    titulo: 'Boxly no ve los datos de tus clientes',
    texto:
      'Solo entramos si vos nos das un acceso de soporte: dura el tiempo que elegís, es de solo lectura, los datos personales se ven enmascarados y lo podés revocar cuando quieras.',
  },
  {
    icono: 'descarga',
    titulo: 'Tu respaldo, cuando quieras',
    texto:
      'Desde el panel del taller descargás un archivo con todos tus datos en CSV, para tener tu propia copia.',
  },
  {
    icono: 'inventario',
    titulo: 'Cada taller, aislado',
    texto:
      'Cada taller tiene su propio espacio. Nadie de otro taller puede ver ni tocar tus clientes, tus órdenes ni tus pagos.',
  },
]

export default function Confianza() {
  return (
    <section
      id="seguridad"
      aria-labelledby="seguridad-titulo"
      className="landing-seccion scroll-mt-20"
    >
      <div className="landing-caja">
        <p className="landing-chip">
          Seguridad y privacidad
        </p>
        <h2
          id="seguridad-titulo"
          className="landing-titulo mt-3 max-w-2xl"
        >
          Los datos de tu taller quedan en tu taller
        </h2>
        <p className="landing-bajada">
          Tus clientes te confían su auto y sus datos. Boxly está hecho para que esa confianza
          no salga del taller.
        </p>

        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PUNTOS.map((punto) => (
            <li
              key={punto.titulo}
              className="landing-tarjeta landing-revelar flex flex-col"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber/15 text-amber-texto">
                <Icono nombre={punto.icono} className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-semibold text-ink">{punto.titulo}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{punto.texto}</p>
            </li>
          ))}
        </ul>

        <div className="landing-tarjeta mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-3 text-sm leading-relaxed text-muted">
            <Icono nombre="historial" className="mt-0.5 h-5 w-5 text-amber-texto" />
            <span>
              <strong className="font-semibold text-ink">Todo queda registrado.</strong> El
              historial de auditoría guarda quién hizo qué en el taller, y cada consulta de
              soporte aparece en tu actividad de soporte.
            </span>
          </p>
          <Link
            to="/privacidad"
            className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-amber-texto hover:underline"
          >
            Leé la política de privacidad
            <Icono nombre="flecha" className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}
