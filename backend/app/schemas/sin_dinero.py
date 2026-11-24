"""Mecanismo único 'sin dinero': ninguna respuesta al mecánico lleva precios ni montos.

Uso:

1. El schema de respuesta hereda ``SinDineroMixin`` y declara los campos de
   dinero en ``_CAMPOS_DINERO`` (ruta con puntos para campos anidados) junto al
   valor que ocupan cuando el dinero se oculta (``None``, ``[]``, ``False``):

       class RepuestoResponse(SinDineroMixin, RepuestoBase):
           _CAMPOS_DINERO = {"precio": None}

2. El service marca la instancia cuando el rol no ve dinero:

       repuesto.sin_dinero = not ve_dinero(usuario)

   Funciona sobre objetos ORM (atributo transitorio, no ensucia la sesión) y
   sobre responses ya validados. ``sin_dinero`` queda excluido del JSON.

3. ``ve_dinero`` es la única fuente de verdad del rol: hoy solo el mecánico
   queda sin dinero.
"""

from typing import Any, ClassVar

from pydantic import Field, model_serializer

from app.models.usuario import RolUsuario


def ve_dinero(usuario) -> bool:
    """True si el rol recibe precios y montos en las respuestas. El mecánico no."""
    return getattr(usuario, "rol", None) != RolUsuario.mecanico


class SinDineroMixin:
    """Mixin para schemas de respuesta: con ``sin_dinero=True`` el serializer
    deja los campos declarados en ``_CAMPOS_DINERO`` con su valor de reemplazo.

    ``_CAMPOS_DINERO`` mapea ruta del campo serializado (admite ``anidado.campo``)
    al valor que toma al ocultarse. Declarar solo campos de dinero: el resto de
    la respuesta queda intacta. El reemplazo puede ser un callable que recibe el
    valor serializado y devuelve el enmascarado (p. ej. tapar montos dentro de
    un texto libre); si el valor es ``None`` no se lo llama.
    """

    sin_dinero: bool = Field(default=False, exclude=True)
    _CAMPOS_DINERO: ClassVar[dict[str, Any]] = {}

    @model_serializer(mode="wrap")
    def _serializar_sin_dinero(self, handler, info):
        datos = handler(self)
        if self.sin_dinero:
            for ruta, reemplazo in self._CAMPOS_DINERO.items():
                *padres, hoja = ruta.split(".")
                nodo = datos
                for padre in padres:
                    nodo = nodo.get(padre) if isinstance(nodo, dict) else None
                    if nodo is None:
                        break
                else:
                    if not isinstance(nodo, dict) or hoja not in nodo:
                        continue
                    if callable(reemplazo):
                        if nodo[hoja] is not None:
                            nodo[hoja] = reemplazo(nodo[hoja])
                    else:
                        nodo[hoja] = reemplazo
        return datos
