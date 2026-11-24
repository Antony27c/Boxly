import { useCallback, useState } from 'react'
import Alert from '@/components/ui/Alert'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Icono from '@/components/ui/Icono'
import Loader from '@/components/ui/Loader'
import Paginacion from '@/components/ui/Paginacion'
import Select from '@/components/ui/Select'
import Textarea from '@/components/ui/Textarea'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { formatearFechaHora } from '@/lib/fechas'
import usePaginacion from '@/hooks/usePaginacion'
import useRecurso from '@/hooks/useRecurso'
import { soporteService } from '@/services/soporte'

const CLASE_TARJETA = 'rounded-box border border-graphite-600 bg-graphite-800 p-5'
const HORAS = [
  { valor: '1', texto: '1 hora' },
  { valor: '4', texto: '4 horas' },
  { valor: '24', texto: '24 horas' },
  { valor: '72', texto: '72 horas' },
]

const fechaHora = formatearFechaHora

function tonoEstado(estado) {
  if (estado >= 500) return 'peligro'
  if (estado >= 400) return 'ambar'
  if (estado >= 200 && estado < 300) return 'ok'
  return 'neutro'
}

function quienDe(acceso) {
  const persona = acceso.otorgado_por
  if (!persona) return 'Boxly'
  return [persona.nombre, persona.email].filter(Boolean).join(' · ') || 'Boxly'
}

function estadoDe(acceso) {
  if (acceso.vigente) return { texto: 'Vigente', tono: 'ok' }
  if (acceso.revocado_en) return { texto: 'Revocado', tono: 'neutro' }
  return { texto: 'Vencido', tono: 'ambar' }
}

// Fila del historial de accesos: quién lo otorgó, por cuánto y cómo terminó.
function ItemAcceso({ acceso, onRevocar, revocando }) {
  const estado = estadoDe(acceso)
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-graphite-700 py-3 first:border-t-0 first:pt-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">
          {acceso.motivo || 'Sin motivo'}
          <span className="ml-2">
            <Badge tono={estado.tono}>{estado.texto}</Badge>
          </span>
        </p>
        <p className="mt-0.5 text-xs text-muted">
          {fechaHora(acceso.desde)} → {fechaHora(acceso.hasta)} · {quienDe(acceso)}
          {acceso.revocado_en ? ` · revocado el ${fechaHora(acceso.revocado_en)}` : ''}
        </p>
      </div>
      {acceso.vigente && (
        <Button variante="secundario" cargando={revocando} onClick={() => onRevocar(acceso)}>
          Revocar
        </Button>
      )}
    </li>
  )
}

/* Sección "Acceso de soporte" de Configuración (solo administrador):
   explica la privacidad, permite otorgar un acceso temporal de solo lectura,
   muestra el vigente con opción de revocar y el historial con la actividad
   registrada de lo que Boxly miró. */
