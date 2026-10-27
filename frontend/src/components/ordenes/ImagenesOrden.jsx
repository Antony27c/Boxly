import { useCallback, useMemo, useRef, useState } from 'react'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import Loader from '@/components/ui/Loader'
import Select from '@/components/ui/Select'
import { useAuth } from '@/context/AuthContext'
import useRecurso from '@/hooks/useRecurso'
import { ESTADOS_ORDEN, ordenesService } from '@/services/ordenes'

export const TAMANO_MAXIMO = 5 * 1024 * 1024
export const TIPOS_IMAGEN = 'image/jpeg,image/png,image/webp'

export default function ImagenesOrden({ orden }) {
  const { token } = useAuth()
  const entrada = useRef(null)
  const [etapa, setEtapa] = useState(orden.estado)
  const [subiendo, setSubiendo] = useState(false)
  const [quitando, setQuitando] = useState(null)
  const [errorAccion, setErrorAccion] = useState('')
  const [ampliada, setAmpliada] = useState(null)

  const cargar = useCallback((t) => ordenesService.imagenes(orden.id, t), [orden.id])
  const { datos: imagenes, cargando, error, recargar } = useRecurso(cargar)

  const porEtapa = useMemo(() => {
    const grupos = new Map()
    for (const imagen of imagenes ?? []) {
      const clave = imagen.etapa ?? 'Sin etapa'
      if (!grupos.has(clave)) grupos.set(clave, [])
      grupos.get(clave).push(imagen)
    }
    return [...grupos.entries()].sort(
      ([a], [b]) => ESTADOS_ORDEN.indexOf(a) - ESTADOS_ORDEN.indexOf(b),
    )
  }, [imagenes])

  async function subir(evento) {
    const archivos = [...(evento.target.files ?? [])]
    evento.target.value = ''
    if (archivos.length === 0) return
    const invalido = archivos.find((archivo) => !TIPOS_IMAGEN.split(',').includes(archivo.type))
    if (invalido) return setErrorAccion(`"${invalido.name}" no es una imagen.`)
    const pesado = archivos.find((archivo) => archivo.size > TAMANO_MAXIMO)
    if (pesado) return setErrorAccion(`"${pesado.name}" pesa más de 5 MB.`)

    setSubiendo(true)
    setErrorAccion('')
    try {
      for (const archivo of archivos) {
        await ordenesService.subirImagen(orden.id, archivo, etapa, token)
      }
      await recargar()
    } catch (problema) {
      setErrorAccion(problema.message)
    } finally {
      setSubiendo(false)
    }
  }

  async function quitar(imagen) {
    setQuitando(imagen.id)
    setErrorAccion('')
    try {
      await ordenesService.quitarImagen(orden.id, imagen.id, token)
      if (ampliada?.id === imagen.id) setAmpliada(null)
      await recargar()
    } catch (problema) {
      setErrorAccion(problema.message)
    } finally {
      setQuitando(null)
    }
  }

  if (cargando) return <Loader texto="Cargando fotos…" />

  if (error) {
    return (
      <div className="space-y-4">
        <Alert>{error}</Alert>
        <Button variante="secundario" onClick={recargar}>
          Reintentar
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {errorAccion && <Alert>{errorAccion}</Alert>}

      <div className="flex flex-wrap items-end gap-3">
        <Select
          label="Etapa de la foto"
          className="min-w-48 flex-1"
          value={etapa}
          onChange={(e) => setEtapa(e.target.value)}
          disabled={subiendo}
          opciones={ESTADOS_ORDEN.filter((estado) => estado !== 'Cancelado').map((estado) => ({
            valor: estado,
            texto: estado,
          }))}
        />
        <input
          ref={entrada}
          type="file"
          accept={TIPOS_IMAGEN}
          capture="environment"
          multiple
          className="hidden"
          onChange={subir}
        />
        <Button cargando={subiendo} onClick={() => entrada.current?.click()}>
          {subiendo ? 'Subiendo…' : 'Subir fotos'}
        </Button>
      </div>

      {porEtapa.length === 0 ? (
        <p className="text-sm text-muted">Todavía no hay fotos cargadas en esta orden.</p>
      ) : (
        porEtapa.map(([nombre, lista]) => (
          <section key={nombre}>
            <h3 className="text-sm font-semibold">
              {nombre} <span className="font-normal text-muted">· {lista.length}</span>
            </h3>
            <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {lista.map((imagen) => (
                <li key={imagen.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => setAmpliada(imagen)}
                    className="block aspect-square w-full overflow-hidden rounded-box border border-graphite-700"
                  >
                    <img
                      src={imagen.url}
                      alt={`Foto de la etapa ${nombre}`}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  </button>
                  <button
                    type="button"
                    aria-label="Quitar foto"
                    disabled={quitando === imagen.id}
                    onClick={() => quitar(imagen)}
                    className="absolute right-1 top-1 rounded-box bg-black/60 px-1.5 text-xs text-white opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      {ampliada && (
        <div className="space-y-2 border-t border-graphite-700 pt-4">
          <img
            src={ampliada.url}
            alt={`Foto de la etapa ${ampliada.etapa ?? ''}`}
            className="max-h-[60vh] w-full rounded-box object-contain"
          />
          <div className="flex items-center justify-between text-sm text-muted">
            <span>
              {ampliada.etapa}
              {ampliada.fecha ? ` · ${new Date(ampliada.fecha).toLocaleString('es-AR')}` : ''}
              {ampliada.usuario_nombre ? ` · ${ampliada.usuario_nombre}` : ''}
            </span>
            <Button variante="fantasma" onClick={() => setAmpliada(null)}>
              Cerrar
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
