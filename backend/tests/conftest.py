import os
import tempfile

# Antes de importar la app: base SQLite descartable y sin credenciales SMTP reales.
_DB = os.path.join(tempfile.mkdtemp(), "test.db")
os.environ["DATABASE_URL"] = f"sqlite:///{_DB}"
for _clave in ("SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM_EMAIL"):
    os.environ[_clave] = ""
# Rate limit apagado por defecto en tests; los tests que lo ejercitan lo
# activan explícitamente (ver tests/test_auth_seguridad.py).
os.environ["RATE_LIMIT_ENABLED"] = "false"
