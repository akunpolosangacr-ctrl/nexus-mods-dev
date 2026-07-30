import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
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
