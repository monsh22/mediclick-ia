# ☁️ Subir MediClick AI a la nube gratis

**Opción elegida:** Oracle Cloud *Always Free* + dominio gratis de DuckDNS + HTTPS automático con Caddy.

```
Internet ──► https://api.TUNOMBRE.duckdns.org  ─┐
          ──► https://n8n.TUNOMBRE.duckdns.org  ─┼─► Caddy (HTTPS) ─► Gateway / n8n ─► microservicios
          ──► https://app.TUNOMBRE.duckdns.org  ─┘                     (Postgres, Redis y RabbitMQ
                                                                         NO quedan abiertos a internet)
```

Ventajas: el servidor queda prendido 24/7, **ya no necesitas túnel para Telegram** (dirección fija con HTTPS),
la app conecta desde cualquier red (datos móviles incluidos) y la laptop puede estar apagada.

---

## 1. Crear la cuenta de Oracle Cloud (gratis)

1. Entra a https://www.oracle.com/cloud/free/ → **Start for free**.
2. Llena tus datos. Pide **tarjeta** solo para verificar identidad (hacen un cargo de prueba que regresan).
   Mientras uses solo recursos *Always Free* no te cobran.
3. **Home region:** elige una cercana (ej. *Mexico Central (Querétaro)* o *US East*). **No se puede cambiar después.**

## 2. Crear el servidor (VM)

1. Menú ☰ → **Compute → Instances → Create instance**.
2. **Image:** *Canonical Ubuntu 24.04*.
3. **Shape:** *Change shape* → **Ampere** → `VM.Standard.A1.Flex` → **2 OCPU y 12 GB** de memoria
   (es el máximo gratis desde junio de 2026).
4. **Networking:** deja que cree la red y marca *Assign a public IPv4 address*.
5. **SSH keys:** *Generate a key pair for me* → **Save private key** (guárdala, ej. `C:\Users\marif\.ssh\oracle.key`).
6. **Boot volume:** 50 GB está bien.
7. **Create**. Copia la **Public IP address** (ej. `150.136.x.x`).

> Si sale *"Out of capacity"*: es común. Reintenta más tarde o prueba otro *Availability Domain*.

## 3. Abrir los puertos 80 y 443 en Oracle

1. En la instancia → **Primary VNIC → Subnet → Security Lists → Default Security List**.
2. **Add Ingress Rules** (dos reglas):
   - Source CIDR `0.0.0.0/0`, protocolo TCP, puerto destino **80**
   - Source CIDR `0.0.0.0/0`, protocolo TCP, puerto destino **443**

## 4. Dominio gratis con DuckDNS

1. Entra a https://www.duckdns.org e inicia sesión (Google o GitHub).
2. Crea un subdominio, ej. `mediclick-fer` → en **current ip** pon la IP pública del servidor → **update ip**.
3. Listo: `mediclick-fer.duckdns.org` y también `api.`, `n8n.` y `app.mediclick-fer.duckdns.org`
   apuntan a tu servidor (DuckDNS acepta sub-subdominios).

## 5. Conectarte al servidor (desde PowerShell)

```powershell
icacls C:\Users\marif\.ssh\oracle.key /inheritance:r /grant:r "$($env:USERNAME):R"
ssh -i C:\Users\marif\.ssh\oracle.key ubuntu@TU_IP
```

## 6. Preparar el servidor (ya dentro por SSH)

```bash
# Firewall de Ubuntu en Oracle: abrir 80 y 443
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo apt-get update && sudo apt-get install -y iptables-persistent unzip
sudo netfilter-persistent save

# Instalar Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu
exit      # sal y vuelve a entrar para que aplique el grupo docker
```

## 7. Subir el proyecto

En tu **laptop** (PowerShell), desde `C:\Users\marif\Downloads\mediclick-ai`:

```powershell
# Comprime el proyecto SIN node_modules (pesa mucho y no se necesita)
tar -a -c -f mediclick.zip --exclude=node_modules --exclude=.expo mediclick-ai
scp -i C:\Users\marif\.ssh\oracle.key mediclick.zip ubuntu@TU_IP:~
```

