# ☁️ Desplegar MediClick AI en Azure for Students (gratis, sin tarjeta)

**Qué usamos**
- **Azure for Students:** $100 USD de crédito por 12 meses, sin tarjeta, verificando el correo de la universidad.
- **Un servidor Linux (VM)** donde corre el `docker-compose` completo (los 10 contenedores).
- **DuckDNS:** dominio gratis.
- **Caddy:** HTTPS automático (certificados gratis).

```
Internet ─► https://api.TU.duckdns.org ─┐
         ─► https://n8n.TU.duckdns.org ─┼─► Caddy (HTTPS) ─► Gateway / n8n ─► microservicios
         ─► https://app.TU.duckdns.org ─┘   (Postgres, Redis y RabbitMQ NO quedan abiertos)
```

---

## Paso 0 · Activar Azure for Students

1. Entra a https://azure.microsoft.com/free/students → **Start free / Comenzar gratis**.
2. Inicia sesión con tu **correo de la UNACH** (o con una cuenta Microsoft y luego verificas ese correo).
3. Verifica con el código que llega al correo y, si lo pide, con tu teléfono. **No pide tarjeta.**
4. Al terminar entras al **Portal de Azure**: https://portal.azure.com

## Paso 1 · Crear el servidor (máquina virtual)

Portal → busca **Virtual machines** → **Create → Azure virtual machine**.

| Campo | Valor |
|---|---|
| Subscription | *Azure for Students* |
| Resource group | **Create new** → `mediclick` |
| Virtual machine name | `mediclick-vm` |
| Region | La que te deje (ej. *East US 2*, *Central US*). Si sale error de "policy", prueba otra |
| Image | **Ubuntu Server 24.04 LTS – x64 Gen2** |
| Size | **B2s** (2 vCPU, 4 GiB) o **B2als v2** (2 vCPU, 4 GiB) |
| Authentication type | **SSH public key** |
| Username | `azureuser` |
| SSH public key source | **Generate new key pair** · Key pair name `mediclick-key` |
| Public inbound ports | **Allow selected ports** → marca **SSH (22), HTTP (80), HTTPS (443)** |

Pestaña **Disks:** *Standard SSD*, 30 GB es suficiente.

**Review + create → Create → Download private key and create resource.**
Guarda el archivo `mediclick-key.pem` en `C:\Users\marif\.ssh\`.

Al terminar: **Go to resource** → copia la **Public IP address**.

### 1.1 · Ahorra crédito con apagado automático
En la VM → **Operations → Auto-shutdown** → actívalo (ej. 23:30, zona *Central Standard Time (Mexico)*).
Para prenderla otro día: VM → **Start**. Apagada no gasta cómputo (solo unos centavos de disco e IP).

> 💰 Costo aproximado de una B2s prendida todo el mes: ~30 USD → el crédito de 100 USD dura ~3 meses
> encendida 24/7, y mucho más si la apagas cuando no la uses. Revisa el costo exacto que muestra el portal
> al crearla y tu saldo en https://www.microsoftazuresponsorships.com/Balance

## Paso 2 · Dominio gratis con DuckDNS

1. https://www.duckdns.org → inicia sesión con Google o GitHub.
2. Crea un subdominio (ej. `mediclick-fer`) → en **current ip** pon la IP pública de tu VM → **update ip**.
3. Funcionan automáticamente: `api.mediclick-fer.duckdns.org`, `n8n.mediclick-fer.duckdns.org` y `app.mediclick-fer.duckdns.org`.

## Paso 3 · Conectarte al servidor (PowerShell en tu laptop)

```powershell
icacls C:\Users\marif\.ssh\mediclick-key.pem /inheritance:r /grant:r "$($env:USERNAME):R"
ssh -i C:\Users\marif\.ssh\mediclick-key.pem azureuser@TU_IP
```
La primera vez escribe `yes`.

## Paso 4 · Preparar el servidor (ya dentro por SSH)

```bash
# Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker azureuser

# Memoria extra de respaldo (swap de 4 GB) para que no se quede corto
sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

