"""
Script de carga de datos de prueba (seed) para las 8 entidades del taller.

Ejecutar con:
    python seed.py

Requiere que las migraciones ya se hayan aplicado (alembic upgrade head)
y que la base de datos exista y esté accesible.
"""

import hashlib
import random
from datetime import datetime, timedelta, timezone
from faker import Faker

from app.database import SessionLocal
from app.models.usuario import Usuario
from app.models.cliente import Cliente
from app.models.vehiculo import Vehiculo
from app.models.orden_trabajo import OrdenTrabajo
from app.models.detalle_orden import DetalleOrden
from app.models.repuesto import Repuesto
from app.models.turno import Turno
from app.models.historial_estado import HistorialEstado

fake = Faker("es_AR")

MARCAS_MODELOS = {
    "Toyota": ["Corolla", "Hilux", "Etios"],
    "Ford": ["Fiesta", "Ranger", "Focus"],
    "Volkswagen": ["Gol", "Amarok", "Vento"],
    "Chevrolet": ["Onix", "S10", "Cruze"],
    "Fiat": ["Cronos", "Toro", "Argo"],
}

PROBLEMAS_COMUNES = [
    "Ruido en el motor al acelerar",
    "Frenos chillan al frenar",
    "Pierde aceite",
    "No enciende",
    "Cambio de aceite y filtro",
    "Revision de suspension",
    "Aire acondicionado no enfria",
    "Luces del tablero encendidas",
]

REPUESTOS_NOMBRES = [
    "Filtro de aceite", "Pastillas de freno", "Correa de distribucion",
    "Bujia", "Amortiguador delantero", "Bateria 12V", "Filtro de aire",
    "Liquido refrigerante", "Aceite 10W40 (litro)", "Rotula de suspension",
]

ESTADOS_ORDEN = ["pendiente", "en_proceso", "terminado", "entregado"]


def _hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def crear_usuarios(db, cantidad=4):
    usuarios = []
    for i in range(cantidad):
        usuario = Usuario(
            nombre=fake.first_name(),
            apellido=fake.last_name(),
            email=fake.unique.email(),
            password_hash=_hash_password("clave123"),
            rol="admin" if i == 0 else "mecanico",
        )
        db.add(usuario)
        usuarios.append(usuario)
    db.commit()
    print(f"Usuarios creados: {cantidad}")
    return usuarios


def crear_clientes(db, cantidad=10):
    clientes = []
    for _ in range(cantidad):
        cliente = Cliente(
            nombre=fake.first_name(),
            apellido=fake.last_name(),
            dni=fake.unique.numerify("########"),
            telefono=fake.phone_number(),
            email=fake.unique.email(),
            direccion=fake.address(),
        )
        db.add(cliente)
        clientes.append(cliente)
    db.commit()
    print(f"Clientes creados: {cantidad}")
    return clientes


def crear_vehiculos(db, clientes, cantidad=15):
    vehiculos = []
    for _ in range(cantidad):
        marca = random.choice(list(MARCAS_MODELOS.keys()))
        modelo = random.choice(MARCAS_MODELOS[marca])
        vehiculo = Vehiculo(
            cliente_id=random.choice(clientes).id,
            patente=fake.unique.bothify(text="??###??").upper(),
            marca=marca,
            modelo=modelo,
            anio=random.randint(2015, 2026),
            color=fake.color_name(),
            vin=fake.unique.bothify(text="#################").upper(),
            observaciones=None,
        )
        db.add(vehiculo)
        vehiculos.append(vehiculo)
    db.commit()
    print(f"Vehiculos creados: {cantidad}")
    return vehiculos


def crear_repuestos(db):
    repuestos = []
    for nombre in REPUESTOS_NOMBRES:
        repuesto = Repuesto(
            codigo=fake.unique.bothify(text="REP-####"),
            nombre=nombre,
            descripcion=fake.sentence(nb_words=6),
            stock=random.randint(0, 50),
            stock_minimo=5,
            precio=random.randint(2_000, 80_000),
            activo=True,
        )
        db.add(repuesto)
        repuestos.append(repuesto)
    db.commit()
    print(f"Repuestos creados: {len(repuestos)}")
    return repuestos