En el **servidor**:

```bash
unzip mediclick.zip && cd mediclick-ai
cp .env.prod.example .env
openssl rand -hex 24      # ejecútalo 3 veces y usa los resultados como contraseñas
nano .env                 # pon tus dominios, contraseñas y GROQ_API_KEY  (Ctrl+O guardar, Ctrl+X salir)
```

## 8. Arrancar en modo producción

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
docker compose ps
```

La primera vez tarda unos minutos. Prueba en el navegador:

- `https://api.mediclick-fer.duckdns.org/health` → `{"ok":true}` (con candado 🔒)
- `https://api.mediclick-fer.duckdns.org/admin` → panel admin
- `https://n8n.mediclick-fer.duckdns.org` → n8n (crea tu cuenta)

## 9. ⚠️ Seguridad (obligatorio, el servidor es público)

1. Entra al panel admin con `admin@mediclick.com` / `Admin123` → **Usuarios** → edita tu admin → **nueva contraseña**.
2. Cambia también la contraseña de las cuentas demo (o elimínalas): `paciente@mediclick.com` y los médicos.
3. Nunca compartas tu `.env`.

## 10. n8n y Telegram (ya sin túnel)

1. En `https://n8n.TU-DOMINIO` crea tu cuenta, tus credenciales de Telegram y Groq.
2. Importa los workflows **01** y **03** y **publícalos**.
3. Listo: Telegram ya apunta a una dirección fija. **Despublica** los workflows de tu n8n local
   (un bot solo puede tener un webhook).

## 11. La app

**En el celular (Expo Go):** en tu laptop, `mobile/.env`:
```
EXPO_PUBLIC_API_URL=https://api.mediclick-fer.duckdns.org
```
`npx expo start -c` → ahora funciona **con datos móviles o cualquier WiFi**.

**Versión web pública (opcional):** en la laptop, carpeta `mobile`:
```powershell
npx expo export --platform web
tar -a -c -f dist.zip dist
scp -i C:\Users\marif\.ssh\oracle.key dist.zip ubuntu@TU_IP:~/mediclick-ai/mobile/
```
En el servidor: `cd ~/mediclick-ai/mobile && unzip -o dist.zip && docker restart mediclick-caddy`
→ abre `https://app.mediclick-fer.duckdns.org` desde cualquier lugar.

## 12. Ver pgAdmin y RabbitMQ (por túnel SSH, no quedan públicos)

```powershell
ssh -i C:\Users\marif\.ssh\oracle.key -L 5050:localhost:5050 -L 15672:localhost:15672 ubuntu@TU_IP
```
Mientras esa ventana esté abierta: `http://localhost:5050` (pgAdmin) y `http://localhost:15672` (RabbitMQ).

## Comandos útiles en el servidor

```bash
cd ~/mediclick-ai
alias dc='docker compose -f docker-compose.yml -f docker-compose.prod.yml'
dc ps                       # estado
dc logs -f triage-service   # logs
dc up -d --build            # después de subir cambios
dc restart n8n
```

## Si algo falla

| Problema | Solución |
|---|---|
| El navegador no abre tu dominio | Revisa la IP en DuckDNS, las reglas 80/443 del paso 3 y el `iptables` del paso 6 |
| Sin candado / error de certificado | `dc logs caddy`: casi siempre es que el puerto 80 no está abierto |
| Telegram "Bad request" | `dc exec n8n printenv WEBHOOK_URL` debe mostrar `https://n8n.TU-DOMINIO/` |
| Algún contenedor reinicia | `dc logs NOMBRE` y revisa contraseñas del `.env` |

## Notas del plan gratis de Oracle

- Desde junio de 2026 el máximo gratis es **2 OCPU y 12 GB** de RAM (antes 4 y 24). Alcanza bien para este proyecto.
- Oracle puede **reclamar instancias inactivas** (uso muy bajo de CPU, red y memoria durante 7 días).
  Si lo usas seguido no debería pasar; si te preocupa, puedes pasar la cuenta a *Pay As You Go*
  (sigue sin cobrar mientras te mantengas en los límites gratis).
