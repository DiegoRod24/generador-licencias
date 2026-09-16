CREATE TABLE IF NOT EXISTS licenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_name TEXT NOT NULL DEFAULT '',
  machine_code TEXT NOT NULL,
  bot TEXT NOT NULL DEFAULT 'CLARIDAD_DIGITADOR',
  license_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_on TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  notes TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_licenses_machine ON licenses(machine_code);
CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status);
CREATE INDEX IF NOT EXISTS idx_licenses_expires ON licenses(expires_on);
