import sys
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select

from app.core.security import hash_password
from app.db.session import SessionLocal, fijar_taller
from app.models.cliente import Cliente
from app.models.configuracion_taller import ConfiguracionTaller
from app.models.detalle_orden import DetalleOrden
from app.models.horario_mecanico import HorarioMecanico
from app.models.orden import Historial_estado, Orden
from app.models.pago import Pago
from app.models.repuesto import Repuesto
from app.models.taller import TALLER_PRINCIPAL_ID, Taller
from app.models.turno import Turno
from app.models.usuario import RolUsuario, Usuario
from app.models.vehiculo import Vehiculo
from scripts.seed_catalogo import seed_catalogo

PASSWORD = "Demo1234"

# El superadmin es de la plataforma (taller_id NULL): se crea sin contexto de
# taller porque con contexto de taller la búsqueda no lo vería.
SUPERADMIN = ("Super", "Admin", "superadmin@boxly.com")

USUARIOS = [
    ("Admin", "Boxly", "admin@boxly.com", RolUsuario.administrador, None),
    ("Rosa", "Recepcion", "recepcion@boxly.com", RolUsuario.recepcion, None),
    ("Mario", "Mecanico", "mecanico@boxly.com", RolUsuario.mecanico, None),
    ("Lucia", "Taller", "mecanico2@boxly.com", RolUsuario.mecanico, None),
    ("Juan", "Perez", "cliente@boxly.com", RolUsuario.cliente, "30111222"),
    ("Laura", "Gomez", "cliente2@boxly.com", RolUsuario.cliente, "27444555"),
]

CLIENTES = [
    ("Juan", "Perez", "30111222", "1155550000", "juan.perez@example.com", "Av. Siempre Viva 742"),
    ("Laura", "Gomez", "27444555", "1155551111", "laura.gomez@example.com", "Calle Falsa 123"),
    ("Carlos", "Diaz", "33666777", "1155552222", "carlos.diaz@example.com", "Ruta 9 km 1500"),
]

VEHICULOS = [
    ("30111222", "AB123CD", "Toyota", "Corolla", 2019, "Gris"),
    ("30111222", "AC456EF", "Ford", "Ranger", 2021, "Blanco"),
    ("27444555", "AD789GH", "Fiat", "Cronos", 2022, "Rojo"),
    ("33666777", "AE321JK", "Volkswagen", "Amarok", 2018, "Negro"),
]

REPUESTOS = [
    ("REP-001", "Filtro de aceite", 4500, 20, 5),
    ("REP-002", "Pastillas de freno", 28000, 8, 4),
    ("REP-003", "Bateria 12V", 95000, 2, 3),
    ("REP-004", "Aceite 5W30 x 4L", 32000, 12, 4),
    ("REP-005", "Bomba de agua", 85000, 1, 2),
    ("REP-006", "Kit de distribucion", 120000, 3, 2),
]

MARIO = "mecanico@boxly.com"
LUCIA = "mecanico2@boxly.com"

