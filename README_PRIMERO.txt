GENERADOR MÓVIL DE LICENCIAS · DRV
=================================

OBJETIVO
- El cliente abre tu EXE y te manda su código de equipo por WhatsApp.
- Tú entras al panel desde el celular.
- Pegas el código, eliges 15/30/60/90 días o fecha exacta.
- El panel genera una clave compatible con el esquema actual del BOT CLARIDAD.
- Puedes copiar/compartir la clave, renovar y llevar historial.

SEGURIDAD
- La clave privada de firma NO está en index.html ni en el navegador.
- Se guarda como Secret del Worker de Cloudflare.
- La clave de administrador también se guarda como Secret.
- El panel pide la clave admin al abrir y la guarda solo en sessionStorage.

IMPORTANTE SOBRE REVOCAR
- El botón Revocar sirve ya como control administrativo en el panel.
- El EXE actual valida la licencia localmente. Por tanto, una licencia ya emitida seguirá
  funcionando hasta su vencimiento aunque la marques Revocada en el panel.
- Para revocación inmediata habría que añadir al bot una validación online periódica.

PRIMERA INSTALACIÓN (UNA VEZ DESDE TU PC)
1. Instala Node.js LTS si no lo tienes.
2. Abre CMD en esta carpeta.
3. Ejecuta: npm install
4. Ejecuta: npx wrangler login
5. Crea la base:
      npx wrangler d1 create claridad-licencias
6. Cloudflare mostrará un database_id. Cópialo y reemplaza REEMPLAZAR_DATABASE_ID
   dentro de wrangler.toml.
7. Inicializa tablas:
      npx wrangler d1 execute claridad-licencias --remote --file=./schema.sql
8. Configura secretos SIN copiarlos al frontend:
      python tools/configurar_desde_bot.py
   El asistente te pedirá la ruta del .py de tu bot y generará además tu clave ADMIN.
9. Publica:
      npx wrangler deploy
10. Wrangler mostrará tu URL https://....workers.dev
    Ábrela desde el celular, escribe tu clave ADMIN y listo.

DESPUÉS
- Ya no necesitas la PC para generar claves.
- Desde Android/iPhone puedes abrir la URL y usar "Añadir a pantalla de inicio".

ARCHIVOS
- src/worker.js              Backend: genera las licencias y consulta D1.
- public/index.html          Panel móvil.
- schema.sql                 Base de datos.
- wrangler.toml              Configuración Cloudflare.
- tools/configurar_desde_bot.py  Extrae el secret del bot localmente y lo sube como Secret.
