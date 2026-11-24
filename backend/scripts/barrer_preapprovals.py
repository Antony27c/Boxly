"""
Barre las preapprovals huérfanas de la cuenta de Mercado Pago de Boxly.

Una preapproval queda huérfana cuando la respuesta de MP se pierde después de
crearla (timeout o corte de red): el reintento crea otra y la primera sigue
viva en MP sin referencia en taller.mp_preapproval_id. No cobra hasta que el
pagador la autorice, pero conviene cancelarla. El alta ya reutiliza las
vivas del mismo taller (P5); este script limpia las que quedaron de antes o
de cualquier otro corte.

Uso (desde la carpeta backend/):

    python -m scripts.barrer_preapprovals            # dry-run: solo muestra
    python -m scripts.barrer_preapprovals --aplicar  # cancela en MP de verdad

Variables (.env o entorno):
    BOXLY_MP_ACCESS_TOKEN (obligatoria: la cuenta de Boxly que cobra suscripciones)

Contrato: docs/Despliegue.md, "Pendientes conocidos".
"""

from __future__ import annotations

import argparse
import sys

from app.api.v1.suscripcion_mp import service
from app.core import mercadopago
from app.core.config import get_settings
from app.db.session import SessionLocal


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Cancela en Mercado Pago las preapprovals de taller que "
        "ya no referencia ningún taller.mp_preapproval_id."
    )
    parser.add_argument(
        "--aplicar",
        action="store_true",
        help="cancelar de verdad en MP (sin este flag solo muestra el dry-run)",
    )
    args = parser.parse_args()

    token = get_settings().boxly_mp_access_token
    if not token:
        print(
            "ERROR: falta BOXLY_MP_ACCESS_TOKEN, no se puede consultar Mercado Pago.",
            file=sys.stderr,
        )
        return 1

    db = SessionLocal()
    try:
        resumen = service.barrer_preapprovals_huerfanas(
            db, token=token, dry_run=not args.aplicar
        )
    except mercadopago.MercadoPagoError as exc:
        print(f"ERROR: no se pudo consultar Mercado Pago: {exc}", file=sys.stderr)
        return 1
    finally:
        db.close()

    huerfanas = resumen["huerfanas"]
    canceladas = set(resumen["canceladas"])
    if not huerfanas:
        print("No hay preapprovals huérfanas: la cuenta de Boxly está limpia.")
        return 0
    for h in huerfanas:
        if h["id"] in canceladas:
            estado = "cancelada"
        elif args.aplicar:
            estado = "error al cancelar (ver log)"
        else:
            estado = "se cancelaría"
        print(
            f"  {h['id']}  ref={h['external_reference']}  "
            f"estado={h['status']}  [{estado}]"
        )
    if args.aplicar:
        print(f"{len(canceladas)} preapproval(s) cancelada(s) en Mercado Pago.")
    else:
        print(
            f"{len(huerfanas)} preapproval(s) huérfana(s). "
            "Dry-run: no se canceló nada. Para cancelar, correr con --aplicar."
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
