# Despliegue: notas de configuración

El paso a paso para levantar Boxly en un VPS está en [DEPLOY.md](DEPLOY.md). Acá van
las notas de configuración que conviene entender antes de tocar el servidor.

## Proxy e IP del cliente

La auditoría guarda la IP de cada escritura, y hay límites por IP: el login (5 por
minuto, `slowapi`) y el formulario de contacto de la landing (5 por hora). Todos sacan
la IP de una sola función, `app/core/ip.py`, que devuelve la IP **de la conexión**
(`request.client.host`).

### Por qué no se lee `X-Forwarded-For`

El backend no lee `X-Forwarded-For` ni `X-Real-IP` a mano. Ese encabezado lo puede
mandar cualquiera: si la app le creyera, un atacante podría poner la IP que quisiera en
la auditoría y saltear los límites cambiándola en cada pedido.

La IP real del visitante la pone **uvicorn**, y solo cuando la conexión viene de un
proxy de confianza. `--proxy-headers` viene activo por defecto, y
`--forwarded-allow-ips` dice de qué IPs o redes se acepta el encabezado. En ese caso,
uvicorn reescribe `client.host` con la última IP de la cadena que no es un proxy de
confianza, y la app la recibe ya resuelta. Si la conexión viene de cualquier otro lado,
el encabezado se ignora.

### Qué configurar

Por defecto se confía solo en `127.0.0.1` (y `::1`). Alcanza si el proxy corre en la
misma máquina y le habla a la API por `localhost`.

> **gunicorn solo acepta IPs sueltas.** `FORWARDED_ALLOW_IPS` y `--forwarded-allow-ips`
> llevan IPs separadas por coma, o `*`. Una red CIDR (`172.28.0.0/16`) hace que gunicorn
> no arranque: lo valida con `ipaddress.ip_address`. uvicorn solo, sin gunicorn, sí
> acepta redes.

### docker compose (el despliegue de DEPLOY.md)

Caddy corre en otro contenedor, así que sin configurar nada la API ve la IP interna de
Caddy y no la del visitante. Eso tiene dos consecuencias:

- la auditoría guarda la IP de Caddy para todos los pedidos;
- todos los visitantes comparten el mismo contador de los límites: con 5 logins fallidos
  por minuto entre todos, nadie más puede entrar durante ese minuto.

`docker-compose.yml` ya lo resuelve así:

- la red interna (`default`) tiene una subred fija, `172.28.0.0/16`, declarada con
  `ipam`;
- Caddy tiene IP fija en esa red: `172.28.0.10`;
- el servicio `api` define `FORWARDED_ALLOW_IPS: ${FORWARDED_ALLOW_IPS:-172.28.0.10}`.
  gunicorn lee esa variable de entorno y se la pasa al worker de uvicorn, que tiene
  `--proxy-headers` activo por defecto. El comando de arranque del `Dockerfile` no
  necesita cambios.

La API acepta `X-Forwarded-For` **solo de Caddy**. Los demás contenedores (`web`, `db`)
no son de confianza, y la API no publica puertos. Caddy (`reverse_proxy`, sin
`trusted_proxies`) descarta los `X-Forwarded-*` que manda el visitante y pone la IP real
de la conexión, más `X-Forwarded-Proto` y `X-Forwarded-Host`.

En `.env.prod.example` está `FORWARDED_ALLOW_IPS=172.28.0.10`. Si cambiás la IP de Caddy
o la subred en `docker-compose.yml`, cambiala también en el `.env`.

**Si la subred `172.28.0.0/16` choca** con otra red del servidor (`docker compose up`
falla con "Pool overlaps"), elegí otra subred privada y cambiá las tres cosas juntas:
la `subnet`, la `ipv4_address` de Caddy y `FORWARDED_ALLOW_IPS`.

**Si hay un CDN o balanceador delante de Caddy** (Cloudflare, el balanceador del
proveedor), Caddy ve la IP del CDN. En ese caso hay que configurar `trusted_proxies` en
las opciones globales del Caddyfile con los rangos de ese CDN. Si no, todos los
visitantes vuelven a compartir la IP.

