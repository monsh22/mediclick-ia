# 🩺 MediClick AI — Sistema Inteligente de Citas y Triaje Médico

App móvil (React Native + Expo) + microservicios Node.js con arquitectura hexagonal,
API Gateway, RabbitMQ, PostgreSQL + pgvector (RAG), Redis, LLM y n8n.

---

> ☁️ ¿Quieres subirlo a la nube gratis? Lee **DESPLIEGUE.md**.

## 1. Arquitectura

```
            📱 App móvil (Expo / React Native)
                        │  HTTP (puerto 8080)
                        ▼
              ┌──────────────────────┐
              │  API Gateway Fastify │  JWT · rate limit · ruteo
              └──────────┬───────────┘
     ┌─────────────┬─────┴───────┬────────────────┐
     ▼             ▼             ▼                ▼
 Patient       Appointment   Notification      Triage / AI
 Service       Service       Service           Service
 (login,       (agendas,     (recordatorios    (911 + RAG pgvector
 expediente)   citas)        24h/2h, Redis)     + LLM Claude)
     │             │             ▲                │
     └──────┬──────┴─────────────┼────────────────┘
            ▼   eventos          │ consume
   ┌──────────────────────────────────────┐
   │ RabbitMQ  exchange "mediclick.events"│──► n8n ──► Telegram
   └──────────────────────────────────────┘
   PostgreSQL (1 BD por servicio)   ·   Redis (colas de recordatorios)
```

**Eventos que viajan por RabbitMQ**

| Evento (routing key)            | Lo publica          | Cuándo                         |
|---------------------------------|---------------------|--------------------------------|
| `usuario.sesion_iniciada`       | patient-service     | **Cada inicio de sesión**      |
| `usuario.registrado`            | patient-service     | Nuevo paciente                 |
| `usuario.login_fallido`         | patient-service     | Contraseña incorrecta          |
| `cita.creada / cancelada / reagendada` | appointment-service | Cambios en citas        |
| `triaje.completado`             | triage-service      | Triaje normal                  |
| `triaje.emergencia_detectada`   | triage-service      | Síntomas de alarma → 911       |

**Colas** (las ves en el panel de RabbitMQ):
- `auditoria.sesiones` → guarda todos los `usuario.*` (aquí ves los inicios de sesión)
- `auditoria.citas` → todos los `cita.*`
- `auditoria.triaje` → todos los `triaje.*`
- `notificaciones.eventos` → la consume el notification-service

**Estructura hexagonal de cada servicio**

```
src/
├── domain/          ← reglas de negocio puras (no saben de BD ni HTTP)
├── application/     ← casos de uso + puertos (interfaces)
├── infrastructure/  ← adaptadores: http (Express), db (Postgres), messaging (RabbitMQ)
└── main.js          ← composition root: conecta adaptadores con casos de uso
```

---

## 2. Qué instalar (una sola vez)

| Programa | Para qué | Descarga |
|---|---|---|
| **Docker Desktop** | Levanta BD, RabbitMQ, Redis, n8n y los microservicios | https://www.docker.com/products/docker-desktop |
| **Node.js 22 LTS o más nuevo** (mínimo 22.13) | Ejecutar la app móvil | https://nodejs.org |
| **VS Code** | Editar el código | https://code.visualstudio.com |
| **Expo Go** (en tu celular) | Ver la app en el móvil | Play Store / App Store |

> En Windows, Docker Desktop te pedirá activar **WSL 2**: acepta y reinicia.
> Abre Docker Desktop y espera a que diga **"Engine running"** antes de seguir.

Verifica en una terminal (PowerShell o CMD):

```bash
docker --version
docker compose version
node --version      # debe ser v22.13 o superior
```

---

## 3. Levantar el backend (Docker)

1. Descomprime el ZIP, por ejemplo en `C:\proyectos\mediclick-ai`.
2. Abre la carpeta en **VS Code** → menú *Terminal → New Terminal*.
3. Crea el archivo de variables:

   ```bash
   # Windows (PowerShell o CMD)
   copy .env.example .env
   # Mac / Linux
   cp .env.example .env
   ```

   (Opcional) Pega tu `ANTHROPIC_API_KEY` en `.env` para usar el LLM.
   Sin ella el triaje funciona igual en **modo local (solo RAG)**.