export default function AccesoSoporte() {
  const { token } = useAuth()
  const { avisar } = useToast()
  const [horas, setHoras] = useState('4')
  const [motivo, setMotivo] = useState('')
  const [procesando, setProcesando] = useState(false)
  const [errorAccion, setErrorAccion] = useState('')

  const cargarAccesos = useCallback((t) => soporteService.listarAccesos(t), [])
  const { datos: accesos, cargando, error, recargar } = useRecurso(cargarAccesos)
  const lista = accesos ?? []
  const vigente = lista.find((acceso) => acceso.vigente) ?? null
  const historial = lista.filter((acceso) => !acceso.vigente)

  const { pagina, setPagina, offset, limite, paginas, desde, hasta, total, setTotal } =
    usePaginacion()
  const cargarActividad = useCallback(
    (t) =>
      soporteService
        .listarActividad({ limit: limite, offset }, t)
        .then(({ items, total: cantidad }) => {
          setTotal(cantidad)
          return items
        }),
    [limite, offset, setTotal],
  )
  const { datos: actividad, cargando: cargandoActividad, error: errorActividad } =
    useRecurso(cargarActividad)
  const registros = actividad ?? []

  async function otorgar() {
    setProcesando(true)
    setErrorAccion('')
    try {
      await soporteService.crearAcceso(
        { horas: Number(horas), motivo: motivo.trim() || undefined },
        token,
      )
      avisar('Acceso de soporte otorgado.')
      setMotivo('')
      await recargar()
    } catch (problema) {
      setErrorAccion(problema.message)
    } finally {
      setProcesando(false)
    }
  }

  async function revocar(acceso) {
    setProcesando(true)
    setErrorAccion('')
    try {
      await soporteService.revocarAcceso(acceso.id, token)
      avisar('Acceso de soporte revocado.')
      await recargar()
    } catch (problema) {
      setErrorAccion(problema.message)
    } finally {
      setProcesando(false)
    }
  }

  return (
    <section className={CLASE_TARJETA} aria-labelledby="config-soporte">
      <h2 id="config-soporte" className="flex items-center gap-2 font-semibold">
        <Icono nombre="llave" className="h-5 w-5 text-amber-texto" />
        Acceso de soporte
      </h2>
      <p className="mt-1 text-sm text-muted">
        Boxly no ve los datos de tus clientes. Si necesitás ayuda, podés darle acceso de
        solo lectura por un tiempo; los datos personales se ven enmascarados y queda
        registrado.
      </p>

      {errorAccion && (
        <div className="mt-4">
          <Alert>{errorAccion}</Alert>
        </div>
      )}

      {cargando && !accesos ? (
        <Loader texto="Cargando accesos…" />
      ) : error ? (
        <div className="mt-4 space-y-3">
          <Alert>{error}</Alert>
          <Button variante="secundario" onClick={recargar}>
            Reintentar
          </Button>
        </div>
      ) : (
        <>
          {vigente ? (
            <div className="mt-4 rounded-box border border-ok/40 bg-ok/10 p-4">
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ok">
                <Icono nombre="check" className="h-4 w-4" />
                Acceso vigente hasta el {fechaHora(vigente.hasta)}
              </p>
              <p className="mt-1 text-xs text-muted">
                Otorgado por {quienDe(vigente)}
                {vigente.motivo ? ` · ${vigente.motivo}` : ''}
              </p>
              <Button
                variante="secundario"
                className="mt-3"
                cargando={procesando}
                onClick={() => revocar(vigente)}
              >
                Revocar acceso
              </Button>
            </div>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
              <Select
                label="Duración"
                value={horas}
                onChange={(e) => setHoras(e.target.value)}
                opciones={HORAS}
              />
              <Textarea
                label="Motivo (opcional)"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ej.: configurar la factura electrónica"
                maxLength={300}
              />
              <Button cargando={procesando} onClick={otorgar}>
                Otorgar acceso
              </Button>
            </div>
          )}

          <div className="mt-5">
            <h3 className="text-sm font-semibold">Historial</h3>
            {historial.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Todavía no hubo accesos de soporte.</p>
            ) : (
              <ul>
                {historial.map((acceso) => (
                  <ItemAcceso key={acceso.id} acceso={acceso} />
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      <div className="mt-5 border-t border-graphite-700 pt-4">
        <h3 className="text-sm font-semibold">Actividad de soporte</h3>
        <p className="mt-0.5 text-xs text-muted">
          Lo que Boxly miró de tu taller mientras tuvo acceso.
        </p>
        {errorActividad ? (
          <div className="mt-3">
            <Alert>{errorActividad}</Alert>
          </div>
        ) : cargandoActividad && !actividad ? (
          <Loader texto="Cargando actividad…" />
        ) : registros.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No hay actividad de soporte registrada.</p>
        ) : (
          <>
            <div className="mt-3 overflow-x-auto rounded-box border border-graphite-700">
              <table className="w-full text-left text-sm">
                <thead className="bg-graphite-800 text-muted">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Fecha</th>
                    <th className="px-4 py-2.5 font-medium">Quién</th>
                    <th className="px-4 py-2.5 font-medium">Acción</th>
                    <th className="px-4 py-2.5 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-graphite-700">
                  {registros.map((registro) => (
                    <tr key={registro.id}>
                      <td className="whitespace-nowrap px-4 py-2.5 text-muted">
                        {fechaHora(registro.creado_en)}
                      </td>
                      <td className="px-4 py-2.5">{registro.usuario_email ?? '—'}</td>
                      <td className="px-4 py-2.5">
                        <span className="font-mono text-xs text-muted">
                          {registro.metodo} {registro.ruta}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge tono={tonoEstado(registro.estado_http)}>
                          {registro.estado_http}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {paginas > 1 && (
              <Paginacion
                className="mt-3"
                pagina={pagina}
                paginas={paginas}
                desde={desde}
                hasta={hasta}
                total={total}
                onPagina={setPagina}
              />
            )}
          </>
        )}
      </div>
    </section>
  )
}