### Otros arranques

**uvicorn directo, sin gunicorn** (acepta IPs y redes):

```sh
uvicorn app.main:app --host 0.0.0.0 --port 8000 \
  --proxy-headers --forwarded-allow-ips="10.0.0.2"
```

**gunicorn por línea de comandos** (equivale a la variable de entorno; solo IPs):

```sh
gunicorn app.main:app -k uvicorn.workers.UvicornWorker --forwarded-allow-ips="10.0.0.2"
```

### Lo que no hay que hacer

- **No usar `FORWARDED_ALLOW_IPS="*"`** si la API se puede alcanzar sin pasar por el
  proxy (puerto 8000 publicado, firewall abierto): cualquiera podría falsear su IP.
- **No agregar código que lea `X-Forwarded-For`.** Si hace falta la IP del cliente en un
  lugar nuevo, usar `ip_cliente(request)` (o `ip_de_scope(scope)` en un middleware) de
  `app/core/ip.py`.

### Cómo verificar

1. Revisá que el YAML sea válido y que la variable llegue a la API:

   ```sh
   docker compose config | grep -n -E "FORWARDED_ALLOW_IPS|ipv4_address|subnet"
   ```

   Tiene que aparecer `FORWARDED_ALLOW_IPS: 172.28.0.10` en `api`,
   `ipv4_address: 172.28.0.10` en `caddy` y `subnet: 172.28.0.0/16`.

2. Levantá el stack y confirmá la IP de Caddy y la variable dentro de la API:

   ```sh
   docker compose up -d --build
   docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' \
     $(docker compose ps -q caddy)                          # 172.28.0.10
   docker compose exec api printenv FORWARDED_ALLOW_IPS     # 172.28.0.10
   ```

3. Desde otra máquina, hacé un login fallido mandando además una IP falsa:

   ```sh
   curl -s -o /dev/null -w "%{http_code}\n" https://TU_DOMINIO/api/v1/auth/login \
     -H "Content-Type: application/json" -H "X-Forwarded-For: 1.2.3.4" \
     -d '{"email":"prueba@x.com","password":"Mala1234"}'              # 401
   ```

4. Mirá qué IP quedó en la auditoría:

   ```sh
   docker compose exec db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
     "SELECT creado_en, ip, ruta, estado_http FROM auditoria ORDER BY id DESC LIMIT 3;"
   ```

   La `ip` tiene que ser la IP pública de la máquina desde la que mandaste el pedido:
   ni `172.28.0.10` (Caddy) ni `1.2.3.4` (la falsa).

   **Docker Desktop (Windows o Mac):** la red virtual de Docker Desktop no conserva la
   IP de origen. Ahí vas a ver la IP del gateway de Docker (por ejemplo `172.28.0.1`)
   aunque todo esté bien configurado. La prueba definitiva es en el VPS Linux. En
   Docker Desktop alcanza con confirmar que la IP auditada **no** es `172.28.0.10` ni
   la falsa.

## Mercado Pago: preapprovals huérfanas

`activar_cobro` (`app/api/v1/suscripcion_mp/service.py`) crea la preapproval
de la suscripción de cada taller en la cuenta de Boxly. Si la respuesta de MP
se pierde después de crearla (timeout o corte de red), el reintento ya no crea
otra: antes de crear busca en `/preapproval/search` una preapproval viva
(`pending` o `authorized`) con el mismo `external_reference` (`taller-<id>`)
y la reutiliza — la API no filtra por `external_reference`, así que la
búsqueda es local sobre los resultados.

Para limpiar las que hayan quedado de antes (o de cualquier otro corte),
correr el barrido (dry-run por defecto):

```sh
docker compose exec api python -m scripts.barrer_preapprovals            # solo muestra
docker compose exec api python -m scripts.barrer_preapprovals --aplicar  # cancela en MP
```

El barrido lista las preapprovals `pending`/`authorized` de la cuenta de
Boxly con referencia `taller-*` y cancela las que no sean el
`mp_preapproval_id` de ningún taller. Conviene correrlo cada tanto (por
ejemplo, una vez por semana o después de incidentes de red).