ORDENES = [
    dict(
        codigo="OT-DEMO-2", patente="AB123CD", mecanico=MARIO, dias=110,
        descripcion="Service de 60.000 km",
        diagnostico="Service completo, sin novedades.",
        recorrido=[
            ("ingresado", 1, "Ingresó al taller para el service."),
            ("en_diagnostico", 3, "Se revisaron niveles, frenos y tren delantero."),
            ("listo", 30, "Se cambió aceite y filtro. Listo para retirar."),
            ("entregado", 48, "El cliente retiró el vehículo."),
        ],
        detalles=[("REP-004", 1), ("REP-001", 1), (None, "Mano de obra service", 1, 45000)],
        pagos=["aprobado"],
    ),
    dict(
        codigo="OT-DEMO-3", patente="AD789GH", mecanico=LUCIA, dias=95,
        descripcion="Pierde agua y levanta temperatura",
        diagnostico="Bomba de agua con pérdida.",
        recorrido=[
            ("ingresado", 2, "Ingresó con grúa."),
            ("en_diagnostico", 5, "Se confirmó pérdida en la bomba de agua."),
            ("esperando_repuestos", 8, "Se pidió la bomba de agua al proveedor."),
            ("listo", 100, "Se reemplazó la bomba y se probó en ruta."),
            ("entregado", 120, "Entregado al cliente."),
        ],
        detalles=[("REP-005", 1), (None, "Mano de obra cambio de bomba", 1, 90000)],
        pagos=["aprobado"],
    ),
    dict(
        codigo="OT-DEMO-4", patente="AE321JK", mecanico=MARIO, dias=80,
        descripcion="Ruido al frenar",
        diagnostico="Pastillas delanteras gastadas.",
        recorrido=[
            ("ingresado", 1, "Ingresó por la mañana."),
            ("en_diagnostico", 2, "Pastillas al límite, discos en buen estado."),
            ("listo", 20, "Se cambiaron las pastillas delanteras."),
            ("entregado", 30, "Retirado. Pagó en el taller."),
        ],
        detalles=[("REP-002", 2), (None, "Mano de obra frenos", 1, 60000)],
        pagos=[],
    ),
    dict(
        codigo="OT-DEMO-5", patente="AC456EF", mecanico=LUCIA, dias=65,
        descripcion="Cambio de distribución por kilometraje",
        diagnostico="Distribución a cambiar según el plan de mantenimiento.",
        recorrido=[
            ("ingresado", 1, "Ingresó para cambio de distribución."),
            ("en_diagnostico", 4, "Se verificó el kit y la bomba."),
            ("listo", 60, "Distribución cambiada y motor probado."),
            ("entregado", 72, "Entregado al cliente."),
        ],
        detalles=[("REP-006", 1), ("REP-001", 1), (None, "Mano de obra distribución", 1, 150000)],
        pagos=["aprobado"],
    ),
    dict(
        codigo="OT-DEMO-6", patente="AD789GH", mecanico=MARIO, dias=50,
        descripcion="No arranca por las mañanas",
        diagnostico="Batería agotada.",
        recorrido=[
            ("ingresado", 1, "Ingresó sin arrancar."),
            ("en_diagnostico", 2, "Batería sin carga, alternador en buen estado."),
            ("listo", 6, "Se instaló una batería nueva."),
            ("entregado", 24, "Entregado al cliente."),
        ],
        detalles=[("REP-003", 1), (None, "Mano de obra", 1, 15000)],
        pagos=["rechazado", "aprobado"],
    ),
    dict(
        codigo="OT-DEMO-7", patente="AE321JK", mecanico=LUCIA, dias=35,
        descripcion="Service de 120.000 km y revisión general",
        diagnostico="Service completo y cambio de pastillas.",
        recorrido=[
            ("ingresado", 2, "Ingresó para service."),
            ("en_diagnostico", 6, "Se detectó desgaste en pastillas."),
            ("esperando_repuestos", 10, "Se esperan pastillas originales."),
            ("listo", 80, "Service y frenos terminados."),
            ("entregado", 96, "Retirado. Pagó en el taller."),
        ],
        detalles=[
            ("REP-004", 2), ("REP-001", 1), ("REP-002", 2),
            (None, "Mano de obra service completo", 1, 110000),
        ],
        pagos=[],
    ),
    dict(
        codigo="OT-DEMO-8", patente="AB123CD", mecanico=MARIO, dias=20,
        descripcion="Vibración en el volante",
        diagnostico="Neumáticos desbalanceados y alineación corrida.",
        recorrido=[
            ("ingresado", 1, "Ingresó por vibración a alta velocidad."),
            ("en_diagnostico", 2, "Se detectó desbalanceo."),
            ("listo", 20, "Se balanceó y alineó."),
            ("entregado", 36, "Entregado al cliente."),
        ],
        detalles=[(None, "Alineación y balanceo", 1, 38000), (None, "Mano de obra tren delantero", 1, 60000)],
        pagos=["aprobado"],
    ),
    dict(
        codigo="OT-DEMO-9", patente="AD789GH", mecanico=LUCIA, dias=15,
        descripcion="Revisión de aire acondicionado",
        diagnostico=None,
        recorrido=[
            ("ingresado", 1, "Ingresó para revisar el aire."),
            ("en_diagnostico", 3, "Se pasó el presupuesto al cliente."),
            ("cancelado", 30, "El cliente no aceptó el presupuesto."),
        ],
        detalles=[],
        pagos=[],
    ),
    dict(
        codigo="OT-DEMO-10", patente="AC456EF", mecanico=MARIO, dias=6,
        descripcion="Cambio de pastillas y revisión de frenos",
        diagnostico="Pastillas traseras gastadas.",
        recorrido=[
            ("ingresado", 1, "Ingresó por ruido atrás."),
            ("en_diagnostico", 3, "Pastillas traseras al límite."),
            ("listo", 26, "Frenos terminados. Listo para retirar y pagar."),
        ],
        detalles=[("REP-002", 2), (None, "Mano de obra frenos traseros", 1, 79000)],
        pagos=[],
    ),
    dict(
        codigo="OT-DEMO-11", patente="AD789GH", mecanico=LUCIA, dias=4,
        descripcion="Pierde aceite",
        diagnostico="Junta de tapa de cilindros con pérdida.",
        recorrido=[
            ("ingresado", 1, "Ingresó con pérdida de aceite."),
            ("en_diagnostico", 4, "Se encontró la pérdida en la junta."),
            ("esperando_repuestos", 8, "Se pidió la junta al proveedor."),
        ],
        detalles=[],
        pagos=[],
    ),
    dict(
        codigo="OT-DEMO-12", patente="AE321JK", mecanico=MARIO, dias=2,
        descripcion="Luz de check engine encendida",
        diagnostico=None,
        recorrido=[
            ("ingresado", 1, "Ingresó con la luz de motor encendida."),
            ("en_diagnostico", 3, "Se conectó el escáner, revisando sensores."),
        ],
        detalles=[],
        pagos=[],
    ),
    dict(
        codigo="OT-DEMO-13", patente="AE321JK", mecanico=None, dias=1,
        descripcion="Cambio de cubiertas",
        diagnostico=None,
        recorrido=[("ingresado", 2, "Ingresó, falta asignar mecánico.")],
        detalles=[],
        pagos=[],
    ),
]

