import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
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

// Alta de taller desde una solicitud de demo (L4 → L6):
// /plataforma?nuevo=1&nombre=<taller>&admin_nombre=<nombre completo>&admin_email=<email>
const PARAMS_ALTA = ['nuevo', 'nombre', 'admin_nombre', 'admin_email']
// Mismos topes que el backend (app/schemas/plataforma.py).
const MAX_TALLER = 120
const MAX_PERSONA = 80
const MAX_EMAIL = 254

// Los valores vienen de la URL: se recortan al largo máximo y se colapsan los
// espacios. React escapa el texto, así que nada se interpreta como HTML.
function limpio(valor, maximo) {
  return (valor ?? '').replace(/\s+/g, ' ').trim().slice(0, maximo)
}

// La solicitud trae el nombre completo en admin_nombre y el alta pide nombre y
// apellido por separado: primera palabra al nombre, el resto al apellido.
function partirAdmin(completo) {
  const texto = (completo ?? '').replace(/\s+/g, ' ').trim()
  const corte = texto.indexOf(' ')
  if (corte === -1) return { nombre: texto.slice(0, MAX_PERSONA), apellido: '' }
  return {
    nombre: texto.slice(0, corte).slice(0, MAX_PERSONA),
    apellido: texto.slice(corte + 1).trim().slice(0, MAX_PERSONA),
  }
}

function armarPrecarga(parametros) {
  const { nombre: adminNombre, apellido: adminApellido } = partirAdmin(parametros.get('admin_nombre'))
  const precarga = {
    nombre: limpio(parametros.get('nombre'), MAX_TALLER),
    admin_nombre: adminNombre,
    admin_apellido: adminApellido,
    admin_email: limpio(parametros.get('admin_email'), MAX_EMAIL).toLowerCase(),
  }
  return Object.values(precarga).every((valor) => valor === '') ? null : precarga
}

// El nombre puede venir ya con "Taller" adelante ("Taller El Rayo"): no
// duplicar la palabra en el aviso de taller creado.
function tituloTallerCreado(nombre) {
  return /^taller(es)?\b/i.test(nombre.trim()) ? `${nombre} creado` : `Taller ${nombre} creado`
}

export default function Plataforma() {
  const { token } = useAuth()
  const [parametros, setParametros] = useSearchParams()
  const [busqueda, setBusqueda] = useState('')
  const [termino, setTermino] = useState('')
  const [estado, setEstado] = useState('')
  const { pagina, setPagina, offset, limite, paginas, desde, hasta, total, setTotal, reiniciar } =
    usePaginacion()
  // El alta está abierta si la abrió la persona o si la URL trae nuevo=1 (el
  // botón "Crear taller" de una solicitud de demo llega con los datos).
  const [altaManual, setAltaManual] = useState(false)
  const altaAbierta = parametros.get('nuevo') === '1' || altaManual
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

  // Saca de la URL los parámetros del alta desde solicitud (si están).
  function limpiarParametrosAlta() {
    if (!PARAMS_ALTA.some((clave) => parametros.has(clave))) return
    setParametros(
      (previos) => {
        const nuevos = new URLSearchParams(previos)
        for (const clave of PARAMS_ALTA) nuevos.delete(clave)
        return nuevos
      },
      { replace: true },
    )
  }

  function abrirAlta() {
    setAltaManual(true)
  }

  function cerrarAlta() {
    setAltaManual(false)
    limpiarParametrosAlta()
  }

  async function guardarTaller(datos) {
    const respuesta = await plataformaService.crearTaller(datos, token)
    setAltaManual(false)
    limpiarParametrosAlta()
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
        acciones={<Button onClick={abrirAlta}>Nuevo taller</Button>}
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
            accion={<Button onClick={abrirAlta}>Nuevo taller</Button>}
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
        descripcion="Se crea el taller con su configuración inicial, el tipo de acceso y su primer administrador."
        onCerrar={cerrarAlta}
      >
        <FormularioTaller
          inicial={parametros.get('nuevo') === '1' ? armarPrecarga(parametros) : null}
          onGuardar={guardarTaller}
          onCancelar={cerrarAlta}
        />
      </Modal>

      <PasswordTemporal
        abierto={Boolean(temporal)}
        titulo={temporal?.nombre ? tituloTallerCreado(temporal.nombre) : 'Taller creado'}
        descripcion={
          temporal?.email ? `Contraseña temporal del administrador ${temporal.email}.` : undefined
        }
        password={temporal?.password ?? ''}
        onCerrar={() => setTemporal(null)}
      />
    </div>
  )
}
