import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 1. PROTEKSI BROWSER
  if (req.method === 'GET') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(403).send(`
      <!DOCTYPE html>
      <html>
      <head><title>Access Protected</title><style>body{background:#0f172a;color:#ef4444;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;}</style></head>
      <body><h2>🔒 API PROTECTED</h2></body>
      </html>
    `);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return res.status(500).json({ success: false, message: "DATABASE_URL belum terpasang!" });
  }

  const sql = neon(databaseUrl);

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS scripts (
        id VARCHAR(64) PRIMARY KEY,
        name TEXT NOT NULL,
        lua_code TEXT NOT NULL,
        expires_at BIGINT NOT NULL,
        created_at BIGINT NOT NULL
      );
    `;
  } catch (err) {
    console.error("DB Init Error:", err);
  }

  let body = req.body || {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) {}
  }

  const { action, key, id, name, luaCode, expireDays, customKey } = body;
  const targetKey = key || id;

  // -------------------------------------------------------------
  // URL 1: INIT LOADER (Struktur UI Login GameGuardian)
  // -------------------------------------------------------------
  if (action === 'init') {
    const loginUI = `
local url = "https://nexus-mods-dev.vercel.app/api/connect"
local prompt = gg.prompt({"[ Nexus Mods ] Masukkan Key Login:"}, {""}, {"text"})

if not prompt then 
  gg.alert("❌ Login dibatalkan!") 
  os.exit() 
end

local user_key = prompt[1]
if user_key == "" then
  gg.alert("❌ Key tidak boleh kosong!")
  os.exit()
end

gg.toast("⏳ Memvalidasi Key ke Server...")
local r = gg.makeRequest(url, {["Content-Type"]="application/json"}, '{"action":"validate_key", "key":"' .. user_key .. '"}')

if not r or not r.content then
  gg.alert("❌ Gagal terhubung ke database server!")
  os.exit()
end

-- Eksekusi response dari URL 2
local func, err = load(r.content)
if func then
  func()
else
  gg.alert("❌ Terjadi kesalahan struktur script!")
end
    `;
    // Kirim balik UI Login sebagai plain text Lua code
    return res.status(200).send(loginUI);
  }

  // -------------------------------------------------------------
  // URL 2 & 3: VALIDASI KEY POST & RETURN MAIN SCRIPT
  // -------------------------------------------------------------
  if (action === 'validate_key') {
    if (!targetKey) {
      // Mengirimkan script alert Lua langsung (Selalu status 200 agar GG bisa meloadnya)
      return res.status(200).send("gg.alert('❌ Key tidak boleh kosong!') os.exit()");
    }

    try {
      const rows = await sql`SELECT * FROM scripts WHERE id = ${targetKey}`;
      
      if (rows.length === 0) {
        // Jika salah / tidak terdaftar
        return res.status(200).send("gg.alert('❌ Key Not Found / Invalid!') os.exit()");
      }

      const item = rows[0];
      if (Date.now() > Number(item.expires_at)) {
        // Jika expired
        return res.status(200).send("gg.alert('⛔ Key ini sudah EXPIRED!') os.exit()");
      }

      // Jika VALID, satukan dengan toast success, lalu return SCRIPT UTAMA
      const successScript = `
gg.toast("✅ Login Berhasil! Selamat bermain.")
${item.lua_code}
      `;
      return res.status(200).send(successScript);
    } catch (e) {
      return res.status(200).send("gg.alert('❌ Database Error!') os.exit()");
    }
  }

  // -------------------------------------------------------------
  // API UNTUK DASHBOARD ADMIN (Create, List, Delete)
  // -------------------------------------------------------------
  if (action === 'create') {
    try {
      const finalId = customKey && customKey.trim() !== '' ? customKey.trim() : Math.random().toString(36).substring(2, 10);
      const expiresAt = Date.now() + ((parseInt(expireDays) || 30) * 86400000);
      const createdAt = Date.now();

      await sql`
        INSERT INTO scripts (id, name, lua_code, expires_at, created_at)
        VALUES (${finalId}, ${name || 'Untitled Script'}, ${luaCode || 'gg.toast("Hello World")'}, ${expiresAt}, ${createdAt})
        ON CONFLICT (id) DO UPDATE 
        SET name = EXCLUDED.name, lua_code = EXCLUDED.lua_code, expires_at = EXCLUDED.expires_at;
      `;
      return res.status(200).json({ success: true, key: finalId });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  }

  if (action === 'list') {
    try {
      const rows = await sql`SELECT * FROM scripts ORDER BY created_at DESC`;
      const scripts = rows.map(r => ({
        key: r.id, name: r.name, expiresAt: Number(r.expires_at), createdAt: Number(r.created_at)
      }));
      return res.status(200).json({ success: true, scripts });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  }

  if (action === 'delete') {
    try {
      await sql`DELETE FROM scripts WHERE id = ${targetKey}`;
      return res.status(200).json({ success: true });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  }

  return res.status(400).json({ success: false, message: "Action tidak valid" });
}
