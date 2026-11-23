import { useCallback, useEffect, useState } from 'react'
import FormularioTaller from '@/components/plataforma/FormularioTaller'
import PasswordTemporal from '@/components/plataforma/PasswordTemporal'
import TarjetaTaller from '@/components/plataforma/TarjetaTaller'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import EncabezadoPagina from '@/components/ui/EncabezadoPagina'
import Field from '@/components/ui/Field'
import Loader from '@/components/ui/Loader'
import Modal from '@/components/ui/Modal'
import Paginacion from '@/components/ui/Paginacion'
import Select from '@/components/ui/Select'
import Vacio from '@/components/ui/Vacio'
import { useAuth } from '@/context/AuthContext'
import usePaginacion from '@/hooks/usePaginacion'
import useRecurso from '@/hooks/useRecurso'
import { plataformaService } from '@/services/plataforma'

const ESTADOS = [
  { valor: '', texto: 'Todos los estados' },
  { valor: 'activo', texto: 'Activo' },
  { valor: 'suspendido', texto: 'Suspendido' },
]

// Búsqueda y filtro pegados al servidor (contrato P1): se espera a que la
// persona deje de escribir antes de pedir de nuevo.
const ESPERA_BUSQUEDA_MS = 350

export default function Plataforma() {
  const { token } = useAuth()
  const [busqueda, setBusqueda] = useState('')
  const [termino, setTermino] = useState('')
  const [estado, setEstado] = useState('')
  const { pagina, setPagina, offset, limite, paginas, desde, hasta, total, setTotal, reiniciar } =
    usePaginacion()
  const [altaAbierta, setAltaAbierta] = useState(false)
  const [temporal, setTemporal] = useState(null)

  useEffect(() => {
    const temporizador = setTimeout(() => {
      setTermino(busqueda.trim())
      reiniciar()
    }, ESPERA_BUSQUEDA_MS)
    return () => clearTimeout(temporizador)
  }, [busqueda, reiniciar])

  const cargarTalleres = useCallback(
    (t) =>
      plataformaService
        .listarTalleres({ limit: limite, offset, q: termino, estado }, t)
        .then(({ items, total: cantidad }) => {
          setTotal(cantidad)
          return items
        }),
    [limite, offset, termino, estado, setTotal],
  )
  const { datos: talleres, cargando, error, recargar } = useRecurso(cargarTalleres)

  async function guardarTaller(datos) {
    const respuesta = await plataformaService.crearTaller(datos, token)
    setAltaAbierta(false)
    // La contraseña temporal se muestra una sola vez y no se puede volver a ver.
    setTemporal({
      nombre: respuesta?.taller?.nombre ?? datos.nombre,
      email: respuesta?.admin_email ?? datos.admin.email,
      password: respuesta?.password_temporal ?? '',
    })
    await recargar()
  }

  const hayFiltros = termino !== '' || estado !== ''

  return (
    <div className="animate-bay-in">
      <EncabezadoPagina
        titulo="Talleres"
        descripcion="Los talleres que usan Boxly. Tocá uno para ver su personal y sus accesos de soporte."
        icono="herramienta"
        acciones={<Button onClick={() => setAltaAbierta(true)}>Nuevo taller</Button>}
      />

      <div className="mt-6 grid gap-4 sm:max-w-2xl sm:grid-cols-2">
        <Field
          label="Buscar taller"
          type="search"
          placeholder="Ej.: El Rayo"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <Select
          label="Estado"
          value={estado}
          onChange={(e) => {
            setEstado(e.target.value)
            reiniciar()
          }}
          opciones={ESTADOS}
        />
      </div>

      {cargando && !talleres ? (
        <Loader texto="Cargando talleres…" />
      ) : error ? (
        <div className="mt-6 space-y-4">
          <Alert>{error}</Alert>
          <Button variante="secundario" onClick={recargar}>
            Reintentar
          </Button>
        </div>
      ) : (talleres ?? []).length === 0 ? (
        <div className="mt-6">
          <Vacio
            titulo={hayFiltros ? 'Sin resultados' : 'Todavía no hay talleres'}
            mensaje={
              hayFiltros
                ? 'Probá con otro nombre o estado.'
                : 'Desde acá das de alta un taller nuevo con su primer administrador.'
            }
            accion={<Button onClick={() => setAltaAbierta(true)}>Nuevo taller</Button>}
          />
        </div>
      ) : (
        <ul
          className={`mt-6 grid gap-4 transition-opacity sm:grid-cols-2 xl:grid-cols-3 ${
            cargando ? 'opacity-60' : ''
          }`}
        >
          {talleres.map((taller) => (
            <li key={taller.id}>
              <TarjetaTaller taller={taller} />
            </li>
          ))}
        </ul>
      )}

      {/* Los filtros van al servidor: el total ya viene filtrado, así que la
          paginación también aplica con búsqueda o estado activo. */}
      {paginas > 1 && !error && (talleres ?? []).length > 0 && (
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

      <Modal
        abierto={altaAbierta}
        titulo="Nuevo taller"
        descripcion="Se crea el taller con su configuración inicial y su primer administrador."
        onCerrar={() => setAltaAbierta(false)}
      >
        <FormularioTaller onGuardar={guardarTaller} onCancelar={() => setAltaAbierta(false)} />
      </Modal>

      <PasswordTemporal
        abierto={Boolean(temporal)}
        titulo={temporal?.nombre ? `Taller ${temporal.nombre} creado` : 'Taller creado'}
        descripcion={
          temporal?.email ? `Contraseña temporal del administrador ${temporal.email}.` : undefined
        }
        password={temporal?.password ?? ''}
        onCerrar={() => setTemporal(null)}
      />
    </div>
  )
}
