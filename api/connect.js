import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Ambil Connection String Neon dari Environment Variable Vercel
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return res.status(500).json({ 
      success: false, 
      message: "DATABASE_URL belum dipasang di Vercel Environment Variables!" 
    });
  }

  const sql = neon(databaseUrl);

  // Otomatis buat tabel 'scripts' di Neon DB jika belum ada
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

  const { action, id, name, luaCode, expireDays } = req.body || {};

  // 1. FETCH SCRIPT (Untuk Executor Roblox / Loader)
  if (action === 'fetch') {
    try {
      const rows = await sql`SELECT * FROM scripts WHERE id = ${id}`;
      if (rows.length === 0) {
        return res.status(404).send("-- [Nexus Mods Dev] Error: Script tidak ditemukan.");
      }
      const item = rows[0];
      if (Date.now() > Number(item.expires_at)) {
        return res.status(403).send("-- [Nexus Mods Dev] Error: Masa aktif script ini telah EXPIRED!");
      }
      return res.status(200).send(item.lua_code);
    } catch (e) {
      return res.status(500).send("-- [Nexus Mods Dev] Database Fetch Error");
    }
  }

  // 2. CREATE SCRIPT
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

  // 3. LIST ALL SCRIPTS
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

  // 4. UPDATE SCRIPT
  if (action === 'update') {
    try {
      const expiresAt = Date.now() + (parseInt(expireDays) * 86400000);
      await sql`
        UPDATE scripts 
        SET name = ${name}, lua_code = ${luaCode}, expires_at = ${expiresAt}
        WHERE id = ${id}
      `;
      return res.status(200).json({ success: true });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  }

  // 5. DELETE SCRIPT
  if (action === 'delete') {
    try {
      await sql`DELETE FROM scripts WHERE id = ${id}`;
      return res.status(200).json({ success: true });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  }

  return res.status(400).json({ success: false, message: "Action tidak valid" });
}
