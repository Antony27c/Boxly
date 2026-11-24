import uuid
from datetime import datetime, timezone
from typing import List, Optional

import anyio
from fastapi import BackgroundTasks, HTTPException, UploadFile, status
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.v1.pagos.service import marcar_aprobado
from app.core import imagenes
from app.core.config import UPLOADS_DIR
from app.core.email import enviar_notificacion_cambio_estado, enviar_notificacion_cobro
from app.db.session import SessionLocal, fijar_taller
from app.models.detalle_orden import DetalleOrden
from app.models.imagen_orden import ImagenOrden
from app.models.orden import Orden
from app.models.pago import Pago
from app.models.repuesto import Repuesto
from app.models.usuario import RolUsuario, Usuario, es_admin
from app.models.vehiculo import Vehiculo
from app.schemas.detalle_orden import DetalleOrdenCreate, DetalleOrdenResponse, DetallePrecioUpdate
from app.schemas.imagen_orden import ImagenOrdenResponse
from app.schemas.orden import (
    ESTADOS_ORDEN,
    EstadoOrdenResponse,
    HistorialResponse,
    NotificacionResponse,
    OrdenCreate,
    OrdenUpdate,
    PagoLocalRequest,
)

from .repository import orden_repository

MAX_BYTES_IMAGEN = 5 * 1024 * 1024


def _extension_imagen(contenido: bytes) -> Optional[str]:
    if contenido.startswith(b"\xff\xd8\xff"):
        return ".jpg"
    if contenido.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png"
    if contenido[:4] == b"RIFF" and contenido[8:12] == b"WEBP":
        return ".webp"
    return None


def _borrar_archivo(url: str) -> None:
    ruta = (UPLOADS_DIR / url.removeprefix("/uploads/")).resolve()
    if ruta.is_relative_to(UPLOADS_DIR.resolve()):
        ruta.unlink(missing_ok=True)

TRANSICIONES_VALIDAS = {
    "pendiente":["ingresado","cancelado"],
    "ingresado": ["en_diagnostico", "cancelado"],
    "en_diagnostico": ["esperando_repuestos", "listo", "cancelado"],
    "esperando_repuestos": ["listo", "cancelado"],
    "listo": ["entregado"],
    "entregado": [],
    "cancelado": []
}

ESTADOS_COBRABLES = ("listo", "entregado")