4. Construye y arranca todo:

   ```bash
   docker compose up -d --build
   ```

   La primera vez tarda 3–8 minutos (descarga imágenes).

5. Revisa que todo esté arriba:

   ```bash
   docker compose ps
   ```

   Deben aparecer 9 contenedores en estado `running` / `healthy`.

6. Prueba el gateway en el navegador: http://localhost:8080/health
   → debe responder `{"ok":true,...}`

**Ver logs** (muy útil si algo falla):

```bash
docker compose logs -f patient-service
docker compose logs -f notification-service
docker compose logs -f triage-service
```

---

## 4. Ver el inicio de sesión en RabbitMQ 🐰

1. Abre http://localhost:15672
2. Usuario: `mediclick` · Contraseña: `mediclick123`
3. Ve a la pestaña **Exchanges → mediclick.events** (ahí pasan todos los eventos).
4. Inicia sesión desde la app (o con el comando de abajo).
5. Ve a **Queues → `auditoria.sesiones`** → baja a **Get messages** → clic en **Get Message(s)**.
   Verás algo así:

   ```json
   {
     "event": "usuario.sesion_iniciada",
     "source": "patient-service",
     "occurredAt": "2026-11-07T05:20:11.000Z",
     "data": { "userId": "...", "name": "Paciente Demo", "email": "paciente@mediclick.com", "role": "paciente", "ip": "...", "device": "..." }
   }
   ```

   En **Overview** también verás la gráfica de mensajes subir.

**Probar el login sin la app** (PowerShell):

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:8080/api/auth/login `
  -ContentType "application/json" `
  -Body '{"email":"paciente@mediclick.com","password":"Paciente123"}'
```

(Mac/Linux: `curl -X POST http://localhost:8080/api/auth/login -H "Content-Type: application/json" -d '{"email":"paciente@mediclick.com","password":"Paciente123"}'`)

---

## 5. Ver la app en tu celular 📱

1. Tu **PC y tu celular deben estar en la misma red WiFi**.
2. Saca la IP de tu PC:
   - Windows: `ipconfig` → busca **Dirección IPv4** (ej. `192.168.1.74`)
   - Mac: `ipconfig getifaddr en0`
3. Entra a la carpeta de la app y crea su `.env`:

   ```bash
   cd mobile
   copy .env.example .env      # Mac/Linux: cp .env.example .env
   ```

   Edita `mobile/.env` y pon tu IP:

   ```
   EXPO_PUBLIC_API_URL=http://192.168.1.74:8080
   ```

4. Instala dependencias y ajusta versiones compatibles con Expo:

   ```bash
   npm install
   npx expo install --fix
   ```

5. Arranca:

   ```bash
   npx expo start
   ```

6. En el celular abre **Expo Go** y escanea el **código QR** que sale en la terminal
   (en iPhone escanéalo con la cámara).

7. Inicia sesión con:
   - Paciente: `paciente@mediclick.com` / `Paciente123`
   - Médico: `ana.lopez@mediclick.com` / `Medico123`

**Si el celular dice "No se pudo conectar con el servidor":**
- Abre en el navegador del celular `http://TU_IP:8080/health`. Si no carga, es el firewall:
  ejecuta PowerShell **como administrador**:
  ```powershell
  netsh advfirewall firewall add rule name="MediClick 8080" dir=in action=allow protocol=TCP localport=8080
  ```
- En redes de escuela/empresa que bloquean dispositivos, usa el hotspot de tu celular.
- Cada vez que cambies `mobile/.env`, reinicia con `npx expo start -c`.

**Verla en el navegador (opcional):** `npx expo install react-dom react-native-web` y luego `npx expo start --web`.

---

## 6. Probar el flujo completo (guion para presentar)

