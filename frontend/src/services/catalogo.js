import { api } from '@/lib/api'
import { usaMock } from '@/services/config'

const USAR_MOCK = usaMock('catalogo')

const CATALOGO = {
  Chevrolet: ['Onix', 'Cruze', 'Tracker', 'S10', 'Spin', 'Corsa', 'Classic', 'Prisma', 'Agile'],
  Citroën: ['C3', 'C4 Cactus', 'Berlingo', 'C4 Lounge', 'C-Elysée'],
  Fiat: ['Cronos', 'Argo', 'Palio', 'Siena', 'Uno', 'Strada', 'Toro', 'Fiorino', 'Pulse'],
  Ford: ['Ka', 'Fiesta', 'Focus', 'EcoSport', 'Ranger', 'Territory', 'Maverick', 'Transit'],
  Honda: ['Fit', 'City', 'Civic', 'HR-V', 'CR-V', 'WR-V'],
  Hyundai: ['HB20', 'Creta', 'Tucson', 'i10', 'H-1'],
  Iveco: ['Daily 35', 'Daily 55', 'Tector'],
  Jeep: ['Renegade', 'Compass', 'Commander'],
  Kia: ['Rio', 'Cerato', 'Sportage', 'Seltos'],
  'Mercedes-Benz': ['Sprinter', 'Clase A', 'Clase C', 'Vito'],
  Nissan: ['March', 'Versa', 'Sentra', 'Kicks', 'Frontier'],
  Peugeot: ['208', '2008', '308', '408', '3008', 'Partner', 'Expert'],
  Renault: ['Kwid', 'Sandero', 'Logan', 'Stepway', 'Duster', 'Captur', 'Kangoo', 'Oroch', 'Alaskan', 'Clio'],
  Toyota: ['Etios', 'Yaris', 'Corolla', 'Corolla Cross', 'Hilux', 'Hilux SRV', 'SW4', 'RAV4'],
  Volkswagen: ['Gol', 'Gol Trend', 'Polo', 'Virtus', 'Vento', 'T-Cross', 'Taos', 'Nivus', 'Amarok', 'Saveiro', 'Up!'],
}

function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function aOpcion(item) {
  const nombre = typeof item === 'string' ? item : item.nombre
  return { valor: item.id ?? nombre, texto: nombre }
}

function filtrar(lista, q) {
  const termino = normalizar(q)
  return lista.filter((nombre) => normalizar(nombre).includes(termino)).slice(0, 8)
}

function esperar(valor) {
  return new Promise((resolve) => setTimeout(() => resolve(valor), 150))
}

export const catalogoService = {
  marcas: (q, token) =>
    USAR_MOCK
      ? esperar(filtrar(Object.keys(CATALOGO), q).map(aOpcion))
      : api
          .get(`/api/v1/catalogo/marcas?q=${encodeURIComponent(q ?? '')}`, token)
          .then((lista) => lista.map(aOpcion)),

  modelos: (marca, q, token) => {
    if (USAR_MOCK) {
      const clave = Object.keys(CATALOGO).find((item) => normalizar(item) === normalizar(marca))
      const modelos = clave
        ? CATALOGO[clave]
        : Object.values(CATALOGO).flat()
      return esperar(filtrar(modelos, q).map(aOpcion))
    }
    return api
      .get(`/api/v1/catalogo/marcas?q=${encodeURIComponent(marca ?? '')}`, token)
      .then((marcas) => {
        const elegida = marcas.find((item) => normalizar(item.nombre) === normalizar(marca))
        const parametros = new URLSearchParams({ q: q ?? '' })
        if (elegida) parametros.set('marca_id', elegida.id)
        return api.get(`/api/v1/catalogo/modelos?${parametros}`, token)
      })
      .then((lista) => lista.slice(0, 8).map(aOpcion))
  },
}
