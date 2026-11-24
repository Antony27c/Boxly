import { Link } from 'react-router-dom'
import Logo from '@/components/ui/Logo'

const ANIO = new Date().getFullYear()

const ANCLAS = [
  { href: '#funciones', texto: 'Funciones' },
  { href: '#como-funciona', texto: 'Cómo funciona' },
  { href: '#seguridad', texto: 'Seguridad' },
  { href: '#planes', texto: 'Planes' },
  { href: '#preguntas', texto: 'Preguntas' },
]

const enlace = 'text-sm text-muted transition-colors hover:text-ink'

// Pie de la landing: logo, atajos a las secciones, privacidad e ingreso.
export default function Pie() {
  return (
    <footer className="border-t border-graphite-600/60 bg-graphite-800/40">
      <div className="landing-caja py-12">
        <div className="grid gap-10 sm:grid-cols-[1.4fr_1fr]">
          <div>
            <Logo tamano="sm" />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">
              Gestión para talleres mecánicos: órdenes de trabajo, turnos,
              repuestos, cobros y un portal para tus clientes.
            </p>
          </div>

          <nav aria-label="Pie de página" className="sm:justify-self-end">
            <ul className="grid grid-cols-2 gap-x-8 gap-y-2.5 sm:grid-cols-1">
              {ANCLAS.map((ancla) => (
                <li key={ancla.href}>
                  <a href={ancla.href} className={enlace}>
                    {ancla.texto}
                  </a>
                </li>
              ))}
              <li>
                <Link to="/privacidad" className={enlace}>
                  Privacidad
                </Link>
              </li>
              <li>
                <Link to="/login" className={enlace}>
                  Ingresar
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        <div className="mt-10 border-t border-graphite-600/60 pt-6">
          <p className="text-sm text-muted">© {ANIO} Boxly</p>
        </div>
      </div>
    </footer>
  )
}