1. **Login** en la app → revisa la cola `auditoria.sesiones` en RabbitMQ ✅
2. **Triaje IA**: escribe *"me duele la rodilla cuando camino"* → sugiere **Traumatología** → botón "Ver horarios".
3. **Emergencia**: escribe *"tengo un dolor fuerte en el pecho"* → aparece la alerta roja y el botón **📞 Llamar al 911** (abre el marcador del teléfono). Para mensajes de riesgo emocional también aparece la **Línea de la Vida 800 911 2000**.
4. **Agendar**: elige fecha y horario → confirma → evento `cita.creada` en `auditoria.citas`.
5. **Recordatorios**: con `DEMO_FAST_REMINDERS=true` el "recordatorio de 24 h" llega a los **30 s** y el de "2 h" al **minuto** → ábrelos en 🔔 Notificaciones (se actualiza cada 10 s).
   En producción pon `DEMO_FAST_REMINDERS=false` y llegarán 24 h y 2 h antes de la cita reales.
6. **Reagendar / Cancelar** desde "Mis citas" → eventos `cita.reagendada` / `cita.cancelada`.
7. **Vista médico**: cierra sesión y entra como `ana.lopez@mediclick.com` → "Mi agenda" muestra los pacientes de Medicina General.

---

## 7. n8n + Telegram (automatización)

1. Abre http://localhost:5678 y crea tu cuenta local de n8n.
2. **Importa los flujos**: *Workflows → (menú ⋮) Import from File* y elige:
   - `n8n/workflows/01-eventos-y-recordatorios.json`
   - `n8n/workflows/02-bot-telegram-triaje.json`
3. **Crea tu bot**: en Telegram habla con **@BotFather** → `/newbot` → copia el **token**.
4. En n8n abre cada nodo de Telegram → *Credential → Create new* → pega el token.
5. **Activa** el flujo 01 (interruptor *Active*). Desde ahora cada confirmación,
   cancelación, reagendado y recordatorio se manda por Telegram a quien tenga su ID guardado.
6. **Para el bot (flujo 02)** Telegram necesita una URL pública HTTPS. Usa un túnel gratuito:
   ```bash
   # instala cloudflared: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
   cloudflared tunnel --url http://localhost:5678
   ```
   Copia la URL `https://xxxx.trycloudflare.com`, ponla en `.env` como
   `N8N_PUBLIC_URL=https://xxxx.trycloudflare.com/` y ejecuta `docker compose up -d n8n`.
   Luego activa el flujo 02.
7. En Telegram escríbele `/start` a tu bot → te responde tu **ID de chat** → pégalo en la app
   en **Perfil → ID de chat de Telegram** → Guardar.
8. Escríbele síntomas al bot y te responderá el triaje (también detecta emergencias → 911).

> Si un import marca error por versión de nodo, crea el flujo a mano: es solo
> *Webhook (POST, path `mediclick-eventos`) → IF (`telegramChatId` no vacío) → Telegram (Send message)*.

---

## 7.1 Asistente de citas en Telegram (AI Agent) 🤖📅

Permite **agendar sin la app**: el paciente le escribe al bot, el asistente entiende
sus síntomas, le muestra horarios libres y agenda, cancela o reagenda.

```
Telegram ─► Identificar paciente ─► Revisar emergencia (911) ─► ¿Emergencia?
              (patient-service)       (triage-service, sin IA)    ├─ Sí ─► Responde 911
                                                                   └─ No ─► AI Agent (Groq) ─► Responde
                                                                              ├─ Memoria (por chat)
                                                                              └─ Herramientas HTTP:
                                                                                  orientar_especialidad
                                                                                  ver_disponibilidad
                                                                                  agendar_cita
                                                                                  mis_citas
                                                                                  cancelar_cita
                                                                                  reagendar_cita
```

**¿Por qué herramientas HTTP y no SQL directo?** Porque así cada cita pasa por el
appointment-service: se validan las reglas (horario del médico, que no esté ocupado),
se publica `cita.creada` en RabbitMQ y se programan los recordatorios 24 h / 2 h,
igual que desde la app. La IA nunca toca la base de datos.

**Pacientes nuevos:** si alguien escribe por primera vez, se le crea su expediente
automáticamente con su nombre de Telegram. Si ya tenía cuenta en la app y guardó su
ID de chat en Perfil, se usa esa misma cuenta (ve sus mismas citas).

