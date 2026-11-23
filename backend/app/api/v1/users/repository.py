from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.cliente import Cliente
from app.models.usuario import RolUsuario, Usuario
from app.schemas.paginacion import ParametrosPagina, aplicar, contar


def get_by_id(db: Session, user_id: int) -> Usuario | None:
    return db.get(Usuario, user_id)


def get_by_email(db: Session, email: str) -> Usuario | None:
    stmt = select(Usuario).where(Usuario.email == email.lower())
    return db.scalar(stmt)


def get_cliente_by_email(db: Session, email: str) -> Cliente | None:
    stmt = select(Cliente).where(func.lower(Cliente.email) == email.lower().strip())
    return db.scalars(stmt).first()


def get_by_cliente_id(db: Session, cliente_id: int) -> Usuario | None:
    stmt = select(Usuario).where(Usuario.cliente_id == cliente_id)
    return db.scalar(stmt)


def _stmt_filtrado(*, solo_activos: bool | None, rol: RolUsuario | None):
    stmt = select(Usuario)
    if solo_activos is True:
        stmt = stmt.where(Usuario.activo.is_(True))
    elif solo_activos is False:
        stmt = stmt.where(Usuario.activo.is_(False))
    if rol is not None:
        stmt = stmt.where(Usuario.rol == rol)
    return stmt


def list_usuarios(
    db: Session,
    *,
    solo_activos: bool | None = None,
    rol: RolUsuario | None = None,
    pagina: ParametrosPagina | None = None,
) -> list[Usuario]:
    stmt = _stmt_filtrado(solo_activos=solo_activos, rol=rol).order_by(Usuario.id)
    if pagina is not None:
        stmt = aplicar(stmt, pagina)
    return list(db.scalars(stmt).all())


def contar_usuarios(
    db: Session, *, solo_activos: bool | None = None, rol: RolUsuario | None = None
) -> int:
    return contar(db, _stmt_filtrado(solo_activos=solo_activos, rol=rol))


def contar_superadmins_activos(db: Session) -> int:
    """Superadmins con cuenta activa: tiene que quedar al menos uno (docs/SuperAdmin.md)."""
    stmt = select(func.count(Usuario.id)).where(
        Usuario.rol == RolUsuario.superadmin,
        Usuario.activo.is_(True),
    )
    return db.scalar(stmt) or 0


def create(
    db: Session,
    *,
    nombre: str,
    apellido: str,
    email: str,
    password_hash: str,
    rol: RolUsuario,
    cliente_id: int | None = None,
) -> Usuario:
    user = Usuario(
        nombre=nombre.strip(),
        apellido=apellido.strip(),
        email=email.lower().strip(),
        password_hash=password_hash,
        rol=rol,
        cliente_id=cliente_id,
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
