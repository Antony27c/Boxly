from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.usuario import RolUsuario, Usuario


def get_by_id(db: Session, user_id: int) -> Usuario | None:
    return db.get(Usuario, user_id)


def get_by_email(db: Session, email: str) -> Usuario | None:
    stmt = select(Usuario).where(Usuario.email == email.lower())
    return db.scalar(stmt)


def list_usuarios(
    db: Session,
    *,
    solo_activos: bool | None = None,
    rol: RolUsuario | None = None,
) -> list[Usuario]:
    stmt = select(Usuario).order_by(Usuario.id)
    if solo_activos is True:
        stmt = stmt.where(Usuario.activo.is_(True))
    elif solo_activos is False:
        stmt = stmt.where(Usuario.activo.is_(False))
    if rol is not None:
        stmt = stmt.where(Usuario.rol == rol)
    return list(db.scalars(stmt).all())


def create(
    db: Session,
    *,
    nombre: str,
    apellido: str,
    email: str,
    password_hash: str,
    rol: RolUsuario,
) -> Usuario:
    user = Usuario(
        nombre=nombre.strip(),
        apellido=apellido.strip(),
        email=email.lower().strip(),
        password_hash=password_hash,
        rol=rol,
        activo=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def update(db: Session, user: Usuario, data: dict) -> Usuario:
    for key, value in data.items():
        setattr(user, key, value)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def soft_delete(db: Session, user: Usuario) -> Usuario:
    user.activo = False
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