**Instalación**
1. Reconstruye los servicios: `docker compose up -d --build`
2. En n8n **despublica/desactiva** el workflow 02 (un bot solo puede tener un trigger activo).
3. Crea un workflow nuevo → **⋯ → Import from File** → `n8n/workflows/03-asistente-telegram-citas.json`
4. Asigna credenciales:
   - **Mensaje de Telegram**, **Responder** y **Responder emergencia** → tu credencial de Telegram.
   - **Groq Chat Model** → *Create new credential* → pega tu API key de Groq.
5. Con el túnel de cloudflared activo → **Publish**.
6. Prueba en Telegram:
   - *"Hola"*
   - *"Me duele la rodilla cuando camino, ¿qué especialista me recomiendas?"*
   - *"¿Qué horarios hay mañana?"* → *"El de las 10:30 con el Dr. Pérez"* → *"Sí"*
   - *"¿Qué citas tengo?"* → *"Cancélala"*
   - *"Me duele el pecho"* → responde con el 911 sin pasar por la IA.
   - *"¿Qué médicos tienen de pediatría?"* · *"Soy alérgico a la penicilina y soy O+"* · *"¿Qué tengo en mi expediente?"*

> Si el import marca error en algún nodo (cambia entre versiones de n8n), créalo a mano
> con los mismos nombres. Cada herramienta es un nodo **HTTP Request Tool** con estas URLs
> (red interna de Docker):
>
> | Herramienta | Método | URL |
> |---|---|---|
> | orientar_especialidad | POST | `http://triage-service:3004/internal/triage/chat` |
> | ver_disponibilidad | GET | `http://appointment-service:3002/internal/availability?specialty=…&date=…` |
> | agendar_cita | POST | `http://appointment-service:3002/internal/appointments` |
> | mis_citas | GET | `http://appointment-service:3002/internal/patients/{patientId}/appointments` |
> | cancelar_cita | POST | `http://appointment-service:3002/internal/appointments/{citaId}/cancel` |
> | reagendar_cita | POST | `http://appointment-service:3002/internal/appointments/{citaId}/reschedule` |

**Probar las rutas internas sin Telegram** (desde tu PC):
```powershell
docker compose exec n8n wget -qO- "http://appointment-service:3002/internal/availability?specialty=cardiologia"
```

---

## 7.2 Panel administrativo ⭐

Abre **http://localhost:8080/admin** (en la laptop o en el navegador del celular con `http://TU_IP:8080/admin`).

- Cuenta: `admin@mediclick.com` / `Admin123`
- **Resumen:** pacientes, médicos, citas de hoy, citas por Telegram, emergencias y gráfica por especialidad.
- **Usuarios:** buscar, ver expediente + citas + conversaciones, editar cualquier dato, cambiar contraseña,
  **hacer administrador**, cambiar rol y eliminar (sus citas futuras se cancelan solas vía RabbitMQ: `usuario.eliminado`).
- **Médicos:** crear (con cuenta nueva o usando un usuario médico existente), editar horario/días/consultorio,
  dar de baja (se cancelan sus citas futuras) y reactivar.
- **Citas:** ver todas (app y Telegram), cancelar o eliminar.
- **Conversaciones IA:** todo lo que los pacientes le escriben a Medi, con filtro de emergencias.

En la app, al entrar con la cuenta admin aparece la pestaña **⭐ Panel** con el resumen y un botón al panel web.

Seguridad: el Gateway solo deja pasar `/api/admin/*` si el token tiene rol `admin`, y cada microservicio lo vuelve a verificar.

## 7.3 Medi más didáctica

En la app y en Telegram Medi trabaja en 2 fases:
1. **Preguntas:** frase empática + 3–6 preguntas numeradas (desde cuándo, intensidad 1–10, otros síntomas…).
2. **Recomendación:** resumen, especialidad, *¿por qué?*, qué esperar en la consulta, cuidados generales y cuándo ir a urgencias.

En la app aparecen **botones de respuesta rápida** bajo cada mensaje. En Telegram, Medi además puede
**ver médicos**, **ver y llenar el expediente** (alergias, tipo de sangre, medicamentos, contacto de emergencia).
Todo se guarda en `patients_db.users` y se ve en la app (Perfil) y en el panel.

