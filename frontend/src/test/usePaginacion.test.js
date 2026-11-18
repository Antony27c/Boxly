import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import usePaginacion from '@/hooks/usePaginacion'

describe('usePaginacion', () => {
  it('arranca en la página 1 con offset 0 y total vacío', () => {
    const { result } = renderHook(() => usePaginacion())
    expect(result.current.pagina).toBe(1)
    expect(result.current.offset).toBe(0)
    expect(result.current.paginas).toBe(1)
    expect(result.current.limite).toBe(20)
    expect(result.current.desde).toBe(0)
    expect(result.current.hasta).toBe(0)
  })

  it('calcula páginas, offset y rango a partir del total', () => {
    const { result } = renderHook(() => usePaginacion())
    act(() => result.current.setTotal(45))
    expect(result.current.paginas).toBe(3)
    expect(result.current.pagina).toBe(1)
    expect(result.current.offset).toBe(0)
    expect(result.current.desde).toBe(1)
    expect(result.current.hasta).toBe(20)

    act(() => result.current.setPagina(2))
    expect(result.current.pagina).toBe(2)
    expect(result.current.offset).toBe(20)
    expect(result.current.desde).toBe(21)
    expect(result.current.hasta).toBe(40)

    act(() => result.current.setPagina(3))
    expect(result.current.offset).toBe(40)
    expect(result.current.desde).toBe(41)
    expect(result.current.hasta).toBe(45)
  })

  it('respeta el tamaño de página personalizado', () => {
    const { result } = renderHook(() => usePaginacion(10))
    act(() => result.current.setTotal(25))
    expect(result.current.limite).toBe(10)
    expect(result.current.paginas).toBe(3)
    act(() => result.current.setPagina(3))
    expect(result.current.offset).toBe(20)
    expect(result.current.hasta).toBe(25)
  })

  it('si el total baja, la página efectiva se ajusta sola', () => {
    const { result } = renderHook(() => usePaginacion())
    act(() => result.current.setTotal(100))
    act(() => result.current.setPagina(5))
    expect(result.current.offset).toBe(80)

    act(() => result.current.setTotal(30))
    expect(result.current.paginas).toBe(2)
    expect(result.current.pagina).toBe(2)
    expect(result.current.offset).toBe(20)
    expect(result.current.desde).toBe(21)
    expect(result.current.hasta).toBe(30)
  })

  it('ignora páginas inválidas y reiniciar vuelve a la primera', () => {
    const { result } = renderHook(() => usePaginacion())
    act(() => result.current.setTotal(100))
    act(() => result.current.setPagina(0))
    act(() => result.current.setPagina(-3))
    act(() => result.current.setPagina('abc'))
    expect(result.current.pagina).toBe(1)

    act(() => result.current.setPagina(4))
    expect(result.current.pagina).toBe(4)
    act(() => result.current.reiniciar())
    expect(result.current.pagina).toBe(1)
    expect(result.current.offset).toBe(0)
  })
})
