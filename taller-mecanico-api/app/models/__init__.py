# Importar todos los modelos acá para que Alembic los detecte al autogenerar migraciones.
from app.models.usuario import Usuario
from app.models.cliente import Cliente
from app.models.vehiculo import Vehiculo
from app.models.orden_trabajo import OrdenTrabajo
from app.models.detalle_orden import DetalleOrden
from app.models.repuesto import Repuesto
from app.models.turno import Turno
from app.models.historial_estado import HistorialEstado
