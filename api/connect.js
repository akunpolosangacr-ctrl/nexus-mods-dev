import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  // CORS Setup
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 1. PROTEKSI BROWSER (Jika diakses via GET / Browser)
  if (req.method === 'GET') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(403).send(`
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Nexus Mods Dev - Protected Endpoint</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { background: #090d16; color: #e2e8f0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
          .card { background: #111827; border: 1px solid #1f2937; border-radius: 20px; padding: 40px 30px; text-align: center; max-width: 450px; width: 100%; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.04); }
          .icon { font-size: 50px; margin-bottom: 15px; }
          h1 { font-size: 22px; color: #ef4444; margin-bottom: 10px; font-weight: 700; }
          p { color: #9ca3af; font-size: 14px; line-height: 1.6; margin-bottom: 25px; }
          .status { display: inline-flex; align-items: center; gap: 8px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: #f87171; padding: 8px 16px; border-radius: 9999px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
          .footer { margin-top: 30px; font-size: 12px; color: #4b5563; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">🛡️</div>
          <h1>ACCESS PROTECTED</h1>
          <p>Akses langsung melalui Browser dilarang! API ini khusus menerima enkripsi <b>POST Request</b> dari Game Guardian Executor.</p>
          <div class="status">🔒 REQUIRED METHOD: POST ONLY</div>
          <div class="footer">Nexus Mods Dev API &copy; 2026</div>
        </div>
      </body>
      </html>
    `);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return res.status(500).json({ 
      success: false, 
      message: "DATABASE_URL belum dipasang di Vercel Environment Variables!" 
    });
  }

  const sql = neon(databaseUrl);

  // Inisialisasi Otomatis Tabel 'scripts'
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
    console.error("Database Init Error:", err);
  }

  // Parse Body
  let body = req.body || {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) {}
  }

  const { action, id, key, name, luaCode, expireDays, customKey } = body;
  const targetKey = key || id;

  // 2. ACTION: VALIDASI KEY DARI GAME GUARDIAN (Metode POST)
  if (action === 'validate_key' || action === 'fetch') {
    if (!targetKey) {
      return res.status(400).send("gg.alert('❌ Key wajib diisi!') os.exit()");
    }

    try {
      const rows = await sql`SELECT * FROM scripts WHERE id = ${targetKey}`;
      if (rows.length === 0) {
        return res.status(404).send("gg.alert('❌ Key INVALID atau Tidak Terdaftar di Database Nexus!') os.exit()");
      }

      const item = rows[0];
      if (Date.now() > Number(item.expires_at)) {
        return res.status(403).send("gg.alert('⛔ Key ini sudah EXPIRED! Silakan perbarui Key Anda.') os.exit()");
      }

      // Return isi Kode LUA jika Key Valid
      return res.status(200).send(item.lua_code);
    } catch (e) {
      return res.status(500).send("gg.alert('❌ Database Server Error!') os.exit()");
    }
  }

  // 3. ACTION: BUAT/ADD KEY BARU BISA DENGAN CUSTOM KEY APA SAJA
  if (action === 'create' || action === 'add_key') {
    try {
      // Gunakan Custom Key jika diisi, jika tidak buat ID acak
      const finalId = customKey && customKey.trim() !== '' ? customKey.trim() : Math.random().toString(36).substring(2, 10);
      const expiresAt = Date.now() + ((parseInt(expireDays) || 30) * 86400000);
      const createdAt = Date.now();

      await sql`
        INSERT INTO scripts (id, name, lua_code, expires_at, created_at)
        VALUES (${finalId}, ${name || 'Default Script'}, ${luaCode || 'gg.toast("Hello World")'}, ${expiresAt}, ${createdAt})
        ON CONFLICT (id) DO UPDATE 
        SET name = EXCLUDED.name, lua_code = EXCLUDED.lua_code, expires_at = EXCLUDED.expires_at;
      `;

      return res.status(200).json({ success: true, key: finalId, message: "Key berhasil ditambahkan/diupdate!" });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  }

  // 4. ACTION: LIST ALL KEYS
  if (action === 'list') {
    try {
      const rows = await sql`SELECT * FROM scripts ORDER BY created_at DESC`;
      const scripts = rows.map(r => ({
        key: r.id,
        name: r.name,
        expiresAt: Number(r.expires_at),
        createdAt: Number(r.created_at)
      }));
      return res.status(200).json({ success: true, scripts });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  }

  // 5. ACTION: DELETE KEY
  if (action === 'delete') {
    try {
      await sql`DELETE FROM scripts WHERE id = ${targetKey}`;
      return res.status(200).json({ success: true, message: "Key berhasil dihapus" });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  }

  return res.status(400).json({ success: false, message: "Action tidak valid" });
}
