import { Link } from 'react-router-dom'
import Cono from '@/components/ilustraciones/Cono'
import Icono from '@/components/ui/Icono'

// Cartel naranja de desvío con flecha que dobla. Decorativo: el título lo dice en texto.
function CartelDesvio({ className }) {
  return (
    <svg viewBox="0 0 64 48" className={`shrink-0 ${className}`} aria-hidden="true">
      <rect x="30" y="24" width="4" height="22" rx="1" className="fill-graphite-500" />
      <rect x="4" y="4" width="56" height="24" rx="3" fill="#ec6a1e" />
      <rect x="6.5" y="6.5" width="51" height="19" rx="2" fill="none" stroke="#fff" strokeWidth="1.5" />
      <path
        d="M14 21v-4.5c0-2.2 1.8-4 4-4h22"
        fill="none"
        stroke="#fff"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M39 7.5 47 12.5 39 17.5Z" fill="#fff" />
      <rect x="4" y="4" width="56" height="24" rx="3" fill="none" stroke="#1b1d21" strokeOpacity="0.25" />
    </svg>
  )
}

export default function NoEncontrado() {
  return (
    <div className="flex min-h-screen animate-bay-in flex-col items-center justify-center gap-4 px-5 text-center">
      <div className="flex items-end gap-1" data-ilustracion="desvio">
        <CartelDesvio className="h-14 w-[4.7rem]" />
        <Cono className="h-9 w-9" />
      </div>
      <p className="text-5xl font-bold text-amber-texto">404</p>
      <h1 className="text-xl font-semibold">Nos desviamos de ruta</h1>
      <p className="max-w-sm text-muted">
        Esta página no existe o cambió de lugar. Puede que el enlace esté mal escrito.
      </p>
      <Link
        to="/inicio"
        className="mt-2 inline-flex items-center gap-2 rounded-lg bg-graphite-600 px-5 py-2.5 text-sm font-semibold text-ink transition motion-safe:active:scale-[0.98] hover:bg-graphite-500"
      >
        <Icono nombre="hoy" className="h-4 w-4" />
        Volver al inicio
      </Link>
    </div>
  )
}
