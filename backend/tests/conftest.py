import os
import sqlite3
import tempfile

import bcrypt
from sqlalchemy import Engine, event

# Antes de importar la app: base SQLite descartable y sin credenciales SMTP reales.
# mkdtemp() da un directorio nuevo por proceso, así que con pytest-xdist cada
# worker (gw0, gw1, ...) tiene su propio archivo y no comparten base. El id del
# worker va en el prefijo solo para reconocer los directorios al depurar.
_WORKER = os.environ.get("PYTEST_XDIST_WORKER", "main")
_DB = os.path.join(tempfile.mkdtemp(prefix=f"boxly-tests-{_WORKER}-"), "test.db")
os.environ["DATABASE_URL"] = f"sqlite:///{_DB}"
for _clave in ("SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM_EMAIL"):
    os.environ[_clave] = ""
# Rate limit apagado por defecto en tests; los tests que lo ejercitan lo
# activan explícitamente (ver tests/test_auth_seguridad.py).
os.environ["RATE_LIMIT_ENABLED"] = "false"

# bcrypt con el costo por defecto (12 rondas) tarda ~0,4 s por hash y casi
# todas las fixtures crean usuarios: era la mayor parte del tiempo de la suite.
# En tests se baja al mínimo (4 rondas). El hash sigue siendo bcrypt $2b$ real
# y checkpw lee las rondas del propio hash, así que los hashes de 12 rondas
# fijos en el código o en los tests se siguen verificando igual. Solo afecta
# a este proceso de pytest, nunca a la app en ejecución.
_gensalt_original = bcrypt.gensalt


def _gensalt_rapido(rounds: int = 4, prefix: bytes = b"2b") -> bytes:
    return _gensalt_original(rounds, prefix)


bcrypt.gensalt = _gensalt_rapido


# Casi todas las fixtures hacen drop_all/create_all por test sobre el archivo
# SQLite. Con el journal por defecto cada transacción crea y borra un archivo
# -journal en disco (lento en Windows, sobre todo con antivirus): en memoria
# el drop_all/create_all baja de ~0,23 s a ~0,09 s. Transacciones, rollback y
# bloqueos entre conexiones se comportan igual (el bloqueo sigue siendo sobre el
# archivo de la base); solo se pierde la recuperación ante un corte de luz, que
# en una base descartable no importa. Por lo mismo se omite el fsync.
@event.listens_for(Engine, "connect")
def _sqlite_journal_en_memoria(conexion_dbapi, _registro) -> None:
    if isinstance(conexion_dbapi, sqlite3.Connection):
        conexion_dbapi.execute("PRAGMA journal_mode=MEMORY")
        conexion_dbapi.execute("PRAGMA synchronous=OFF")
