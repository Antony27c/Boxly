import os
import tempfile

# Antes de importar la app: base SQLite descartable y sin credenciales SMTP reales.
_DB = os.path.join(tempfile.mkdtemp(), "test.db")
os.environ["DATABASE_URL"] = f"sqlite:///{_DB}"
for _clave in ("SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM_EMAIL"):
    os.environ[_clave] = ""
