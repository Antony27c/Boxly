from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models.marca import Marca
from app.models.modelo import Modelo

def seed_catalogo():
    db= SessionLocal()
    try:
        #Marcas
        marcas_data =[
            "Toyota", "Ford", "Volkswagen", "Chevrolet", "Peugeot", "Renault", "Fiat", "Honda", "Nissan", "Hyundai"]
        marcas ={}
        for nombre in marcas_data:
            nombre = nombre.upper()
            marca = db.query(Marca).filter(Marca.nombre == nombre).first()
            if not marca:
                marca= Marca(nombre=nombre)
                db.add(marca)
                db.flush()
            marcas[nombre] = marca

        modelos_por_marca = {
            "TOYOTA":["Corolla", "Hilux", "Yaris", "RAV4", "Etios"],
            "FORD": ["Fiesta","Focus", "Ranger", "Mustang", "Ka"],
            "VOLKSWAGEN": ["Gol", "Vento", "Polo", "Bora", "Tiguan"],
            "CHEVROLET": ["Onix", "Cruze", "Sonic", "Captiva", "Corsa"],
            "PEUGEOT": ["208", "308", "408", "2008", "Partner"],
            "FIAT": ["Uno", "Palio", "Siena", "Toro", "Cronos"],
            "RENAULT": ["Clio", "Sandero", "Duster", "Logan", "kwid"],
            "HONDA": ["Civic", "Fit", "Cr-V", "HR-V"],
            "NISSAN": ["Versa", "Sentra", "March", "Kicks", "Frontier"],
            "HYUNDAY": ["HB20", "Creta", "i20", "Tucson", "Santa fe"],
        }
        for nombre_marca, modelos in modelos_por_marca.items():
            marca = marcas[nombre_marca]
            for nombre_modelo in modelos:
                nombre_modelo = nombre_modelo.upper()
                existe = db.query(Modelo).filter(
                    Modelo.marca_id == marca.id,
                    Modelo.nombre == nombre_modelo
                ).first()
                if not existe:
                    modelo = Modelo(marca_id=marca.id, nombre=nombre_modelo)
                    db.add(modelo)
        db.commit()
        print("Catalogo seeded: marcas y modelos cargados.")
    finally:
        db.close()
if __name__== "__main__":
    seed_catalogo       