sudo apt-get install -y unzip
exit      # sal y vuelve a entrar para que aplique el grupo docker
```

## Paso 5 · Subir el proyecto

En tu **laptop** (PowerShell), parado en `C:\Users\marif\Downloads\mediclick-ai`:
```powershell
tar -a -c -f mediclick.zip --exclude=node_modules --exclude=.expo --exclude=.env mediclick-ai
scp -i C:\Users\marif\.ssh\mediclick-key.pem mediclick.zip azureuser@TU_IP:~
```

En el **servidor**:
```bash
unzip mediclick.zip && cd mediclick-ai
cp .env.prod.example .env
openssl rand -hex 24      # ejecútalo 3 veces: contraseña de Postgres, de RabbitMQ y JWT_SECRET
nano .env                 # pon dominios, contraseñas y GROQ_API_KEY (Ctrl+O, Enter, Ctrl+X)
```

## Paso 6 · Arrancar en modo producción

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
```
Prueba en el navegador (debe salir el candado 🔒):
- `https://api.TU.duckdns.org/health`
- `https://api.TU.duckdns.org/admin`
- `https://n8n.TU.duckdns.org`

## Paso 7 · ⚠️ Seguridad (obligatorio)

1. Panel admin → entra con `admin@mediclick.com` / `Admin123` → **Usuarios** → tu admin → **nueva contraseña**.
2. Cambia la contraseña de las cuentas demo (paciente y médicos) o elimínalas.
3. Nunca compartas el `.env` ni la llave `.pem`.

## Paso 8 · n8n y Telegram

1. **En tu laptop**, apaga el n8n local para que no le "robe" el bot al servidor:
   `docker compose stop` (o despublica ahí el workflow de Medi).
2. En `https://n8n.TU.duckdns.org` crea tu cuenta, tus credenciales de Telegram y de Groq.
3. Importa los workflows **01** y **03**, asígnales las credenciales y **publícalos**.
4. Escríbele al bot: ahora responde desde la nube, aunque tu laptop esté apagada.

## Paso 9 · La app

**Celular (Expo Go):** en tu laptop, `mobile/.env`:
```
EXPO_PUBLIC_API_URL=https://api.TU.duckdns.org
```
`npx expo start -c` → funciona con datos móviles o cualquier WiFi.

**Versión web pública (opcional):** en la laptop, carpeta `mobile`:
```powershell
npx expo export --platform web
tar -a -c -f dist.zip dist
scp -i C:\Users\marif\.ssh\mediclick-key.pem dist.zip azureuser@TU_IP:~/mediclick-ai/mobile/
```
Servidor: `cd ~/mediclick-ai/mobile && unzip -o dist.zip && docker restart mediclick-caddy`
→ `https://app.TU.duckdns.org` desde cualquier lugar.

## Paso 10 · pgAdmin y RabbitMQ (por túnel SSH)

```powershell
ssh -i C:\Users\marif\.ssh\mediclick-key.pem -L 5050:localhost:5050 -L 15672:localhost:15672 azureuser@TU_IP
```
Con esa ventana abierta: `http://localhost:5050` y `http://localhost:15672`.

## Comandos útiles en el servidor

```bash
cd ~/mediclick-ai
alias dc='docker compose -f docker-compose.yml -f docker-compose.prod.yml'
dc ps                       # estado
dc logs -f triage-service   # logs de un servicio
dc up -d --build            # después de subir cambios
free -h                     # memoria usada
```

## Si algo falla

| Problema | Solución |
|---|---|
| No abre tu dominio | Revisa la IP en DuckDNS y que la VM tenga abiertos 80 y 443 (VM → Networking) |
| Sin candado / error de certificado | `dc logs caddy`: casi siempre es el puerto 80 cerrado o la IP mal en DuckDNS |
| Contenedores que se reinician | `dc logs NOMBRE` y `free -h` (si falta memoria, revisa el swap del paso 4) |
| Telegram no responde | `dc exec n8n printenv WEBHOOK_URL` debe ser `https://n8n.TU.duckdns.org/`; revisa que el n8n de tu laptop esté apagado |
| Error de "policy" al crear la VM | Tu cuenta de estudiante no permite esa región o tamaño: prueba otra región |