TURNOS = [
    ("AB123CD", 1, 10, "confirmado", "Cambio de aceite y revision de frenos", MARIO),
    ("AD789GH", 2, 10, "pendiente", "Revisión de la junta reparada", LUCIA),
    ("AE321JK", 3, 16, "confirmado", "Cambio de cubiertas", MARIO),
]

# (mecánico, día 0=lunes..6=domingo, desde, hasta). Mario hace mañana y tarde.
HORARIOS = [
    (MARIO, 0, "08:00", "12:00"), (MARIO, 0, "14:00", "18:00"),
    (MARIO, 2, "08:00", "12:00"), (MARIO, 2, "14:00", "18:00"),
    (MARIO, 4, "08:00", "16:00"),
    (LUCIA, 1, "09:00", "17:00"), (LUCIA, 3, "09:00", "17:00"),
    (LUCIA, 5, "08:00", "12:00"),
]

# ---------------------------------------------------------------------------
# Taller Norte (taller 2): demo multi-taller. Mismos datos de prueba en chico;
# la unicidad de dni/patente/codigo es por taller, así que nada colisiona.
# ---------------------------------------------------------------------------

NORTE_USUARIOS = [
    ("Nora", "Norte", "admin2@boxly.com", RolUsuario.administrador, None),
    ("Rui", "Norte", "recepcion2@boxly.com", RolUsuario.recepcion, None),
    ("Memo", "Norte", "mecanico3@boxly.com", RolUsuario.mecanico, None),
    ("Pedro", "Sosa", "cliente3@boxly.com", RolUsuario.cliente, "30998877"),
]

