"""
Script de carga de datos de prueba (seed) para las entidades del taller.

Uso (desde la carpeta backend/, con venv activo y la base disponible):

    python -m scripts.seed

Requiere que las tablas existan (alembic upgrade head o el create_all del
lifespan). Las contraseñas se guardan con bcrypt (mismo hash que el login)
y los roles/estados usan los valores del DER, así los datos sirven para
probar el login y el flujo de órdenes de verdad.
"""

import random
import sys
from datetime import datetime, timedelta, timezone

from faker import Faker

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.cliente import Cliente
from app.models.detalle_orden import DetalleOrden
from app.models.orden import Historial_estado, Orden
from app.models.repuesto import Repuesto
from app.models.turno import Turno
from app.models.usuario import RolUsuario, Usuario
from app.models.vehiculo import Vehiculo

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

# Flujo del DER (§3.4) más "pendiente" como estado inicial, igual que el
# mapa TRANSICIONES_VALIDAS del service de órdenes.
ESTADOS_ORDEN = [
    "pendiente", "ingresado", "en_diagnostico",
    "esperando_repuestos", "listo", "entregado",
]

# DER §3.7
ESTADOS_TURNO = ["pendiente", "confirmado", "cancelado", "asistio"]


def crear_usuarios(db, cantidad=4):
    usuarios = []
    for i in range(cantidad):
        usuario = Usuario(
            nombre=fake.first_name(),
            apellido=fake.last_name(),
            email=fake.unique.email(),
            password_hash=hash_password("clave123"),
            rol=RolUsuario.administrador if i == 0 else RolUsuario.mecanico,
        )
        db.add(usuario)
        usuarios.append(usuario)
    db.commit()
    print(f"Usuarios creados: {cantidad} (password de todos: clave123)")
    return usuarios


def crear_clientes(db, cantidad=10):
    clientes = []
    for _ in range(cantidad):
        cliente = Cliente(
            nombre=fake.first_name(),
            apellido=fake.last_name(),
            dni=fake.unique.numerify("########"),
            telefono=fake.phone_number()[:30],
            email=fake.unique.email(),
            direccion=fake.address()[:200],
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
        vehiculo = Vehiculo(
            cliente_id=random.choice(clientes).id,
            patente=fake.unique.bothify(text="??###??").upper(),
            marca=marca,
            modelo=random.choice(MARCAS_MODELOS[marca]),
            anio=random.randint(2015, 2026),
            color=fake.color_name()[:40],
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


def crear_ordenes_con_detalle_e_historial(db, vehiculos, usuarios, repuestos, cantidad=12):
    mecanicos = [u for u in usuarios if u.rol == RolUsuario.mecanico]
    for i in range(cantidad):
        vehiculo = random.choice(vehiculos)
        estado_final = random.choice(ESTADOS_ORDEN)
        fecha_ingreso = datetime.now(timezone.utc) - timedelta(days=random.randint(1, 30))

        orden = Orden(
            cliente_id=vehiculo.cliente_id,
            vehiculo_id=vehiculo.id,
            creado_por_id=random.choice(usuarios).id,
            mecanico_id=random.choice(mecanicos).id if mecanicos else None,
            codigo=f"OT-{1000 + i}",
            estado=estado_final,
            descripcion_ingreso=random.choice(PROBLEMAS_COMUNES),
            diagnostico=None if estado_final == "pendiente" else fake.sentence(),
            costo_estimado=random.randint(15_000, 150_000),
            costo_final=random.randint(15_000, 300_000) if estado_final == "entregado" else None,
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
                descripcion=repuesto.nombre,
                cantidad=random.randint(1, 3),
                precio_unitario=repuesto.precio,
            )
            db.add(detalle)

        # Historial: registro de creacion + cambio al estado final
        db.add(Historial_estado(
            orden_id=orden.id,
            usuario_id=orden.creado_por_id,
            estado_anterior=None,
            estado_nuevo="pendiente",
            comentario="Orden creada",
            fecha=fecha_ingreso,
        ))
        if estado_final != "pendiente":
            db.add(Historial_estado(
                orden_id=orden.id,
                usuario_id=orden.mecanico_id or orden.creado_por_id,
                estado_anterior="pendiente",
                estado_nuevo=estado_final,
                comentario=f"Cambio de estado a {estado_final}",
                fecha=fecha_ingreso + timedelta(hours=random.randint(1, 48)),
            ))

    db.commit()
    print(f"Ordenes creadas (con detalle e historial): {cantidad}")


def crear_turnos(db, vehiculos, usuarios, cantidad=8):
    for _ in range(cantidad):
        vehiculo = random.choice(vehiculos)
        turno = Turno(
            cliente_id=vehiculo.cliente_id,
            vehiculo_id=vehiculo.id,
            registrado_por_id=random.choice(usuarios).id,
            fecha_hora=datetime.now(timezone.utc) + timedelta(days=random.randint(1, 15)),
            estado=random.choice(ESTADOS_TURNO),
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
        crear_ordenes_con_detalle_e_historial(db, vehiculos, usuarios, repuestos)
        crear_turnos(db, vehiculos, usuarios)
        print("Seed completado con exito.")
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
