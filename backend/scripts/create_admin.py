"""
Script de utilidad (Sprint 1 — Antonio): crea un usuario administrador inicial.

Uso (desde la carpeta backend/, con venv activo y PostgreSQL disponible):

    python -m scripts.create_admin

Variables opcionales (.env o entorno):
    BOXLY_ADMIN_EMAIL, BOXLY_ADMIN_PASSWORD, BOXLY_ADMIN_NOMBRE, BOXLY_ADMIN_APELLIDO

La carga formal de seeds (BD-03) la completa Pablo Romano.
"""

from __future__ import annotations

import os
import sys

from app.core.security import hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.api.v1.users import repository
from app.models.usuario import RolUsuario


def main() -> int:
    Base.metadata.create_all(bind=engine)

    email = os.getenv("BOXLY_ADMIN_EMAIL", "admin@boxly.com").lower().strip()
    password = os.getenv("BOXLY_ADMIN_PASSWORD", "Admin123")
    nombre = os.getenv("BOXLY_ADMIN_NOMBRE", "Admin")
    apellido = os.getenv("BOXLY_ADMIN_APELLIDO", "Boxly")

    db = SessionLocal()
    try:
        if repository.get_by_email(db, email):
            print(f"Ya existe un usuario con email {email}. No se creó otro.")
            return 0

        user = repository.create(
            db,
            nombre=nombre,
            apellido=apellido,
            email=email,
            password_hash=hash_password(password),
            rol=RolUsuario.administrador,
        )
        print("Administrador creado:")
        print(f"  id:    {user.id}")
        print(f"  email: {user.email}")
        print(f"  rol:   {user.rol.value}")
        print("  (usá la contraseña configurada en BOXLY_ADMIN_PASSWORD / default Admin123)")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
