import sys

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.marca import Marca
from app.models.modelo import Modelo

CATALOGO = {
    "Chevrolet": ["Onix", "Prisma", "Cruze", "Tracker", "S10", "Spin", "Corsa", "Agile"],
    "Citroën": ["C3", "C4 Cactus", "Berlingo", "C-Elysée"],
    "Fiat": ["Cronos", "Argo", "Mobi", "Toro", "Strada", "Palio", "Siena", "Uno", "Fiorino"],
    "Ford": ["Ranger", "EcoSport", "Ka", "Fiesta", "Focus", "Territory", "Maverick", "Transit"],
    "Honda": ["Civic", "Fit", "City", "HR-V", "CR-V", "WR-V"],
    "Hyundai": ["HB20", "Creta", "Tucson", "i10", "Santa Fe"],
    "Iveco": ["Daily 35", "Daily 55", "Tector"],
    "Jeep": ["Renegade", "Compass", "Commander"],
    "Nissan": ["Versa", "Sentra", "March", "Kicks", "Frontier"],
    "Peugeot": ["208", "2008", "308", "408", "3008", "Partner", "Expert"],
    "Renault": ["Sandero", "Logan", "Stepway", "Duster", "Kangoo", "Kwid", "Clio", "Alaskan"],
    "Toyota": ["Corolla", "Corolla Cross", "Etios", "Yaris", "Hilux", "Hilux SRV", "SW4", "RAV4"],
    "Volkswagen": ["Gol", "Gol Trend", "Polo", "Virtus", "T-Cross", "Taos", "Amarok", "Saveiro", "Vento", "Up!"],
}


def seed_catalogo() -> tuple[int, int]:
    db = SessionLocal()
    try:
        marcas_nuevas = modelos_nuevos = 0
        for nombre_marca, modelos in CATALOGO.items():
            marca = db.scalar(select(Marca).where(Marca.nombre == nombre_marca))
            if marca is None:
                marca = Marca(nombre=nombre_marca, activo=True)
                db.add(marca)
                db.flush()
                marcas_nuevas += 1
            existentes = set(db.scalars(select(Modelo.nombre).where(Modelo.marca_id == marca.id)))
            for nombre_modelo in modelos:
                if nombre_modelo not in existentes:
                    db.add(Modelo(marca_id=marca.id, nombre=nombre_modelo, activo=True))
                    modelos_nuevos += 1
        db.commit()
        return marcas_nuevas, modelos_nuevos
    finally:
        db.close()


if __name__ == "__main__":
    marcas, modelos = seed_catalogo()
    print(f"Catálogo listo ({marcas} marcas y {modelos} modelos nuevos).")
    sys.exit(0)
