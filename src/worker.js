const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  }
});

function clean(v) {
  return String(v ?? "").trim();
}

function b64url(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function hmacSignature(secret, payloadB64) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64));
  const hex = [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  return hex.slice(0, 32);
}

async function makeLicense(secret, machine, expiresOn) {
  const payload = `DRV1|${machine}|${expiresOn}`;
  const payloadB64 = b64url(payload);
  const signature = await hmacSignature(secret, payloadB64);
  return `${payloadB64}.${signature}`;
}

function isIsoDate(v) {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
}

function addDays(days) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + Number(days));
  return d.toISOString().slice(0, 10);
}

function authOk(request, env) {
  const auth = request.headers.get("authorization") || "";
  return !!env.ADMIN_TOKEN && auth === `Bearer ${env.ADMIN_TOKEN}`;
}

async function parseBody(request) {
  try { return await request.json(); } catch { return {}; }
}

async function handleApi(request, env, url) {
  if (!authOk(request, env)) return json({ ok: false, error: "NO_AUTORIZADO" }, 401);
  if (!env.LICENSE_SECRET) return json({ ok: false, error: "FALTA_LICENSE_SECRET" }, 500);

  if (request.method === "GET" && url.pathname === "/api/summary") {
    const row = await env.DB.prepare(`
      SELECT
        COUNT(*) total,
        SUM(CASE WHEN status='ACTIVE' AND date(expires_on) >= date('now') THEN 1 ELSE 0 END) active,
        SUM(CASE WHEN status='REVOKED' THEN 1 ELSE 0 END) revoked,
        SUM(CASE WHEN status='ACTIVE' AND date(expires_on) < date('now') THEN 1 ELSE 0 END) expired
      FROM licenses
    `).first();
    return json({ ok: true, summary: row || { total: 0, active: 0, revoked: 0, expired: 0 } });
  }

  if (request.method === "GET" && url.pathname === "/api/licenses") {
    const q = clean(url.searchParams.get("q"));
    let stmt;
    if (q) {
      const like = `%${q}%`;
      stmt = env.DB.prepare(`
        SELECT * FROM licenses
        WHERE client_name LIKE ? OR machine_code LIKE ? OR bot LIKE ? OR notes LIKE ?
        ORDER BY id DESC LIMIT 200
      `).bind(like, like, like, like);
    } else {
      stmt = env.DB.prepare("SELECT * FROM licenses ORDER BY id DESC LIMIT 200");
    }
    const result = await stmt.all();
    return json({ ok: true, licenses: result.results || [] });
  }

  if (request.method === "POST" && url.pathname === "/api/generate") {
    const body = await parseBody(request);
    const machine = clean(body.machine_code).toUpperCase();
    const client = clean(body.client_name);
    const bot = clean(body.bot) || "CLARIDAD_DIGITADOR";
    const notes = clean(body.notes);
    let expires = clean(body.expires_on);
    if (!expires) {
      const days = Number(body.days || 30);
      if (!Number.isFinite(days) || days < 1 || days > 730) return json({ ok: false, error: "DIAS_INVALIDOS" }, 400);
      expires = addDays(days);
    }
    if (!machine || machine.length < 8) return json({ ok: false, error: "CODIGO_EQUIPO_INVALIDO" }, 400);
    if (!isIsoDate(expires)) return json({ ok: false, error: "FECHA_INVALIDA" }, 400);

    const licenseKey = await makeLicense(env.LICENSE_SECRET, machine, expires);
    const now = new Date().toISOString();
    const r = await env.DB.prepare(`
      INSERT INTO licenses (client_name, machine_code, bot, license_key, created_at, expires_on, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?)
    `).bind(client, machine, bot, licenseKey, now, expires, notes).run();
    return json({ ok: true, id: r.meta?.last_row_id, license_key: licenseKey, expires_on: expires });
  }

  const m = url.pathname.match(/^\/api\/licenses\/(\d+)\/(renew|revoke|activate)$/);
  if (m && request.method === "POST") {
    const id = Number(m[1]);
    const action = m[2];
    const row = await env.DB.prepare("SELECT * FROM licenses WHERE id=?").bind(id).first();
    if (!row) return json({ ok: false, error: "NO_EXISTE" }, 404);

    if (action === "revoke") {
      await env.DB.prepare("UPDATE licenses SET status='REVOKED' WHERE id=?").bind(id).run();
      return json({ ok: true });
    }
    if (action === "activate") {
      await env.DB.prepare("UPDATE licenses SET status='ACTIVE' WHERE id=?").bind(id).run();
      return json({ ok: true });
    }

    const body = await parseBody(request);
    let expires = clean(body.expires_on);
    if (!expires) expires = addDays(Number(body.days || 30));
    if (!isIsoDate(expires)) return json({ ok: false, error: "FECHA_INVALIDA" }, 400);
    const licenseKey = await makeLicense(env.LICENSE_SECRET, row.machine_code, expires);
    const now = new Date().toISOString();
    const r = await env.DB.prepare(`
      INSERT INTO licenses (client_name, machine_code, bot, license_key, created_at, expires_on, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?)
    `).bind(row.client_name, row.machine_code, row.bot, licenseKey, now, expires, `Renovación de #${id}. ${row.notes || ''}`.trim()).run();
    return json({ ok: true, id: r.meta?.last_row_id, license_key: licenseKey, expires_on: expires });
  }

  return json({ ok: false, error: "RUTA_NO_ENCONTRADA" }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      try { return await handleApi(request, env, url); }
      catch (e) { return json({ ok: false, error: "ERROR_SERVIDOR", detail: String(e?.message || e) }, 500); }
    }
    return env.ASSETS.fetch(request);
  }
};
