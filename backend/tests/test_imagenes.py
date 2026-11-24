import io
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from PIL import ExifTags, Image

from app.core.imagenes import MAX_BYTES_IMAGEN, MAX_LADO_PX
from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.main import app
from app.models import Cliente, Orden, Usuario, Vehiculo
from app.models.usuario import RolUsuario


def _jpeg(exif: Image.Exif | None = None, ancho: int = 64, alto: int = 48) -> bytes:
    img = Image.new("RGB", (ancho, alto), (180, 40, 40))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", exif=exif)
    return buf.getvalue()


def _jpeg_con_exif_y_gps() -> bytes:
    img = Image.new("RGB", (64, 48), (180, 40, 40))
    exif = img.getexif()
    exif[ExifTags.Base.Make] = "BoxlyCam"
    exif[ExifTags.Base.Model] = "GPS-9000"
    gps = exif.get_ifd(ExifTags.IFD.GPSInfo)
    gps[ExifTags.GPS.GPSLatitudeRef] = "S"
    gps[ExifTags.GPS.GPSLatitude] = (34, 36, 0)
    gps[ExifTags.GPS.GPSLongitudeRef] = "W"
    gps[ExifTags.GPS.GPSLongitude] = (58, 22, 0)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", exif=exif)
    return buf.getvalue()


def _png_transparente() -> bytes:
    img = Image.new("RGBA", (32, 32), (10, 20, 30, 128))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


@pytest.fixture
def datos(tmp_path, monkeypatch):
    # Las subidas escriben en un directorio descartable, no en uploads/ real.
    monkeypatch.setattr("app.api.v1.ordenes.service.UPLOADS_DIR", tmp_path)
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        admin = Usuario(
            nombre="Admin", apellido="Uno", email="admin@x.com",
            password_hash=hash_password("x"), rol=RolUsuario.administrador,
        )
        cliente = Cliente(nombre="Juan", apellido="Perez", dni="1", email="j@x.com")
        db.add_all([admin, cliente])
        db.commit()
        vehiculo = Vehiculo(
            cliente_id=cliente.id, patente="AB123CD",
            marca="Fiat", modelo="Cronos", anio=2020,
        )
        db.add(vehiculo)
        db.flush()
        orden = Orden(
            codigo="OT-IMG-1", cliente_id=cliente.id, vehiculo_id=vehiculo.id,
            creado_por_id=admin.id, estado="ingresado",
            descripcion_ingreso="Ruido en el motor al acelerar",
        )
        db.add(orden)
        db.commit()
        return {
            "h_admin": {"Authorization": "Bearer " + create_access_token(admin.id)},
            "orden_id": orden.id,
            "tmp_path": tmp_path,
        }


@pytest.fixture
def api():
    with TestClient(app) as cliente:
        yield cliente


def _subir(api, header, orden_id, contenido, nombre="foto.jpg", content_type="image/jpeg"):
    return api.post(
        f"/api/v1/ordenes/{orden_id}/imagenes",
        headers=header,
        files={"archivo": (nombre, contenido, content_type)},
        data={"etapa": "ingresado"},
    )


def _ruta_guardada(datos, imagen):
    return datos["tmp_path"] / "ordenes" / str(datos["orden_id"]) / Path(imagen["url"]).name


def test_exif_y_gps_se_eliminan(api, datos):
    r = _subir(api, datos["h_admin"], datos["orden_id"], _jpeg_con_exif_y_gps())
    assert r.status_code == 201
    imagen = r.json()
    assert imagen["url"].endswith(".jpg")

    with Image.open(_ruta_guardada(datos, imagen)) as guardada:
        assert guardada.format == "JPEG"
        assert len(guardada.getexif()) == 0


def test_archivo_falso_rechazado(api, datos):
    for contenido, content_type in (
        (b"esto no es una imagen", "image/jpeg"),
        (b"\x89PNG\r\n\x1a\n" + b"basura" * 100, "image/png"),
    ):
        r = _subir(api, datos["h_admin"], datos["orden_id"], contenido,
                   content_type=content_type)
        assert r.status_code == 400

    # No quedó ni la fila ni el archivo.
    assert api.get(
        f"/api/v1/ordenes/{datos['orden_id']}/imagenes", headers=datos["h_admin"]
    ).json() == []
    assert not (datos["tmp_path"] / "ordenes").exists()


def test_imagen_gigante_se_reduce(api, datos):
    img = Image.new("RGB", (MAX_LADO_PX + 1000, MAX_LADO_PX + 500), (20, 180, 20))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=60)
    contenido = buf.getvalue()
    assert len(contenido) <= MAX_BYTES_IMAGEN

    r = _subir(api, datos["h_admin"], datos["orden_id"], contenido)
    assert r.status_code == 201

    with Image.open(_ruta_guardada(datos, r.json())) as guardada:
        assert max(guardada.size) <= MAX_LADO_PX
        assert guardada.size == (MAX_LADO_PX, 3600)


def test_mayor_a_5mb_rechazado(api, datos):
    contenido = b"\xff\xd8\xff" + b"0" * MAX_BYTES_IMAGEN
    r = _subir(api, datos["h_admin"], datos["orden_id"], contenido)
    assert r.status_code == 413


def test_png_con_transparencia_guarda_png(api, datos):
    r = _subir(
        api, datos["h_admin"], datos["orden_id"], _png_transparente(),
        nombre="foto.png", content_type="image/png",
    )
    assert r.status_code == 201
    imagen = r.json()
    assert imagen["url"].endswith(".png")
    with Image.open(_ruta_guardada(datos, imagen)) as guardada:
        assert guardada.format == "PNG"
