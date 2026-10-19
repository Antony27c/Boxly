import sys
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.cliente import Cliente
from app.models.orden import Historial_estado, Orden
from app.models.repuesto import Repuesto
from app.models.turno import Turno
from app.models.usuario import RolUsuario, Usuario
from app.models.vehiculo import Vehiculo

PASSWORD = "Demo1234"

USUARIOS = [
    ("Admin", "Boxly", "admin@boxly.com", RolUsuario.administrador),
    ("Rosa", "Recepcion", "recepcion@boxly.com", RolUsuario.recepcion),
    ("Mario", "Mecanico", "mecanico@boxly.com", RolUsuario.mecanico),
]

REPUESTOS = [
    ("REP-001", "Filtro de aceite", 4500, 20, 5),
    ("REP-002", "Pastillas de freno", 28000, 8, 4),
    ("REP-003", "Bateria 12V", 95000, 2, 3),
]


def obtener_o_crear(db, modelo, filtro, datos):
    existente = db.scalar(select(modelo).where(*filtro))
    if existente:
        return existente
    nuevo = modelo(**datos)
    db.add(nuevo)
    db.flush()
    return nuevo


def main() -> int:
    db = SessionLocal()
    try:
        usuarios = {
            email: obtener_o_crear(
                db,
                Usuario,
                [Usuario.email == email],
                dict(
                    nombre=nombre,
                    apellido=apellido,
                    email=email,
                    password_hash=hash_password(PASSWORD),
                    rol=rol,
                ),
            )
            for nombre, apellido, email, rol in USUARIOS
        }
        recepcion = usuarios["recepcion@boxly.com"]
        mecanico = usuarios["mecanico@boxly.com"]

        cliente = obtener_o_crear(
            db,
            Cliente,
            [Cliente.dni == "30111222"],
            dict(
                nombre="Juan",
                apellido="Perez",
                dni="30111222",
                telefono="1155550000",
                email="juan.perez@example.com",
                direccion="Av. Siempre Viva 742",
            ),
        )
        vehiculo = obtener_o_crear(
            db,
            Vehiculo,
            [Vehiculo.patente == "AB123CD"],
            dict(
                cliente_id=cliente.id,
                patente="AB123CD",
                marca="Toyota",
                modelo="Corolla",
                anio=2019,
                color="Gris",
            ),
        )

        for codigo, nombre, precio, stock, minimo in REPUESTOS:
            obtener_o_crear(
                db,
                Repuesto,
                [Repuesto.codigo == codigo],
                dict(
                    codigo=codigo,
                    nombre=nombre,
                    precio=precio,
                    stock=stock,
                    stock_minimo=minimo,
                    activo=True,
                ),
            )

        manana = datetime.now(timezone.utc).replace(
            hour=10, minute=0, second=0, microsecond=0
        ) + timedelta(days=1)
        obtener_o_crear(
            db,
            Turno,
            [Turno.vehiculo_id == vehiculo.id, Turno.estado == "confirmado"],
            dict(
                cliente_id=cliente.id,
                vehiculo_id=vehiculo.id,
                registrado_por_id=recepcion.id,
                fecha_hora=manana,
                estado="confirmado",
                motivo="Cambio de aceite y revision de frenos",
            ),
        )

        orden = db.scalar(select(Orden).where(Orden.codigo == "OT-DEMO-1"))
        if orden is None:
            orden = Orden(
                cliente_id=cliente.id,
                vehiculo_id=vehiculo.id,
                creado_por_id=recepcion.id,
                mecanico_id=mecanico.id,
                codigo="OT-DEMO-1",
                estado="pendiente",
                descripcion_ingreso="Ruido en los frenos al frenar",
                costo_estimado=60000,
            )
            db.add(orden)
            db.flush()
            db.add(
                Historial_estado(
                    orden_id=orden.id,
                    usuario_id=recepcion.id,
                    estado_anterior=None,
                    estado_nuevo="pendiente",
                    comentario="Orden creada",
                )
            )

        db.commit()
        print("Datos de demo listos.")
        print(f"Usuarios: admin@boxly.com, recepcion@boxly.com, mecanico@boxly.com (clave: {PASSWORD})")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
