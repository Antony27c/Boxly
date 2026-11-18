"""Logging de la API hacia stdout.

Formato único: timestamp, nivel, logger y mensaje. El nivel se toma de la
variable de entorno LOG_LEVEL (default INFO) con os.getenv, sin pasar por
Settings.
"""

import logging
import os
import sys

_NIVELES = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}
# Marca para reconocer los handlers de este módulo y no duplicarlos si
# create_app() se llama más de una vez (por ejemplo, en los tests).
_MARCA_HANDLER = "_boxly_stdout"


def configurar_logging(nivel: str | None = None) -> None:
    """Configura el logger raíz con un handler a stdout.

    Si `nivel` es None se usa LOG_LEVEL del entorno (default INFO); un valor
    inválido cae a INFO. Es idempotente: no duplica handlers propios ni toca
    los handlers ajenos (pytest, uvicorn).
    """
    nombre = (nivel or os.getenv("LOG_LEVEL", "INFO")).strip().upper()
    nivel_final = nombre if nombre in _NIVELES else "INFO"

    root = logging.getLogger()
    for handler in list(root.handlers):
        if getattr(handler, _MARCA_HANDLER, False):
            root.removeHandler(handler)

    handler = logging.StreamHandler(sys.stdout)
    setattr(handler, _MARCA_HANDLER, True)
    handler.setFormatter(
        logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s")
    )
    root.addHandler(handler)
    root.setLevel(nivel_final)
