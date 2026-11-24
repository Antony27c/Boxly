import csv
import io

from sqlalchemy.orm import Session

from app.api.v1.admin_auditoria import repository
from app.core.suscripcion import hoy
from app.schemas.auditoria import AuditoriaResponse, FiltrosAuditoria
from app.schemas.paginacion import ParametrosPagina

COLUMNAS_CSV = [
    "id",
    "creado_en",
    "usuario_id",
    "usuario_email",
    "rol",
    "metodo",
    "ruta",
    "entidad",
    "entidad_id",
    "estado_http",
    "ip",
    "detalle",
]


def _fila_csv(fila: AuditoriaResponse) -> list[str]:
    return [
        str(fila.id),
        fila.creado_en.isoformat(),
        "" if fila.usuario_id is None else str(fila.usuario_id),
        fila.usuario_email or "",
        fila.rol or "",
        fila.metodo,
        fila.ruta,
        fila.entidad or "",
        "" if fila.entidad_id is None else str(fila.entidad_id),
        str(fila.estado_http),
        fila.ip or "",
        fila.detalle or "",
    ]


def list_auditoria(
    db: Session,
    filtros: FiltrosAuditoria,
    pagina: ParametrosPagina,
) -> tuple[list[AuditoriaResponse], int]:
    items = repository.listar(db, filtros, pagina)
    total = repository.contar(db, filtros)
    return [AuditoriaResponse.model_validate(a) for a in items], total


def exportar_csv(
    db: Session,
    filtros: FiltrosAuditoria,
) -> tuple[str, str]:
    """Devuelve (contenido CSV con BOM, filename) listo para Response."""
    filas = repository.listar_para_exportar(db, filtros)
    salida = io.StringIO()
    escritor = csv.writer(salida)
    escritor.writerow(COLUMNAS_CSV)
    for fila in filas:
        escritor.writerow(_fila_csv(AuditoriaResponse.model_validate(fila)))
    contenido = "﻿" + salida.getvalue()
    return contenido, f"auditoria-{hoy():%Y%m%d}.csv"