def crear_ordenes_con_detalle_e_historial(db, clientes, vehiculos, usuarios, repuestos, cantidad=12):
    mecanicos = [u for u in usuarios if u.rol == "mecanico"]
    for i in range(cantidad):
        vehiculo = random.choice(vehiculos)
        estado_final = random.choice(ESTADOS_ORDEN)
        fecha_ingreso = datetime.now(timezone.utc) - timedelta(days=random.randint(1, 30))

        orden = OrdenTrabajo(
            cliente_id=vehiculo.cliente_id,
            vehiculo_id=vehiculo.id,
            creado_por_id=random.choice(usuarios).id,
            mecanico_id=random.choice(mecanicos).id if mecanicos else None,
            codigo=f"OT-{1000 + i}",
            estado=estado_final,
            descripcion_ingreso=random.choice(PROBLEMAS_COMUNES),
            diagnostico=None if estado_final == "pendiente" else fake.sentence(),
            costo_estimado=random.randint(15_000, 150_000),
            costo_final=random.randint(15_000, 300_000) if estado_final in ("terminado", "entregado") else None,
            fecha_ingreso=fecha_ingreso,
            fecha_estimada_entrega=fecha_ingreso + timedelta(days=random.randint(1, 5)),
            fecha_entrega=fecha_ingreso + timedelta(days=random.randint(1, 5)) if estado_final == "entregado" else None,
        )
        db.add(orden)
        db.flush()  # para obtener orden.id sin cerrar la transaccion

        # 1 a 3 repuestos usados por orden
        for _ in range(random.randint(1, 3)):
            repuesto = random.choice(repuestos)
            detalle = DetalleOrden(
                orden_id=orden.id,
                repuesto_id=repuesto.id,
                descripcion=None,
                cantidad=random.randint(1, 3),
                precio_unitario=repuesto.precio,
            )
            db.add(detalle)

        # Historial: al menos un cambio de estado registrado
        historial = HistorialEstado(
            orden_id=orden.id,
            usuario_id=orden.creado_por_id,
            estado_anterior=None,
            estado_nuevo="pendiente",
            comentario="Orden creada",
            fecha=fecha_ingreso,
        )
        db.add(historial)

        if estado_final != "pendiente":
            cambio = HistorialEstado(
                orden_id=orden.id,
                usuario_id=orden.mecanico_id or orden.creado_por_id,
                estado_anterior="pendiente",
                estado_nuevo=estado_final,
                comentario=f"Cambio de estado a {estado_final}",
                fecha=fecha_ingreso + timedelta(hours=random.randint(1, 48)),
            )
            db.add(cambio)

    db.commit()
    print(f"Ordenes de trabajo creadas (con detalle e historial): {cantidad}")


def crear_turnos(db, clientes, vehiculos, usuarios, cantidad=8):
    for _ in range(cantidad):
        vehiculo = random.choice(vehiculos)
        turno = Turno(
            cliente_id=vehiculo.cliente_id,
            vehiculo_id=vehiculo.id,
            registrado_por_id=random.choice(usuarios).id,
            fecha_hora=datetime.now(timezone.utc) + timedelta(days=random.randint(1, 15)),
            estado=random.choice(["pendiente", "confirmado", "cancelado", "completado"]),
            motivo=random.choice(PROBLEMAS_COMUNES),
            notas=None,
        )
        db.add(turno)
    db.commit()
    print(f"Turnos creados: {cantidad}")


def main():
    db = SessionLocal()
    try:
        usuarios = crear_usuarios(db)
        clientes = crear_clientes(db)
        vehiculos = crear_vehiculos(db, clientes)
        repuestos = crear_repuestos(db)
        crear_ordenes_con_detalle_e_historial(db, clientes, vehiculos, usuarios, repuestos)
        crear_turnos(db, clientes, vehiculos, usuarios)
        print("Seed completado con exito (8 entidades cargadas).")
    finally:
        db.close()


if __name__ == "__main__":
    main()