class OrdenService:

    def _validar_cobrable(self, orden: Orden) -> None:
        if orden.estado not in ESTADOS_COBRABLES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El cobro se emite cuando la orden está lista o entregada",
            )
        if orden.pagada:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="La orden ya está pagada")

    def _aprobar_cobro(self, orden: Orden, monto, usuario_id: int) -> None:
        orden.costo_final = monto
        orden.cobro_estado = "aprobado"
        orden.cobro_aprobado_por_id = usuario_id
        orden.cobro_aprobado_en = datetime.now(timezone.utc)

    def _avisar_cobro(self, orden: Orden, background_tasks: BackgroundTasks | None) -> None:
        if background_tasks is None or not orden.cliente or not orden.cliente.email:
            return
        background_tasks.add_task(self.enviar_y_registrar_aviso, orden.id, "", None, "cobro")

    def emitir_cobro(
        self, db: Session, orden_id: int, monto, usuario: Usuario,
        background_tasks: BackgroundTasks | None = None,
    ) -> Orden:
        if usuario.rol == RolUsuario.mecanico:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="El mecánico no emite cobros")
        orden = self.obtener_detalle_orden(db, orden_id)
        self._validar_cobrable(orden)
        if any(d.precio_unitario is None for d in orden.detalles):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Hay trabajos sin cotizar")
        if monto is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Indicá el monto a cobrar",
            )
        self._aprobar_cobro(orden, monto, usuario.id)
        orden = orden_repository.guardar_cambios(db, orden)
        self._avisar_cobro(orden, background_tasks)
        return orden

    def aprobar_cobro(
        self, db: Session, orden_id: int, monto, usuario_id: int,
        background_tasks: BackgroundTasks | None = None,
    ) -> Orden:
        orden = self.obtener_detalle_orden(db, orden_id)
        self._validar_cobrable(orden)
        monto = monto or orden.monto_propuesto
        if not monto:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="No hay un cobro propuesto para aprobar",
            )
        self._aprobar_cobro(orden, monto, usuario_id)
        orden = orden_repository.guardar_cambios(db, orden)
        self._avisar_cobro(orden, background_tasks)
        return orden

    def registrar_pago_local(self, db: Session, orden_id: int, datos: PagoLocalRequest) -> Orden:
        """Pago presencial (efectivo, tarjeta, transferencia u otro) de un cobro emitido.

        Queda como un `Pago` aprobado más: la orden pasa a pagada por el mismo
        camino que un pago online aprobado y las métricas lo cuentan igual.
        """
        # Lock de la orden: dos registros simultáneos no pueden pagarla dos veces.
        if db.scalar(select(Orden.id).where(Orden.id == orden_id).with_for_update()) is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Orden no encontrada")
        orden = self.obtener_detalle_orden(db, orden_id)
        if orden.pagada:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="La orden ya está pagada")
        if orden.cobro_estado != "aprobado" or orden.costo_final is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="La orden no tiene un cobro emitido para registrar el pago",
            )
        # Sin pagos parciales por ahora: se registra el cobro completo.
        if datos.monto != orden.costo_final:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"El monto tiene que ser el del cobro emitido: $ {orden.costo_final:,.2f}",
            )
        # Un intento de pago online que quedó abierto no puede cobrarse después.
        for pendiente in orden.pagos:
            if pendiente.estado == "pendiente":
                pendiente.estado = "rechazado"
        referencia = (datos.referencia or "").strip() or None
        pago = Pago(
            orden_id=orden.id, monto=orden.costo_final, estado="pendiente",
            medio=datos.medio, referencia=referencia,
        )
        db.add(pago)
        db.flush()
        marcar_aprobado(pago)
        db.commit()
        db.expire(orden)
        return self.obtener_detalle_orden(db, orden_id)

    def listar_estados(self) -> List[EstadoOrdenResponse]:
        return [
            EstadoOrdenResponse(
                codigo=codigo,
                nombre=nombre,
                descripcion=descripcion,
                siguientes=TRANSICIONES_VALIDAS.get(codigo, []),
            )
            for codigo, (nombre, descripcion) in ESTADOS_ORDEN.items()
        ]
    
    def obtener_lista_ordenes(
        self, db: Session, estado: Optional[str] = None, mecanico_id: Optional[int] = None
    ) -> List[Orden]:
        
        return orden_repository.obtener_ordenes(db, estado, mecanico_id)

    def obtener_detalle_orden(self, db: Session, orden_id: int, mecanico_id: Optional[int] = None) -> Orden:
        orden = orden_repository.obtener_por_id(db, orden_id)
        if not orden or (mecanico_id is not None and orden.mecanico_id != mecanico_id):
            
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Orden no encontrada")
        return orden

    def validar_edicion_mecanico(
        self, db: Session, orden_id: int, datos: OrdenUpdate, mecanico_id: Optional[int]
    ) -> None:
        if mecanico_id is None:
            return
        self.obtener_detalle_orden(db, orden_id, mecanico_id)
        if datos.mecanico_id is not None and datos.mecanico_id != mecanico_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="No podés reasignar la orden a otro mecánico",
            )
        if datos.costo_final is not None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="El monto final a cobrar lo fija administración o recepción",
            )

    def _validar_mecanico(self, db:Session, mecanico_id: int)-> None:
        mecanico = db.get(Usuario, mecanico_id)
        if mecanico is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="El mecanico asignado no existe",
            )
        if mecanico.rol != RolUsuario.mecanico or not mecanico.activo:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El usuario asignado no es un mecanico activo",
            )

    def crear_orden(self, db:Session, datos:OrdenCreate, creado_por_id:int)-> Orden:
        vehiculo = db.get(Vehiculo, datos.vehiculo_id)
        if vehiculo is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail= "vehiculo no encontrado")
        if datos.mecanico_id is not None:
            self._validar_mecanico(db, datos.mecanico_id)

        cliente_id = vehiculo.cliente_id
        vehiculo_id = vehiculo.id
        for intento in range(3):
            orden = Orden(
                cliente_id = cliente_id,
                vehiculo_id=vehiculo_id,
                creado_por_id=creado_por_id,
                mecanico_id=datos.mecanico_id,
                codigo=orden_repository.siguiente_codigo(db),
                estado="pendiente",
                descripcion_ingreso=datos.descripcion_ingreso,
                costo_estimado=datos.costo_estimado,
                fecha_estimada_entrega= datos.fecha_estimada_entrega,
            )
            db.add(orden)
            try:
                db.flush()
                orden_repository.guardar_historial(
                    db,
                    orden_id=orden.id,
                    usuario_id=creado_por_id,
                    estado_anterior= None,
                    estado_nuevo="pendiente",
                    comentario="Orden creada",
                )
                return orden_repository.guardar_cambios(db, orden)
            except IntegrityError as exc:
                db.rollback()
                if intento == 2 or "codigo" not in str(exc).lower():
                    raise
    
    def editar_orden(
        self, db: Session, orden_id: int, datos: OrdenUpdate, usuario_id: int,
        background_tasks: BackgroundTasks | None = None,
    ) -> Orden:
       
        orden = self.obtener_detalle_orden(db, orden_id)

        if orden.estado in ("entregado", "cancelado"):
            # La orden está cerrada: no admite cambios de datos. La única
            # excepción es dejar un comentario en el historial (re-enviar el
            # mismo estado no cuenta como cambio).
            campos = datos.model_dump(exclude={"comentario_cambio"}, exclude_unset=True)
            if campos.get("estado") == orden.estado:
                campos.pop("estado")
            comentario = (datos.comentario_cambio or "").strip()
            if campos or not comentario:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Orden cerrada: no se puede modificar",
                )
            orden_repository.guardar_historial(
                db,
                orden_id=orden.id,
                usuario_id=usuario_id,
                estado_anterior=orden.estado,
                estado_nuevo=orden.estado,
                comentario=comentario,
            )
            return orden_repository.guardar_cambios(db, orden)

        notificar_estado = None

        if datos.costo_final is not None:
            self._validar_cobrable(orden)
            if any(pago.estado in ("pendiente", "aprobado") for pago in orden.pagos):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="La orden tiene un pago pendiente o aprobado; no se puede cambiar el costo final",
                )
        if datos.mecanico_id is not None:
            self._validar_mecanico(db,datos.mecanico_id)
       
        if datos.estado and datos.estado != orden.estado:
            if datos.estado not in ESTADOS_ORDEN:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, 
                    detail=f"Estado desconocido: '{datos.estado}'"
                )
            estados_permitidos = TRANSICIONES_VALIDAS.get(orden.estado, [])

            if datos.estado not in estados_permitidos:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Transicion invalida. No se puede pasar de '{orden.estado}' a '{datos.estado}'",
                )

            if not datos.comentario_cambio or not datos.comentario_cambio.strip():
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail= "El comentario es obligatorio al cambiar de estado",
                )
            orden_repository.guardar_historial(
                db, 
                orden_id=orden.id, 
                usuario_id=usuario_id,
                estado_anterior=orden.estado, 
                estado_nuevo=datos.estado,
                comentario=datos.comentario_cambio.strip()

            )
            orden.estado = datos.estado
            if datos.estado == "entregado" and orden.fecha_entrega is None:
                orden.fecha_entrega= datetime.now(timezone.utc)
            if datos.estado == "cancelado" and self._devolver_stock(db, orden):
                orden_repository.guardar_historial(
                    db,
                    orden_id=orden.id,
                    usuario_id=usuario_id,
                    estado_anterior=orden.estado,
                    estado_nuevo=orden.estado,
                    comentario="Stock devuelto por cancelación",
                )

            notificar_estado = datos.estado
        for campo in (
            "mecanico_id",
            "descripcion_ingreso",
            "diagnostico",
            "costo_estimado",
            "costo_final",
            "fecha_estimada_entrega",
            "fecha_entrega",
        ):
            valor= getattr(datos, campo)
            if valor is not None:
                setattr(orden, campo, valor)
        if datos.costo_final is not None:
            self._aprobar_cobro(orden, datos.costo_final, usuario_id)
        orden = orden_repository.guardar_cambios(db, orden)
        if datos.costo_final is not None:
            self._avisar_cobro(orden, background_tasks)
        if notificar_estado and background_tasks is not None and orden.cliente and orden.cliente.email:
            background_tasks.add_task(
                self.enviar_y_registrar_aviso, orden.id, datos.comentario_cambio.strip(), None
            )
        return orden

    def enviar_y_registrar_aviso(
        self, orden_id: int, comentario: str, enviado_por_id: Optional[int], tipo: str = "cambio_estado"
    ) -> NotificacionResponse:
        """Manda el aviso (de estado o de cobro) y deja el comprobante en la base.

        Abre su propia sesión: corre en segundo plano, cuando la del request ya se cerró.
        """
        with SessionLocal() as db:
            orden = self.obtener_detalle_orden(db, orden_id)
            # La sesión de fondo arranca sin taller: se fija el de la orden
            # para que el comprobante quede en el taller que la generó.
            fijar_taller(db, orden.taller_id)
            vehiculo = orden.vehiculo
            datos_comunes = (
                orden.cliente.email,
                f"{orden.cliente.apellido}, {orden.cliente.nombre}",
                vehiculo.patente if vehiculo else "N/A",
                vehiculo.marca if vehiculo else "N/A",
                vehiculo.modelo if vehiculo else "N/A",
                orden.codigo,
                ESTADOS_ORDEN[orden.estado][0],
            )
            if tipo == "cobro":
                envio = anyio.from_thread.run(
                    enviar_notificacion_cobro, *datos_comunes, f"$ {orden.costo_final:,.2f}"
                )
            else:
                envio = anyio.from_thread.run(
                    enviar_notificacion_cambio_estado, *datos_comunes, comentario, orden.estado
                )
            notificacion = orden_repository.guardar_notificacion(
                db,
                orden_id=orden.id,
                tipo=tipo,
                estado_orden=orden.estado,
                destinatario=orden.cliente.email,
                asunto=envio.asunto,
                resultado=envio.resultado,
                error=envio.error,
                enviado_por_id=enviado_por_id,
            )
            return NotificacionResponse.model_validate(notificacion)

    def reenviar_aviso(self, db: Session, orden_id: int, usuario_id: int) -> NotificacionResponse:
        orden = self.obtener_detalle_orden(db, orden_id)
        if not orden.cliente or not orden.cliente.email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="El cliente no tiene un email cargado",
            )
        historial = orden_repository.obtener_historial(db, orden_id)
        comentario = (historial[-1].comentario if historial else None) or "Aviso reenviado por el taller"
        return self.enviar_y_registrar_aviso(orden_id, comentario, usuario_id)

    def listar_notificaciones(self, db: Session, orden_id: int) -> List[NotificacionResponse]:
        self.obtener_detalle_orden(db, orden_id)
        return [
            NotificacionResponse.model_validate(item)
            for item in orden_repository.listar_notificaciones(db, orden_id)
        ]

    def obtener_historial_orden(self, db:Session, orden_id: int) -> List[HistorialResponse]:
        self.obtener_detalle_orden(db, orden_id)
        respuesta = []
        for item in orden_repository.obtener_historial(db,orden_id):
            fila = HistorialResponse.model_validate(item)
            if item.usuario:
                fila.usuario_nombre = f"{item.usuario.apellido}, {item.usuario.nombre}"
            respuesta.append(fila)
        return respuesta

    def eliminar_orden(self, db:Session, orden_id:int) -> Orden:
        orden = self.obtener_detalle_orden(db, orden_id)
        if orden.estado != "pendiente":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Solo se pueden eliminar órdenes pendientes. Para las demás, pasala a 'cancelado'.",
            )
        urls = [imagen.url for imagen in orden.imagenes]
        self._devolver_stock(db, orden)
        orden_repository.eliminar(db, orden)
        for url in urls:
            _borrar_archivo(url)
        return orden

    def _validar_orden_editable(self, orden: Orden) -> None:
        if orden.estado in ("entregado", "cancelado"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se puede modificar lineas de una orden cerrada",
            )

    def _devolver_stock(self, db: Session, orden: Orden) -> bool:
        """Devuelve al stock los repuestos de las líneas de la orden.

        Cada reposición es un UPDATE atómico para no pisar movimientos
        concurrentes. Devuelve True si la orden tenía repuestos.
        """
        cantidades: dict[int, int] = {}
        for detalle in orden.detalles:
            if detalle.repuesto_id is not None:
                cantidades[detalle.repuesto_id] = (
                    cantidades.get(detalle.repuesto_id, 0) + detalle.cantidad
                )
        for repuesto_id, cantidad in cantidades.items():
            db.execute(
                update(Repuesto)
                .where(Repuesto.id == repuesto_id)
                .values(stock=Repuesto.stock + cantidad)
            )
        return bool(cantidades)

    def _a_response_detalle(self, detalle:DetalleOrden) -> DetalleOrdenResponse:
        item= DetalleOrdenResponse.model_validate(detalle)
        item.a_cotizar = detalle.precio_unitario is None
        item.subtotal = (
            detalle.cantidad * detalle.precio_unitario
            if detalle.precio_unitario is not None
            else None
        )
        if detalle.repuesto:
            item.repuesto_nombre = detalle.repuesto.nombre
        return item
    def listar_detalles(self, db:Session, orden_id:int) -> List[DetalleOrdenResponse]:
        self.obtener_detalle_orden(db, orden_id)
        return [
            self._a_response_detalle(d)
            for d in orden_repository.listar_detalles(db, orden_id)
        ]
    def agregar_detalle(
        self, db: Session, orden_id: int, datos: DetalleOrdenCreate,
        usuario: Usuario,
    ) -> DetalleOrdenResponse:
        orden= self.obtener_detalle_orden(db, orden_id)
        self._validar_orden_editable(orden)
        es_mecanico = usuario.rol == RolUsuario.mecanico
        if es_mecanico and datos.precio_unitario is not None:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="El mecánico no carga precios")

        repuesto= None
        if datos.repuesto_id is not None:
            repuesto = db.get(Repuesto, datos.repuesto_id)
            if repuesto is None or not repuesto.activo:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND, detail="Repuesto no encontrado o inactivo",
                )
        descripcion = datos.descripcion or (repuesto.nombre if repuesto else None)
        if not descripcion:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Las lineas de mano de obra necesitan descripcion",
            )
        precio = datos.precio_unitario
        if precio is None and repuesto is not None:
            precio = repuesto.precio
        # La mano de obra del mecánico queda sin precio ("a cotizar"); recepción
        # y administración la siguen cargando con precio obligatorio.
        if precio is None and not (es_mecanico and repuesto is None):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="las lineas de mano de obra necesitan precio unitario",
            )
        if repuesto is not None:
            descuento = db.execute(
                update(Repuesto)
                .where(Repuesto.id == repuesto.id, Repuesto.stock >= datos.cantidad)
                .values(stock=Repuesto.stock - datos.cantidad)
            )
            if descuento.rowcount == 0:
                db.refresh(repuesto)
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Stock insuficiente: quedan {repuesto.stock} de {repuesto.nombre}",
                )
        detalle = DetalleOrden(
            orden_id=orden.id,
            repuesto_id=datos.repuesto_id,
            descripcion= descripcion,
            cantidad= datos.cantidad,
            precio_unitario=precio,
        )
        orden_repository.guardar_historial(
            db,
            orden_id=orden.id,
            usuario_id= usuario.id,
            estado_anterior=orden.estado,
            estado_nuevo=orden.estado,
            comentario=f"Linea agregada:{datos.cantidad} x {descripcion}",
        )
        return self._a_response_detalle(orden_repository.guardar_detalle(db,detalle))

    def cotizar_detalle(
        self, db: Session, orden_id: int, detalle_id: int,
        datos: DetallePrecioUpdate, usuario_id: int,
    ) -> DetalleOrdenResponse:
        """Cotiza o corrige el precio de una línea (administración y recepción)."""
        orden = self.obtener_detalle_orden(db, orden_id)
        self._validar_orden_editable(orden)
        detalle = orden_repository.obtener_detalle(db, orden_id, detalle_id)
        if detalle is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Linea no encontrada en esta Orden",
            )
        detalle.precio_unitario = datos.precio_unitario
        orden_repository.guardar_historial(
            db,
            orden_id=orden.id,
            usuario_id=usuario_id,
            estado_anterior=orden.estado,
            estado_nuevo=orden.estado,
            comentario=(
                f"Linea cotizada: {detalle.cantidad} x {detalle.descripcion} "
                f"a ${datos.precio_unitario}"
            ),
        )
        return self._a_response_detalle(orden_repository.guardar_detalle(db, detalle))

    def quitar_detalle( self, db:Session, orden_id: int, detalle_id:int, usuario_id:int) -> None:
        orden= self.obtener_detalle_orden(db, orden_id)
        self._validar_orden_editable(orden)

        detalle = orden_repository.obtener_detalle(db, orden_id, detalle_id)
        if detalle is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Linea no encontrada en esta Orden",
            )
        if detalle.repuesto_id is not None:
            db.execute(
                update(Repuesto)
                .where(Repuesto.id == detalle.repuesto_id)
                .values(stock=Repuesto.stock + detalle.cantidad)
            )
        orden_repository.guardar_historial(
            db,
            orden_id=orden.id,
            usuario_id=usuario_id,
            estado_anterior=orden.estado,
            estado_nuevo=orden.estado,
            comentario=f"Linea quitada: {detalle.cantidad} x {detalle.descripcion}",
        )
        orden_repository.eliminar_detalle(db, detalle)
    def listar_imagenes(self, db:Session, orden_id: int) -> List[ImagenOrdenResponse]:
        self.obtener_detalle_orden(db, orden_id)
        return [
            ImagenOrdenResponse.model_validate(img)
            for img in orden_repository.listar_imagenes(db, orden_id)
        ]
    def agregar_imagen(
        self, db: Session, orden_id: int, archivo: UploadFile, etapa: Optional[str], usuario_id: int
    ) -> ImagenOrdenResponse:
        orden = self.obtener_detalle_orden(db, orden_id)
        etapa = etapa or orden.estado
        if etapa not in ESTADOS_ORDEN:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=f"Etapa desconocida: '{etapa}'",
            )

        contenido = archivo.file.read(MAX_BYTES_IMAGEN + 1)
        contenido, extension = imagenes.procesar(contenido)

        nombre_archivo = f"{uuid.uuid4().hex}{extension}"
        imagen = ImagenOrden(
            orden_id=orden.id,
            etapa=etapa,
            url=f"/uploads/ordenes/{orden.id}/{nombre_archivo}",
            usuario_id=usuario_id,
        )
        imagen = orden_repository.guardar_imagen(db, imagen)

        # El archivo se escribe después del commit: si falla, se borra la
        # fila para no quedar con una imagen registrada sin archivo.
        try:
            imagenes.guardar(
                contenido,
                UPLOADS_DIR / "ordenes" / str(orden.id) / nombre_archivo,
            )
        except Exception:
            orden_repository.eliminar_imagen(db, imagen)
            raise
        return ImagenOrdenResponse.model_validate(imagen)
    def eliminar_imagen(self, db:Session, orden_id:int, imagen_id: int, usuario: Usuario)-> None:
        self.obtener_detalle_orden(db, orden_id)
        imagen= orden_repository.obtener_imagen(db, imagen_id)
        if imagen is None or imagen.orden_id != orden_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Imagen no encontrada")
        if not es_admin(usuario) and imagen.usuario_id != usuario.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Solo el administrador o quien subió la foto puede borrarla",
            )
        _borrar_archivo(imagen.url)
        orden_repository.eliminar_imagen(db, imagen)
orden_service = OrdenService()