## 7.3.1 Medi en la app = agente con herramientas 🤖🛠️

En la app, Medi ya no es solo triaje: es el **mismo tipo de agente que en Telegram**, programado en el
triage-service (`src/application/assistant.js`) con *tool calling* de Groq:

```
App ─► Gateway ─► triage-service /triage/assistant
                    1) Filtro 911 (reglas, sin IA)
                    2) Groq decide qué herramienta usar ──► appointment-service / patient-service (/internal)
                    3) Devuelve texto + "tarjetas" para la app
```

Herramientas: `buscar_especialidad` (RAG), `ver_medicos`, `ver_disponibilidad`, `agendar_cita`, `mis_citas`,
`cancelar_cita`, `reagendar_cita`, `ver_expediente`, `actualizar_expediente`.

La app dibuja **tarjetas interactivas**: horarios por día (tocas la hora y Medi confirma), médicos con avatar,
cita agendada, tus próximas citas y tu expediente; además de **botones de respuesta rápida**.

Requiere `GROQ_API_KEY` (o `XAI_API_KEY`) en `.env`. Sin key o si Groq falla, responde el triaje clásico (RAG).
Bajo cada respuesta verás qué herramientas usó (ej. *✨ IA Groq · usó: ver_disponibilidad*).

## 7.4 Ver las bases de datos (pgAdmin)

Abre **http://localhost:5050** → servidor **MediClick AI** (ya viene configurado) →
contraseña `mediclick123` → *Databases* → `patients_db`, `appointments_db`, `triage_db`
→ *Schemas → public → Tables* → clic derecho en una tabla → **View/Edit Data → All Rows**.

---

## 8. Endpoints del API Gateway (`http://TU_IP:8080`)

| Método | Ruta | Login | Servicio |
|---|---|---|---|
| POST | `/api/auth/register` | No | patient |
| POST | `/api/auth/login` | No | patient |
| GET/PUT | `/api/patients/me` | Sí | patient |
| GET | `/api/doctors?specialty=` | Sí | appointment |
| GET | `/api/doctors/specialties` | Sí | appointment |
| GET | `/api/doctors/:id/slots?date=AAAA-MM-DD` | Sí | appointment |
| POST | `/api/appointments` | Sí | appointment |
| GET | `/api/appointments/me` | Sí | appointment |
| PATCH | `/api/appointments/:id/cancel` | Sí | appointment |
| PATCH | `/api/appointments/:id/reschedule` | Sí | appointment |
| GET | `/api/notifications/me` | Sí | notification |
| POST | `/api/triage/chat` | Sí | triage |

---

## 9. Seguridad del triaje

- Antes de usar la IA se revisan **señales de alarma** (dolor de pecho, falta de aire, desmayo,
  convulsiones, señales de derrame, sangrado abundante, accidentes, intoxicación, alergia grave,
  emergencias del embarazo, fiebre en bebés). Si hay alguna → **no se agenda**, se indica **llamar al 911**.
- Riesgo emocional → 911 + **Línea de la Vida 800 911 2000** (México, 24 h).
- El asistente **solo sugiere especialidad**, nunca diagnostica ni receta; cada respuesta lleva aviso.
- Cada conversación se guarda en `triage_db.triage_sessions` para revisión médica.

---

## 10. Comandos útiles

```bash
docker compose up -d --build     # levantar / reconstruir tras cambiar código
docker compose ps                # estado
docker compose logs -f gateway   # logs de un servicio
docker compose restart triage-service
docker compose down              # apagar
docker compose down -v           # apagar y BORRAR datos (reinicio limpio)
```

**Puertos:** 8080 Gateway · 15672 RabbitMQ · 5678 n8n · 5050 pgAdmin · 5432 PostgreSQL · 6379 Redis

**Ver la base de datos:** conéctate con DBeaver / pgAdmin a `localhost:5432`,
usuario `mediclick`, contraseña `mediclick123`, bases `patients_db`, `appointments_db`, `triage_db`.
