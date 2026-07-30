import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  // Setup CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 1. PROTEKSI BROWSER (Jika diakses lewat browser/GET)
  if (req.method === 'GET') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(403).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Nexus Mods Dev - Protected</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { background-color: #0f172a; color: #f8fafc; font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
          .card { text-align: center; padding: 2.5rem; border: 1px solid #334155; border-radius: 16px; background: #1e293b; box-shadow: 0 10px 25px rgba(0,0,0,0.5); max-width: 400px; }
          h1 { color: #ef4444; margin-bottom: 0.5rem; font-size: 1.5rem; }
          p { color: #94a3b8; font-size: 0.95rem; line-height: 1.5; }
          .badge { display: inline-block; margin-top: 1rem; padding: 0.4rem 0.8rem; background: #334155; color: #38bdf8; border-radius: 20px; font-size: 0.75rem; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>🔒 PROTECTED API ENDPOINT</h1>
          <p>Akses langsung via Web Browser ditolak. Endpoint ini hanya menerima enkripsi data dari Game Guardian Executor via POST request.</p>
          <div class="badge">NEXUS MODS DEV v1.0</div>
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

  // Inisialisasi Otomatis Tabel 'scripts' di Neon DB
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS scripts (
        id VARCHAR(32) PRIMARY KEY,
        name TEXT NOT NULL,
        lua_code TEXT NOT NULL,
        expires_at BIGINT NOT NULL,
        created_at BIGINT NOT NULL
      );
    `;
  } catch (err) {
    console.error("Neon DB Init Table Error:", err);
  }

  // Parse Body
  let body = req.body || {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) {}
  }

  const { action, id, key, name, luaCode, expireDays } = body;
  const targetId = id || key;

  // 2. ACTION: FETCH / VALIDATE KEY (Dari Game Guardian via POST)
  if (action === 'fetch' || action === 'validate_key') {
    if (!targetId) {
      return res.status(400).send("-- [Nexus Error] Key / Script ID wajib diisi!");
    }

    try {
      const rows = await sql`SELECT * FROM scripts WHERE id = ${targetId}`;
      if (rows.length === 0) {
        return res.status(404).send("-- [Nexus Error] Key tidak terdaftar atau invalid!");
      }

      const item = rows[0];
      if (Date.now() > Number(item.expires_at)) {
        return res.status(403).send("-- [Nexus Error] Masa aktif Key ini telah EXPIRED!");
      }

      // Kembalikan isi kode Lua untuk dieksekusi oleh Game Guardian
      return res.status(200).send(item.lua_code);
    } catch (e) {
      return res.status(500).send("-- [Nexus Error] Database Server Error");
    }
  }

  // 3. ACTION: CREATE (Deploy Script Baru)
  if (action === 'create') {
    try {
      const newId = Math.random().toString(36).substring(2, 10);
      const expiresAt = Date.now() + (parseInt(expireDays) * 86400000);
      const createdAt = Date.now();

      await sql`
        INSERT INTO scripts (id, name, lua_code, expires_at, created_at)
        VALUES (${newId}, ${name}, ${luaCode}, ${expiresAt}, ${createdAt})
      `;

      return res.status(200).json({ success: true, id: newId });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  }

  // 4. ACTION: LIST SCRIPTS
  if (action === 'list') {
    try {
      const rows = await sql`SELECT * FROM scripts ORDER BY created_at DESC`;
      const scripts = rows.map(r => ({
        id: r.id,
        name: r.name,
        luaCode: r.lua_code,
        expiresAt: Number(r.expires_at),
        createdAt: Number(r.created_at)
      }));
      return res.status(200).json({ success: true, scripts });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  }

  // 5. ACTION: DELETE
  if (action === 'delete') {
    try {
      await sql`DELETE FROM scripts WHERE id = ${targetId}`;
      return res.status(200).json({ success: true });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  }

  return res.status(400).json({ success: false, message: "Action tidak valid" });
}
