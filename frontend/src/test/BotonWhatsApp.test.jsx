import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import WhatsAppCliente from '@/components/clientes/WhatsAppCliente'
import { WhatsAppOrden } from '@/components/ordenes/AccionesOrdenDetalle'
import WhatsAppTurno from '@/components/turnos/WhatsAppTurno'
import BotonWhatsApp from '@/components/ui/BotonWhatsApp'
import { autoListo, recordatorioTurno, trabajosACotizar, turnoConfirmado } from '@/lib/plantillasWhatsapp'

const sesion = vi.hoisted(() => ({ rol: 'recepcion' }))
const clientes = vi.hoisted(() => ({ obtener: vi.fn() }))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ token: 'tok', usuario: { id: 1, rol: sesion.rol } }),
}))
vi.mock('@/services/taller', () => ({
  tallerService: { obtener: vi.fn().mockResolvedValue({ nombre: 'Taller Don Pepe' }) },
}))
vi.mock('@/services/clientes', () => ({ clientesService: clientes }))

const CLIENTE = { id: 4, nombre: 'Ana', apellido: 'García', telefono: '011 15 4444-0000' }
const ORDEN = {
  id: 7,
  estado: 'Listo',
  cliente_id: 4,
  vehiculo_marca: 'Fiat',
  vehiculo_modelo: 'Cronos',
  vehiculo_patente: 'AB123CD',
  lineas_a_cotizar: 0,
}
const TURNO = { id: 2, estado: 'pendiente', fecha: '2026-11-24', hora: '10:00', cliente_id: 4, vehiculo_id: 3 }
const VEHICULO = { id: 3, marca: 'Fiat', modelo: 'Cronos', patente: 'AB123CD' }

function textoDelLink(link) {
  return new URL(link.getAttribute('href')).searchParams.get('text')
}

beforeEach(() => {
  sesion.rol = 'recepcion'
  clientes.obtener.mockReset()
  clientes.obtener.mockResolvedValue(CLIENTE)
})

