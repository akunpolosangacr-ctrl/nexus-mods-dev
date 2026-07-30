import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Nexus-Shield');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST' || req.headers['x-nexus-shield'] !== 'Active') {
    return res.status(403).send('Forbidden.');
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return res.status(500).json({ success: false, message: "DATABASE_URL kosong!" });
  const sql = neon(databaseUrl);

  let body = req.body || {};
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) {} }
  const { action, key, id, name, luaCode, expireDays, customKey, maxDevices, device_id } = body;
  const targetKey = key || id;

  // INIT - SCRIPT LUA MURNI (TANPA _ENV Yg Bikin Error GG)
  if (action === 'init') {
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host;
    const dynamicUrl = `${protocol}://${host}/api/connect`;

    const loginUI = `
local url = "${dynamicUrl}"
local hw_path = "/sdcard/.nxs_sys"

local function getID()
  local f = io.open(hw_path, "r")
  if f then local id = f:read("*a") f:close() return id else
    local n = string.format("%08x", math.random(1, 0xffffffff))
    f = io.open(hw_path, "w") if f then f:write(n) f:close() end return n
  end
end

local hw = getID()
local p = gg.prompt({"[ Nexus Protection ]\\nInput License Key:"}, {""}, {"text"})
if not p or p[1] == "" then os.exit() end

gg.toast("Validating Environment...")
local pl = '{"action":"validate_key", "key":"' .. p[1] .. '", "device_id":"' .. hw .. '"}'
local r = gg.makeRequest(url, {["Content-Type"]="application/json", ["X-Nexus-Shield"]="Active"}, pl)

if r and r.content then 
  local f, e = load(r.content)
  if f then f() else gg.alert("Security Triggered: Invalid Script Format") end
else 
  gg.alert("Server Offline") 
end
    `;
    return res.status(200).send(loginUI);
  }

  // VALIDATE KEY
  if (action === 'validate_key') {
    if (!targetKey) return res.status(200).send("gg.alert('Key Invalid') os.exit()");
    try {
      const rows = await sql`SELECT * FROM scripts WHERE id = ${targetKey}`;
      if (rows.length === 0) return res.status(200).send("gg.alert('License Not Found') os.exit()");

      const item = rows[0];
      if (Date.now() > Number(item.expires_at)) return res.status(200).send("gg.alert('License Expired') os.exit()");

      let currentDevices = [];
      try { currentDevices = JSON.parse(item.devices || '[]'); } catch(e) {}
      const reqDev = device_id || 'UNKNOWN';

      if (!currentDevices.includes(reqDev)) {
        if (currentDevices.length >= item.max_devices) {
          return res.status(200).send("gg.alert('Max HWID Reached (" + item.max_devices + " devices)') os.exit()");
        }
        currentDevices.push(reqDev);
        await sql`UPDATE scripts SET devices = ${JSON.stringify(currentDevices)} WHERE id = ${targetKey}`;
      }
      return res.status(200).send(`gg.toast("Access Granted")\n` + item.lua_code);
    } catch (e) {
      return res.status(200).send("gg.alert('Server Error') os.exit()");
    }
  }

  // ADMIN ACTIONS
  if (action === 'create') {
    const fId = customKey && customKey.trim() !== '' ? customKey.trim() : Math.random().toString(36).substring(2, 10);
    const exp = Date.now() + ((parseInt(expireDays) || 30) * 86400000);
    await sql`INSERT INTO scripts (id, name, lua_code, expires_at, created_at, max_devices, devices) VALUES (${fId}, ${name}, ${luaCode}, ${exp}, ${Date.now()}, ${parseInt(maxDevices) || 1}, '[]') ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, lua_code=EXCLUDED.lua_code, max_devices=EXCLUDED.max_devices;`;
    return res.status(200).json({ success: true });
  }
  if (action === 'list') {
    const rows = await sql`SELECT * FROM scripts ORDER BY created_at DESC`;
    const scripts = rows.map(r => ({ key: r.id, name: r.name, expiresAt: Number(r.expires_at), maxDevices: r.max_devices, devices: r.devices }));
    return res.status(200).json({ success: true, scripts });
  }
  if (action === 'edit') {
    await sql`UPDATE scripts SET name=${name}, max_devices=${parseInt(maxDevices) || 1} WHERE id=${targetKey}`;
    return res.status(200).json({ success: true });
  }
  if (action === 'reset_hwid') {
    await sql`UPDATE scripts SET devices='[]' WHERE id=${targetKey}`;
    return res.status(200).json({ success: true });
  }
  if (action === 'delete') {
    await sql`DELETE FROM scripts WHERE id=${targetKey}`;
    return res.status(200).json({ success: true });
  }

  return res.status(400).json({ success: false });
}
