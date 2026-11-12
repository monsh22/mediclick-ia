# ☁️ MediClick AI en la nube con GitHub Codespaces (gratis, sin tarjeta)

GitHub te presta una computadora en la nube (2 núcleos, 8 GB) donde corre el `docker-compose` completo,
con direcciones públicas HTTPS fijas para la app, el panel y Telegram.

**Límites del plan gratis:**
- Unas **60 horas al mes** con la máquina de 2 núcleos.
- Se **apaga sola** tras un rato sin actividad: 30 minutos por defecto, configurable hasta 4 horas.
- Dura máximo **12 horas seguidas**.

Por eso es ideal para **presentar y hacer pruebas**, no para tenerlo prendido 24/7.

---

## 1. Crear tu cuenta de GitHub
https://github.com/signup (gratis). Puedes usar tu Gmail.

## 2. Subir el proyecto con GitHub Desktop (sin comandos)
1. Descarga **GitHub Desktop**: https://desktop.github.com e inicia sesión con tu cuenta.
2. **File → Add local repository** → elige `C:\Users\marif\Downloads\mediclick-ai\mediclick-ai`.
3. Te dirá que no es un repositorio → **create a repository** → **Create repository**.
4. Arriba: **Publish repository** → deja marcado **Keep this code private** → **Publish**.

> Tu `.env` y `node_modules` **no** se suben (están en `.gitignore`). Así tus llaves no quedan en GitHub.

## 3. Configurar (una sola vez) en github.com
- **Llave de Groq como secreto:** tu foto → **Settings → Codespaces → Secrets → New secret**
  - Name: `GROQ_API_KEY` · Value: tu llave `gsk_...` · Repository access: tu repositorio `mediclick-ai`.
- **Tiempo antes de apagarse:** misma página → **Default idle timeout** → `240` minutos → Save.

## 4. Crear el Codespace
En tu repositorio → botón verde **Code** → pestaña **Codespaces** → **Create codespace on main**.

Se abre un VS Code en el navegador. La primera vez tarda **5 a 10 minutos**. Al terminar, la terminal muestra:
```
✅ MediClick AI está corriendo en la nube (GitHub Codespaces)
 API / app ......... https://NOMBRE-8080.app.github.dev
 Panel admin ....... https://NOMBRE-8080.app.github.dev/admin
 n8n (Telegram) .... https://NOMBRE-5678.app.github.dev/
```

## 5. Hacer públicas las direcciones
Pestaña **PORTS** (abajo) → clic derecho en **8080** → **Port Visibility → Public**. Repite con **5678**.
(El script lo intenta solo; si ya dicen *Public*, no hagas nada.)

Prueba: `https://NOMBRE-8080.app.github.dev/health` → `{"ok":true}`.

## 6. Seguridad
Tu panel queda en internet: entra a `/admin` con `admin@mediclick.com` / `Admin123` y **cambia la contraseña**
del admin y de las cuentas demo.

## 7. n8n y Telegram
1. **En tu laptop** apaga lo local para que no le gane el bot: `docker compose stop`.
2. Abre la dirección de n8n (5678) → crea tu cuenta → credenciales de **Telegram** y **Groq**.
3. **Import from File** los workflows `01` y `03` (están en `n8n/workflows` de tu laptop) → asigna credenciales → **Publish**.
4. Escríbele al bot.

## 8. La app
En tu laptop, `mobile/.env`:
```
EXPO_PUBLIC_API_URL=https://NOMBRE-8080.app.github.dev
```
`npx expo start -c` → funciona con datos móviles o cualquier WiFi.

## Día a día
- **Prender:** https://github.com/codespaces → tu codespace → **⋯ → Open in browser**. El script arranca todo solo.
  Las direcciones **son las mismas** mientras no borres el codespace (Telegram sigue funcionando).
- **Apagar** (ahorra horas): https://github.com/codespaces → **⋯ → Stop codespace**.
- **Ver logs:** en la terminal del codespace, `docker compose logs -f`.
- **Revisa tus horas:** https://github.com/settings/billing.

## Si algo falla
| Problema | Solución |
|---|---|
| La app o Telegram no conectan | Revisa en **PORTS** que 8080 y 5678 digan **Public** |
| Telegram no responde | Apaga el n8n de tu laptop y vuelve a publicar el workflow en el n8n del codespace |
| Se apagó solo | Es el límite de inactividad: vuelve a abrirlo |
| Error al construir | En la terminal: `bash .devcontainer/start.sh` |
