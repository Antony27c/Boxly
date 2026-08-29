## Estructura del proyecto

```
tp-productos-api/
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── core/
│   │   ├── __init__.py
│   │   └── db.py
│   ├── models/
│   │   ├── __init__.py
│   │   ├── categoria.py
│   │   └── producto.py
│   └── api/
│       ├── __init__.py
│       └── v1/
│           ├── __init__.py
│           └── productos/
│               ├── __init__.py
│               ├── router.py
│               ├── schemas.py
│               └── repository.py
├── requirements.txt
├── README.md
└── .gitignore
```