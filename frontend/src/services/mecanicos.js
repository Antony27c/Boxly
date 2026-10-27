import { api } from '@/lib/api'

const RECURSO = '/api/v1/mecanicos'

export const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

function rango(desde, hasta) {
  const parametros = new URLSearchParams()
  if (desde) parametros.set('desde', desde)
  if (hasta) parametros.set('hasta', hasta)
  const texto = parametros.toString()
  return texto ? `?${texto}` : ''
}

export const mecanicosService = {
  listar: (token) => api.get('/api/v1/users/mecanicos', token),

  horarios: (mecanicoId, token) => api.get(`${RECURSO}/${mecanicoId}/horarios`, token),

  crearHorario: (mecanicoId, horario, token) =>
    api.post(`${RECURSO}/${mecanicoId}/horarios`, { ...horario, dia_semana: Number(horario.dia_semana) }, token),

  actualizarHorario: (mecanicoId, horarioId, horario, token) =>
    api.put(
      `${RECURSO}/${mecanicoId}/horarios/${horarioId}`,
      { ...horario, dia_semana: Number(horario.dia_semana) },
      token,
    ),

  eliminarHorario: (mecanicoId, horarioId, token) =>
    api.del(`${RECURSO}/${mecanicoId}/horarios/${horarioId}`, token),

  calendario: (mecanicoId, { desde, hasta } = {}, token) =>
    api.get(`${RECURSO}/${mecanicoId}/calendario${rango(desde, hasta)}`, token),
}
