import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ZonaSoloLectura } from '@/context/SoloLecturaContext'
import Button from '@/components/ui/Button'
import Confirmacion from '@/components/ui/Confirmacion'
import Modal from '@/components/ui/Modal'

// Los modales no usan portal: viven adentro de la zona y se apagaban junto
// con todo lo demás, incluidos sus botones de cerrar.
// El disparador queda afuera de la zona: simula el aviso de solo lectura que
// llega mientras el modal está abierto.
function ConModal() {
  const [abierto, setAbierto] = useState(true)
  const [activo, setActivo] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setActivo(true)}>
        pasar a solo lectura
      </button>
      <ZonaSoloLectura activo={activo}>
        <Modal abierto={abierto} titulo="Editar cliente" onCerrar={() => setAbierto(false)}>
          <Button>Guardar</Button>
        </Modal>
        {!abierto && <p>Modal cerrado</p>}
      </ZonaSoloLectura>
    </>
  )
}

function pasarASoloLectura() {
  fireEvent.click(screen.getByRole('button', { name: 'pasar a solo lectura' }))
}

describe('modales en solo lectura', () => {
  it('un modal abierto se puede cerrar con la X después de pasar a solo lectura', () => {
    render(<ConModal />)
    pasarASoloLectura()

    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled()
    const cerrar = screen.getAllByRole('button', { name: 'Cerrar' })
    expect(cerrar).toHaveLength(2) // el fondo y la X
    cerrar.forEach((boton) => expect(boton).toBeEnabled())

    fireEvent.click(cerrar[1])
    expect(screen.getByText('Modal cerrado')).toBeInTheDocument()
  })

  it('también se cierra tocando el fondo (celular, sin Escape)', () => {
    render(<ConModal />)
    pasarASoloLectura()

    fireEvent.click(screen.getAllByRole('button', { name: 'Cerrar' })[0])
    expect(screen.getByText('Modal cerrado')).toBeInTheDocument()
  })

  it('en la confirmación, Cancelar sigue andando y Confirmar no', () => {
    let cancelado = false
    render(
      <ZonaSoloLectura activo>
        <Confirmacion
          abierto
          titulo="Eliminar"
          mensaje="¿Seguro?"
          textoConfirmar="Eliminar"
          onConfirmar={() => {}}
          onCerrar={() => {
            cancelado = true
          }}
        />
      </ZonaSoloLectura>,
    )
    expect(screen.getByRole('button', { name: 'Eliminar' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(cancelado).toBe(true)
  })
})

describe('salir de solo lectura', () => {
  function Formulario() {
    const [activo, setActivo] = useState(true)
    const [cargando, setCargando] = useState(false)
    return (
      <>
        <button
          type="button"
          onClick={() => {
            // En el mismo commit: se sale de solo lectura y el botón pasa a cargando.
            setActivo(false)
            setCargando(true)
          }}
        >
          salir mientras envía
        </button>
        <button type="button" onClick={() => setActivo(false)}>
          salir
        </button>
        <ZonaSoloLectura activo={activo}>
          <Button cargando={cargando}>Enviar</Button>
          <Button disabled>Sin permiso</Button>
          <Button>Otro</Button>
        </ZonaSoloLectura>
      </>
    )
  }

  it('no habilita un botón que React deshabilitó en el mismo commit (doble envío)', () => {
    render(<Formulario />)
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'salir mientras envía' }))

    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Otro' })).toBeEnabled()
  })

  it('lo que ya estaba deshabilitado antes de entrar sigue deshabilitado al salir', () => {
    render(<Formulario />)
    fireEvent.click(screen.getByRole('button', { name: 'salir' }))

    expect(screen.getByRole('button', { name: 'Sin permiso' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Otro' })).toBeEnabled()
  })
})
