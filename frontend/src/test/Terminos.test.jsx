import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import GuardiaTerminos from '@/components/terminos/GuardiaTerminos'
import Terminos from '@/pages/Terminos'

const auth = vi.hoisted(() => ({
  token: 'tok',
  usuario: { id: 1, nombre: 'Admin', apellido: 'Taller', rol: 'administrador' },
}))

const servicio = vi.hoisted(() => {
  const ref = { datos: null }
  return {
    ref,
    obtener: vi.fn(),
    aceptar: vi.fn(),
    estado: () => ref.datos,
  }
})

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    token: auth.token,
    usuario: auth.usuario,
    autenticado: true,
    cargandoSesion: false,
  }),
}))

vi.mock('@/services/terminos', () => ({ terminosService: servicio }))

const TEXTO = `**BORRADOR: revisar con un abogado antes de usar**

# Términos de Boxly y acuerdo de tratamiento de datos

## Quién responde por los datos

Cada taller es **responsable** de los datos de sus clientes y Boxly es el encargado del tratamiento.`

const PENDIENTE = {
  version: '2026-11',
  texto: TEXTO,
  aceptados_en: null,
  aceptados_por: null,
}

const ACEPTADO = {
  ...PENDIENTE,
  aceptados_en: '2026-11-20T15:04:00+00:00',
  aceptados_por: 'admin@x.com',
}

// Simula el servicio real: obtener/aceptar actualizan el estado cacheado y
// obtener lo devuelve (como el caché de sesión del servicio de verdad).
function configurar(datos) {
  servicio.ref.datos = datos
  servicio.obtener.mockImplementation(() => Promise.resolve(servicio.ref.datos))
  servicio.aceptar.mockImplementation(async () => {
    servicio.ref.datos = ACEPTADO
    return ACEPTADO
  })
}

function montarGuardia(rutaInicial = '/hoy') {
  return render(
    <MemoryRouter initialEntries={[rutaInicial]}>
      <Routes>
        <Route element={<GuardiaTerminos />}>
          <Route path="/hoy" element={<div>Panel del taller</div>} />
          <Route path="/terminos" element={<div>Pagina de terminos</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

function montarApp(rutaInicial = '/hoy') {
  return render(
    <MemoryRouter initialEntries={[rutaInicial]}>
      <Routes>
        <Route element={<GuardiaTerminos />}>
          <Route path="/hoy" element={<div>Panel del taller</div>} />
          <Route path="/terminos" element={<Terminos />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

function montarPagina() {
  return render(
    <MemoryRouter>
      <Terminos />
    </MemoryRouter>,
  )
}

describe('GuardiaTerminos', () => {
  beforeEach(() => {
    auth.usuario = { id: 1, nombre: 'Admin', apellido: 'Taller', rol: 'administrador' }
    servicio.ref.datos = null
    servicio.obtener.mockReset()
    servicio.aceptar.mockReset()
    configurar(PENDIENTE)
  })

  it('redirige al administrador cuyo taller no aceptó los términos', async () => {
    montarGuardia('/hoy')
    expect(await screen.findByText('Pagina de terminos')).toBeInTheDocument()
    expect(screen.queryByText('Panel del taller')).not.toBeInTheDocument()
    expect(servicio.obtener).toHaveBeenCalledTimes(1)
  })

  it('no redirige al administrador que ya aceptó', async () => {
    configurar(ACEPTADO)
    montarGuardia('/hoy')
    expect(await screen.findByText('Panel del taller')).toBeInTheDocument()
    expect(screen.queryByText('Pagina de terminos')).not.toBeInTheDocument()
  })

  it.each(['recepcion', 'mecanico', 'cliente', 'superadmin'])(
    'no bloquea al rol %s ni pide los términos',
    async (rol) => {
      auth.usuario = { id: 2, nombre: 'Otro', apellido: 'Usuario', rol }
      montarGuardia('/hoy')
      expect(await screen.findByText('Panel del taller')).toBeInTheDocument()
      expect(servicio.obtener).not.toHaveBeenCalled()
    },
  )

  it('no entra en loop cuando el admin ya está en /terminos', async () => {
    montarGuardia('/terminos')
    expect(await screen.findByText('Pagina de terminos')).toBeInTheDocument()
  })
})

describe('Terminos', () => {
  beforeEach(() => {
    auth.usuario = { id: 1, nombre: 'Admin', apellido: 'Taller', rol: 'administrador' }
    servicio.ref.datos = null
    servicio.obtener.mockReset()
    servicio.aceptar.mockReset()
    configurar(PENDIENTE)
  })

  it('muestra el texto con el aviso de borrador', async () => {
    montarPagina()
    expect(await screen.findByText(/BORRADOR: revisar con un abogado/)).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Quién responde por los datos' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/encargado del tratamiento/)).toBeInTheDocument()
  })

  it('al aceptar llama al servicio y libera la navegación', async () => {
    montarApp('/hoy')

    // La guardia manda al admin a /terminos.
    expect(await screen.findByText('Aceptar los términos')).toBeInTheDocument()

    const casilla = screen.getByRole('checkbox', { name: /leí y acepto en nombre del taller/i })
    const boton = screen.getByRole('button', { name: 'Aceptar' })
    expect(boton).toBeDisabled()

    fireEvent.click(casilla)
    expect(boton).toBeEnabled()
    fireEvent.click(boton)

    // El POST actualizó el estado: la página muestra la aceptación y el
    // enlace al panel; al navegar la guardia ya no redirige.
    expect(await screen.findByText(/aceptó estos términos/)).toBeInTheDocument()
    expect(servicio.aceptar).toHaveBeenCalledTimes(1)
    expect(servicio.aceptar).toHaveBeenCalledWith('tok')

    fireEvent.click(screen.getByRole('link', { name: /seguir al panel/i }))
    expect(await screen.findByText('Panel del taller')).toBeInTheDocument()
    expect(screen.queryByText('Aceptar los términos')).not.toBeInTheDocument()
  })

  it('muestra fecha y quién aceptó cuando ya está aceptado', async () => {
    configurar(ACEPTADO)
    montarPagina()
    expect(await screen.findByText(/aceptó estos términos/)).toBeInTheDocument()
    expect(screen.getByText(/admin@x\.com/)).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('un no administrador ve el texto sin controles de aceptación', async () => {
    auth.usuario = { id: 3, nombre: 'Recep', apellido: 'Taller', rol: 'recepcion' }
    montarPagina()
    expect(await screen.findByText(/BORRADOR/)).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aceptar' })).not.toBeInTheDocument()
  })
})