NORTE_CLIENTES = [
    ("Pedro", "Sosa", "30998877", "3415550000", "pedro.sosa@example.com", "San Martin 450"),
]

NORTE_VEHICULOS = [
    ("30998877", "NT500AB", "Chevrolet", "Onix", 2020, "Azul"),
]

NORTE_REPUESTOS = [
    ("NTE-001", "Pastillas de freno", 26000, 6, 3),
    ("NTE-002", "Filtro de aceite", 4800, 15, 4),
    ("NTE-003", "Bateria 12V", 88000, 3, 2),
]

NORTE_MEMO = "mecanico3@boxly.com"
NORTE_RECEPCION = "recepcion2@boxly.com"

NORTE_ORDENES = [
    dict(
        codigo="OT-NTE-1", patente="NT500AB", mecanico=NORTE_MEMO, dias=20,
        descripcion="Service de 30.000 km",
        diagnostico="Service completo, sin novedades.",
        recorrido=[
            ("ingresado", 1, "Ingresó para el service."),
            ("en_diagnostico", 3, "Niveles y frenos en buen estado."),
            ("listo", 15, "Service terminado."),
            ("entregado", 22, "Retirado y pagado."),
        ],
        detalles=[("NTE-002", 1), (None, "Mano de obra service", 1, 38000)],
        pagos=["aprobado"],
    ),
    dict(
        codigo="OT-NTE-2", patente="NT500AB", mecanico=NORTE_MEMO, dias=8,
        descripcion="Frenos que chirrian",
        diagnostico="Pastillas delanteras gastadas.",
        recorrido=[
            ("ingresado", 1, "Ingresó por ruido al frenar."),
            ("en_diagnostico", 2, "Pastillas al límite, discos OK."),
            ("listo", 10, "Pastillas cambiadas."),
        ],
        detalles=[("NTE-001", 2), (None, "Mano de obra frenos", 1, 45000)],
        pagos=[],
    ),
    dict(
        codigo="OT-NTE-3", patente="NT500AB", mecanico=None, dias=3,
        descripcion="Revisión de tren delantero",
        diagnostico=None,
        recorrido=[("ingresado", 1, "Ingresó para revisión.")],
        detalles=[],
        pagos=[],
    ),
]

NORTE_TURNOS = [
    ("NT500AB", 5, 9, "confirmado", "Service de 60.000 km", NORTE_MEMO),
]

# Memo atiende lunes, miércoles y viernes.
NORTE_HORARIOS = [
    (NORTE_MEMO, 0, "08:00", "12:00"), (NORTE_MEMO, 0, "14:00", "18:00"),
    (NORTE_MEMO, 2, "08:00", "16:00"), (NORTE_MEMO, 4, "09:00", "17:00"),
]


def obtener_o_crear(db, modelo, filtro, datos):
    existente = db.scalar(select(modelo).where(*filtro))
    if existente:
        return existente
    nuevo = modelo(**datos)
    db.add(nuevo)
    db.flush()
    return nuevo


