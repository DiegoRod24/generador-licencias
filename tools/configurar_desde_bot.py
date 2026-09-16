# -*- coding: utf-8 -*-
"""Configuración inicial desde Windows.
Extrae la clave HMAC del bot LOCALMENTE y la envía como secreto de Cloudflare.
No imprime el secreto en pantalla ni lo guarda en el proyecto.
"""
from pathlib import Path
import re, subprocess, sys, secrets

root = Path(__file__).resolve().parents[1]
print("=== CONFIGURADOR DE LICENCIAS MOVIL ===")
print("Este asistente NO muestra ni guarda la clave privada del bot.\n")

bot = input("Ruta completa al .py del BOT CLARIDAD v1.7.x: ").strip().strip('"')
p = Path(bot)
if not p.is_file():
    raise SystemExit("No existe el archivo indicado.")
text = p.read_text(encoding="utf-8", errors="ignore")
m = re.search(r'_LIC_SECRET\s*=\s*b["\']([^"\']+)["\']', text)
if not m:
    raise SystemExit("No encontré _LIC_SECRET en el bot.")
license_secret = m.group(1)
admin_token = secrets.token_urlsafe(24)

print("\n1) Se abrirá el login de Cloudflare si hace falta.")
subprocess.run(["npx", "wrangler", "login"], cwd=root, check=True)
print("\n2) Guardando LICENSE_SECRET como secreto remoto...")
subprocess.run(["npx", "wrangler", "secret", "put", "LICENSE_SECRET"], cwd=root, input=license_secret+"\n", text=True, check=True)
print("\n3) Guardando ADMIN_TOKEN como secreto remoto...")
subprocess.run(["npx", "wrangler", "secret", "put", "ADMIN_TOKEN"], cwd=root, input=admin_token+"\n", text=True, check=True)
print("\nCLAVE ADMIN PARA TU CELULAR (GUÁRDALA):")
print(admin_token)
print("\nNo compartas esta clave con los clientes.")
