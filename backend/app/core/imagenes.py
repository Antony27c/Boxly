"""Validación y normalizado de las imágenes que sube el taller.

Las fotos de las órdenes se procesan con Pillow antes de guardarse: se
rechazan los archivos que no son imágenes reales, se re-encodean a JPEG o
PNG (sin EXIF ni GPS) y se acota el tamaño para no guardar originales
pesados ni con metadatos de ubicación.
"""

from io import BytesIO
from pathlib import Path

from fastapi import HTTPException, status
from PIL import Image

MAX_BYTES_IMAGEN = 5 * 1024 * 1024
MAX_LADO_PX = 4000

# Formatos aceptados de entrada; la salida siempre es JPEG o PNG.
_FORMATOS_ENTRADA = {"JPEG", "PNG", "WEBP"}


def _tiene_transparencia(imagen: Image.Image) -> bool:
    return imagen.mode in ("RGBA", "LA") or (
        imagen.mode == "P" and "transparency" in imagen.info
    )


def procesar(contenido: bytes) -> tuple[bytes, str]:
    """Valida y normaliza una imagen subida.

    Devuelve ``(bytes, extension)`` con la imagen re-encodeada: sin EXIF ni
    GPS, con el lado máximo acotado a ``MAX_LADO_PX`` y en JPEG (o PNG si
    tiene transparencia). Lanza HTTPException 413 si pesa más de 5 MB o
    400 si no se puede decodificar como imagen JPG, PNG o WEBP.
    """
    if len(contenido) > MAX_BYTES_IMAGEN:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail="La imagen no puede pesar más de 5 MB",
        )
    try:
        # verify() solo revisa la estructura del archivo; hay que reabrirla
        # para trabajar con ella (verify deja la imagen inutilizable).
        with Image.open(BytesIO(contenido)) as imagen:
            imagen.verify()
        with Image.open(BytesIO(contenido)) as imagen:
            imagen.load()
            if imagen.format not in _FORMATOS_ENTRADA:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Solo se permiten imágenes JPG, PNG o WEBP",
                )
            imagen.thumbnail((MAX_LADO_PX, MAX_LADO_PX))
            salida = BytesIO()
            if _tiene_transparencia(imagen):
                if imagen.mode != "RGBA":
                    imagen = imagen.convert("RGBA")
                # Sin pasar exif= no se escribe ningún metadato.
                imagen.save(salida, format="PNG", optimize=True)
                return salida.getvalue(), ".png"
            imagen.convert("RGB").save(
                salida, format="JPEG", quality=85, optimize=True
            )
            return salida.getvalue(), ".jpg"
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo no es una imagen válida",
        ) from None


def guardar(contenido: bytes, destino: Path) -> None:
    """Escribe los bytes en ``destino`` creando las carpetas que falten."""
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_bytes(contenido)
