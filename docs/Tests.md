# Tests del backend

## Correr la suite

Desde `backend/`, con las dependencias de desarrollo instaladas
(`pip install -r requirements-dev.txt`, que incluye `pytest-xdist`):

```bash
python -m pytest -q -n auto     # en paralelo: ~1 min
python -m pytest -q             # en serie: ~3 min
```

`-n auto` lanza un worker por núcleo. No está en `addopts` a propósito: para
correr un archivo o un test suelto (`python -m pytest tests/test_x.py -k nombre`)
el arranque de los workers cuesta más de lo que se gana.

Para ver qué tarda: `python -m pytest -q -n auto --durations=20`.

## Por qué es rápida (tests/conftest.py)

La suite tardaba ~16 minutos en serie (más de 30 con la máquina cargada). Casi
todo el tiempo se iba en las fixtures, no en los tests:

1. **bcrypt a 4 rondas en tests.** Con el costo por defecto (12) cada hash
   tarda ~0,4 s y las fixtures crean muchos usuarios (varias tardaban 4-5 s
   solo en armar los datos). En `conftest.py` se reemplaza `bcrypt.gensalt` por
   una versión que usa 4 rondas. Los hashes siguen siendo bcrypt `$2b$` reales
   y `checkpw` lee las rondas de cada hash, así que los hashes fijos de 12
   rondas (el hash dummy anti-enumeración, el de la librería anterior) se
   verifican igual. La app en ejecución no se toca.
2. **SQLite con el journal en memoria.** Las fixtures hacen
   `drop_all`/`create_all` por test. Con el journal por defecto cada transacción
   crea y borra un archivo `-journal` en disco, lo que en Windows es lento. Con
   `PRAGMA journal_mode=MEMORY` y `synchronous=OFF` el ciclo baja de ~0,23 s a
   ~0,09 s. Transacciones, rollback y bloqueos entre conexiones se comportan
   igual; solo se pierde la recuperación ante un corte de luz, que en una base
   descartable no importa.
3. **pytest-xdist.** Cada worker es un proceso con su propia base SQLite
   (`tempfile.mkdtemp()` por proceso, con el id del worker en el nombre del
   directorio) y su propio rate limiter en memoria de slowapi, así que no
   comparten estado. Los archivos que escriben a disco usan `tmp_path`, que
   xdist ya separa por worker.

## Reglas para tests nuevos

- Escribir archivos solo en `tmp_path` (o monkeypatcheando `UPLOADS_DIR` a
  `tmp_path`), nunca en una ruta fija: dos workers la pisarían.
- Si un test enciende el rate limit, que lo haga con una fixture que lo
  restaure y llame a `limiter.reset()` al entrar y al salir (ver
  `limiter_activo` en `tests/test_auth_seguridad.py`).
- No depender del orden de ejecución: con `-n` cada worker corre un subconjunto
  distinto de tests.
