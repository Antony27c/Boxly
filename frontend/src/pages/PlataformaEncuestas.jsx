import { useCallback, useEffect, useState } from 'react'
import TarjetaEncuesta from '@/components/plataforma/encuestas/TarjetaEncuesta'
import { INTENCIONES } from '@/components/plataforma/encuestas/intenciones'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import EncabezadoPagina from '@/components/ui/EncabezadoPagina'
import Field from '@/components/ui/Field'
import Loader from '@/components/ui/Loader'
import Paginacion from '@/components/ui/Paginacion'
import Select from '@/components/ui/Select'
import Vacio from '@/components/ui/Vacio'
import { useAuth } from '@/context/AuthContext'
import usePaginacion from '@/hooks/usePaginacion'
import useRecurso from '@/hooks/useRecurso'
import { listarEncuestas, POR_PAGINA } from '@/services/encuesta'
import { plataformaService } from '@/services/plataforma'

const OPCIONES_INTENCION = [
  { valor: '', texto: 'Todas' },
  ...INTENCIONES.map(({ valor, texto }) => ({ valor, texto })),
]

const OPCIONES_PUNTAJE = [
  { valor: '', texto: 'Cualquiera' },
  { valor: '5', texto: '5 estrellas' },
  ...[4, 3, 2].map((n) => ({ valor: String(n), texto: `${n} estrellas o más` })),
  { valor: '1', texto: '1 estrella o más' },
]

const SIN_FILTROS = { intencion: '', tallerId: '', puntajeMin: '', desde: '', hasta: '' }

// Hasta cuántos talleres trae el selector (la plataforma tiene pocos).
const TALLERES_EN_FILTRO = 200

function textoTotal(total) {
  return total === 1 ? '1 encuesta' : `${total} encuestas`
}

/* Encuestas de fin de demo (docs/Oferta.md) para el superadmin. Todos los
   filtros (intención, taller, puntaje mínimo y fechas) van al servidor, así el
   total y la paginación ya vienen filtrados. */
export default function PlataformaEncuestas() {
  const { token } = useAuth()
  const [filtros, setFiltros] = useState(SIN_FILTROS)
  const [talleres, setTalleres] = useState([])
  const { pagina, setPagina, paginas, desde, hasta, total, setTotal, reiniciar } = usePaginacion(POR_PAGINA)

  useEffect(() => {
    let vigente = true
    plataformaService
      .listarTalleres({ limit: TALLERES_EN_FILTRO, offset: 0 }, token)
      .then(({ items }) => {
        if (vigente) setTalleres(items)
      })
      .catch(() => {
        // Sin la lista de talleres el filtro queda solo con "Todos".
      })
    return () => {
      vigente = false
    }
  }, [token])

  const cargar = useCallback(
    (t) =>
      listarEncuestas({ ...filtros, pagina }, t).then(({ items, total: cantidad }) => {
        setTotal(cantidad)
        return items
      }),
    [filtros, pagina, setTotal],
  )
  const { datos: encuestas, cargando, error, recargar } = useRecurso(cargar)
  const lista = encuestas ?? []
  const hayFiltros = Object.values(filtros).some(Boolean)

  // Cada cambio de filtro vuelve a la primera página.
  function cambiarFiltro(clave, valor) {
    setFiltros((previos) => ({ ...previos, [clave]: valor }))
    reiniciar()
  }

  function limpiar() {
    setFiltros(SIN_FILTROS)
    reiniciar()
  }

  const opcionesTaller = [
    { valor: '', texto: 'Todos' },
    ...talleres.map((taller) => ({ valor: String(taller.id), texto: taller.nombre })),
  ]

  return (
    <div className="animate-bay-in">
      <EncabezadoPagina
        titulo="Encuestas"
        descripcion="Lo que contaron los talleres al terminar su demo."
        icono="info"
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Select
          label="Intención"
          value={filtros.intencion}
          onChange={(e) => cambiarFiltro('intencion', e.target.value)}
          opciones={OPCIONES_INTENCION}
        />
        <Select
          label="Taller"
          value={filtros.tallerId}
          onChange={(e) => cambiarFiltro('tallerId', e.target.value)}
          opciones={opcionesTaller}
        />
        <Select
          label="Puntaje"
          value={filtros.puntajeMin}
          onChange={(e) => cambiarFiltro('puntajeMin', e.target.value)}
          opciones={OPCIONES_PUNTAJE}
        />
        <Field
          label="Desde"
          type="date"
          value={filtros.desde}
          max={filtros.hasta || undefined}
          onChange={(e) => cambiarFiltro('desde', e.target.value)}
        />
        <Field
          label="Hasta"
          type="date"
          value={filtros.hasta}
          min={filtros.desde || undefined}
          onChange={(e) => cambiarFiltro('hasta', e.target.value)}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted" aria-live="polite">
          {cargando || error ? '' : textoTotal(total)}
        </p>
        {hayFiltros && (
          <Button variante="fantasma" onClick={limpiar}>
            Limpiar filtros
          </Button>
        )}
      </div>

      {cargando && !encuestas ? (
        <Loader texto="Cargando encuestas…" />
      ) : error ? (
        <div className="mt-6 space-y-4">
          <Alert>{error}</Alert>
          <Button variante="secundario" onClick={recargar}>
            Reintentar
          </Button>
        </div>
      ) : lista.length === 0 ? (
        <div className="mt-6">
          <Vacio
            icono="info"
            ilustracion="portapapeles"
            titulo={hayFiltros ? 'Sin encuestas con estos filtros' : 'Todavía no hay encuestas'}
            mensaje={
              hayFiltros
                ? 'Probá con otros filtros.'
                : 'Cuando un taller termine su demo y responda la encuesta, aparece acá.'
            }
          />
        </div>
      ) : (
        <ul className={`mt-6 grid gap-4 transition-opacity lg:grid-cols-2 ${cargando ? 'opacity-60' : ''}`}>
          {lista.map((encuesta) => (
            <li key={encuesta.id}>
              <TarjetaEncuesta encuesta={encuesta} />
            </li>
          ))}
        </ul>
      )}

      {paginas > 1 && !error && lista.length > 0 && (
        <Paginacion
          className="mt-4"
          pagina={pagina}
          paginas={paginas}
          desde={desde}
          hasta={hasta}
          total={total}
          onPagina={setPagina}
        />
      )}
    </div>
  )
}
