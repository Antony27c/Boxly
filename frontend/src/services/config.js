// Mientras el backend de Clientes, Vehículos y Turnos no esté publicado, los
// servicios trabajan contra la base simulada de src/mocks. Con
// VITE_USAR_MOCK=false pasan a consumir la API real sin tocar las pantallas.
export const USAR_MOCK = import.meta.env.VITE_USAR_MOCK !== 'false'
