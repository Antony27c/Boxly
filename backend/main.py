from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI()


class Alumno(BaseModel):
    nombre: str
    carrera: str


alumnos = [
    {"id": 1, "nombre": "Ana", "carrera": "Sistemas"},
    {"id": 2, "nombre": "Carlos", "carrera": "Redes"},
]


@app.get("/")
def read_root():
    return {"mensaje": "Hola desde de FastAPI!", "status": "OK"}


@app.get("/alumnos")
def lista_alumnos():
    return alumnos


@app.get("/alumnos/{alumno_id}")
def obtener_alumno(alumno_id: int):
    for alumno in alumnos:
        if alumno["id"] == alumno_id:
            return alumno
    raise HTTPException(status_code=404, detail="Alumno no encontrado")


@app.post("/alumnos", status_code=201)
def crear_alumno(alumno: Alumno):
    nuevo_alumno = {
        "id": max((alumno["id"] for alumno in alumnos), default=0) + 1,
        **alumno.model_dump(),
    }
    alumnos.append(nuevo_alumno)
    return nuevo_alumno


@app.put("/alumnos/{alumno_id}")
def actualizar_alumno(alumno_id: int, datos: Alumno):
    for indice, alumno in enumerate(alumnos):
        if alumno["id"] == alumno_id:
            alumnos[indice] = {"id": alumno_id, **datos.model_dump()}
            return alumnos[indice]
    raise HTTPException(status_code=404, detail="Alumno no encontrado")


@app.delete("/alumnos/{alumno_id}")
def eliminar_alumno(alumno_id: int):
    for indice, alumno in enumerate(alumnos):
        if alumno["id"] == alumno_id:
            return {"mensaje": f"Alumno {alumnos.pop(indice)['nombre']} eliminado"}
    raise HTTPException(status_code=404, detail="Alumno no encontrado")
