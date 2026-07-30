import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'POST') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(403).send(`
      <body style="background:#090d16;color:#ef4444;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;">
        <div style="background:#111827;padding:30px;border-radius:12px;border:1px solid #1f2937;text-align:center;max-width:400px;">
          <h2>🔒 PROTECTED ACCESS DENIED (/validate.php)</h2>
          <p style="color:#9ca3af;font-size:14px;margin-top:10px;">Akses langsung via browser dilarang!</p>
        </div>
      </body>
    `);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return res.status(200).send("gg.alert('❌ DATABASE_URL belum terpasang di Vercel Environment Variables!') os.exit()");
  }

  const sql = neon(databaseUrl);

  let body = req.body || {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) {}
  }

  const { key } = body;
  if (!key) {
    return res.status(200).send("gg.alert('❌ Key wajib diisi!') os.exit()");
  }

  try {
    const rows = await sql`SELECT * FROM scripts WHERE id = ${key}`;
    if (rows.length === 0) {
      return res.status(200).send("gg.alert('❌ Login Gagal: Key Not Found!') os.exit()");
    }

    const item = rows[0];
    if (Date.now() > Number(item.expires_at)) {
      return res.status(200).send("gg.alert('⛔ Login Gagal: Key Expired!') os.exit()");
    }

    // Jika Login Berhasil, Kembalikan Toast + Base Lua Script
    const successLua = `gg.toast("✅ Login Berhasil!")\n` + item.lua_code;
    return res.status(200).send(successLua);
  } catch (e) {
    return res.status(200).send("gg.alert('❌ Server Database Error!') os.exit()");
  }
}