describe('BotonWhatsApp', () => {
  it('con teléfono es un link a wa.me que abre en una pestaña nueva', () => {
    render(<BotonWhatsApp telefono="11 4444-0000" mensaje="¡Hola, Ana! ¿Todo bien?" />)
    const link = screen.getByRole('link', { name: /WhatsApp/ })
    expect(link).toHaveAttribute(
      'href',
      `https://wa.me/5491144440000?text=${encodeURIComponent('¡Hola, Ana! ¿Todo bien?')}`,
    )
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(link.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('sin teléfono queda deshabilitado con title y descripción accesible', () => {
    render(<BotonWhatsApp telefono="" mensaje="Hola" />)
    const boton = screen.getByRole('button', { name: 'WhatsApp' })
    expect(boton).toBeDisabled()
    expect(boton).toHaveAttribute('title', 'El cliente no tiene un teléfono cargado.')
    expect(boton).toHaveAccessibleDescription('El cliente no tiene un teléfono cargado.')
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('con un teléfono incompleto explica que falta el código de área', () => {
    render(<BotonWhatsApp telefono="4444-0000" mensaje="Hola" />)
    const boton = screen.getByRole('button', { name: 'WhatsApp' })
    expect(boton).toBeDisabled()
    expect(boton).toHaveAccessibleDescription(/código de área/)
  })
})

describe('WhatsAppOrden', () => {
  it('arma el mensaje según el estado con el teléfono del cliente y el portal', async () => {
    render(<WhatsAppOrden orden={ORDEN} />)
    const link = await screen.findByRole('link', { name: /WhatsApp/ })
    expect(clientes.obtener).toHaveBeenCalledWith(4, 'tok')
    expect(link.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/5491144440000\?text=/)
    await waitFor(() =>
      expect(textoDelLink(link)).toBe(
        autoListo({
          cliente: 'Ana',
          vehiculo: 'Fiat Cronos',
          patente: 'AB123CD',
          taller: 'Taller Don Pepe',
          portal: `${window.location.origin}/portal`,
        }),
      ),
    )
  })

  it('con trabajos a cotizar avisa que hay que cotizar', async () => {
    render(<WhatsAppOrden orden={{ ...ORDEN, estado: 'En diagnóstico', lineas_a_cotizar: 1 }} />)
    const link = await screen.findByRole('link', { name: /WhatsApp/ })
    await waitFor(() => expect(textoDelLink(link)).toContain('Taller Don Pepe'))
    expect(textoDelLink(link)).toBe(
      trabajosACotizar({
        cliente: 'Ana',
        vehiculo: 'Fiat Cronos',
        patente: 'AB123CD',
        taller: 'Taller Don Pepe',
        portal: `${window.location.origin}/portal`,
      }),
    )
  })

  it('si el cliente no tiene teléfono, el botón queda deshabilitado', async () => {
    clientes.obtener.mockResolvedValue({ ...CLIENTE, telefono: null })
    render(<WhatsAppOrden orden={ORDEN} />)
    expect(await screen.findByRole('button', { name: 'WhatsApp' })).toBeDisabled()
  })

  it('el mecánico no ve el botón ni se pide el cliente', async () => {
    sesion.rol = 'mecanico'
    render(<WhatsAppOrden orden={ORDEN} />)
    await new Promise((listo) => setTimeout(listo, 10))
    expect(screen.queryByText('WhatsApp')).not.toBeInTheDocument()
    expect(clientes.obtener).not.toHaveBeenCalled()
  })
})

describe('WhatsAppTurno', () => {
  const DATOS = {
    cliente: 'Ana',
    vehiculo: 'Fiat Cronos',
    patente: 'AB123CD',
    fecha: '2026-11-24',
    hora: '10:00',
    taller: 'Taller Don Pepe',
  }

  it('turno pendiente: mensaje de confirmación', async () => {
    render(<WhatsAppTurno turno={TURNO} cliente={CLIENTE} vehiculo={VEHICULO} />)
    const link = screen.getByRole('link', { name: /WhatsApp/ })
    await waitFor(() => expect(textoDelLink(link)).toBe(turnoConfirmado(DATOS)))
  })

  it('turno confirmado: recordatorio', async () => {
    render(<WhatsAppTurno turno={{ ...TURNO, estado: 'confirmado' }} cliente={CLIENTE} vehiculo={VEHICULO} />)
    const link = screen.getByRole('link', { name: /WhatsApp/ })
    await waitFor(() => expect(textoDelLink(link)).toBe(recordatorioTurno(DATOS)))
  })

  it('turno cancelado o sin cliente: no hay botón', () => {
    const { rerender } = render(
      <WhatsAppTurno turno={{ ...TURNO, estado: 'cancelado' }} cliente={CLIENTE} vehiculo={VEHICULO} />,
    )
    expect(screen.queryByText('WhatsApp')).not.toBeInTheDocument()
    rerender(<WhatsAppTurno turno={TURNO} cliente={undefined} vehiculo={VEHICULO} />)
    expect(screen.queryByText('WhatsApp')).not.toBeInTheDocument()
  })

  it('el mecánico no lo ve', () => {
    sesion.rol = 'mecanico'
    render(<WhatsAppTurno turno={TURNO} cliente={CLIENTE} vehiculo={VEHICULO} />)
    expect(screen.queryByText('WhatsApp')).not.toBeInTheDocument()
  })
})

describe('WhatsAppCliente', () => {
  it('el administrador ve el saludo libre', async () => {
    sesion.rol = 'administrador'
    render(<WhatsAppCliente cliente={CLIENTE} />)
    const link = screen.getByRole('link', { name: /WhatsApp/ })
    await waitFor(() => expect(textoDelLink(link)).toBe('¡Hola, Ana! Te escribimos de Taller Don Pepe.'))
  })

  it('el mecánico no lo ve', () => {
    sesion.rol = 'mecanico'
    render(<WhatsAppCliente cliente={CLIENTE} />)
    expect(screen.queryByText('WhatsApp')).not.toBeInTheDocument()
  })
})