def crear_orden(db, datos, *, ahora, vehiculos, usuarios, repuestos, recepcion):
    vehiculo = vehiculos[datos["patente"]]
    mecanico = usuarios[datos["mecanico"]] if datos["mecanico"] else None
    ingreso = ahora - timedelta(days=datos["dias"])

    lineas = []
    for item in datos["detalles"]:
        if item[0]:
            repuesto = repuestos[item[0]]
            lineas.append((repuesto.id, repuesto.nombre, item[1], Decimal(repuesto.precio)))
        else:
            lineas.append((None, item[1], item[2], Decimal(item[3])))
    total = sum((cantidad * precio for _, _, cantidad, precio in lineas), Decimal("0"))

    estado_final, horas_final, _ = datos["recorrido"][-1]
    orden = Orden(
        cliente_id=vehiculo.cliente_id,
        vehiculo_id=vehiculo.id,
        creado_por_id=recepcion.id,
        mecanico_id=mecanico.id if mecanico else None,
        codigo=datos["codigo"],
        estado=estado_final,
        descripcion_ingreso=datos["descripcion"],
        diagnostico=datos["diagnostico"],
        costo_estimado=total or None,
        costo_final=total if total and estado_final in ("listo", "entregado") else None,
        fecha_ingreso=ingreso,
        fecha_estimada_entrega=ingreso + timedelta(days=3),
        fecha_entrega=ingreso + timedelta(hours=horas_final) if estado_final == "entregado" else None,
    )
    db.add(orden)
    db.flush()

    db.add(Historial_estado(
        orden_id=orden.id, usuario_id=recepcion.id, estado_anterior=None,
        estado_nuevo="pendiente", comentario="Orden creada", fecha=ingreso,
    ))
    anterior = "pendiente"
    for estado, horas, comentario in datos["recorrido"]:
        autor = mecanico if mecanico and estado not in ("ingresado", "entregado", "cancelado") else recepcion
        db.add(Historial_estado(
            orden_id=orden.id, usuario_id=autor.id, estado_anterior=anterior,
            estado_nuevo=estado, comentario=comentario, fecha=ingreso + timedelta(hours=horas),
        ))
        anterior = estado

    for repuesto_id, descripcion, cantidad, precio in lineas:
        db.add(DetalleOrden(
            orden_id=orden.id, repuesto_id=repuesto_id, descripcion=descripcion,
            cantidad=cantidad, precio_unitario=precio,
        ))

    momento = orden.fecha_entrega or ingreso + timedelta(hours=horas_final)
    for numero, estado in enumerate(datos["pagos"], start=1):
        creado = momento - timedelta(hours=len(datos["pagos"]) - numero + 1)
        db.add(Pago(
            orden_id=orden.id, monto=total, estado=estado,
            preference_id=f"demo-pref-{orden.codigo}-{numero}",
            payment_id=f"demo-pay-{orden.codigo}-{numero}",
            creado_en=creado,
            fecha_pago=creado + timedelta(minutes=3) if estado == "aprobado" else None,
        ))


