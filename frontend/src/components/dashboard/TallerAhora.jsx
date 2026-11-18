import { Link } from 'react-router-dom'
import Velocimetro from '@/components/graficos/Velocimetro'
import TarjetaDash from '@/components/dashboard/TarjetaDash'

// Colores fijos por etapa, en el orden del flujo del taller.
const COLOR_POR_ETAPA = {
  Ingresado: 'serie-1',
  'En diagnóstico': 'serie-2',
  'Esperando repuestos': 'serie-3',
  Listo: 'serie-4',
}

/**
 * Tarjeta "Taller ahora": velocímetro con las órdenes abiertas por etapa
 * (zonas de color) y la aguja en el total. Debajo, las que todavía no ingresaron.
 */
export default function TallerAhora({ ordenes, derivados, className = '', indice = 0 }) {
  const datos = ordenes?.datos ?? null
  const total = derivados?.totalAbiertas ?? 0
  const porIngresar = derivados?.porIngresar ?? 0

  const segmentos = (derivados?.abiertasPorEtapa ?? []).map((e) => ({
    etiqueta: e.etapa,
    valor: e.cantidad,
    color: COLOR_POR_ETAPA[e.etapa] ?? 'muted',
  }))

  return (
    <TarjetaDash
      titulo="Taller ahora"
      icono="ordenes"
      indice={indice}
      className={className}
      accion={
        <Link
          to="/ordenes"
          className="inline-flex min-h-[40px] items-center text-sm font-semibold text-amber-texto transition-colors hover:text-ink"
        >
          Ver tablero
        </Link>
      }
      cargando={Boolean(ordenes?.cargando && !datos)}
      error={ordenes?.error ?? ''}
      onReintentar={ordenes?.recargar}
    >
      {datos && (
        <>
          <Velocimetro
            segmentos={segmentos}
            subtitulo={total === 1 ? 'auto en el taller' : 'autos en el taller'}
            titulo="Órdenes abiertas por etapa"
          />
          {porIngresar > 0 && (
            <p className="mt-3 text-sm text-muted">
              y <span className="font-semibold text-ink">{porIngresar}</span> por ingresar
            </p>
          )}
        </>
      )}
    </TarjetaDash>
  )
}
