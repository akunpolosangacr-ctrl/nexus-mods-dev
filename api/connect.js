import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Nexus-Shield');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // PROTEKSI BROWSER TINGKAT TINGGI
  // Wajib POST dan Wajib memiliki header khusus "X-Nexus-Shield: Active"
  if (req.method !== 'POST' || req.headers['x-nexus-shield'] !== 'Active') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(403).send(`
      <!DOCTYPE html><html><head><title>Forbidden</title><style>body{background:#0b0f19;color:#ef4444;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;}</style></head>
      <body><h2>⛔ 403 FORBIDDEN - ACCESS DENIED</h2></body></html>
    `);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return res.status(500).json({ success: false, message: "DATABASE_URL kosong!" });
  const sql = neon(databaseUrl);

  // Inisialisasi Database + Otomatis Migrasi jika kolom max_devices belum ada
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS scripts (
        id VARCHAR(64) PRIMARY KEY,
        name TEXT NOT NULL,
        lua_code TEXT NOT NULL,
        expires_at BIGINT NOT NULL,
        created_at BIGINT NOT NULL,
        max_devices INT DEFAULT 1,
        devices TEXT DEFAULT '[]'
      );
    `;
    try { await sql`ALTER TABLE scripts ADD COLUMN max_devices INT DEFAULT 1;`; } catch (e) {}
    try { await sql`ALTER TABLE scripts ADD COLUMN devices TEXT DEFAULT '[]';`; } catch (e) {}
  } catch (err) { console.error("DB Init Error:", err); }

  let body = req.body || {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) {}
  }

  const { action, key, id, name, luaCode, expireDays, customKey, maxDevices, device_id } = body;
  const targetKey = key || id;

  // -------------------------------------------------------------
  // URL 1: INIT LOADER (Generasi Script Login & File HWID binding)
  // -------------------------------------------------------------
  if (action === 'init') {
    const loginUI = `
local url = "https://" .. "nexus-mods-dev.vercel.app/api/connect"
local hwid_path = "/sdcard/.nexus_device_id"

-- Fungsi mengambil atau membuat Device ID (Mendukung Non-Root/Root)
local function getHWID()
  local f = io.open(hwid_path, "r")
  if f then
    local id = f:read("*a")
    f:close()
    return id
  else
    local new_id = string.format("%08x-%04x", math.random(1, 0xffffffff), math.random(1, 0xffff))
    f = io.open(hwid_path, "w")
    if f then f:write(new_id) f:close() end
    return new_id
  end
end

local user_hwid = getHWID()
local prompt = gg.prompt({"[ Nexus Mods ] Masukkan Key Login:"}, {""}, {"text"})

if not prompt or prompt[1] == "" then 
  gg.alert("❌ Login dibatalkan atau Key kosong!") 
  os.exit() 
end

gg.toast("⏳ Memeriksa Key & Device ID...")
local payload = '{"action":"validate_key", "key":"' .. prompt[1] .. '", "device_id":"' .. user_hwid .. '"}'
local r = gg.makeRequest(url, {["Content-Type"]="application/json", ["X-Nexus-Shield"]="Active"}, payload)

if not r or not r.content then
  gg.alert("❌ Server Offline atau Terblokir!")
  os.exit()
end

local func = load(r.content)
if func then func() else gg.alert("❌ Error mengeksekusi script dari server!") end
    `;
    return res.status(200).send(loginUI);
  }

  // -------------------------------------------------------------
  // URL 2: VALIDASI KEY + HWID BINDING POST
  // -------------------------------------------------------------
  if (action === 'validate_key') {
    if (!targetKey) return res.status(200).send("gg.alert('❌ Key tidak valid!') os.exit()");

    try {
      const rows = await sql`SELECT * FROM scripts WHERE id = ${targetKey}`;
      if (rows.length === 0) return res.status(200).send("gg.alert('❌ Key Not Found / Invalid!') os.exit()");

      const item = rows[0];
      if (Date.now() > Number(item.expires_at)) return res.status(200).send("gg.alert('⛔ Key ini sudah EXPIRED!') os.exit()");

      // Logika HWID Limit Devices
      let currentDevices = [];
      try { currentDevices = JSON.parse(item.devices || '[]'); } catch(e) {}
      
      const reqDeviceId = device_id || 'UNKNOWN';

      if (!currentDevices.includes(reqDeviceId)) {
        if (currentDevices.length >= item.max_devices) {
          return res.status(200).send("gg.alert('⛔ Login Gagal! Key ini sudah mencapai batas limit " + item.max_devices + " device.') os.exit()");
        }
        currentDevices.push(reqDeviceId);
        // Simpan device baru ke database
        await sql`UPDATE scripts SET devices = ${JSON.stringify(currentDevices)} WHERE id = ${targetKey}`;
      }

      // Jika VALID
      const successScript = `
gg.toast("✅ Validasi Sukses!")
${item.lua_code}
      `;
      return res.status(200).send(successScript);
    } catch (e) {
      return res.status(200).send("gg.alert('❌ Database Error Server!') os.exit()");
    }
  }

  // -------------------------------------------------------------
  // API DASHBOARD (Create, List, Edit, Reset, Delete)
  // -------------------------------------------------------------
  if (action === 'create') {
    try {
      const finalId = customKey && customKey.trim() !== '' ? customKey.trim() : Math.random().toString(36).substring(2, 10);
      const expiresAt = Date.now() + ((parseInt(expireDays) || 30) * 86400000);
      const maxDev = parseInt(maxDevices) || 1;
      
      await sql`
        INSERT INTO scripts (id, name, lua_code, expires_at, created_at, max_devices, devices)
        VALUES (${finalId}, ${name || 'Untitled'}, ${luaCode}, ${expiresAt}, ${Date.now()}, ${maxDev}, '[]')
        ON CONFLICT (id) DO UPDATE 
        SET name = EXCLUDED.name, lua_code = EXCLUDED.lua_code, max_devices = EXCLUDED.max_devices;
      `;
      return res.status(200).json({ success: true, key: finalId });
    } catch (e) { return res.status(500).json({ success: false, message: e.message }); }
  }

  if (action === 'list') {
    try {
      const rows = await sql`SELECT * FROM scripts ORDER BY created_at DESC`;
      const scripts = rows.map(r => ({
        key: r.id, name: r.name, expiresAt: Number(r.expires_at), maxDevices: r.max_devices, devices: r.devices
      }));
      return res.status(200).json({ success: true, scripts });
    } catch (e) { return res.status(500).json({ success: false, message: e.message }); }
  }

  if (action === 'edit') {
    try {
      await sql`UPDATE scripts SET name = ${name}, max_devices = ${parseInt(maxDevices) || 1} WHERE id = ${targetKey}`;
      return res.status(200).json({ success: true });
    } catch (e) { return res.status(500).json({ success: false, message: e.message }); }
  }

  if (action === 'reset_hwid') {
    try {
      await sql`UPDATE scripts SET devices = '[]' WHERE id = ${targetKey}`;
      return res.status(200).json({ success: true });
    } catch (e) { return res.status(500).json({ success: false, message: e.message }); }
  }

  if (action === 'delete') {
    try {
      await sql`DELETE FROM scripts WHERE id = ${targetKey}`;
      return res.status(200).json({ success: true });
    } catch (e) { return res.status(500).json({ success: false, message: e.message }); }
  }

  return res.status(400).json({ success: false, message: "Action invalid" });
}
