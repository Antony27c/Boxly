import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import EncabezadoPagina from '@/components/ui/EncabezadoPagina'
import Field from '@/components/ui/Field'
import Icono from '@/components/ui/Icono'
import Toast from '@/components/ui/Toast'
import Vacio from '@/components/ui/Vacio'

const TRAZO_VEHICULOS =
  'M5 17h14M5 17a2 2 0 1 0 4 0M15 17a2 2 0 1 0 4 0M3 17v-4l2-5a2 2 0 0 1 1.9-1.4h10.2A2 2 0 0 1 19 8l2 5v4M3 13h18'
const TRAZO_INVENTARIO = 'M21 8 12 3 3 8v8l9 5 9-5V8ZM3 8l9 5 9-5M12 13v8'
const TRAZO_INFO = 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5M12 8h.01'
const TRAZO_CHECK = 'M5 12.5 10 17l9-10'

describe('Icono', () => {
  it('dibuja el trazo del icono pedido', () => {
    const { container } = render(<Icono nombre="vehiculos" />)
    expect(container.querySelector('svg path')).toHaveAttribute('d', TRAZO_VEHICULOS)
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('un nombre desconocido no renderiza nada', () => {
    const { container } = render(<Icono nombre="no_existe" />)
    expect(container.querySelector('svg')).not.toBeInTheDocument()
  })
})

describe('Iconos de taller', () => {
  const NUEVOS = [
    'llave_inglesa',
    'llave_tubo',
    'crique',
    'neumatico',
    'bujia',
    'aceite',
    'bateria',
    'filtro',
    'disco_freno',
    'piston',
    'cono',
  ]

  it.each(NUEVOS)('%s dibuja un único trazo en el mismo estilo', (nombre) => {
    const { container } = render(<Icono nombre={nombre} />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('viewBox', '0 0 24 24')
    expect(svg).toHaveAttribute('stroke-width', '2')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    const trazos = svg.querySelectorAll('path')
    expect(trazos).toHaveLength(1)
    expect(trazos[0].getAttribute('d')).toMatch(/^M/)
  })

  it('con titulo se anuncia como imagen', () => {
    render(<Icono nombre="bujia" titulo="Bujía" />)
    expect(screen.getByRole('img', { name: 'Bujía' })).toBeInTheDocument()
  })
})

describe('Button con icono', () => {
  it('renderiza el svg del icono junto al texto', () => {
    const { container } = render(<Button icono="vehiculos">Recibir un auto</Button>)

    expect(screen.getByRole('button', { name: 'Recibir un auto' })).toBeInTheDocument()
    expect(container.querySelector('svg path')).toHaveAttribute('d', TRAZO_VEHICULOS)
  })

  it('cargando muestra el spinner en lugar del icono', () => {
    const { container } = render(
      <Button icono="vehiculos" cargando>
        Guardando
      </Button>,
    )

    expect(container.querySelectorAll('svg')).toHaveLength(1)
    expect(container.querySelector('svg.animate-spin')).toBeInTheDocument()
  })
})

describe('Vacio con icono', () => {
  it('muestra el icono indicado en el círculo', () => {
    const { container } = render(
      <Vacio titulo="Sin repuestos" mensaje="No hay nada cargado." icono="inventario" />,
    )

    expect(screen.getByText('Sin repuestos')).toBeInTheDocument()
    expect(container.querySelector('svg path')).toHaveAttribute('d', TRAZO_INVENTARIO)
  })

  it('sin icono usa el de información por defecto', () => {
    const { container } = render(<Vacio titulo="Vacío" mensaje="No hay datos." />)

    expect(container.querySelector('svg path')).toHaveAttribute('d', TRAZO_INFO)
  })
})

describe('Alert con icono', () => {
  it('ok muestra el tilde', () => {
    const { container } = render(<Alert tipo="ok">Todo salió bien.</Alert>)
    expect(container.querySelector('svg path')).toHaveAttribute('d', TRAZO_CHECK)
  })

  it('error muestra el triángulo de alerta', () => {
    const { container } = render(<Alert>No se pudo guardar.</Alert>)
    expect(container.querySelector('svg path')).toHaveAttribute(
      'd',
      'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
    )
  })
})

describe('Toast con icono', () => {
  it('ok entra con el tilde y error con la alerta', () => {
    const { container, rerender } = render(
      <Toast mensaje="Guardado." tipo="ok" onCerrar={() => {}} />,
    )
    expect(container.querySelector('svg path')).toHaveAttribute('d', TRAZO_CHECK)

    rerender(<Toast mensaje="Falló." tipo="error" onCerrar={() => {}} />)
    expect(container.querySelector('svg path')).toHaveAttribute(
      'd',
      'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
    )
  })
})

describe('EncabezadoPagina con icono', () => {
  it('muestra el icono junto al título sin cambiar su nombre', () => {
    const { container } = render(<EncabezadoPagina titulo="Panel" icono="dashboard" />)

    expect(screen.getByRole('heading', { name: 'Panel' })).toBeInTheDocument()
    expect(container.querySelector('svg')).toBeInTheDocument()
  })
})

describe('Field con icono', () => {
  it('muestra el icono dentro del campo', () => {
    const { container } = render(<Field label="Correo" icono="correo" />)

    expect(screen.getByLabelText('Correo')).toBeInTheDocument()
    expect(container.querySelector('svg')).toBeInTheDocument()
  })
})