def main() -> int:
    db = SessionLocal()
    try:
        # El superadmin existe una sola vez para toda la plataforma.
        nombre, apellido, email = SUPERADMIN
        obtener_o_crear(
            db, Usuario, [Usuario.email == email],
            dict(
                nombre=nombre, apellido=apellido, email=email,
                password_hash=hash_password(PASSWORD), rol=RolUsuario.superadmin,
            ),
        )
        db.flush()

        # Taller principal (id=1): los datos que la demo ya tenía. Se siembra
        # con el taller en contexto para que el taller_id se complete solo y la
        # búsqueda de existentes quede limitada a este taller.
        fijar_taller(db, TALLER_PRINCIPAL_ID)
        clientes = {
            dni: obtener_o_crear(
                db, Cliente, [Cliente.dni == dni],
                dict(
                    nombre=nombre, apellido=apellido, dni=dni, telefono=telefono,
                    email=email, direccion=direccion,
                ),
            )
            for nombre, apellido, dni, telefono, email, direccion in CLIENTES
        }
        usuarios = {
            email: obtener_o_crear(
                db, Usuario, [Usuario.email == email],
                dict(
                    nombre=nombre, apellido=apellido, email=email,
                    password_hash=hash_password(PASSWORD), rol=rol,
                    cliente_id=clientes[dni].id if dni else None,
                ),
            )
            for nombre, apellido, email, rol, dni in USUARIOS
        }
        recepcion = usuarios["recepcion@boxly.com"]
        vehiculos = {
            patente: obtener_o_crear(
                db, Vehiculo, [Vehiculo.patente == patente],
                dict(
                    cliente_id=clientes[dni].id, patente=patente, marca=marca, modelo=modelo,
                    anio=anio, color=color,
                ),
            )
            for dni, patente, marca, modelo, anio, color in VEHICULOS
        }
        repuestos = {
            codigo: obtener_o_crear(
                db, Repuesto, [Repuesto.codigo == codigo],
                dict(
                    codigo=codigo, nombre=nombre, precio=precio, stock=stock,
                    stock_minimo=minimo, activo=True,
                ),
            )
            for codigo, nombre, precio, stock, minimo in REPUESTOS
        }

        ahora = datetime.now(timezone.utc).replace(tzinfo=None, minute=0, second=0, microsecond=0)
        for patente, dias, hora, estado, motivo, mecanico in TURNOS:
            vehiculo = vehiculos[patente]
            obtener_o_crear(
                db, Turno, [Turno.vehiculo_id == vehiculo.id, Turno.motivo == motivo],
                dict(
                    cliente_id=vehiculo.cliente_id, vehiculo_id=vehiculo.id, registrado_por_id=recepcion.id,
                    mecanico_id=usuarios[mecanico].id,
                    fecha_hora=(ahora + timedelta(days=dias)).replace(hour=hora),
                    estado=estado, motivo=motivo,
                ),
            )

        for mecanico, dia, desde, hasta in HORARIOS:
            mecanico_id = usuarios[mecanico].id
            obtener_o_crear(
                db, HorarioMecanico,
                [HorarioMecanico.mecanico_id == mecanico_id, HorarioMecanico.dia_semana == dia,
                 HorarioMecanico.hora_desde == desde],
                dict(mecanico_id=mecanico_id, dia_semana=dia, hora_desde=desde, hora_hasta=hasta),
            )

        if db.scalar(select(Orden).where(Orden.codigo == "OT-DEMO-1")) is None:
            orden = Orden(
                cliente_id=vehiculos["AB123CD"].cliente_id,
                vehiculo_id=vehiculos["AB123CD"].id,
                creado_por_id=recepcion.id,
                mecanico_id=usuarios[MARIO].id,
                codigo="OT-DEMO-1",
                estado="pendiente",
                descripcion_ingreso="Ruido en los frenos al frenar",
                costo_estimado=60000,
            )
            db.add(orden)
            db.flush()
            db.add(Historial_estado(
                orden_id=orden.id, usuario_id=recepcion.id, estado_anterior=None,
                estado_nuevo="pendiente", comentario="Orden creada",
            ))

        creadas = 0
        for datos in ORDENES:
            if db.scalar(select(Orden).where(Orden.codigo == datos["codigo"])) is None:
                crear_orden(
                    db, datos, ahora=ahora, vehiculos=vehiculos, usuarios=usuarios,
                    repuestos=repuestos, recepcion=recepcion,
                )
                creadas += 1

        # Materializa el taller_id=1 de todo lo pendiente antes de cambiar de taller.
        db.flush()

        # --- Taller Norte (taller 2): demo multi-taller ----------------------
        taller_norte = obtener_o_crear(
            db, Taller, [Taller.nombre == "Taller Norte"],
            dict(nombre="Taller Norte", estado="activo"),
        )
        fijar_taller(db, taller_norte.id)
        clientes_n = {
            dni: obtener_o_crear(
                db, Cliente, [Cliente.dni == dni],
                dict(
                    nombre=nombre, apellido=apellido, dni=dni, telefono=telefono,
                    email=email, direccion=direccion,
                ),
            )
            for nombre, apellido, dni, telefono, email, direccion in NORTE_CLIENTES
        }
        usuarios_n = {
            email: obtener_o_crear(
                db, Usuario, [Usuario.email == email],
                dict(
                    nombre=nombre, apellido=apellido, email=email,
                    password_hash=hash_password(PASSWORD), rol=rol,
                    cliente_id=clientes_n[dni].id if dni else None,
                ),
            )
            for nombre, apellido, email, rol, dni in NORTE_USUARIOS
        }
        recepcion_n = usuarios_n[NORTE_RECEPCION]
        vehiculos_n = {
            patente: obtener_o_crear(
                db, Vehiculo, [Vehiculo.patente == patente],
                dict(
                    cliente_id=clientes_n[dni].id, patente=patente, marca=marca,
                    modelo=modelo, anio=anio, color=color,
                ),
            )
            for dni, patente, marca, modelo, anio, color in NORTE_VEHICULOS
        }
        repuestos_n = {
            codigo: obtener_o_crear(
                db, Repuesto, [Repuesto.codigo == codigo],
                dict(
                    codigo=codigo, nombre=nombre, precio=precio, stock=stock,
                    stock_minimo=minimo, activo=True,
                ),
            )
            for codigo, nombre, precio, stock, minimo in NORTE_REPUESTOS
        }
        obtener_o_crear(
            db, ConfiguracionTaller, [ConfiguracionTaller.taller_id == taller_norte.id],
            dict(taller_id=taller_norte.id, nombre="Taller Norte",
                 direccion="Av. Norte 1000", telefono="3415559999"),
        )

        for patente, dias, hora, estado, motivo, mecanico in NORTE_TURNOS:
            vehiculo = vehiculos_n[patente]
            obtener_o_crear(
                db, Turno, [Turno.vehiculo_id == vehiculo.id, Turno.motivo == motivo],
                dict(
                    cliente_id=vehiculo.cliente_id, vehiculo_id=vehiculo.id, registrado_por_id=recepcion_n.id,
                    mecanico_id=usuarios_n[mecanico].id,
                    fecha_hora=(ahora + timedelta(days=dias)).replace(hour=hora),
                    estado=estado, motivo=motivo,
                ),
            )

        for mecanico, dia, desde, hasta in NORTE_HORARIOS:
            mecanico_id = usuarios_n[mecanico].id
            obtener_o_crear(
                db, HorarioMecanico,
                [HorarioMecanico.mecanico_id == mecanico_id, HorarioMecanico.dia_semana == dia,
                 HorarioMecanico.hora_desde == desde],
                dict(mecanico_id=mecanico_id, dia_semana=dia, hora_desde=desde, hora_hasta=hasta),
            )

        creadas_n = 0
        for datos in NORTE_ORDENES:
            if db.scalar(select(Orden).where(Orden.codigo == datos["codigo"])) is None:
                crear_orden(db, datos, ahora=ahora, vehiculos=vehiculos_n, usuarios=usuarios_n,
                            repuestos=repuestos_n, recepcion=recepcion_n)
                creadas_n += 1

        db.flush()
        fijar_taller(db, None)

        db.commit()
        marcas, modelos = seed_catalogo()
        print(f"Datos de demo listos ({creadas} órdenes nuevas del taller principal, "
              f"{creadas_n} del Taller Norte, {marcas} marcas y {modelos} modelos nuevos en el catálogo).")
        print(f"Clave de todos los usuarios: {PASSWORD}")
        print("  Personal:  superadmin@boxly.com, admin@boxly.com, recepcion@boxly.com,")
        print("             mecanico@boxly.com, mecanico2@boxly.com")
        print("  Clientes:  cliente@boxly.com (Juan Perez), cliente2@boxly.com (Laura Gomez)")
        print("  Taller Norte: admin2@boxly.com, recepcion2@boxly.com, mecanico3@boxly.com,")
        print("             cliente3@boxly.com (Pedro Sosa)")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
