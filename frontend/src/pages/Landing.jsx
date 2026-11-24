import Encabezado from '@/components/landing/Encabezado'
import Hero from '@/components/landing/Hero'
import Funciones from '@/components/landing/Funciones'
import ComoFunciona from '@/components/landing/ComoFunciona'
import VistaPrevia from '@/components/landing/VistaPrevia'
import Confianza from '@/components/landing/Confianza'
import Planes from '@/components/landing/Planes'
import Preguntas from '@/components/landing/Preguntas'
import Contacto from '@/components/landing/Contacto'
import Pie from '@/components/landing/Pie'
import useMetaPagina from '@/hooks/useMetaPagina'

// Landing pública de Boxly (docs/Landing.md). Cada sección es de una tarea distinta;
// el orden y los ids de ancla los fija este archivo.
export default function Landing() {
  useMetaPagina('Boxly · Gestión para talleres mecánicos', { ruta: '/' })
  return (
    <div className="landing min-h-screen bg-g900 text-ink">
      <Encabezado />
      <main id="contenido">
        <Hero />
        <Funciones />
        <ComoFunciona />
        <VistaPrevia />
        <Confianza />
        <Planes />
        <Preguntas />
        <Contacto />
      </main>
      <Pie />
    </div>
  )
}
