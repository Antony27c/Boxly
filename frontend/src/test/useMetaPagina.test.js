import { afterEach, describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import useMetaPagina, { DOMINIO_PUBLICO, urlPublica } from '@/hooks/useMetaPagina'

const canonical = () => document.head.querySelector('link[rel="canonical"]')
const ogUrl = () => document.head.querySelector('meta[property="og:url"]')

function ponerHeadComoIndex() {
  document.head.innerHTML =
    '<link rel="canonical" href="https://boxly.com.ar/" /><meta property="og:url" content="https://boxly.com.ar/" />'
}

afterEach(() => {
  document.head.innerHTML = ''
})

describe('useMetaPagina', () => {
  it('arma las URLs con la constante del dominio', () => {
    expect(urlPublica('/privacidad')).toBe(`${DOMINIO_PUBLICO}/privacidad`)
    expect(urlPublica('privacidad')).toBe(`${DOMINIO_PUBLICO}/privacidad`)
    expect(urlPublica()).toBe(`${DOMINIO_PUBLICO}/`)
  })

  it('actualiza título, canonical y og:url y los restaura al salir', () => {
    ponerHeadComoIndex()
    document.title = 'Título original'
    const { unmount } = renderHook(() => useMetaPagina('Política de privacidad · Boxly', { ruta: '/privacidad' }))

    expect(document.title).toBe('Política de privacidad · Boxly')
    expect(canonical()).toHaveAttribute('href', `${DOMINIO_PUBLICO}/privacidad`)
    expect(ogUrl()).toHaveAttribute('content', `${DOMINIO_PUBLICO}/privacidad`)

    unmount()
    expect(document.title).toBe('Título original')
    expect(canonical()).toHaveAttribute('href', 'https://boxly.com.ar/')
    expect(ogUrl()).toHaveAttribute('content', 'https://boxly.com.ar/')
  })

  it('sin ruta usa la de la barra de direcciones', () => {
    ponerHeadComoIndex()
    window.history.pushState({}, '', '/boxly')
    const { unmount } = renderHook(() => useMetaPagina('Boxly'))
    expect(canonical()).toHaveAttribute('href', `${DOMINIO_PUBLICO}/boxly`)
    unmount()
    window.history.pushState({}, '', '/')
  })

  it('si el head no tiene las etiquetas las crea y al salir las saca', () => {
    const { unmount } = renderHook(() => useMetaPagina('Boxly', { ruta: '/' }))
    expect(canonical()).toHaveAttribute('href', `${DOMINIO_PUBLICO}/`)
    expect(ogUrl()).toHaveAttribute('content', `${DOMINIO_PUBLICO}/`)
    unmount()
    expect(canonical()).toBeNull()
    expect(ogUrl()).toBeNull()
  })

  it('al cambiar de ruta actualiza y al salir vuelve al valor original', () => {
    ponerHeadComoIndex()
    const { rerender, unmount } = renderHook(({ ruta }) => useMetaPagina('Boxly', { ruta }), {
      initialProps: { ruta: '/' },
    })
    rerender({ ruta: '/privacidad' })
    expect(canonical()).toHaveAttribute('href', `${DOMINIO_PUBLICO}/privacidad`)
    unmount()
    expect(canonical()).toHaveAttribute('href', 'https://boxly.com.ar/')
  })
})
