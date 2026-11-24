import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import useTituloPagina from '@/hooks/useTituloPagina'

describe('useTituloPagina', () => {
  it('cambia el título y lo restaura al desmontar', () => {
    document.title = 'Título original'
    const { unmount } = renderHook(() => useTituloPagina('Boxly · Gestión para talleres mecánicos'))
    expect(document.title).toBe('Boxly · Gestión para talleres mecánicos')
    unmount()
    expect(document.title).toBe('Título original')
  })

  it('si cambia el título lo actualiza y al salir vuelve al original', () => {
    document.title = 'Título original'
    const { rerender, unmount } = renderHook(({ titulo }) => useTituloPagina(titulo), {
      initialProps: { titulo: 'Primero' },
    })
    rerender({ titulo: 'Segundo' })
    expect(document.title).toBe('Segundo')
    unmount()
    expect(document.title).toBe('Título original')
  })

  it('sin título no toca el de la pestaña', () => {
    document.title = 'Título original'
    renderHook(() => useTituloPagina(''))
    expect(document.title).toBe('Título original')
  })
})
