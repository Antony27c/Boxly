const MOCK_GENERAL = import.meta.env.VITE_USAR_MOCK !== 'false'

const CON_API = (import.meta.env.VITE_API_REAL ?? '')
  .split(',')
  .map((recurso) => recurso.trim())
  .filter(Boolean)

export const USAR_MOCK = MOCK_GENERAL

export function usaMock(recurso) {
  return MOCK_GENERAL && !CON_API.includes(recurso)
}
